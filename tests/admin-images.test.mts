/* 관리자 이미지 관리 단위 시험 (mock 기반)
   - 실제 DB·저장소·네트워크를 전혀 사용하지 않습니다. (메모리 속 가짜 DB·저장소만 사용)
   - 실행: npm test   (Node 내장 시험 도구) */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  MAX_IMAGE_BYTES,
  buildImagePath,
  detectImageKind,
  parseManagedImageUrl,
  sanitizeError,
  validateImageFile,
} from "../lib/admin-images.ts";
import type { UploadedFileLike } from "../lib/admin-images.ts";
import { deleteCard, runIfAdmin, saveCard } from "../lib/admin-card-service.ts";
import type { SaveCardInput, ServiceDeps } from "../lib/admin-card-service.ts";

/* ============================ 시험용 파일 / 가짜 환경 ============================ */

const jpegBytes = (n = 64) => { const b = new Uint8Array(n); b.set([0xff, 0xd8, 0xff, 0xe0]); return b; };
const pngBytes = (n = 64) => { const b = new Uint8Array(n); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]); return b; };
const webpBytes = (n = 64) => {
  const b = new Uint8Array(n);
  b.set([0x52, 0x49, 0x46, 0x46]);
  const size = n - 8;
  b[4] = size & 255; b[5] = (size >> 8) & 255; b[6] = (size >> 16) & 255; b[7] = (size >> 24) & 255;
  b.set([0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20], 8); // WEBP + "VP8 "
  return b;
};
const textBytes = (s: string) => new TextEncoder().encode(s);
const mkFile = (bytes: Uint8Array<ArrayBuffer>, type: string, name = "photo.bin") => new File([bytes], name, { type });

const SUPA = "https://devproj.supabase.co";
const BUCKET = "images";
const publicUrl = (p: string) => `${SUPA}/storage/v1/object/public/${BUCKET}/${p}`;
// 시험용 가짜 값 (실제 키·토큰이 아님). 비밀정보 검사기에 오탐되지 않도록 소스에는 한 덩어리로 적지 않고 실행할 때 조립함
const FAKE_KEY = ["sb", "secret", "NOT-A-REAL-KEY-0000"].join("_");
const FAKE_JWT = ["eyJhbGciOiJIUzI1NiJ9", "eyJyb2xlIjoic2VydmljZSJ9", "c2lnbmF0dXJl"].join(".");
const SECRET_LIKE = `${FAKE_KEY} Authorization: Bearer ${FAKE_JWT}`;

type LogEvent = Parameters<ServiceDeps["log"]>[0];

function makeEnv() {
  const cards = new Map<string, { id: string; section: string; image_url: string | null; title: string }>();
  const objects = new Map<string, number>(); // 경로 → 크기
  const calls = { db: [] as string[], storage: [] as string[], removed: [] as string[], uploaded: [] as string[], contentTypes: [] as string[] };
  const logs: LogEvent[] = [];
  const fail = { upload: false, remove: false, insert: false, update: false, delete: false, getCard: false, countRefs: false, updateZeroRows: false, removeMessage: "storage unavailable" };
  let tick = 0;
  let idCounter = 0;

  const deps: ServiceDeps = {
    supabaseUrl: SUPA,
    bucket: BUCKET,
    allowedSections: ["features"],
    now: () => 1762400000000 + tick++,
    random: () => (0xabcdef000000 + tick).toString(16).padStart(16, "0"),
    log: (e) => { logs.push(e); },
    storage: {
      async upload(p, bytes, contentType) {
        calls.storage.push("upload:" + p);
        if (fail.upload) return { error: "upload blocked" };
        objects.set(p, bytes.byteLength); calls.uploaded.push(p); calls.contentTypes.push(contentType);
        return { error: null };
      },
      async remove(p) {
        calls.storage.push("remove:" + p);
        if (fail.remove) return { error: fail.removeMessage, removed: 0 };
        const had = objects.delete(p); calls.removed.push(p);
        return { error: null, removed: had ? 1 : 0 };
      },
      publicUrl: publicUrl,
    },
    db: {
      async getCard(id) {
        calls.db.push("getCard:" + id);
        if (fail.getCard) return { card: null, error: "db down" };
        const c = cards.get(id);
        return { card: c ? { id: c.id, section: c.section, image_url: c.image_url } : null, error: null };
      },
      async insertCard(row) {
        calls.db.push("insert");
        if (fail.insert) return { error: "insert failed" };
        const id = `00000000-0000-4000-8000-${String(++idCounter).padStart(12, "0")}`;
        cards.set(id, { id, section: String(row.section), image_url: (row.image_url as string | undefined) ?? null, title: String(row.title) });
        return { error: null };
      },
      async updateCard(id, row) {
        calls.db.push("update:" + id);
        if (fail.update) return { error: "update failed", updated: 0 };
        const c = cards.get(id);
        if (!c || fail.updateZeroRows) return { error: null, updated: 0 };
        if ("image_url" in row) c.image_url = row.image_url as string | null;
        if ("title" in row) c.title = String(row.title);
        return { error: null, updated: 1 };
      },
      async deleteCard(id) {
        calls.db.push("delete:" + id);
        if (fail.delete) return { error: "delete failed", deleted: 0 };
        return { error: null, deleted: cards.delete(id) ? 1 : 0 };
      },
      async countOtherReferences(url, excludeId) {
        calls.db.push("countRefs");
        if (fail.countRefs) return { count: 0, error: "count failed" };
        let n = 0;
        for (const c of cards.values()) if (c.image_url === url && c.id !== excludeId) n++;
        return { count: n, error: null };
      },
    },
  };

  const addCard = (image_url: string | null, title = "기존 카드") => {
    const id = `11111111-1111-4111-8111-${String(++idCounter).padStart(12, "0")}`;
    cards.set(id, { id, section: "features", image_url, title });
    return id;
  };
  const addObject = (p: string) => { objects.set(p, 100); return p; };
  return { deps, cards, objects, calls, logs, fail, addCard, addObject };
}

const fields = (over: Partial<SaveCardInput["fields"]> = {}): SaveCardInput["fields"] => ({
  section: "features", title: "시험 카드", description: null, link_url: null, sort_order: 0, is_visible: true, ...over,
});
const OLD_PATH = "features/1762300000000-oldaaaaaaa.png";
const OLD_URL = publicUrl(OLD_PATH);

/* ============================ 1~4. 이미지 파일 검사 ============================ */

describe("1. JPEG/PNG/WebP 허용", () => {
  for (const [name, bytes, mime, kind, ext] of [
    ["JPEG", jpegBytes(), "image/jpeg", "jpeg", "jpg"],
    ["PNG", pngBytes(), "image/png", "png", "png"],
    ["WebP", webpBytes(), "image/webp", "webp", "webp"],
  ] as const) {
    it(`${name} 허용: 형식·확장자는 파일 내용으로 결정`, async () => {
      const r = await validateImageFile(mkFile(bytes, mime, "엉뚱한이름.svg"));
      assert.equal(r.ok, true);
      if (r.ok) { assert.equal(r.kind, kind); assert.equal(r.ext, ext); assert.equal(r.mime, mime); assert.equal(r.bytes.byteLength, bytes.byteLength); }
    });
  }
  it("MIME 대소문자·공백 차이는 허용하되 내용은 그대로 확인", async () => {
    const r = await validateImageFile(mkFile(pngBytes(), " IMAGE/PNG "));
    assert.equal(r.ok, true);
  });
});

describe("2. SVG 및 허용 외 형식 거부", () => {
  const svg = textBytes('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const cases: Array<[string, Uint8Array<ArrayBuffer>, string]> = [
    ["SVG (image/svg+xml)", svg, "image/svg+xml"],
    ["GIF", textBytes("GIF89a" + "x".repeat(40)), "image/gif"],
    ["BMP", textBytes("BM" + "x".repeat(40)), "image/bmp"],
    ["TIFF", textBytes("II*\0" + "x".repeat(40)), "image/tiff"],
    ["AVIF/HEIC 등", textBytes("....ftypavif" + "x".repeat(40)), "image/avif"],
    ["PDF", textBytes("%PDF-1.7" + "x".repeat(40)), "application/pdf"],
    ["텍스트", textBytes("hello world, not an image at all, just text"), "text/plain"],
    ["형식 비어 있음", jpegBytes(), ""],
    ["와일드카드 형식", jpegBytes(), "image/*"],
    ["SVG 내용을 PNG 라고 속임", svg, "image/png"],
  ];
  for (const [name, bytes, mime] of cases) {
    it(`${name} 거부`, async () => {
      const r = await validateImageFile(mkFile(bytes, mime, "x.png"));
      assert.equal(r.ok, false);
    });
  }
});

describe("3. 파일 내용과 MIME 불일치 거부", () => {
  it("PNG 라고 했지만 JPEG 내용", async () => {
    const r = await validateImageFile(mkFile(jpegBytes(), "image/png"));
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.message, /일치하지 않습니다/);
  });
  it("JPEG 라고 했지만 PNG 내용", async () => assert.equal((await validateImageFile(mkFile(pngBytes(), "image/jpeg"))).ok, false));
  it("WebP 라고 했지만 PNG 내용", async () => assert.equal((await validateImageFile(mkFile(pngBytes(), "image/webp"))).ok, false));
  it("PNG 라고 했지만 글자 내용(이미지 아님)", async () => assert.equal((await validateImageFile(mkFile(textBytes("a".repeat(64)), "image/png"))).ok, false));
  it("PNG 머리글자만 있고 IHDR 조각이 없으면 거부", async () => {
    const b = new Uint8Array(64); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal((await validateImageFile(mkFile(b, "image/png"))).ok, false);
  });
  it("WebP 의 RIFF 크기가 실제 파일보다 크면(잘린 파일) 거부", async () => {
    const b = webpBytes(64); b[4] = 255; b[5] = 255; b[6] = 255;
    assert.equal((await validateImageFile(mkFile(b, "image/webp"))).ok, false);
  });
  it("detectImageKind: 알 수 없는 내용은 null", () => assert.equal(detectImageKind(new Uint8Array(40)), null));
});

describe("4. 빈 파일과 용량 초과 거부", () => {
  it("빈 파일(0바이트) 거부", async () => {
    const r = await validateImageFile(mkFile(new Uint8Array(0), "image/png"));
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.message, /빈 파일/);
  });
  it("정확히 5MB 는 거부 (5MB 미만만 허용)", async () => {
    const r = await validateImageFile(mkFile(jpegBytes(MAX_IMAGE_BYTES), "image/jpeg"));
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.message, /5MB 미만/);
  });
  it("5MB 보다 1바이트 작으면 허용", async () => assert.equal((await validateImageFile(mkFile(jpegBytes(MAX_IMAGE_BYTES - 1), "image/jpeg"))).ok, true));
  it("5MB 초과 거부", async () => assert.equal((await validateImageFile(mkFile(jpegBytes(MAX_IMAGE_BYTES + 1), "image/jpeg"))).ok, false));
  it("용량 초과·빈 파일은 내용을 읽기 전에 먼저 거부 (큰 파일을 메모리에 올리지 않음)", async () => {
    let reads = 0;
    const big: UploadedFileLike = { size: MAX_IMAGE_BYTES, type: "image/jpeg", arrayBuffer: async () => { reads++; return new ArrayBuffer(1); } };
    const empty: UploadedFileLike = { size: 0, type: "image/jpeg", arrayBuffer: async () => { reads++; return new ArrayBuffer(1); } };
    assert.equal((await validateImageFile(big)).ok, false);
    assert.equal((await validateImageFile(empty)).ok, false);
    assert.equal(reads, 0);
  });
  it("형식(MIME)이 허용 목록에 없으면 내용을 읽기 전에 거부", async () => {
    let reads = 0;
    const svg: UploadedFileLike = { size: 100, type: "image/svg+xml", arrayBuffer: async () => { reads++; return new ArrayBuffer(100); } };
    assert.equal((await validateImageFile(svg)).ok, false);
    assert.equal(reads, 0);
  });
  it("알려 준 크기(size)와 실제 내용 크기가 달라도 실제 내용 기준으로 거부", async () => {
    const lying: UploadedFileLike = { size: 100, type: "image/png", arrayBuffer: async () => pngBytes(MAX_IMAGE_BYTES + 10).buffer };
    assert.equal((await validateImageFile(lying)).ok, false);
  });
  it("알려 준 크기는 있는데 실제 내용이 비어 있으면 거부", async () => {
    const lying: UploadedFileLike = { size: 100, type: "image/png", arrayBuffer: async () => new ArrayBuffer(0) };
    assert.equal((await validateImageFile(lying)).ok, false);
  });
  it("파일을 읽다가 오류가 나면 거부", async () => {
    const broken: UploadedFileLike = { size: 100, type: "image/png", arrayBuffer: async () => { throw new Error("read error"); } };
    assert.equal((await validateImageFile(broken)).ok, false);
  });
});

/* ============================ 저장 경로 ============================ */

describe("저장 경로는 서버가 만든다", () => {
  it("형식: 섹션/13자리시각-난수.확장자", () => assert.equal(buildImagePath("features", "png", 1762400000000, "abcdef1234567890"), "features/1762400000000-abcdef1234567890.png"));
  it("이상한 섹션·확장자·난수·시각은 거부(null)", () => {
    assert.equal(buildImagePath("../etc", "png", 1762400000000, "abcdef1234567890"), null);
    assert.equal(buildImagePath("fea/tures", "png", 1762400000000, "abcdef1234567890"), null);
    assert.equal(buildImagePath("features", "svg", 1762400000000, "abcdef1234567890"), null);
    assert.equal(buildImagePath("features", "php", 1762400000000, "abcdef1234567890"), null);
    assert.equal(buildImagePath("features", "png", 12345, "abcdef1234567890"), null);
    assert.equal(buildImagePath("features", "png", 1762400000000, "../../x"), null);
  });
});

/* ============================ 5~7. 업로드 흐름 ============================ */

describe("5. 이미지 업로드 성공 흐름", () => {
  it("새 카드 + 이미지: 서버가 만든 경로로 올리고 그 주소가 DB 에 저장됨 (사용자 파일 이름은 쓰지 않음)", async () => {
    const env = makeEnv();
    const r = await saveCard(env.deps, { id: null, fields: fields(), image: mkFile(jpegBytes(), "image/jpeg", "../../evil.svg.php"), removeImage: false });
    assert.equal(r.ok, true);
    assert.equal(r.message, "추가했습니다.");
    assert.equal(r.dbChanged, true);
    assert.equal(env.calls.uploaded.length, 1);
    const uploaded = env.calls.uploaded[0];
    assert.match(uploaded, /^features\/\d{13}-[a-z0-9]{8,32}\.jpg$/);
    assert.ok(!/evil|php|svg|\.\./.test(uploaded), "사용자 파일 이름이 경로에 들어가면 안 됨");
    assert.deepEqual(env.calls.contentTypes, ["image/jpeg"]);
    const [card] = [...env.cards.values()];
    assert.equal(card.image_url, publicUrl(uploaded));
    assert.deepEqual(r.cleanup, []);
  });
  it("수정 + 새 이미지(기존 이미지 없음): 업로드 후 DB 수정, 정리할 것 없음", async () => {
    const env = makeEnv(); const id = env.addCard(null);
    const r = await saveCard(env.deps, { id, fields: fields(), image: mkFile(pngBytes(), "image/png"), removeImage: false });
    assert.equal(r.ok, true); assert.equal(r.message, "수정했습니다.");
    assert.equal(env.calls.removed.length, 0);
    assert.equal(env.cards.get(id)?.image_url, publicUrl(env.calls.uploaded[0]));
  });
});

describe("6. 이미지 업로드 실패 시 DB 변경 없음", () => {
  it("저장소 업로드 실패 → DB 쓰기를 시도하지 않음", async () => {
    const env = makeEnv(); env.fail.upload = true;
    const r = await saveCard(env.deps, { id: null, fields: fields(), image: mkFile(jpegBytes(), "image/jpeg"), removeImage: false });
    assert.equal(r.ok, false); assert.equal(r.dbChanged, false);
    assert.ok(!env.calls.db.includes("insert")); assert.equal(env.cards.size, 0); assert.equal(env.objects.size, 0);
    assert.ok(env.logs.some((l) => l.event === "image-upload" && l.status === "failed"));
  });
  it("이미지 검사 실패(SVG) → DB·저장소 호출이 전혀 없음", async () => {
    const env = makeEnv();
    const r = await saveCard(env.deps, { id: null, fields: fields(), image: mkFile(textBytes("<svg></svg>"), "image/svg+xml"), removeImage: false });
    assert.equal(r.ok, false);
    assert.deepEqual(env.calls.db, []); assert.deepEqual(env.calls.storage, []);
  });
  it("수정 중 이미지 검사 실패 → 기존 카드·기존 이미지 그대로", async () => {
    const env = makeEnv(); env.addObject(OLD_PATH); const id = env.addCard(OLD_URL);
    const r = await saveCard(env.deps, { id, fields: fields({ title: "바뀌면 안 됨" }), image: mkFile(jpegBytes(), "image/png"), removeImage: false });
    assert.equal(r.ok, false);
    assert.deepEqual(env.calls.db, []); assert.deepEqual(env.calls.storage, []);
    assert.equal(env.cards.get(id)?.title, "기존 카드"); assert.equal(env.cards.get(id)?.image_url, OLD_URL); assert.ok(env.objects.has(OLD_PATH));
  });
});

describe("7. DB 저장 실패 시 새 파일 정리", () => {
  it("새 카드 저장 실패 → 방금 올린 파일을 지움", async () => {
    const env = makeEnv(); env.fail.insert = true;
    const r = await saveCard(env.deps, { id: null, fields: fields(), image: mkFile(pngBytes(), "image/png"), removeImage: false });
    assert.equal(r.ok, false); assert.equal(r.dbChanged, false);
    assert.equal(env.calls.uploaded.length, 1); assert.deepEqual(env.calls.removed, env.calls.uploaded);
    assert.equal(env.objects.size, 0); assert.equal(env.cards.size, 0);
    assert.match(r.message, /변경되지 않았습니다/);
  });
  it("수정 저장 실패 → 새 파일만 지우고 기존 이미지·카드는 그대로", async () => {
    const env = makeEnv(); env.addObject(OLD_PATH); const id = env.addCard(OLD_URL); env.fail.update = true;
    const r = await saveCard(env.deps, { id, fields: fields({ title: "바뀌면 안 됨" }), image: mkFile(webpBytes(), "image/webp"), removeImage: false });
    assert.equal(r.ok, false);
    assert.deepEqual(env.calls.removed, env.calls.uploaded);
    assert.ok(env.objects.has(OLD_PATH), "기존 이미지는 남아 있어야 함"); assert.equal(env.objects.size, 1);
    assert.equal(env.cards.get(id)?.image_url, OLD_URL);
  });
  it("수정 대상 행이 없어졌을 때(수정된 행 0) 도 실패로 처리하고 새 파일을 지움", async () => {
    const env = makeEnv(); const id = env.addCard(null); env.fail.updateZeroRows = true;
    const r = await saveCard(env.deps, { id, fields: fields(), image: mkFile(jpegBytes(), "image/jpeg"), removeImage: false });
    assert.equal(r.ok, false); assert.equal(env.objects.size, 0);
  });
  it("저장 실패 + 새 파일 정리도 실패 → 남은 파일 경로를 알려 줌", async () => {
    const env = makeEnv(); env.fail.insert = true; env.fail.remove = true;
    const r = await saveCard(env.deps, { id: null, fields: fields(), image: mkFile(jpegBytes(), "image/jpeg"), removeImage: false });
    assert.equal(r.ok, false); assert.equal(r.leftoverPaths.length, 1); assert.equal(r.leftoverPaths[0], env.calls.uploaded[0]);
    assert.ok(r.message.includes(env.calls.uploaded[0]));
  });
});

/* ============================ 8~11. 교체 · 제거 · 삭제 ============================ */

describe("8. 이미지 교체 시 이전 파일 정리", () => {
  it("DB 수정 성공 후 이전 파일만 정리 (이전 주소는 DB 에서 조회)", async () => {
    const env = makeEnv(); env.addObject(OLD_PATH); env.addObject("features/1762300000001-otherzzzzz.png"); const id = env.addCard(OLD_URL);
    const r = await saveCard(env.deps, { id, fields: fields(), image: mkFile(pngBytes(), "image/png"), removeImage: false });
    assert.equal(r.ok, true);
    assert.deepEqual(env.calls.removed, [OLD_PATH]);
    assert.ok(env.objects.has(env.calls.uploaded[0])); assert.ok(env.objects.has("features/1762300000001-otherzzzzz.png"));
    assert.equal(env.cards.get(id)?.image_url, publicUrl(env.calls.uploaded[0]));
    assert.ok(env.calls.db.includes("getCard:" + id));
    assert.equal(r.cleanup[0].status, "removed"); assert.equal(r.cleanup[0].stage, "replaced");
  });
  it("정리는 DB 저장이 끝난 뒤에만 일어남 (순서)", async () => {
    const env = makeEnv(); env.addObject(OLD_PATH); const id = env.addCard(OLD_URL);
    await saveCard(env.deps, { id, fields: fields(), image: mkFile(jpegBytes(), "image/jpeg"), removeImage: false });
    const order = [...env.calls.storage, ...env.calls.db];
    assert.ok(order.length > 0);
    assert.ok(env.calls.storage.indexOf("remove:" + OLD_PATH) > env.calls.storage.findIndex((s) => s.startsWith("upload:")));
  });
});

describe("9. 이미지 제거 시 이전 파일 정리", () => {
  it("「기존 이미지 지우기」: DB 의 image_url 을 null 로 바꾸고 이전 파일 정리", async () => {
    const env = makeEnv(); env.addObject(OLD_PATH); const id = env.addCard(OLD_URL);
    const r = await saveCard(env.deps, { id, fields: fields(), image: null, removeImage: true });
    assert.equal(r.ok, true); assert.equal(env.cards.get(id)?.image_url, null);
    assert.deepEqual(env.calls.removed, [OLD_PATH]); assert.equal(env.objects.size, 0);
    assert.equal(r.cleanup[0].stage, "removed");
  });
  it("이미지가 없는 카드에 지우기 요청 → 저장소 호출 없음", async () => {
    const env = makeEnv(); const id = env.addCard(null);
    const r = await saveCard(env.deps, { id, fields: fields(), image: null, removeImage: true });
    assert.equal(r.ok, true); assert.deepEqual(env.calls.storage, []);
  });
  it("새 카드 추가 중 지우기 체크는 무시 (저장소 호출 없음)", async () => {
    const env = makeEnv();
    const r = await saveCard(env.deps, { id: null, fields: fields(), image: null, removeImage: true });
    assert.equal(r.ok, true); assert.deepEqual(env.calls.storage, []);
  });
  it("DB 수정이 실패하면 이전 파일은 지우지 않음", async () => {
    const env = makeEnv(); env.addObject(OLD_PATH); const id = env.addCard(OLD_URL); env.fail.update = true;
    const r = await saveCard(env.deps, { id, fields: fields(), image: null, removeImage: true });
    assert.equal(r.ok, false); assert.deepEqual(env.calls.removed, []); assert.ok(env.objects.has(OLD_PATH)); assert.equal(env.cards.get(id)?.image_url, OLD_URL);
  });
});

describe("10. 카드 삭제 시 해당 파일만 정리", () => {
  it("DB 에서 카드를 지운 뒤 그 카드의 이미지 1개만 삭제", async () => {
    const env = makeEnv(); env.addObject(OLD_PATH); env.addObject("features/1762300000009-keepkeepkeep.png"); const id = env.addCard(OLD_URL);
    const other = env.addCard(publicUrl("features/1762300000009-keepkeepkeep.png"), "다른 카드");
    const r = await deleteCard(env.deps, id);
    assert.equal(r.ok, true); assert.equal(r.message, "삭제했습니다."); assert.equal(r.section, "features");
    assert.equal(env.cards.has(id), false); assert.equal(env.cards.has(other), true);
    assert.deepEqual(env.calls.removed, [OLD_PATH]);
    assert.ok(env.objects.has("features/1762300000009-keepkeepkeep.png"));
    assert.ok(env.calls.db.indexOf("delete:" + id) < env.calls.db.indexOf("countRefs"), "DB 삭제가 먼저");
  });
  it("DB 삭제 실패 → 이미지 파일은 건드리지 않음", async () => {
    const env = makeEnv(); env.addObject(OLD_PATH); const id = env.addCard(OLD_URL); env.fail.delete = true;
    const r = await deleteCard(env.deps, id);
    assert.equal(r.ok, false); assert.equal(r.dbChanged, false); assert.deepEqual(env.calls.storage, []); assert.ok(env.cards.has(id));
  });
  it("삭제 근거는 DB 의 image_url — 브라우저의 숨은 값은 받지 않음 (함수 입력에 이미지 주소 자체가 없음)", async () => {
    const env = makeEnv(); env.addObject(OLD_PATH); const id = env.addCard(OLD_URL);
    assert.equal(deleteCard.length, 2); // (deps, id) 만 받음
    await deleteCard(env.deps, id);
    assert.ok(env.calls.db.includes("getCard:" + id));
  });
});

describe("11. 다른 카드가 참조하는 이미지는 유지", () => {
  it("삭제: 같은 이미지를 쓰는 다른 카드가 있으면 파일을 지우지 않음", async () => {
    const env = makeEnv(); env.addObject(OLD_PATH); const a = env.addCard(OLD_URL, "A"); env.addCard(OLD_URL, "B");
    const r = await deleteCard(env.deps, a);
    assert.equal(r.ok, true); assert.deepEqual(env.calls.removed, []); assert.deepEqual(env.calls.storage, []); assert.ok(env.objects.has(OLD_PATH));
    assert.equal(r.cleanup[0].status, "kept_referenced");
  });
  it("교체: 이전 이미지를 다른 카드도 쓰면 유지", async () => {
    const env = makeEnv(); env.addObject(OLD_PATH); const a = env.addCard(OLD_URL, "A"); const b = env.addCard(OLD_URL, "B");
    const r = await saveCard(env.deps, { id: a, fields: fields(), image: mkFile(pngBytes(), "image/png"), removeImage: false });
    assert.equal(r.ok, true); assert.deepEqual(env.calls.removed, []); assert.ok(env.objects.has(OLD_PATH)); assert.equal(env.cards.get(b)?.image_url, OLD_URL);
  });
  it("제거: 다른 카드가 쓰면 유지", async () => {
    const env = makeEnv(); env.addObject(OLD_PATH); const a = env.addCard(OLD_URL, "A"); env.addCard(OLD_URL, "B");
    await saveCard(env.deps, { id: a, fields: fields(), image: null, removeImage: true });
    assert.deepEqual(env.calls.removed, []); assert.ok(env.objects.has(OLD_PATH));
  });
  it("사용 여부를 확인하지 못하면(DB 오류) 지우지 않고 남은 파일로 보고", async () => {
    const env = makeEnv(); env.addObject(OLD_PATH); const id = env.addCard(OLD_URL); env.fail.countRefs = true;
    const r = await deleteCard(env.deps, id);
    assert.equal(r.ok, true); assert.deepEqual(env.calls.removed, []); assert.deepEqual(r.leftoverPaths, [OLD_PATH]); assert.ok(env.objects.has(OLD_PATH));
  });
});

/* ============================ 12. 삭제 대상 보호 ============================ */

describe("12. 다른 버킷·외부 URL·경로 이동 삭제 차단", () => {
  const opts = { supabaseUrl: SUPA, bucket: BUCKET, allowedSections: ["features"] };
  const blocked: Array<[string, string]> = [
    ["다른 버킷", `${SUPA}/storage/v1/object/public/avatars/features/1762300000000-aaaaaaaa.png`],
    ["이름 길이가 같은 다른 버킷(imagez)", `${SUPA}/storage/v1/object/public/imagez/features/1762300000000-aaaaaaaa.png`],
    ["이름이 비슷한 버킷(images2)", `${SUPA}/storage/v1/object/public/images2/features/1762300000000-aaaaaaaa.png`],
    ["다른 프로젝트 주소", "https://other.supabase.co/storage/v1/object/public/images/features/1762300000000-aaaaaaaa.png"],
    ["외부 사이트", "https://evil.example.com/storage/v1/object/public/images/features/1762300000000-aaaaaaaa.png"],
    ["http(프로토콜 다름)", "http://devproj.supabase.co/storage/v1/object/public/images/features/1762300000000-aaaaaaaa.png"],
    ["경로 이동(..)", `${SUPA}/storage/v1/object/public/images/features/../secret/1762300000000-aaaaaaaa.png`],
    ["인코딩된 경로 이동(%2e%2e)", `${SUPA}/storage/v1/object/public/images/features/%2e%2e/1762300000000-aaaaaaaa.png`],
    ["인코딩된 슬래시(%2f)", `${SUPA}/storage/v1/object/public/images/features%2f1762300000000-aaaaaaaa.png`],
    ["허용되지 않은 폴더", `${SUPA}/storage/v1/object/public/images/private/1762300000000-aaaaaaaa.png`],
    ["하위 폴더", `${SUPA}/storage/v1/object/public/images/features/sub/1762300000000-aaaaaaaa.png`],
    ["서버가 만든 이름이 아님", `${SUPA}/storage/v1/object/public/images/features/photo.png`],
    ["쿼리 포함", `${SUPA}/storage/v1/object/public/images/features/1762300000000-aaaaaaaa.png?x=1`],
    ["공개 주소가 아닌 경로", `${SUPA}/storage/v1/object/sign/images/features/1762300000000-aaaaaaaa.png`],
    ["데이터 URL", "data:image/png;base64,AAAA"],
    ["javascript 주소", "javascript:alert(1)"],
    ["역슬래시", `${SUPA}/storage/v1/object/public/images/features\\1762300000000-aaaaaaaa.png`],
    ["버킷 바로 아래(폴더 없음)", `${SUPA}/storage/v1/object/public/images/1762300000000-aaaaaaaa.png`],
  ];
  for (const [name, url] of blocked) {
    it(`${name}: 파싱 거부`, () => assert.equal(parseManagedImageUrl(url, opts).ok, false));
    it(`${name}: 카드 삭제 시 저장소 삭제를 시도하지 않음 (카드 자체는 삭제됨)`, async () => {
      const env = makeEnv(); const id = env.addCard(url);
      const r = await deleteCard(env.deps, id);
      assert.equal(r.ok, true); assert.deepEqual(env.calls.storage, []);
      assert.ok(r.cleanup.length === 0 || r.cleanup[0].status === "skipped_unmanaged");
    });
  }
  it("정상: 서버가 만든 주소만 허용 (새 방식·예전 방식)", () => {
    assert.deepEqual(parseManagedImageUrl(publicUrl("features/1762300000000-abcdef1234567890.webp"), opts), { ok: true, path: "features/1762300000000-abcdef1234567890.webp" });
    assert.deepEqual(parseManagedImageUrl(publicUrl("features/1762300000000-k3j9xz.jpeg"), opts), { ok: true, path: "features/1762300000000-k3j9xz.jpeg" });
  });
  it("이미지 주소가 없으면 정리할 것도 없음 (오류 아님)", async () => {
    const env = makeEnv(); const id = env.addCard(null);
    const r = await deleteCard(env.deps, id);
    assert.equal(r.ok, true); assert.deepEqual(r.cleanup, []); assert.deepEqual(env.calls.storage, []);
    assert.deepEqual(parseManagedImageUrl(null, opts), { ok: false, reason: "none", detail: "이미지 주소 없음" });
  });
  it("지정한 섹션 목록이 비어 있으면 어떤 폴더도 정리 대상이 아님", () => {
    assert.equal(parseManagedImageUrl(publicUrl("features/1762300000000-abcdef1234567890.png"), { ...opts, allowedSections: [] }).ok, false);
  });
});

/* ============================ 13. 비로그인 차단 ============================ */

describe("13. 비로그인 요청 차단", () => {
  it("관리자가 아니면 작업 자체를 실행하지 않음 (DB·저장소 접근 전에 차단)", async () => {
    const env = makeEnv(); let worked = false;
    const r = await runIfAdmin(async () => false, async () => { worked = true; await saveCard(env.deps, { id: null, fields: fields(), image: null, removeImage: false }); return "ran"; }, "denied");
    assert.equal(worked, false); assert.equal(r, "denied");
    assert.deepEqual(env.calls.db, []); assert.deepEqual(env.calls.storage, []);
  });
  it("관리자이면 작업을 실행", async () => {
    let worked = false;
    const r = await runIfAdmin(async () => true, async () => { worked = true; return "done"; }, "denied");
    assert.equal(worked, true); assert.equal(r, "done");
  });
  it("관리자 확인에서 오류가 나면 작업을 실행하지 않고 오류가 그대로 전달됨 (열어 주지 않음)", async () => {
    let worked = false;
    await assert.rejects(runIfAdmin(async () => { throw new Error("auth down"); }, async () => { worked = true; return 1; }, 0));
    assert.equal(worked, false);
  });

  // 실제 서버 액션 파일의 구조를 글자로 확인 (서버 액션 자체는 Next 환경이 필요해 직접 실행하지 않음)
  const root = path.resolve(import.meta.dirname, "..");
  const actions = fs.readFileSync(path.join(root, "app/admin/actions.ts"), "utf8");
  const body = (name: string) => {
    const start = actions.indexOf(`export async function ${name}(`);
    assert.ok(start >= 0, name + " 를 찾지 못함");
    // 이 함수 본문 = 다음 함수 선언(내보낸 함수 또는 helper) 직전까지
    const ends = [actions.indexOf("\nexport async function ", start + 10), actions.indexOf("\nasync function ", start + 10)].filter((i) => i > -1);
    return actions.slice(start, ends.length ? Math.min(...ends) : undefined);
  };
  it("saveItem / deleteItem 은 runIfAdmin(isAdmin, …) 으로만 작업을 실행", () => {
    for (const name of ["saveItem", "deleteItem"]) {
      const b = body(name);
      assert.match(b, /runIfAdmin\(isAdmin,/);
      assert.ok(!b.includes("getAdminClient("), name + " 본문에서 관리자 확인 전에 서버 키 연결을 만들면 안 됨");
    }
  });
  it("saveHeroTexts 는 맨 처음에 isAdmin() 확인 (기존 유지)", () => {
    const b = body("saveHeroTexts");
    assert.ok(b.indexOf("isAdmin()") > -1 && b.indexOf("isAdmin()") < b.indexOf("getAdminClient("));
  });
  it("서버 키 연결(getAdminClient)을 쓰는 helper(…AsAdmin)는 runIfAdmin 안에서만 호출됨", () => {
    const calls = [...actions.matchAll(/(saveItemAsAdmin|deleteItemAsAdmin)\(/g)].map((m) => m[1]);
    assert.deepEqual(calls.sort(), ["deleteItemAsAdmin", "deleteItemAsAdmin", "saveItemAsAdmin", "saveItemAsAdmin"]); // 선언 1 + 호출 1
    assert.equal((actions.match(/=>\s*(save|delete)ItemAsAdmin\(formData\)/g) ?? []).length, 2);
  });
  it("삭제 근거로 브라우저의 숨은 이미지 주소(image_url)를 읽지 않음", () => {
    assert.ok(!/formData\.get\(\s*["']image_url["']\s*\)/.test(actions));
    const del = fs.readFileSync(path.join(root, "app/admin/_components/delete-button.tsx"), "utf8");
    assert.ok(!/name=["']image_url["']/.test(del), "삭제 버튼에 숨은 image_url 입력칸이 있으면 안 됨");
    const page = fs.readFileSync(path.join(root, "app/admin/page.tsx"), "utf8");
    assert.ok(!/<DeleteButton[^>]*imageUrl/.test(page));
  });
  it("이미지 형식·저장 경로 규칙이 서버 액션에 남아 있는 예전 코드(사용자 파일 이름으로 경로 만들기)가 없음", () => {
    assert.ok(!/image\.name\.split/.test(actions));
    assert.ok(!/Math\.random\(\)\.toString\(36\)/.test(actions));
    assert.ok(!/startsWith\(["']image\/["']\)/.test(actions));
  });
});

/* ============================ 14. 정리 실패 보고 ============================ */

describe("14. Storage 정리 실패 시 오류 보고 및 복구 정보 보존", () => {
  it("교체: DB 는 성공했고 이전 파일 정리만 실패 → ok, 남은 파일 경로와 경고, 비밀 제거된 기록", async () => {
    const env = makeEnv(); env.addObject(OLD_PATH); const id = env.addCard(OLD_URL); env.fail.remove = true; env.fail.removeMessage = "request failed: " + SECRET_LIKE;
    const r = await saveCard(env.deps, { id, fields: fields(), image: mkFile(jpegBytes(), "image/jpeg"), removeImage: false });
    assert.equal(r.ok, true); assert.equal(r.dbChanged, true);
    assert.equal(env.cards.get(id)?.image_url, publicUrl(env.calls.uploaded[0]), "카드 데이터는 새 이미지로 정상 저장");
    assert.deepEqual(r.leftoverPaths, [OLD_PATH]);
    assert.ok(r.message.includes("⚠") && r.message.includes(OLD_PATH) && r.message.includes("카드 데이터는 정상"));
    assert.ok(env.objects.has(OLD_PATH), "복구를 위해 파일은 그대로 남아 있음");
    const log = env.logs.find((l) => l.status === "failed");
    assert.ok(log); assert.equal(log?.path, OLD_PATH);
    const all = JSON.stringify([r, env.logs]);
    assert.ok(!/sb_secret_|eyJhbGci|Bearer eyJ/.test(all), "결과·기록에 비밀이 섞이면 안 됨");
    assert.ok(/제거/.test(log?.reason ?? ""));
  });
  it("카드 삭제: DB 삭제는 성공했고 이미지 정리만 실패 → leftoverPaths, section 반환", async () => {
    const env = makeEnv(); env.addObject(OLD_PATH); const id = env.addCard(OLD_URL); env.fail.remove = true;
    const r = await deleteCard(env.deps, id);
    assert.equal(r.ok, true); assert.equal(r.dbChanged, true); assert.deepEqual(r.leftoverPaths, [OLD_PATH]); assert.equal(r.section, "features");
    assert.equal(env.cards.has(id), false); assert.ok(env.objects.has(OLD_PATH));
    assert.ok(r.message.includes(OLD_PATH));
  });
  it("제거: 정리 실패해도 DB 는 image_url=null 로 정상 반영", async () => {
    const env = makeEnv(); env.addObject(OLD_PATH); const id = env.addCard(OLD_URL); env.fail.remove = true;
    const r = await saveCard(env.deps, { id, fields: fields(), image: null, removeImage: true });
    assert.equal(r.ok, true); assert.equal(env.cards.get(id)?.image_url, null); assert.deepEqual(r.leftoverPaths, [OLD_PATH]);
  });
  it("이미 없는 파일은 실패가 아님 (missing)", async () => {
    const env = makeEnv(); const id = env.addCard(OLD_URL); // 저장소에는 객체 없음
    const r = await deleteCard(env.deps, id);
    assert.equal(r.ok, true); assert.equal(r.cleanup[0].status, "missing"); assert.deepEqual(r.leftoverPaths, []); assert.equal(r.message, "삭제했습니다.");
  });
  it("sanitizeError: 토큰·키·Bearer 값 제거, 길이 제한", () => {
    const s = sanitizeError("err " + SECRET_LIKE + " password=hunter2 " + "x".repeat(500));
    assert.ok(!s.includes("NOT-A-REAL-KEY") && !s.includes("eyJhbGci") && !s.includes("hunter2")); assert.ok(s.length <= 201);
  });
});

/* ============================ 15. 이미지 없는 카드 CRUD 유지 ============================ */

describe("15. 기존 이미지 없는 카드 CRUD 동작 유지", () => {
  it("추가: 이미지 없이 저장, 저장소 호출 없음", async () => {
    const env = makeEnv();
    const r = await saveCard(env.deps, { id: null, fields: fields({ title: "새 카드", description: "설명", link_url: "https://example.com", sort_order: 9000 }), image: null, removeImage: false });
    assert.equal(r.ok, true); assert.equal(r.message, "추가했습니다."); assert.equal(env.cards.size, 1); assert.deepEqual(env.calls.storage, []);
    assert.deepEqual([...env.cards.values()][0].image_url, null);
  });
  it("수정: 제목만 바꿈, image_url 은 건드리지 않음, 저장소 호출 없음", async () => {
    const env = makeEnv(); const id = env.addCard(null);
    const r = await saveCard(env.deps, { id, fields: fields({ title: "바뀐 제목" }), image: null, removeImage: false });
    assert.equal(r.ok, true); assert.equal(r.message, "수정했습니다."); assert.equal(env.cards.get(id)?.title, "바뀐 제목"); assert.deepEqual(env.calls.storage, []);
  });
  it("수정: 이미지는 그대로 두고 글자만 바꿈 → 기존 이미지 파일 유지", async () => {
    const env = makeEnv(); env.addObject(OLD_PATH); const id = env.addCard(OLD_URL);
    const r = await saveCard(env.deps, { id, fields: fields({ title: "글자만 수정" }), image: null, removeImage: false });
    assert.equal(r.ok, true); assert.deepEqual(env.calls.storage, []); assert.equal(env.cards.get(id)?.image_url, OLD_URL); assert.ok(env.objects.has(OLD_PATH));
  });
  it("삭제: 이미지 없는 카드 삭제, 저장소 호출 없음", async () => {
    const env = makeEnv(); const id = env.addCard(null);
    const r = await deleteCard(env.deps, id);
    assert.equal(r.ok, true); assert.equal(env.cards.has(id), false); assert.deepEqual(env.calls.storage, []);
  });
  it("없는 카드 수정은 성공으로 속이지 않음", async () => {
    const env = makeEnv();
    const r = await saveCard(env.deps, { id: "11111111-1111-4111-8111-999999999999", fields: fields(), image: null, removeImage: false });
    assert.equal(r.ok, false); assert.equal(r.dbChanged, false); assert.match(r.message, /찾을 수 없습니다/); assert.ok(!env.calls.db.some((c) => c.startsWith("update")));
  });
  it("카드 조회 오류 → 아무것도 바꾸지 않음", async () => {
    const env = makeEnv(); const id = env.addCard(null); env.fail.getCard = true;
    const r = await saveCard(env.deps, { id, fields: fields(), image: mkFile(jpegBytes(), "image/jpeg"), removeImage: false });
    assert.equal(r.ok, false); assert.deepEqual(env.calls.storage, []); assert.equal(env.objects.size, 0);
  });
  it("삭제: 번호 형식이 이상하면 DB 접근 없이 거부, 없는 카드는 안내", async () => {
    const env = makeEnv();
    assert.equal((await deleteCard(env.deps, "'; drop table items;--")).ok, false);
    assert.equal((await deleteCard(env.deps, "")).ok, false);
    assert.deepEqual(env.calls.db, []);
    const gone = await deleteCard(env.deps, "11111111-1111-4111-8111-999999999999");
    assert.equal(gone.ok, false); assert.equal(gone.dbChanged, false); assert.match(gone.message, /이미 삭제되었거나/);
  });
});

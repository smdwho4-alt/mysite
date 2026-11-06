/* 관리자 이미지 업로드의 「검증」과 「저장 경로」 규칙 (순수 함수 — 네트워크·DB 를 쓰지 않아 단위 시험이 가능)
   - 허용 형식: JPEG, PNG, WebP 만 (SVG 등 다른 형식은 모두 거부)
   - 파일 이름이나 브라우저가 알려 준 형식(MIME)만 믿지 않고, 파일의 실제 내용(앞부분)을 확인합니다.
   - 저장 경로는 서버가 만듭니다. 사용자가 올린 파일 이름은 경로에 쓰지 않습니다.
   - 삭제는 「서버가 만든 파일」의 정확한 주소만 허용합니다. (외부 주소, 다른 버킷, 경로 이동 문자열은 거부)
   ※ 이 파일은 시험(node:test)에서 직접 불러오므로 '@/' 경로 별칭을 쓰지 않습니다. */

/** 5MB '미만'만 허용 (5MB 와 같거나 크면 거부) */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type ImageKind = "jpeg" | "png" | "webp";

const KIND_INFO: Record<ImageKind, { mime: string; ext: string }> = {
  jpeg: { mime: "image/jpeg", ext: "jpg" },
  png: { mime: "image/png", ext: "png" },
  webp: { mime: "image/webp", ext: "webp" },
};

const MIME_TO_KIND: Record<string, ImageKind> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

export const IMAGE_FORMAT_MESSAGE = "JPEG, PNG, WebP 형식의 이미지만 올릴 수 있습니다.";

export type ImageCheck =
  | { ok: true; kind: ImageKind; mime: string; ext: string; bytes: Uint8Array }
  | { ok: false; message: string };

/** 브라우저의 File 처럼 생긴 것 (시험에서는 가짜 파일을 넘길 수 있음) */
export type UploadedFileLike = { size: number; type: string; arrayBuffer(): Promise<ArrayBuffer> };

function ascii(bytes: Uint8Array, from: number, to: number) {
  let s = "";
  for (let i = from; i < to && i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

/** 파일 앞부분(매직 바이트)으로 실제 형식을 판별. 알 수 없으면 null */
export function detectImageKind(bytes: Uint8Array): ImageKind | null {
  // JPEG: FF D8 FF
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A + 첫 조각이 IHDR
  const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 24 && pngSig.every((b, i) => bytes[i] === b) && ascii(bytes, 12, 16) === "IHDR") return "png";

  // WebP: "RIFF" + 크기 + "WEBP" + VP8 / VP8L / VP8X 조각
  if (bytes.length >= 16 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    const chunk = ascii(bytes, 12, 16);
    const riffSize = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] * 2 ** 24);
    if (["VP8 ", "VP8L", "VP8X"].includes(chunk) && riffSize + 8 <= bytes.length) return "webp";
  }
  return null;
}

/**
 * 폼에서 받은 「image」 값에서 실제로 선택된 파일만 골라냅니다. (선택하지 않았으면 null)
 * 브라우저는 파일을 고르지 않아도 「크기 0의 빈 파일」을 함께 보내며, 서버로 전달되는 과정에서
 * 파일 이름이 비어 있지 않은 값(예: "undefined")으로 바뀔 수 있습니다.
 * 따라서 이름이 아니라 「크기가 0보다 큰가」로만 판단합니다. (크기 0 = 선택 안 함)
 */
export function pickUploadedFile(entry: unknown): UploadedFileLike | null {
  if (typeof entry !== "object" || entry === null) return null; // 글자("")나 없음
  const f = entry as { size?: unknown; type?: unknown; arrayBuffer?: unknown };
  if (typeof f.size !== "number" || typeof f.arrayBuffer !== "function") return null;
  if (f.size <= 0) return null;
  return entry as UploadedFileLike;
}

/** 업로드된 파일 검사. 하나라도 어긋나면 이유를 돌려주고 끝냅니다 (이 시점에는 DB·저장소에 아무것도 하지 않음). */
export async function validateImageFile(file: UploadedFileLike): Promise<ImageCheck> {
  if (!file || typeof file.size !== "number" || file.size === 0) {
    return { ok: false, message: "빈 파일은 올릴 수 없습니다." };
  }
  if (file.size >= MAX_IMAGE_BYTES) {
    return { ok: false, message: "이미지는 5MB 미만만 올릴 수 있습니다." };
  }

  // 브라우저가 알려 준 형식은 1차 확인일 뿐 (속일 수 있음)
  const declared = MIME_TO_KIND[String(file.type ?? "").toLowerCase().trim()];
  if (!declared) return { ok: false, message: IMAGE_FORMAT_MESSAGE };

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { ok: false, message: "이미지 파일을 읽지 못했습니다." };
  }
  // 파일이 알려 준 크기(size)와 실제 내용의 크기가 다를 수 있으므로 실제 내용 기준으로 다시 확인
  if (bytes.byteLength === 0) return { ok: false, message: "빈 파일은 올릴 수 없습니다." };
  if (bytes.byteLength >= MAX_IMAGE_BYTES) return { ok: false, message: "이미지는 5MB 미만만 올릴 수 있습니다." };

  const actual = detectImageKind(bytes);
  if (!actual) return { ok: false, message: "이미지 파일이 아니거나 손상된 파일입니다." };
  if (actual !== declared) return { ok: false, message: "파일 내용과 형식이 일치하지 않습니다." };

  const info = KIND_INFO[actual];
  return { ok: true, kind: actual, mime: info.mime, ext: info.ext, bytes };
}

/* ---------- 저장 경로 (서버가 생성) ---------- */

const SECTION_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const RANDOM_RE = /^[a-z0-9]{8,32}$/;

/** `<섹션>/<시각>-<난수>.<확장자>` — 파일 이름은 사용자 입력을 전혀 쓰지 않음. 값이 이상하면 null */
export function buildImagePath(section: string, ext: string, now: number, random: string): string | null {
  if (!SECTION_RE.test(section)) return null;
  if (!["jpg", "png", "webp"].includes(ext)) return null;
  if (!Number.isInteger(now) || String(now).length !== 13) return null;
  if (!RANDOM_RE.test(random)) return null;
  return `${section}/${now}-${random}.${ext}`;
}

/* ---------- 삭제 대상 확인 ---------- */

/** 서버가 만든 파일 이름 형태 (예전 방식 `시각-난수6자.확장자` 도 허용) */
const MANAGED_FILE_RE = /^\d{13}-[a-z0-9]{6,32}\.[a-z0-9]{2,5}$/;

export type ManagedImage = { ok: true; path: string } | { ok: false; reason: "none" | "unmanaged"; detail: string };

/**
 * 카드의 image_url 이 「이 프로젝트의 지정 버킷 안, 허용된 섹션 폴더의, 서버가 만든 파일」인지 확인하고 파일 경로를 돌려줍니다.
 * 외부 주소 / 다른 프로젝트 / 다른 버킷 / 하위 폴더 / 경로 이동(..) / 인코딩된 문자 / 쿼리 / 이름 규칙 불일치는 모두 거부합니다.
 */
export function parseManagedImageUrl(
  imageUrl: string | null | undefined,
  opts: { supabaseUrl: string; bucket: string; allowedSections: readonly string[] },
): ManagedImage {
  if (!imageUrl) return { ok: false, reason: "none", detail: "이미지 주소 없음" };
  const bad = (detail: string): ManagedImage => ({ ok: false, reason: "unmanaged", detail });

  if (/\.\.|%2e|%2f|%5c|%00|\\/i.test(imageUrl)) return bad("경로 이동·인코딩 문자 포함");

  let url: URL;
  let expected: URL;
  try {
    url = new URL(imageUrl);
    expected = new URL(opts.supabaseUrl);
  } catch {
    return bad("주소 형식 오류");
  }
  if (url.origin !== expected.origin) return bad("이 프로젝트의 저장소 주소가 아님");
  if (url.username || url.password || url.search || url.hash) return bad("쿼리·인증 정보 포함");

  const prefix = `/storage/v1/object/public/${opts.bucket}/`;
  if (!url.pathname.startsWith(prefix)) return bad("지정한 버킷이 아님");

  const rest = url.pathname.slice(prefix.length);
  const parts = rest.split("/");
  if (parts.length !== 2) return bad("하위 폴더 구조가 다름");
  const [section, file] = parts;
  if (!opts.allowedSections.includes(section) || !SECTION_RE.test(section)) return bad("허용된 폴더가 아님");
  if (!MANAGED_FILE_RE.test(file)) return bad("서버가 만든 파일 이름이 아님");

  return { ok: true, path: `${section}/${file}` };
}

/* ---------- 오류 문구 정리 (기록·화면에 비밀이 섞이지 않게) ---------- */

export function sanitizeError(message: unknown): string {
  let s = String(message ?? "").replace(/\s+/g, " ").trim();
  s = s
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g, "[토큰 제거]")
    .replace(/sb_(secret|publishable)_[A-Za-z0-9_-]+/gi, "[키 제거]")
    .replace(/(bearer|apikey|authorization)\s*[:=]?\s*\S+/gi, "$1 [제거]")
    .replace(/(password|secret|token)\s*[:=]\s*\S+/gi, "$1=[제거]");
  return s.length > 200 ? s.slice(0, 200) + "…" : s;
}

/* 게시판(공지사항 · 주민자치회 소식) 단위 시험 (mock 기반)
   - 실제 DB·저장소·네트워크를 전혀 사용하지 않습니다. (메모리 속 가짜 DB 만 사용)
   - 실행: npm test   (Node 내장 시험 도구) */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  BODY_MAX_CHARS,
  BOARD_INFO,
  LINK_MAX_CHARS,
  MAX_PAGE,
  PAGE_SIZE,
  SEARCH_MAX_CHARS,
  TITLE_MAX_CHARS,
  boardHref,
  formatPostDate,
  isBoardCategory,
  isSafeLink,
  isUuid,
  isValidDateString,
  normalizeSearchQuery,
  pageCount,
  paginationWindow,
  parsePage,
  safeLinkHref,
  todayInSeoul,
  validatePostInput,
} from "../lib/board-shared.ts";
import type { RawPostInput } from "../lib/board-shared.ts";
import { deletePost, describeDbError, savePost } from "../lib/admin-post-service.ts";
import type { PostDb, PostServiceDeps } from "../lib/admin-post-service.ts";
import { runIfAdmin } from "../lib/admin-card-service.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(rel);
  }
  return out;
}

const TODAY = "2026-11-06";
const ID = "11111111-1111-4111-8111-111111111111";
const raw = (o: Partial<RawPostInput> = {}): RawPostInput => ({
  category: "notice",
  title: "가을 정기 모임 안내",
  body: "본문입니다.",
  link_url: "",
  is_pinned: false,
  is_visible: true,
  published_at: "2026-11-01",
  ...o,
});

/* ============================ 1. 쪽(페이지) · 검색어 ============================ */

describe("1. 쪽 번호와 쪽 수", () => {
  const cases: Array<[string, string | string[] | undefined, number]> = [
    ["없음 → 1", undefined, 1],
    ["빈 글자 → 1", "", 1],
    ["3 → 3", "3", 3],
    ["0 → 1", "0", 1],
    ["-5 → 1", "-5", 1],
    ["1.5 → 1", "1.5", 1],
    ["abc → 1", "abc", 1],
    ["3abc → 1", "3abc", 1],
    ["공백 포함 ' 2' → 1", " 2", 1],
    ["아주 큰 수(7자리) → 1", "1234567", 1],
    ["상한 초과(999999) → 상한", "999999", MAX_PAGE],
    ["배열이면 첫 값", ["4", "9"], 4],
    ["지수 표기 1e3 → 1", "1e3", 1],
    ["0x10 → 1", "0x10", 1],
  ];
  for (const [name, input, expected] of cases) it(name, () => assert.equal(parsePage(input), expected));

  it("pageCount: 0건도 1쪽, 10건=1쪽, 11건=2쪽, 이상한 값도 1쪽", () => {
    assert.equal(pageCount(0), 1);
    assert.equal(pageCount(10), 1);
    assert.equal(pageCount(11), 2);
    assert.equal(pageCount(95), 10);
    assert.equal(pageCount(-3), 1);
    assert.equal(pageCount(Number.NaN), 1);
  });
  it("paginationWindow: 가운데·처음·끝·적은 쪽", () => {
    assert.deepEqual(paginationWindow(7, 20), [5, 6, 7, 8, 9]);
    assert.deepEqual(paginationWindow(1, 20), [1, 2, 3, 4, 5]);
    assert.deepEqual(paginationWindow(20, 20), [16, 17, 18, 19, 20]);
    assert.deepEqual(paginationWindow(2, 3), [1, 2, 3]);
    assert.deepEqual(paginationWindow(1, 1), [1]);
  });
  it("한 쪽 크기는 10", () => assert.equal(PAGE_SIZE, 10));
});

describe("2. 검색어 정리 (데이터베이스 검색 조건에 끼어들 수 있는 특수문자 제거)", () => {
  const ALLOWED = /^[\p{L}\p{N}\p{M} -]*$/u;
  it("일반 한글·영문·숫자 검색어는 그대로", () => {
    assert.equal(normalizeSearchQuery("가을 모임"), "가을 모임");
    assert.equal(normalizeSearchQuery("AI 강좌 1기"), "AI 강좌 1기");
    assert.equal(normalizeSearchQuery("원데이-클래스"), "원데이-클래스");
  });
  it("앞뒤 공백 제거, 연속 공백은 하나로", () => assert.equal(normalizeSearchQuery("  가을    모임  "), "가을 모임"));
  it("없거나 이상한 값은 빈 글자", () => {
    assert.equal(normalizeSearchQuery(undefined), "");
    assert.equal(normalizeSearchQuery(null), "");
    assert.equal(normalizeSearchQuery(""), "");
    assert.equal(normalizeSearchQuery("   "), "");
    assert.equal(normalizeSearchQuery(["가을", "겨울"]), "가을");
  });
  const attacks = [
    "a,b",
    "x%",
    "100%_",
    "title.eq.1),or(id.neq.0",
    'a"b',
    "a\\b",
    "it's",
    "a(b)c",
    "*",
    "'; drop table posts; --",
    "<script>alert(1)</script>",
    "a\nb\tc",
    "a\u0000b",
    "{}[]<>|^~`$#@!&=+;:/?.",
  ];
  for (const a of attacks) {
    it(`특수문자 제거: ${JSON.stringify(a)}`, () => {
      const out = normalizeSearchQuery(a);
      assert.match(out, ALLOWED, `정리 결과에 허용되지 않은 글자: ${JSON.stringify(out)}`);
      assert.ok(!/[,%_"'\\()*<>]/.test(out));
    });
  }
  it("정리 결과에서 콤마·괄호가 사라져 조건 문자열을 끊을 수 없음", () => {
    assert.equal(normalizeSearchQuery("title.eq.1),or(id.neq.0"), "title eq 1 or id neq 0");
  });
  it(`최대 ${SEARCH_MAX_CHARS}글자로 자름 (글자 단위)`, () => {
    assert.equal(Array.from(normalizeSearchQuery("가".repeat(500))).length, SEARCH_MAX_CHARS);
  });
  it("이모지 같은 특수 글자는 제거", () => assert.equal(normalizeSearchQuery("공지😀모임"), "공지 모임"));
});

describe("3. 주소 만들기 / 날짜 / 번호 형식", () => {
  it("boardHref: 1쪽·빈 검색어는 생략, 값 인코딩", () => {
    assert.equal(boardHref("/notice"), "/notice");
    assert.equal(boardHref("/notice", { page: 1 }), "/notice");
    assert.equal(boardHref("/notice", { page: 3 }), "/notice?page=3");
    assert.equal(boardHref("/notice", { q: "가을 모임", page: 2 }), "/notice?q=%EA%B0%80%EC%9D%84+%EB%AA%A8%EC%9E%84&page=2");
    assert.equal(boardHref("/admin", { q: "a", page: 2, extra: { section: "posts-notice" } }), "/admin?section=posts-notice&q=a&page=2");
  });
  it("isValidDateString: 실제 있는 날짜만", () => {
    for (const ok of ["2026-11-06", "2024-02-29", "2026-12-31"]) assert.equal(isValidDateString(ok), true, ok);
    for (const bad of ["2026-02-30", "2025-02-29", "2026-13-01", "2026-00-10", "2026-1-1", "26-11-06", "2026/11/06", "", "2026-11-06T00:00", " 2026-11-06", "1800-01-01", "2300-01-01"]) {
      assert.equal(isValidDateString(bad), false, bad);
    }
    assert.equal(isValidDateString(20261106), false);
    assert.equal(isValidDateString(null), false);
  });
  it("todayInSeoul: 한국 시간 기준 날짜 (UTC 15시 이후는 이미 다음 날)", () => {
    assert.equal(todayInSeoul(new Date("2026-11-05T14:59:59Z")), "2026-11-05");
    assert.equal(todayInSeoul(new Date("2026-11-05T15:00:00Z")), "2026-11-06");
    assert.equal(todayInSeoul(new Date("2026-12-31T20:00:00Z")), "2027-01-01");
  });
  it("formatPostDate: 점으로 표시, 이상한 값은 그대로", () => {
    assert.equal(formatPostDate("2026-10-20"), "2026.10.20");
    assert.equal(formatPostDate("abc"), "abc");
  });
  it("isUuid / isBoardCategory", () => {
    assert.equal(isUuid(ID), true);
    for (const bad of ["", "abc", ID + "x", "../etc/passwd", "11111111-1111-4111-8111-11111111111", null, 123, "1' or '1'='1"]) assert.equal(isUuid(bad), false);
    assert.equal(isBoardCategory("notice"), true);
    assert.equal(isBoardCategory("news"), true);
    for (const bad of ["", "NOTICE", "notice ", "admin", "../notice", null, undefined, 1]) assert.equal(isBoardCategory(bad), false);
  });
});

/* ============================ 2. 링크 안전 ============================ */

describe("4. 링크 안전 확인 (XSS · 위장 주소 차단)", () => {
  const good = ["https://example.com", "http://example.com/a/b?x=1#y", "https://example.com:8080/path", "/notice", "/notice/abc", "/", "/a?b=c#d", "https://sub.example.co.kr/가나다"];
  for (const g of good) it(`허용: ${g}`, () => assert.equal(isSafeLink(g), true));

  const bad = [
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "ftp://example.com",
    "//evil.com",
    "//evil.com/path",
    "/\\evil.com",
    "\\\\evil.com",
    "http://user@evil.com",
    "http://good.com@evil.com",
    "https://exa mple.com",
    "https://example.com/a b",
    "https://",
    "http:/example.com",
    "example.com",
    "www.example.com",
    "mailto:a@b.com",
    "https://example.com\n",
    "https://example.com/\u0000",
    "/a\nb",
    "/a b",
    "https://example.com/\\x",
    "",
  ];
  for (const b of bad) it(`거부: ${JSON.stringify(b)}`, () => assert.equal(isSafeLink(b), false));

  it(`길이 ${LINK_MAX_CHARS}자 초과는 거부`, () => {
    assert.equal(isSafeLink("https://a.com/" + "a".repeat(LINK_MAX_CHARS)), false);
    assert.equal(isSafeLink("https://a.com/" + "a".repeat(LINK_MAX_CHARS - 14)), true);
  });
  it("safeLinkHref: 바깥 주소는 external, 내부 주소는 아님, 위험하면 null", () => {
    assert.deepEqual(safeLinkHref("https://example.com"), { href: "https://example.com", external: true });
    assert.deepEqual(safeLinkHref("/notice"), { href: "/notice", external: false });
    assert.equal(safeLinkHref("javascript:alert(1)"), null);
    assert.equal(safeLinkHref(null), null);
    assert.equal(safeLinkHref(""), null);
    assert.equal(safeLinkHref(undefined), null);
  });
});

/* ============================ 3. 관리자 입력 검증 ============================ */

describe("5. 게시글 입력 검증", () => {
  it("정상 입력: 값이 정리되어 통과", () => {
    const r = validatePostInput(raw({ title: "  제목  ", body: "  본문\r\n둘째 줄  ", link_url: " https://example.com ", is_pinned: true }), TODAY);
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.value.title, "제목");
      assert.equal(r.value.body, "본문\n둘째 줄");
      assert.equal(r.value.link_url, "https://example.com");
      assert.equal(r.value.is_pinned, true);
      assert.equal(r.value.is_visible, true);
      assert.equal(r.value.published_at, "2026-11-01");
      assert.deepEqual(Object.keys(r.value).sort(), ["body", "category", "is_pinned", "is_visible", "link_url", "published_at", "title"]);
    }
  });
  it("빈 본문·빈 링크는 null 로 저장", () => {
    const r = validatePostInput(raw({ body: "   ", link_url: "   " }), TODAY);
    assert.ok(r.ok);
    if (r.ok) { assert.equal(r.value.body, null); assert.equal(r.value.link_url, null); }
    const r2 = validatePostInput(raw({ body: null, link_url: null }), TODAY);
    assert.ok(r2.ok);
  });
  it("게시일을 비우면 오늘로", () => {
    const r = validatePostInput(raw({ published_at: "" }), TODAY);
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.value.published_at, TODAY);
  });

  const badTitles: Array<[string, unknown]> = [
    ["빈 제목", ""],
    ["공백만", "     "],
    ["탭·줄바꿈만", "\t\n "],
    ["전각 공백만", "\u3000\u3000"],
    ["보이지 않는 공백만", "\u200b\u200b"],
    ["BOM 만", "\ufeff"],
    ["글자가 아닌 값(null)", null],
    ["글자가 아닌 값(숫자)", 123],
    ["줄바꿈 포함", "가\n나"],
    ["NUL 포함", "가\u0000나"],
    [`${TITLE_MAX_CHARS + 1}자`, "가".repeat(TITLE_MAX_CHARS + 1)],
  ];
  for (const [name, title] of badTitles) {
    it(`제목 거부: ${name}`, () => assert.equal(validatePostInput(raw({ title }), TODAY).ok, false));
  }
  it(`제목 ${TITLE_MAX_CHARS}자는 허용 (이모지도 한 글자로 계산)`, () => {
    assert.equal(validatePostInput(raw({ title: "가".repeat(TITLE_MAX_CHARS) }), TODAY).ok, true);
    assert.equal(validatePostInput(raw({ title: "😀".repeat(TITLE_MAX_CHARS) }), TODAY).ok, true);
    assert.equal(validatePostInput(raw({ title: "😀".repeat(TITLE_MAX_CHARS + 1) }), TODAY).ok, false);
  });

  it(`본문 ${BODY_MAX_CHARS.toLocaleString()}자까지 허용, 초과·NUL·글자 아닌 값은 거부`, () => {
    assert.equal(validatePostInput(raw({ body: "가".repeat(BODY_MAX_CHARS) }), TODAY).ok, true);
    assert.equal(validatePostInput(raw({ body: "가".repeat(BODY_MAX_CHARS + 1) }), TODAY).ok, false);
    assert.equal(validatePostInput(raw({ body: "가\u0000나" }), TODAY).ok, false);
    assert.equal(validatePostInput(raw({ body: 123 }), TODAY).ok, false);
    assert.equal(validatePostInput(raw({ body: { x: 1 } }), TODAY).ok, false);
  });

  it("위험한 링크는 거부 (javascript:, //외부, 위장 주소)", () => {
    for (const link of ["javascript:alert(1)", "//evil.com", "http://a@evil.com", "ftp://x.com", "data:text/html,x", 5, { a: 1 }]) {
      assert.equal(validatePostInput(raw({ link_url: link }), TODAY).ok, false, String(link));
    }
  });

  it("게시판 종류는 notice / news 만", () => {
    for (const c of ["admin", "", "NOTICE", null, undefined, 1, "notice;drop"]) assert.equal(validatePostInput(raw({ category: c }), TODAY).ok, false, String(c));
    assert.equal(validatePostInput(raw({ category: "news" }), TODAY).ok, true);
  });

  it("게시일 형식·실제 날짜 검사", () => {
    for (const d of ["2026-02-30", "2026/11/01", "내일", "2026-11-1", 20261101]) assert.equal(validatePostInput(raw({ published_at: d }), TODAY).ok, false, String(d));
  });
  it("미래 게시일: 게시하면 거부, 비공개(임시저장)면 허용, 오늘은 허용", () => {
    assert.equal(validatePostInput(raw({ published_at: "2026-11-07", is_visible: true }), TODAY).ok, false);
    assert.equal(validatePostInput(raw({ published_at: "2026-11-07", is_visible: false }), TODAY).ok, true);
    assert.equal(validatePostInput(raw({ published_at: TODAY, is_visible: true }), TODAY).ok, true);
    assert.equal(validatePostInput(raw({ published_at: "2026-11-05", is_visible: true }), TODAY).ok, true);
  });
  it("체크 칸은 정확히 true 일 때만 켜짐 (문자열 'on'·1 등은 꺼짐)", () => {
    const r = validatePostInput(raw({ is_pinned: "on", is_visible: 1 }), TODAY);
    assert.ok(r.ok);
    if (r.ok) { assert.equal(r.value.is_pinned, false); assert.equal(r.value.is_visible, false); }
  });
  it("XSS 문구는 글자 그대로 저장됨(지우지 않음) — 화면에서는 항상 글자로만 출력", () => {
    const r = validatePostInput(raw({ title: "<script>alert(1)</script>", body: '<img src=x onerror=alert(1)>' }), TODAY);
    assert.ok(r.ok);
    if (r.ok) { assert.equal(r.value.title, "<script>alert(1)</script>"); assert.equal(r.value.body, "<img src=x onerror=alert(1)>"); }
  });
  it("DB 의 규칙 숫자와 앱의 규칙 숫자가 같음 (002_posts.sql)", () => {
    const sql = read("supabase/migrations/002_posts.sql");
    assert.match(sql, new RegExp(`between 1 and ${TITLE_MAX_CHARS}`));
    assert.match(sql, new RegExp(`char_length\\(body\\) <= ${BODY_MAX_CHARS}`));
    assert.match(sql, new RegExp(`char_length\\(link_url\\) <= ${LINK_MAX_CHARS}`));
    assert.match(sql, /category in \('notice', 'news'\)/);
  });
});

/* ============================ 4. 관리자 서비스 (mock DB) ============================ */

type Call = { fn: string; args: unknown[] };
function makeDeps(opts: { insertError?: { code?: string; message: string }; updated?: number; deleted?: number; updateError?: { code?: string; message: string }; deleteError?: { code?: string; message: string } } = {}) {
  const calls: Call[] = [];
  const logs: unknown[] = [];
  const db: PostDb = {
    async insertPost(row) { calls.push({ fn: "insert", args: [row] }); return { error: opts.insertError ?? null }; },
    async updatePost(id, row) { calls.push({ fn: "update", args: [id, row] }); return { error: opts.updateError ?? null, updated: opts.updated ?? 1 }; },
    async deletePost(id) { calls.push({ fn: "delete", args: [id] }); return { error: opts.deleteError ?? null, deleted: opts.deleted ?? 1 }; },
  };
  const deps: PostServiceDeps = { db, log: (e) => logs.push(e) };
  return { deps, calls, logs };
}

describe("6. 관리자 확인 보호막 (runIfAdmin)", () => {
  it("관리자가 아니면 작업을 아예 실행하지 않음 (DB 에 닿기 전에 차단)", async () => {
    const { deps, calls } = makeDeps();
    const r = await runIfAdmin(async () => false, () => savePost(deps, { id: null, raw: raw(), today: TODAY }), { ok: false, message: "로그인", dbChanged: false });
    assert.equal(r.ok, false);
    assert.deepEqual(calls, []);
    const d = await runIfAdmin(async () => false, () => deletePost(deps, ID), { ok: false, message: "로그인", dbChanged: false });
    assert.equal(d.ok, false);
    assert.deepEqual(calls, []);
  });
  it("관리자 확인이 오류로 실패해도(거짓이 아니라 예외) 작업은 실행되지 않음", async () => {
    const { deps, calls } = makeDeps();
    await assert.rejects(runIfAdmin(async () => { throw new Error("auth down"); }, () => savePost(deps, { id: null, raw: raw(), today: TODAY }), { ok: false, message: "", dbChanged: false }));
    assert.deepEqual(calls, []);
  });
  it("관리자이면 실행됨", async () => {
    const { deps, calls } = makeDeps();
    const r = await runIfAdmin(async () => true, () => savePost(deps, { id: null, raw: raw(), today: TODAY }), { ok: false, message: "", dbChanged: false });
    assert.equal(r.ok, true);
    assert.equal(calls.length, 1);
  });
});

describe("7. 글 저장·삭제 서비스", () => {
  it("추가: 정리된 7개 컬럼만 DB 로 보냄 (작성자·id·시각은 보내지 않음)", async () => {
    const { deps, calls } = makeDeps();
    const r = await savePost(deps, { id: null, raw: raw({ title: "  새 글  " }), today: TODAY });
    assert.deepEqual(r, { ok: true, message: "추가했습니다.", dbChanged: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].fn, "insert");
    const row = calls[0].args[0] as Record<string, unknown>;
    assert.deepEqual(Object.keys(row).sort(), ["body", "category", "is_pinned", "is_visible", "link_url", "published_at", "title"]);
    assert.equal(row.title, "새 글");
    assert.ok(!("created_by" in row) && !("id" in row) && !("created_at" in row) && !("updated_at" in row));
  });
  it("브라우저가 작성자·id 를 끼워 보내도(raw 에 추가 값) 저장 행에는 들어가지 않음", async () => {
    const { deps, calls } = makeDeps();
    const sneaky = { ...raw(), created_by: "00000000-0000-0000-0000-000000000001", id: ID } as RawPostInput;
    await savePost(deps, { id: null, raw: sneaky, today: TODAY });
    const row = calls[0].args[0] as Record<string, unknown>;
    assert.ok(!("created_by" in row)); assert.ok(!("id" in row));
  });
  it("수정: 글 번호와 함께 보내고 성공 메시지", async () => {
    const { deps, calls } = makeDeps();
    const r = await savePost(deps, { id: ID, raw: raw(), today: TODAY });
    assert.deepEqual(r, { ok: true, message: "수정했습니다.", dbChanged: true });
    assert.deepEqual([calls[0].fn, calls[0].args[0]], ["update", ID]);
  });
  it("수정 대상이 없으면(이미 삭제) 실패 안내, 화면 갱신 없음", async () => {
    const { deps } = makeDeps({ updated: 0 });
    const r = await savePost(deps, { id: ID, raw: raw(), today: TODAY });
    assert.equal(r.ok, false); assert.equal(r.dbChanged, false); assert.match(r.message, /찾지 못했습니다/);
  });
  it("검증 실패 시 DB 를 건드리지 않음", async () => {
    const { deps, calls } = makeDeps();
    for (const bad of [raw({ title: "  " }), raw({ link_url: "javascript:1" }), raw({ category: "x" }), raw({ published_at: "2099-01-01" })]) {
      const r = await savePost(deps, { id: null, raw: bad, today: TODAY });
      assert.equal(r.ok, false); assert.equal(r.dbChanged, false);
    }
    assert.deepEqual(calls, []);
  });
  it("이상한 글 번호는 DB 에 보내지 않음", async () => {
    const { deps, calls } = makeDeps();
    for (const id of ["abc", "../x", "1 or 1=1", ID + "0"]) {
      assert.equal((await savePost(deps, { id, raw: raw(), today: TODAY })).ok, false);
      assert.equal((await deletePost(deps, id)).ok, false);
    }
    assert.deepEqual(calls, []);
  });
  it("DB 오류는 정해진 안내로 바꾸고 원문은 화면에 노출하지 않음 (기록에는 비밀 제거본만)", async () => {
    const secret = "sb_secret_" + "ABCDEFGH12345678";
    const { deps, logs } = makeDeps({ insertError: { code: "XX000", message: `relation "public.posts" failed apikey ${secret}` } });
    const r = await savePost(deps, { id: null, raw: raw(), today: TODAY });
    assert.equal(r.ok, false); assert.equal(r.dbChanged, false);
    assert.ok(!r.message.includes("posts") && !r.message.includes(secret));
    assert.equal(logs.length, 1);
    assert.ok(!JSON.stringify(logs).includes(secret), "기록에 비밀 키가 남으면 안 됨");
  });
  it("오류 코드별 안내: 권한(42501)·규칙 위반(23514)·표 없음", () => {
    assert.match(describeDbError({ code: "42501", message: "x" }), /권한/);
    assert.match(describeDbError({ code: "23514", message: "x" }), /규칙/);
    assert.match(describeDbError({ code: "42P01", message: "x" }), /게시판 표/);
    assert.match(describeDbError({ code: "PGRST205", message: "x" }), /게시판 표/);
    assert.match(describeDbError({ code: null, message: "x" }), /다시 시도/);
  });
  it("관리자가 아닌 사용자가 DB 까지 왔다면 RLS 오류(42501)를 권한 안내로 보여줌, 화면 갱신 없음", async () => {
    const { deps } = makeDeps({ updateError: { code: "42501", message: "permission denied" } });
    const r = await savePost(deps, { id: ID, raw: raw(), today: TODAY });
    assert.equal(r.ok, false); assert.equal(r.dbChanged, false); assert.match(r.message, /권한/);
  });
  it("삭제: 성공 / 대상 없음 / 오류", async () => {
    assert.deepEqual(await deletePost(makeDeps().deps, ID), { ok: true, message: "삭제했습니다.", dbChanged: true });
    const none = await deletePost(makeDeps({ deleted: 0 }).deps, ID);
    assert.equal(none.ok, false); assert.equal(none.dbChanged, false);
    const err = await deletePost(makeDeps({ deleteError: { code: "42501", message: "denied" } }).deps, ID);
    assert.equal(err.ok, false); assert.match(err.message, /권한/);
  });
});

/* ============================ 5. 코드 점검 (정적 검사) ============================ */

describe("8. 코드 점검: 서버 측 관리자 검증과 보안 규칙이 코드에 남아 있는지", () => {
  const actions = read("app/admin/post-actions.ts");

  it("관리자 서버 액션 파일은 'use server' 이고 두 액션 모두 맨 처음에 runIfAdmin(isAdmin) 으로 막음", () => {
    assert.match(actions, /^"use server";/);
    assert.match(actions, /export async function savePostAction[\s\S]*?return runIfAdmin\(isAdmin,/);
    assert.match(actions, /export async function deletePostAction[\s\S]*?return runIfAdmin\(isAdmin,/);
    // 실제 일을 하는 함수는 export 하지 않음 (밖에서 바로 호출할 수 없게)
    assert.ok(!/export async function (savePostAsAdmin|deletePostAsAdmin)/.test(actions));
  });
  it("게시글 쓰기는 서버 비밀 키(service_role)가 아니라 로그인한 관리자의 연결을 씀 (RLS 가 한 번 더 막음)", () => {
    assert.ok(!/supabase-admin|getAdminClient|SUPABASE_SECRET_KEY/.test(actions));
    assert.match(actions, /createSupabaseServerClient/);
    const deps = read("lib/admin-post-deps.ts");
    assert.ok(!/supabase-admin|getAdminClient|SUPABASE_SECRET_KEY/.test(deps));
  });
  it("서비스 파일들은 '@/' 별칭 없이 시험에서 직접 불러올 수 있음", () => {
    assert.ok(!/from "@\//.test(read("lib/admin-post-service.ts")));
    assert.ok(!/from "@\//.test(read("lib/board-shared.ts")));
  });
  it("HTML 로 해석해 넣는 코드(dangerouslySetInnerHTML, innerHTML)가 앱 어디에도 없음 (XSS 방지)", () => {
    const files = [...walk("app"), ...walk("components"), ...walk("lib")];
    for (const f of files) {
      const text = read(f);
      assert.ok(!/dangerouslySetInnerHTML|\.innerHTML\s*=|insertAdjacentHTML|document\.write/.test(text), `${f} 에 HTML 직접 삽입 코드가 있음`);
    }
  });
  it("공개 읽기 코드는 컬럼을 명시하고 select('*') 를 쓰지 않으며 작성자(created_by)를 읽지 않음", () => {
    const board = read("lib/board.ts");
    const code = board.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""); // 주석 제외
    assert.ok(!/select\(\s*["'`]\*["'`]/.test(code), "select('*') 금지");
    assert.ok(!/created_by/.test(code), "created_by 는 코드(주석 제외)에서 읽지 않음");
    assert.match(board, /const SUMMARY_COLUMNS = "[^"]+"/);
    assert.match(board, /const DETAIL_COLUMNS = "[^"]+"/);
    const cols = [...board.matchAll(/const (?:SUMMARY|DETAIL)_COLUMNS = "([^"]+)"/g)].map((m) => m[1]).join(",");
    assert.ok(!/created_by|\*/.test(cols));
  });
  it("공개 읽기에는 서버 비밀 키 연결을 쓰지 않음", () => {
    const board = read("lib/board.ts");
    assert.ok(!/supabase-admin|getAdminClient/.test(board));
    assert.match(board, /getPublicClient/);
  });
  it("검색어는 항상 정리된 값(normalizeSearchQuery)만 DB 조건에 들어감", () => {
    for (const f of ["app/notice/page.tsx", "app/news/page.tsx", "app/admin/page.tsx"]) {
      assert.match(read(f), /normalizeSearchQuery\(searchParams\.q\)/, f);
    }
    const board = read("lib/board.ts");
    assert.match(board, /function searchFilter\(q: string\)/);
    // 조건 문자열을 만드는 곳은 searchFilter 하나뿐
    assert.equal((board.match(/\.or\(/g) ?? []).length, 2);
    assert.equal((board.match(/\.or\(searchFilter\(opts\.q\)\)/g) ?? []).length, 2);
  });
  it("글 번호는 형식(uuid)을 확인한 뒤에만 DB 에 묻고, 상세 화면은 없는 글에 notFound() 를 돌려줌", () => {
    assert.match(read("lib/board.ts"), /!isUuid\(id\)\) return null/);
    for (const f of ["app/notice/[id]/page.tsx", "app/news/[id]/page.tsx"]) assert.match(read(f), /if \(!post\) notFound\(\)/, f);
  });
  it("상세 화면: 본문은 일반 글자로 출력, 링크는 그릴 때 다시 확인(safeLinkHref), 바깥 링크는 noopener", () => {
    const detail = read("components/board/post-detail-view.tsx");
    assert.match(detail, /\{post\.body\}/);
    assert.match(detail, /safeLinkHref\(post\.link_url\)/);
    assert.match(detail, /rel="noopener noreferrer"/);
  });
  it("관리자 화면과 첫 화면은 비공개 글을 방문자 연결로 읽지 않음 (관리자 목록은 로그인한 관리자의 연결)", () => {
    const panel = read("app/admin/_components/posts-panel.tsx");
    assert.match(panel, /fetchAdminPostPage\(client,/);
    assert.match(read("app/admin/page.tsx"), /createSupabaseServerClient\(\)/);
  });
  it("게시판 화면 이름과 주소", () => {
    assert.equal(BOARD_INFO.notice.path, "/notice");
    assert.equal(BOARD_INFO.news.path, "/news");
    assert.equal(BOARD_INFO.news.title, "주민자치회 소식");
  });
});

/* 게시판(공지사항 · 주민자치회 소식)의 「순수 규칙」 모음 — 네트워크·DB 를 쓰지 않아 단위 시험이 가능합니다.
   - 입력값 검증 (제목·본문·링크·게시일): supabase/migrations/002_posts.sql 의 DB 규칙과 같은 기준으로 앱에서 먼저 막습니다.
   - 검색어 정리: 데이터베이스 검색 조건에 들어가기 전에 안전한 글자만 남깁니다.
   - 링크 안전 확인: 화면에 링크를 그릴 때도 한 번 더 확인합니다. (http/https 또는 사이트 내부 주소만)
   ※ 이 파일은 시험(node:test)에서 직접 불러오므로 '@/' 경로 별칭을 쓰지 않습니다. */

export const BOARD_CATEGORIES = ["notice", "news"] as const;
export type BoardCategory = (typeof BOARD_CATEGORIES)[number];

/** 게시판별 주소 이름과 화면 글자 */
export const BOARD_INFO: Record<BoardCategory, { path: string; title: string; description: string }> = {
  notice: { path: "/notice", title: "공지사항", description: "주민자치회의 공지사항을 알려드립니다." },
  news: { path: "/news", title: "주민자치회 소식", description: "주민자치회의 활동 소식을 전합니다." },
};

export const PAGE_SIZE = 10;
export const MAX_PAGE = 1000;
export const SEARCH_MAX_CHARS = 50;
export const TITLE_MAX_CHARS = 120;
export const BODY_MAX_CHARS = 10000;
export const LINK_MAX_CHARS = 500;

/** 목록에 필요한 컬럼 (작성자 created_by 는 방문자가 읽을 수 없으므로 절대 포함하지 않음) */
export type PostSummary = {
  id: string;
  category: BoardCategory;
  title: string;
  is_pinned: boolean;
  is_visible: boolean;
  published_at: string; // YYYY-MM-DD
};

export type Post = PostSummary & {
  body: string | null;
  link_url: string | null;
  created_at: string;
  updated_at: string;
};

export function isBoardCategory(value: unknown): value is BoardCategory {
  return typeof value === "string" && (BOARD_CATEGORIES as readonly string[]).includes(value);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/* ---------- 쪽(페이지) · 검색어 ---------- */

/** 주소의 ?page= 값을 1 이상의 정수로 정리 (이상한 값은 1쪽) */
export function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || !/^[0-9]{1,6}$/.test(value)) return 1;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) return 1;
  return Math.min(n, MAX_PAGE);
}

export function pageCount(total: number, pageSize: number = PAGE_SIZE): number {
  if (!Number.isFinite(total) || total <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

/** 현재 쪽 주변에 보여줄 쪽 번호들 (예: 현재 7 → 5,6,7,8,9) */
export function paginationWindow(current: number, total: number, size = 5): number[] {
  const count = Math.min(size, total);
  let start = Math.max(1, current - Math.floor(size / 2));
  if (start + count - 1 > total) start = Math.max(1, total - count + 1);
  return Array.from({ length: count }, (_, i) => start + i);
}

/**
 * 검색어를 안전하게 정리합니다.
 * - 글자(한글·영문 등)·숫자·띄어쓰기·하이픈만 남기고 나머지(따옴표, 쉼표, 괄호, %, _, *, \ 등)는 모두 제거
 *   → 데이터베이스 검색 조건 문자열에 끼어들 수 있는 특수문자가 없어집니다.
 * - 연속 공백은 하나로, 앞뒤 공백 제거, 최대 50글자
 */
export function normalizeSearchQuery(raw: string | string[] | undefined | null): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return "";
  const cleaned = value
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\p{M} -]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(cleaned).slice(0, SEARCH_MAX_CHARS).join("").trim();
}

/** 게시판 목록 주소 만들기 (검색어는 정리된 값, 1쪽은 생략) */
export function boardHref(basePath: string, opts: { q?: string; page?: number; extra?: Record<string, string> } = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.extra ?? {})) params.set(k, v);
  if (opts.q) params.set("q", opts.q);
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/* ---------- 날짜 ---------- */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** YYYY-MM-DD 형식이면서 실제로 있는 날짜인지 (예: 2026-02-30 은 거부) */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1900 || y > 2200) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** 한국 시간 기준 오늘 날짜 (YYYY-MM-DD) — DB 의 게시일 규칙과 같은 기준 */
export function todayInSeoul(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** 화면 표시용 날짜 (2026-10-20 → 2026.10.20). 형식이 이상하면 그대로 돌려줌 */
export function formatPostDate(value: string): string {
  return isValidDateString(value) ? value.replaceAll("-", ".") : value;
}

/* ---------- 링크 ---------- */

// 002_posts.sql 의 posts_link_url_check 와 같은 규칙
//  ① http(s):// + 주소(주소 안에 @, 공백, 역슬래시, 제어문자, 또 다른 / 시작 불가)  ② 사이트 내부 주소(/ 또는 /글자...)
const LINK_RE = /^(https?:\/\/[^\s\x00-\x1f\x7f/\\@?#]+([/?#][^\s\x00-\x1f\x7f\\]*)?|\/([^\s\x00-\x1f\x7f/\\][^\s\x00-\x1f\x7f\\]*)?)$/;

export function isSafeLink(value: unknown): value is string {
  return typeof value === "string" && value.length <= LINK_MAX_CHARS && LINK_RE.test(value);
}

/** 링크를 화면에 그릴 때 사용: 안전하지 않으면 null. external 이면 새 탭 + noopener 로 엽니다. */
export function safeLinkHref(value: string | null | undefined): { href: string; external: boolean } | null {
  if (!value || !isSafeLink(value)) return null;
  return { href: value, external: /^https?:\/\//i.test(value) };
}

/* ---------- 관리자 입력 검증 ---------- */

export type RawPostInput = {
  category: unknown;
  title: unknown;
  body: unknown;
  link_url: unknown;
  is_pinned: unknown;
  is_visible: unknown;
  published_at: unknown;
};

export type PostInput = {
  category: BoardCategory;
  title: string;
  body: string | null;
  link_url: string | null;
  is_pinned: boolean;
  is_visible: boolean;
  published_at: string;
};

export type PostValidation = { ok: true; value: PostInput } | { ok: false; message: string };

// 공백·탭·줄바꿈·전각 공백·보이지 않는 공백(0x2000~0x200b, 0x3000, 0xfeff)만으로 된 값 (DB 의 제목 규칙과 같은 기준)
const INVISIBLE_ONLY_RE = new RegExp("^[\\s\\xa0" + String.fromCharCode(0x2000) + "-" + String.fromCharCode(0x200b) + String.fromCharCode(0x3000) + String.fromCharCode(0xfeff) + "]*$");
const NUL_RE = /\u0000/;
// 제목에는 줄바꿈·탭 같은 제어문자를 허용하지 않음
const CONTROL_RE = /[\x00-\x1f\x7f]/;

const charLength = (s: string) => Array.from(s).length;

/**
 * 관리자가 보낸 값을 검사하고 정리합니다. (브라우저에서 보낸 값은 모두 믿지 않고 서버에서 다시 검사)
 * today: 한국 시간 기준 오늘(YYYY-MM-DD). 공개(게시) 글의 게시일이 오늘보다 뒤이면 거부 (예약 게시 미지원)
 */
export function validatePostInput(raw: RawPostInput, today: string): PostValidation {
  if (!isBoardCategory(raw.category)) return { ok: false, message: "게시판 종류가 올바르지 않습니다." };

  if (typeof raw.title !== "string") return { ok: false, message: "제목을 입력하세요." };
  const title = raw.title.trim();
  if (INVISIBLE_ONLY_RE.test(title)) return { ok: false, message: "제목을 입력하세요." };
  if (CONTROL_RE.test(title)) return { ok: false, message: "제목에 줄바꿈이나 특수한 제어 문자는 쓸 수 없습니다." };
  if (charLength(title) > TITLE_MAX_CHARS) return { ok: false, message: `제목은 ${TITLE_MAX_CHARS}자 이하로 입력하세요.` };

  let body: string | null = null;
  if (raw.body !== null && raw.body !== undefined && raw.body !== "") {
    if (typeof raw.body !== "string") return { ok: false, message: "본문 형식이 올바르지 않습니다." };
    if (NUL_RE.test(raw.body)) return { ok: false, message: "본문에 사용할 수 없는 문자가 있습니다." };
    const normalized = raw.body.replace(/\r\n?/g, "\n").trim();
    if (charLength(normalized) > BODY_MAX_CHARS) return { ok: false, message: `본문은 ${BODY_MAX_CHARS.toLocaleString("ko-KR")}자 이하로 입력하세요.` };
    body = normalized === "" ? null : normalized;
  }

  let link: string | null = null;
  if (raw.link_url !== null && raw.link_url !== undefined && raw.link_url !== "") {
    if (typeof raw.link_url !== "string") return { ok: false, message: "링크 형식이 올바르지 않습니다." };
    const trimmed = raw.link_url.trim();
    if (trimmed !== "") {
      if (!isSafeLink(trimmed)) {
        return { ok: false, message: "링크는 https:// 또는 http:// 로 시작하는 주소이거나, / 로 시작하는 사이트 내부 주소여야 합니다." };
      }
      link = trimmed;
    }
  }

  const isPinned = raw.is_pinned === true;
  const isVisible = raw.is_visible === true;

  let publishedAt = today;
  if (raw.published_at !== null && raw.published_at !== undefined && raw.published_at !== "") {
    if (!isValidDateString(raw.published_at)) return { ok: false, message: "게시일 형식이 올바르지 않습니다. (예: 2026-11-06)" };
    publishedAt = raw.published_at;
  }
  if (!isValidDateString(today)) return { ok: false, message: "오늘 날짜를 확인하지 못했습니다." };
  if (isVisible && publishedAt > today) {
    return { ok: false, message: "게시일이 오늘보다 뒤인 글은 게시할 수 없습니다. 비공개로 저장하거나 게시일을 오늘 이전으로 바꾸세요." };
  }

  return {
    ok: true,
    value: { category: raw.category, title, body, link_url: link, is_pinned: isPinned, is_visible: isVisible, published_at: publishedAt },
  };
}

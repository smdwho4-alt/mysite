import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getPublicClient } from "@/lib/supabase";
import {
  PAGE_SIZE,
  isBoardCategory,
  isUuid,
  pageCount,
  type BoardCategory,
  type Post,
  type PostSummary,
} from "@/lib/board-shared";

/* 게시판 글 읽기 (방문자용 + 관리자 화면 공용)
   - 방문자용은 「공개 키」 연결로 읽습니다. 어떤 글이 보이는지는 데이터베이스의 RLS 정책이 정합니다.
     (게시 상태이고 게시일이 오늘 이전인 글만 — 비공개·임시저장·미래 날짜 글은 방문자에게 절대 안 보임)
   - ⚠ 컬럼 이름을 반드시 적어서 읽습니다. select("*") 금지 — 작성자(created_by)는 방문자가 읽을 수 없는 컬럼이라
     * 로 읽으면 오류가 납니다. (아래 컬럼 목록에 created_by 가 없는 것이 맞습니다) */

const SUMMARY_COLUMNS = "id, category, title, is_pinned, is_visible, published_at";
const DETAIL_COLUMNS = "id, category, title, body, link_url, is_pinned, is_visible, published_at, created_at, updated_at";

export type PostListResult = {
  posts: PostSummary[];
  total: number;
  page: number;
  pageCount: number;
  /** 읽기에 실패했으면 true (화면에서 안내) */
  failed: boolean;
};

const EMPTY: PostListResult = { posts: [], total: 0, page: 1, pageCount: 1, failed: false };

/** 검색어 조건. q 는 normalizeSearchQuery() 로 이미 정리된 값(글자·숫자·공백·하이픈만)이어야 합니다. */
function searchFilter(q: string) {
  // 정리된 검색어에는 따옴표·쉼표·괄호·%·_ 가 없으므로 조건 문자열에 끼어들 수 없음. 그래도 값은 큰따옴표로 감쌉니다.
  return `title.ilike."%${q}%",body.ilike."%${q}%"`;
}

/**
 * 글 목록 한 쪽을 읽습니다. (고정 글 → 게시일 최신순)
 * client: 방문자는 공개 연결, 관리자 화면은 로그인한 관리자 연결을 넘깁니다. (RLS 가 각자의 범위를 정함)
 */
export async function fetchPostPage(
  client: SupabaseClient,
  opts: { category: BoardCategory; q: string; page: number; pageSize?: number },
): Promise<PostListResult> {
  if (!isBoardCategory(opts.category)) return { ...EMPTY };
  const pageSize = opts.pageSize ?? PAGE_SIZE;

  // 1) 전체 개수 (쪽 수 계산) — 요청한 쪽이 범위를 벗어나도 오류가 나지 않게 먼저 개수만 셉니다.
  let countQuery = client.from("posts").select("id", { count: "exact", head: true }).eq("category", opts.category);
  if (opts.q) countQuery = countQuery.or(searchFilter(opts.q));
  const counted = await countQuery;
  if (counted.error) {
    console.error("[board] 글 개수 읽기 실패:", counted.error.code ?? "", counted.error.message);
    return { ...EMPTY, failed: true };
  }
  const total = counted.count ?? 0;
  const pages = pageCount(total, pageSize);
  const page = Math.min(Math.max(1, opts.page), pages);

  // 2) 해당 쪽의 글
  const from = (page - 1) * pageSize;
  let listQuery = client.from("posts").select(SUMMARY_COLUMNS).eq("category", opts.category);
  if (opts.q) listQuery = listQuery.or(searchFilter(opts.q));
  const { data, error } = await listQuery
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) {
    console.error("[board] 글 목록 읽기 실패:", error.code ?? "", error.message);
    return { ...EMPTY, failed: true };
  }
  return { posts: (data ?? []) as PostSummary[], total, page, pageCount: pages, failed: false };
}

/** 방문자용 목록 (공개 연결). Supabase 가 연결 안 됐으면 null */
export async function getPublicPostPage(category: BoardCategory, q: string, page: number): Promise<PostListResult | null> {
  const client = getPublicClient();
  if (!client) return null;
  return fetchPostPage(client, { category, q, page });
}

/** 방문자용 글 한 건. 없거나 비공개/미래 글이면 null (RLS 가 걸러 줌). 형식이 이상한 번호는 DB 에 묻지 않고 null */
export async function getPublicPost(category: BoardCategory, id: string): Promise<Post | null> {
  if (!isBoardCategory(category) || !isUuid(id)) return null;
  const client = getPublicClient();
  if (!client) return null;
  const { data, error } = await client.from("posts").select(DETAIL_COLUMNS).eq("id", id).eq("category", category).maybeSingle();
  if (error) {
    console.error("[board] 글 읽기 실패:", error.code ?? "", error.message);
    return null;
  }
  return (data as Post | null) ?? null;
}

/** 첫 화면용 최신 글 몇 건 (고정 글 먼저). 읽기에 실패하면 null → 화면이 예전 고정 문구로 대신함 */
export async function getLatestPosts(category: BoardCategory, limit = 5): Promise<PostSummary[] | null> {
  const client = getPublicClient();
  if (!client) return null;
  const { data, error } = await client
    .from("posts")
    .select(SUMMARY_COLUMNS)
    .eq("category", category)
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[board] 최신 글 읽기 실패:", error.code ?? "", error.message);
    return null;
  }
  return (data ?? []) as PostSummary[];
}

/** 관리자 화면용: 글 한 쪽을 본문 포함해서 읽기 (수정 칸에 채우기 위함). 로그인한 관리자 연결만 넘길 것. */
export async function fetchAdminPostPage(
  client: SupabaseClient,
  opts: { category: BoardCategory; q: string; page: number },
): Promise<{ result: PostListResult; details: Map<string, Post> }> {
  const result = await fetchPostPage(client, opts);
  const details = new Map<string, Post>();
  if (result.posts.length > 0) {
    const { data, error } = await client
      .from("posts")
      .select(DETAIL_COLUMNS)
      .in(
        "id",
        result.posts.map((p) => p.id),
      );
    if (error) {
      console.error("[board] 관리자 글 상세 읽기 실패:", error.code ?? "", error.message);
      return { result: { ...result, failed: true }, details };
    }
    for (const row of (data ?? []) as Post[]) details.set(row.id, row);
  }
  return { result, details };
}

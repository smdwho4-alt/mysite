import type { Metadata } from "next";

import { PostListView } from "@/components/board/post-list-view";
import { getPublicPostPage } from "@/lib/board";
import { BOARD_INFO, normalizeSearchQuery, parsePage } from "@/lib/board-shared";

/* 공지사항 목록 (주소: /notice) — 검색(?q=)과 쪽 이동(?page=) 지원. 방문자에게는 「게시」 상태인 글만 보입니다. (DB 의 RLS 가 걸러 줌) */

export const metadata: Metadata = { title: BOARD_INFO.notice.title };

export default async function NoticePage(props: PageProps<"/notice">) {
  const searchParams = await props.searchParams;
  const q = normalizeSearchQuery(searchParams.q);
  const page = parsePage(searchParams.page);
  const result = await getPublicPostPage("notice", q, page);

  return <PostListView category="notice" q={q} result={result} />;
}

import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PostDetailView } from "@/components/board/post-detail-view";
import { getPublicPost } from "@/lib/board";
import { BOARD_INFO } from "@/lib/board-shared";

/* 공지사항 상세 (주소: /notice/글번호)
   - 형식이 이상한 번호, 없는 글, 비공개·임시저장·미래 날짜 글은 모두 똑같이 「찾을 수 없음」 화면입니다.
     (비공개 글이 존재하는지조차 알 수 없게 함) */

const loadPost = cache((id: string) => getPublicPost("notice", id));

export async function generateMetadata(props: PageProps<"/notice/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const post = await loadPost(id);
  return { title: post ? `${post.title} | ${BOARD_INFO.notice.title}` : BOARD_INFO.notice.title };
}

export default async function NoticeDetailPage(props: PageProps<"/notice/[id]">) {
  const { id } = await props.params;
  const post = await loadPost(id);
  if (!post) notFound();

  return <PostDetailView post={post} />;
}

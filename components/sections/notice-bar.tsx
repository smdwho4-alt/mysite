import Link from "next/link";
import { Megaphone } from "lucide-react";

import { siteConfig } from "@/site.config";
import { getLatestPosts } from "@/lib/board";
import { BOARD_INFO } from "@/lib/board-shared";
import { Container } from "@/components/layout/container";

/** 첫 화면 바로 아래 한 줄짜리 공지 띠. 가장 앞의 공지(고정 글 → 최신 글)가 나옵니다.
    데이터베이스를 읽지 못하면 site.config.ts 의 예시 공지 첫 번째 글을 보여줍니다. */
export async function NoticeBar() {
  const posts = await getLatestPosts("notice", 1);

  let title: string;
  let href: string;
  if (posts === null) {
    const fallback = siteConfig.notices.items[0];
    if (!fallback) return null;
    title = fallback.title;
    href = BOARD_INFO.notice.path;
  } else {
    const latest = posts[0];
    if (!latest) return null; // 공지가 하나도 없으면 띠를 숨김
    title = latest.title;
    href = `${BOARD_INFO.notice.path}/${latest.id}`;
  }

  return (
    <div className="bg-primary text-primary-foreground">
      <Container className="flex items-center gap-3 py-3 text-sm">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold">
          <Megaphone className="size-3.5" />
          공지
        </span>
        <Link href={href} className="truncate hover:underline">
          {title}
        </Link>
      </Container>
    </div>
  );
}

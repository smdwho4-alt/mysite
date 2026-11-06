import Link from "next/link";
import { Bell, ChevronRight, Newspaper, Pin } from "lucide-react";

import { siteConfig } from "@/site.config";
import { getLatestPosts } from "@/lib/board";
import { BOARD_INFO, formatPostDate, type BoardCategory } from "@/lib/board-shared";
import { Container } from "@/components/layout/container";

type Row = { key: string; title: string; date: string; href?: string; pinned?: boolean };

/** 제목 + 날짜 목록이 들어간 카드 한 칸 */
function PostList({
  icon,
  title,
  moreHref,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  moreHref: string;
  items: Row[];
}) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <span className="text-primary">{icon}</span>
          {title}
        </h2>
        <Link
          href={moreHref}
          className="inline-flex shrink-0 items-center text-sm text-muted-foreground hover:text-foreground"
        >
          더보기
          <ChevronRight className="size-4" />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">등록된 글이 없습니다.</p>
      ) : (
        <ul className="mt-4 divide-y">
          {items.map((post) => {
            const inner = (
              <>
                <span className="flex min-w-0 items-center gap-2">
                  {post.pinned ? <Pin aria-label="고정" className="size-3.5 shrink-0 text-primary" /> : null}
                  <span className="truncate text-sm">{post.title}</span>
                </span>
                <time className="shrink-0 text-xs text-muted-foreground">{post.date}</time>
              </>
            );
            return (
              <li key={post.key}>
                {post.href ? (
                  <Link href={post.href} className="flex items-center justify-between gap-4 py-3 hover:text-primary">
                    {inner}
                  </Link>
                ) : (
                  <div className="flex items-center justify-between gap-4 py-3">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** 데이터베이스의 최신 글을 보여줍니다. 읽지 못하면(연결 전·오류) site.config.ts 의 예시 글로 대신합니다. */
async function loadRows(category: BoardCategory, fallback: { title: string; date: string }[]): Promise<Row[]> {
  const posts = await getLatestPosts(category, 5);
  if (posts === null) return fallback.map((p) => ({ key: p.title + p.date, title: p.title, date: p.date }));
  return posts.map((p) => ({
    key: p.id,
    title: p.title,
    date: formatPostDate(p.published_at),
    href: `${BOARD_INFO[category].path}/${p.id}`,
    pinned: p.is_pinned,
  }));
}

/** 공지사항 · 주민자치회 소식 두 칸. 글은 관리자 페이지(/admin)에서 등록합니다. */
export async function Notices() {
  const { notices, news } = siteConfig;
  const [noticeRows, newsRows] = await Promise.all([loadRows("notice", notices.items), loadRows("news", news.items)]);

  return (
    <section id="notices" className="scroll-mt-16 py-16">
      <Container className="grid gap-6 md:grid-cols-2">
        <PostList icon={<Bell className="size-5" />} title={notices.title} moreHref={BOARD_INFO.notice.path} items={noticeRows} />
        <PostList icon={<Newspaper className="size-5" />} title={news.title} moreHref={BOARD_INFO.news.path} items={newsRows} />
      </Container>
    </section>
  );
}

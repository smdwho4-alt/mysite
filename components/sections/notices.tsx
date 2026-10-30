import { Bell, Newspaper } from "lucide-react";

import { siteConfig } from "@/site.config";
import { Container } from "@/components/layout/container";

type Post = { title: string; date: string };

/** 제목 + 날짜 목록이 들어간 카드 한 칸 */
function PostList({ icon, title, items }: { icon: React.ReactNode; title: string; items: Post[] }) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">등록된 글이 없습니다.</p>
      ) : (
        <ul className="mt-4 divide-y">
          {items.map((post) => (
            <li key={post.title + post.date} className="flex items-center justify-between gap-4 py-3">
              <span className="truncate text-sm">{post.title}</span>
              <time className="shrink-0 text-xs text-muted-foreground">{post.date}</time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 공지사항 · 주요소식 두 칸. 글은 site.config.ts 의 notices, news 에서 바꿉니다. */
export function Notices() {
  const { notices, news } = siteConfig;

  return (
    <section id="notices" className="scroll-mt-16 py-16">
      <Container className="grid gap-6 md:grid-cols-2">
        <PostList icon={<Bell className="size-5" />} title={notices.title} items={notices.items} />
        <PostList icon={<Newspaper className="size-5" />} title={news.title} items={news.items} />
      </Container>
    </section>
  );
}

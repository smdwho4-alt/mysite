import Link from "next/link";
import { Pin } from "lucide-react";

import { BOARD_INFO, formatPostDate, boardHref, type BoardCategory } from "@/lib/board-shared";
import type { PostListResult } from "@/lib/board";
import { Container } from "@/components/layout/container";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Pagination } from "@/components/board/pagination";
import { SearchForm } from "@/components/board/search-form";

/** 공지사항 / 주민자치회 소식 「목록」 화면 (두 게시판이 같은 모양을 씁니다)
    result 가 null 이면 Supabase 가 아직 연결되지 않은 상태입니다. */
export function PostListView({
  category,
  q,
  result,
}: {
  category: BoardCategory;
  q: string;
  result: PostListResult | null;
}) {
  const info = BOARD_INFO[category];

  return (
    <>
      <Navbar />
      <main className="flex-1 py-12 sm:py-16">
        <Container className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{info.title}</h1>
          <span aria-hidden className="mt-4 block h-1 w-12 rounded-full bg-highlight" />
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">{info.description}</p>

          <div className="mt-8">
            <SearchForm action={info.path} q={q} />
          </div>

          {q && result && !result.failed ? (
            <p className="mt-4 text-sm text-muted-foreground">
              「{q}」 검색 결과 {result.total.toLocaleString("ko-KR")}건 ·{" "}
              <Link href={info.path} className="underline underline-offset-4 hover:text-foreground">
                전체 보기
              </Link>
            </p>
          ) : null}

          {result === null ? (
            <p className="mt-10 rounded-xl border bg-muted/50 p-6 text-sm text-muted-foreground">
              데이터베이스가 아직 연결되지 않아 글을 보여드릴 수 없습니다.
            </p>
          ) : result.failed ? (
            <p role="alert" className="mt-10 rounded-xl border border-destructive/40 p-6 text-sm text-destructive">
              글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
            </p>
          ) : result.posts.length === 0 ? (
            <p className="mt-10 rounded-xl border bg-muted/50 p-6 text-sm text-muted-foreground">
              {q ? "검색 결과가 없습니다. 다른 검색어로 찾아보세요." : "등록된 글이 없습니다."}
            </p>
          ) : (
            <>
              <ul className="mt-6 divide-y rounded-xl border bg-card">
                {result.posts.map((post) => (
                  <li key={post.id}>
                    <Link
                      href={`${info.path}/${post.id}`}
                      className="flex flex-col gap-1 px-4 py-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {post.is_pinned ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                            <Pin className="size-3" />
                            고정
                          </span>
                        ) : null}
                        <span className="min-w-0 break-words font-medium sm:truncate">{post.title}</span>
                      </span>
                      <time dateTime={post.published_at} className="shrink-0 text-sm text-muted-foreground">
                        {formatPostDate(post.published_at)}
                      </time>
                    </Link>
                  </li>
                ))}
              </ul>
              <Pagination basePath={info.path} q={q} current={result.page} total={result.pageCount} />
              <p className="mt-4 text-center text-xs text-muted-foreground">
                총 {result.total.toLocaleString("ko-KR")}건 · {result.page}/{result.pageCount}쪽
              </p>
            </>
          )}

          {/* 다른 게시판으로 이동 */}
          <div className="mt-10 border-t pt-6 text-sm text-muted-foreground">
            <Link
              href={boardHref(category === "notice" ? BOARD_INFO.news.path : BOARD_INFO.notice.path)}
              className="underline underline-offset-4 hover:text-foreground"
            >
              {category === "notice" ? BOARD_INFO.news.title : BOARD_INFO.notice.title} 보러가기
            </Link>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}

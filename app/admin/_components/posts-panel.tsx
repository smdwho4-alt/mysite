import Link from "next/link";
import { EyeOff, Pin } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchAdminPostPage } from "@/lib/board";
import { BOARD_INFO, formatPostDate, todayInSeoul, type BoardCategory } from "@/lib/board-shared";
import { Pagination } from "@/components/board/pagination";
import { SearchForm } from "@/components/board/search-form";
import { PostForm } from "./post-form";
import { PostDeleteButton } from "./post-delete-button";

/** 관리자 「공지사항 / 주민자치회 소식」 탭 화면: 글 추가 + 목록(검색·쪽 이동) + 수정·삭제
    목록은 「로그인한 관리자의 연결」로 읽으므로 비공개·임시저장 글도 보입니다. (DB 의 RLS 가 관리자에게만 허용) */
export async function PostsPanel({
  client,
  category,
  sectionKey,
  q,
  page,
}: {
  client: SupabaseClient;
  category: BoardCategory;
  sectionKey: string;
  q: string;
  page: number;
}) {
  const info = BOARD_INFO[category];
  const today = todayInSeoul();
  const { result, details } = await fetchAdminPostPage(client, { category, q, page });

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {/* 새 글 추가 */}
      <section className="h-fit rounded-xl border p-6">
        <h2 className="mb-5 text-lg font-semibold">{info.title} 글쓰기</h2>
        <PostForm category={category} today={today} />
      </section>

      {/* 등록된 글 목록 */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">
          등록된 글 <span className="text-muted-foreground">({result.total.toLocaleString("ko-KR")})</span>
        </h2>

        <SearchForm action="/admin" q={q} hidden={{ section: sectionKey }} />
        {q ? (
          <p className="mt-3 text-sm text-muted-foreground">
            「{q}」 검색 결과 {result.total.toLocaleString("ko-KR")}건 ·{" "}
            <Link href={`/admin?section=${sectionKey}`} className="underline underline-offset-4 hover:text-foreground">
              전체 보기
            </Link>
          </p>
        ) : null}

        {result.failed ? (
          <p role="alert" className="mt-6 rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
            글을 불러오지 못했습니다. 게시판 표(posts)와 권한 설정(supabase/migrations 001~005)이 적용됐는지 확인하세요.
          </p>
        ) : result.posts.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            {q ? "검색 결과가 없습니다." : "아직 글이 없습니다. 왼쪽에서 글을 써 보세요."}
          </p>
        ) : (
          <>
            <ul className="mt-6 space-y-3">
              {result.posts.map((summary) => {
                const post = details.get(summary.id);
                const publicNow = summary.is_visible && summary.published_at <= today;
                return (
                  <li key={summary.id} className="rounded-xl border">
                    <div className="flex items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                          {summary.is_pinned ? <Pin className="size-4 shrink-0 text-primary" aria-label="고정" /> : null}
                          <span className="min-w-0 break-words">{summary.title}</span>
                          {!summary.is_visible ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              <EyeOff className="size-3" />
                              비공개
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          게시일 {formatPostDate(summary.published_at)}
                          {publicNow ? (
                            <>
                              {" · "}
                              <Link href={`${info.path}/${summary.id}`} target="_blank" className="underline underline-offset-4 hover:text-foreground">
                                사이트에서 보기
                              </Link>
                            </>
                          ) : null}
                        </p>
                      </div>
                      <PostDeleteButton id={summary.id} />
                    </div>
                    {post ? (
                      <details className="border-t px-4 py-3">
                        <summary className="cursor-pointer text-sm text-muted-foreground">수정하기</summary>
                        <div className="pt-4">
                          <PostForm category={category} today={today} post={post} />
                        </div>
                      </details>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <Pagination basePath="/admin" q={q} current={result.page} total={result.pageCount} extra={{ section: sectionKey }} />
          </>
        )}
      </section>
    </div>
  );
}

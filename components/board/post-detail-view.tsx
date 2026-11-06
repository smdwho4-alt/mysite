import Link from "next/link";
import { ArrowLeft, ExternalLink, Pin } from "lucide-react";

import { BOARD_INFO, formatPostDate, safeLinkHref, type Post } from "@/lib/board-shared";
import { Container } from "@/components/layout/container";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";

/** 공지사항 / 주민자치회 소식 「상세」 화면
    ⚠ 본문과 제목은 반드시 React 의 일반 글자 출력({post.body})으로만 그립니다. (HTML 로 해석해 넣는 방식 금지 → XSS 방지)
       줄바꿈은 whitespace-pre-wrap 으로 보여줍니다. */
export function PostDetailView({ post }: { post: Post }) {
  const info = BOARD_INFO[post.category];
  const link = safeLinkHref(post.link_url); // 저장 때 한 번, 그릴 때 한 번 더 확인

  return (
    <>
      <Navbar />
      <main className="flex-1 py-12 sm:py-16">
        <Container className="max-w-3xl">
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href={info.path}>
              <ArrowLeft />
              {info.title} 목록
            </Link>
          </Button>

          <article className="mt-6">
            <p className="text-sm font-medium text-muted-foreground">{info.title}</p>
            <h1 className="mt-2 break-words text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
              {post.is_pinned ? (
                <span className="mr-2 inline-flex translate-y-[-2px] items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 align-middle text-xs font-semibold text-primary-foreground">
                  <Pin className="size-3" />
                  고정
                </span>
              ) : null}
              {post.title}
            </h1>
            <time dateTime={post.published_at} className="mt-3 block text-sm text-muted-foreground">
              {formatPostDate(post.published_at)}
            </time>

            <div className="mt-8 border-t pt-8">
              {post.body ? (
                <div className="whitespace-pre-wrap break-words text-base leading-relaxed">{post.body}</div>
              ) : (
                <p className="text-sm text-muted-foreground">본문이 없는 글입니다.</p>
              )}
            </div>

            {link ? (
              <div className="mt-8">
                <Button asChild variant="outline">
                  {link.external ? (
                    <a href={link.href} target="_blank" rel="noopener noreferrer">
                      관련 링크 열기
                      <ExternalLink />
                    </a>
                  ) : (
                    <Link href={link.href}>
                      관련 페이지로 이동
                      <ExternalLink />
                    </Link>
                  )}
                </Button>
              </div>
            ) : null}
          </article>
        </Container>
      </main>
      <Footer />
    </>
  );
}

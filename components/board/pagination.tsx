import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { boardHref, paginationWindow } from "@/lib/board-shared";
import { cn } from "@/lib/utils";

const itemClass =
  "inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm transition-colors";

/** 쪽 이동 (이전 · 번호 · 다음). 검색어와 추가 주소 값(extra)을 유지한 채 이동합니다. 쪽이 1개뿐이면 그리지 않음. */
export function Pagination({
  basePath,
  q,
  current,
  total,
  extra,
}: {
  basePath: string;
  q: string;
  current: number;
  total: number;
  extra?: Record<string, string>;
}) {
  if (total <= 1) return null;
  const numbers = paginationWindow(current, total);
  const href = (page: number) => boardHref(basePath, { q, page, extra });

  return (
    <nav aria-label="쪽 이동" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      {current > 1 ? (
        <Link href={href(current - 1)} className={cn(itemClass, "hover:bg-muted")} aria-label="이전 쪽">
          <ChevronLeft className="size-4" />
        </Link>
      ) : (
        <span aria-hidden className={cn(itemClass, "pointer-events-none opacity-40")}>
          <ChevronLeft className="size-4" />
        </span>
      )}

      {numbers.map((n) => (
        <Link
          key={n}
          href={href(n)}
          aria-current={n === current ? "page" : undefined}
          className={cn(itemClass, n === current ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
        >
          {n}
        </Link>
      ))}

      {current < total ? (
        <Link href={href(current + 1)} className={cn(itemClass, "hover:bg-muted")} aria-label="다음 쪽">
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span aria-hidden className={cn(itemClass, "pointer-events-none opacity-40")}>
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}

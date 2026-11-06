import { Search } from "lucide-react";

import { SEARCH_MAX_CHARS } from "@/lib/board-shared";
import { Button } from "@/components/ui/button";

/** 제목·본문 검색 칸. 자바스크립트 없이 동작하는 일반 폼(GET)이라 주소(?q=)로 검색 결과를 공유할 수 있습니다.
    hidden 에는 관리자 화면처럼 함께 유지해야 하는 주소 값(예: section)을 넣습니다. */
export function SearchForm({
  action,
  q,
  hidden,
}: {
  action: string;
  q: string;
  hidden?: Record<string, string>;
}) {
  return (
    <form action={action} method="get" role="search" className="flex gap-2">
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label className="sr-only" htmlFor="board-search">
        제목·내용 검색
      </label>
      <input
        id="board-search"
        name="q"
        type="search"
        defaultValue={q}
        maxLength={SEARCH_MAX_CHARS}
        placeholder="제목·내용 검색"
        className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/50"
      />
      <Button type="submit" variant="outline" className="shrink-0">
        <Search />
        검색
      </Button>
    </form>
  );
}

import { Megaphone } from "lucide-react";

import { siteConfig } from "@/site.config";
import { Container } from "@/components/layout/container";

/** 첫 화면 바로 아래 한 줄짜리 공지 띠. site.config.ts 의 notices.items 첫 번째 글이 나옵니다. */
export function NoticeBar() {
  const latest = siteConfig.notices.items[0];
  if (!latest) return null;

  return (
    <div className="bg-primary text-primary-foreground">
      <Container className="flex items-center gap-3 py-3 text-sm">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold">
          <Megaphone className="size-3.5" />
          공지
        </span>
        <a href="#notices" className="truncate hover:underline">
          {latest.title}
        </a>
      </Container>
    </div>
  );
}

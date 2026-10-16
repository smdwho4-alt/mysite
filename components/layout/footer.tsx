import Link from "next/link";

import { siteConfig } from "@/site.config";
import { Container } from "@/components/layout/container";

/** 맨 아래 영역. 오른쪽 끝의 작은 점(•)이 관리자 페이지로 가는 숨은 버튼입니다. */
export function Footer() {
  return (
    <footer className="border-t border-border/60 py-10">
      <Container className="flex flex-col items-start justify-between gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center">
        <p>{siteConfig.footer.copyright}</p>
        <div className="flex items-center gap-6">
          {siteConfig.nav.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-foreground">
              {item.label}
            </a>
          ))}
          {/* 숨은 관리자 버튼 */}
          <Link
            href="/admin"
            aria-label="관리자"
            className="opacity-30 transition-opacity hover:opacity-100"
          >
            •
          </Link>
        </div>
      </Container>
    </footer>
  );
}

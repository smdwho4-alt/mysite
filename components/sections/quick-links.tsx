import { BookOpen, Image as ImageIcon, Link2, Map, Megaphone, MessageCircle, Newspaper } from "lucide-react";

import { siteConfig } from "@/site.config";
import { Container } from "@/components/layout/container";
import { SectionHeader } from "@/components/layout/section-header";

/* site.config.ts 의 quickLinks.items 에 적는 icon 이름 → 실제 아이콘 */
const icons = {
  book: BookOpen,
  megaphone: Megaphone,
  image: ImageIcon,
  newspaper: Newspaper,
  message: MessageCircle,
  map: Map,
};

/** 바로가기 섹션 (아이콘 메뉴). 항목은 site.config.ts 의 quickLinks 에서 바꿉니다. */
export function QuickLinks() {
  const { quickLinks } = siteConfig;

  return (
    <section id="quick-links" className="scroll-mt-16 bg-muted/50 py-24">
      <Container>
        <SectionHeader
          eyebrow={quickLinks.eyebrow}
          title={quickLinks.title}
          description={quickLinks.description}
        />
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {quickLinks.items.map((link) => {
            const Icon = icons[link.icon as keyof typeof icons] ?? Link2;
            return (
              <a
                key={link.label}
                href={link.href}
                className="group flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-6 text-center transition-shadow hover:shadow-md"
              >
                <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-5" />
                </span>
                <span className="text-sm font-medium">{link.label}</span>
              </a>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

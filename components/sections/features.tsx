import Image from "next/image";
import { ArrowUpRight, Sparkles } from "lucide-react";

import { siteConfig } from "@/site.config";
import { getItems } from "@/lib/data";
import { Container } from "@/components/layout/container";
import { SectionHeader } from "@/components/layout/section-header";

/* 기능(항목) 섹션.
   - 제목/설명: site.config.ts 의 features
   - 카드 목록: 관리자 페이지(/admin)에서 관리 (Supabase 연결 전에는 예시 카드가 보임) */
export async function Features() {
  const { features } = siteConfig;
  const items = await getItems("features");

  return (
    <section id="features" className="scroll-mt-16 py-24">
      <Container>
        <SectionHeader
          eyebrow={features.eyebrow}
          title={features.title}
          description={features.description}
        />

        {items.length === 0 ? (
          <p className="mt-12 text-muted-foreground">아직 등록된 항목이 없습니다.</p>
        ) : (
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const card = (
                <article className="group h-full overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-lg">
                  <div className="relative aspect-[4/3] bg-muted">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.title}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Sparkles className="size-8" />
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <h3 className="flex items-center justify-between gap-2 text-lg font-semibold">
                      {item.title}
                      {item.link_url ? (
                        <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      ) : null}
                    </h3>
                    {item.description ? (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                </article>
              );

              return item.link_url ? (
                <a key={item.id} href={item.link_url} target="_blank" rel="noreferrer">
                  {card}
                </a>
              ) : (
                <div key={item.id}>{card}</div>
              );
            })}
          </div>
        )}
      </Container>
    </section>
  );
}

import Image from "next/image";

import { siteConfig } from "@/site.config";
import { Container } from "@/components/layout/container";
import { SectionHeader } from "@/components/layout/section-header";

/** 소개 섹션. 글자는 site.config.ts 의 about 에서 바꿉니다. */
export function About() {
  const { about } = siteConfig;

  return (
    <section id="about" className="scroll-mt-16 bg-muted/50 py-24">
      <Container className="grid gap-12 md:grid-cols-2 md:items-center">
        <div>
          <SectionHeader eyebrow={about.eyebrow} title={about.title} />
          <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
            {about.paragraphs.map((text, i) => (
              <p key={i}>{text}</p>
            ))}
          </div>
        </div>
        {/* 그림은 site.config.ts 의 about.image 에서 바꿉니다. 지도 글자와 출처 표시가 잘리지 않게 원본 비율 그대로 보여줍니다. */}
        <Image
          src={about.image.src}
          alt={about.image.alt}
          width={1243}
          height={867}
          sizes="(min-width: 768px) 50vw, 100vw"
          className="h-auto w-full rounded-xl border bg-background"
        />
      </Container>
    </section>
  );
}

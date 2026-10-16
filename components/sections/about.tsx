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
        {/* 이미지 자리: public 폴더에 사진을 넣고 <img src="/사진이름.jpg" /> 로 바꿔 보세요 */}
        <div className="aspect-[4/3] w-full rounded-xl border bg-background" />
      </Container>
    </section>
  );
}

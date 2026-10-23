import { ArrowRight } from "lucide-react";

import { siteConfig } from "@/site.config";
import { getHeroTexts } from "@/lib/data";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

/* 첫 화면(히어로).
   - 글자는 관리자 페이지(/admin)의 「히어로 글자」 탭에서 바꿉니다.
     (저장한 적 없는 칸은 site.config.ts 의 hero 글자가 보입니다)
   - 21st.dev 의 멋진 히어로로 바꾸고 싶다면: 그 컴포넌트를 components/ui 에 넣고,
     이 파일의 <section> 안쪽을 그 컴포넌트로 감싸면 됩니다. (Claude에게 /add-component 로 요청) */
export async function Hero() {
  const { hero } = siteConfig;
  const texts = await getHeroTexts();

  return (
    <section id="top" className="relative overflow-hidden">
      <Container className="flex min-h-[80svh] flex-col justify-center py-24">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {texts["hero.eyebrow"]}
        </p>
        <h1 className="mt-5 max-w-4xl whitespace-pre-line text-5xl font-semibold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">
          {texts["hero.title"]}
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          {texts["hero.description"]}
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <a href={hero.primaryCta.href}>
              {texts["hero.primaryCta"]}
              <ArrowRight />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={hero.secondaryCta.href}>{texts["hero.secondaryCta"]}</a>
          </Button>
        </div>
      </Container>
    </section>
  );
}

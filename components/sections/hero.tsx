import Image from "next/image";
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
    <section id="top" className="relative overflow-hidden bg-hero">
      {/* 배경 그림 (site.config.ts 의 hero.backgroundImage)
          - 컴퓨터: 오른쪽에 크게 / 휴대폰: 글자 뒤에 흐리게
          - mix-blend-multiply: 그림의 흰 바탕이 배경색에 자연스럽게 섞이게 함 */}
      {hero.backgroundImage ? (
        <div className="pointer-events-none absolute inset-0 md:left-auto md:w-1/2 lg:right-[4%] lg:w-[46%]">
          <Image
            src={hero.backgroundImage}
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-contain object-center opacity-25 mix-blend-multiply md:opacity-100"
          />
        </div>
      ) : null}
      <Container className="relative flex min-h-[80svh] flex-col justify-center py-24">
        <div className="md:max-w-[52%]">
        {hero.eyebrowImage ? (
          // 작은 제목 자리의 로고 (관리자에서 쓴 작은 제목 글자는 그림 설명으로 쓰임)
          <Image
            src={hero.eyebrowImage}
            alt={texts["hero.eyebrow"]}
            width={184}
            height={76}
            priority
            className="h-12 w-auto mix-blend-multiply sm:h-14"
          />
        ) : (
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {texts["hero.eyebrow"]}
          </p>
        )}
        <h1 className="mt-5 max-w-4xl whitespace-pre-line text-5xl font-semibold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">
          {texts["hero.title"]}
        </h1>
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
        </div>
      </Container>
    </section>
  );
}

import { Mail, Phone } from "lucide-react";

import { siteConfig } from "@/site.config";
import { Container } from "@/components/layout/container";
import { SectionHeader } from "@/components/layout/section-header";
import { Button } from "@/components/ui/button";

/** 연락처 섹션. 전화번호, 이메일, 링크는 site.config.ts 의 contact 에서 바꿉니다. */
export function Contact() {
  const { contact } = siteConfig;

  return (
    <section id="contact" className="scroll-mt-16 py-24">
      <Container>
        <div className="rounded-2xl border bg-muted/50 px-6 py-16 text-center sm:px-12">
          <SectionHeader
            eyebrow={contact.eyebrow}
            title={contact.title}
            className="mx-auto"
          />
          <p className="mt-4">
            <a
              href={`tel:${contact.phone}`}
              className="inline-flex items-center gap-2 text-xl font-semibold text-primary hover:underline"
            >
              <Phone className="size-5" />
              {contact.phone}
            </a>
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            {contact.description}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <a href={`mailto:${contact.email}`}>
                <Mail />
                {contact.email}
              </a>
            </Button>
            {contact.links.map((link) => (
              <Button key={link.href} asChild size="lg" variant="outline">
                <a href={link.href} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
              </Button>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

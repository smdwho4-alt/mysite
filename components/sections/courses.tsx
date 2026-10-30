import { CalendarDays, Clock, MapPin, Ticket, User } from "lucide-react";

import { siteConfig } from "@/site.config";
import { cn } from "@/lib/utils";
import { Container } from "@/components/layout/container";
import { SectionHeader } from "@/components/layout/section-header";

/* 강좌 안내 섹션.
   - 글은 site.config.ts 의 courses 에서 바꿉니다.
   - 카드가 많으면 옆으로 밀어서(스크롤) 넘겨 볼 수 있습니다. */
export function Courses() {
  const { courses } = siteConfig;

  return (
    <section id="courses" className="scroll-mt-16 py-24">
      <Container>
        <SectionHeader eyebrow={courses.eyebrow} title={courses.title} description={courses.description} />

        <div className="-mx-5 mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 sm:-mx-8 sm:px-8">
          {courses.items.map((course) => {
            const closed = course.status === "마감";
            return (
              <article
                key={course.title}
                className={cn(
                  "w-[17rem] shrink-0 snap-start rounded-xl border bg-card p-6 sm:w-[19rem]",
                  closed && "opacity-70",
                )}
              >
                <span
                  className={cn(
                    "inline-block rounded-full px-2.5 py-1 text-xs font-semibold",
                    closed ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
                  )}
                >
                  {course.status}
                </span>
                <h3 className="mt-4 text-lg font-semibold leading-snug">{course.title}</h3>
                <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CalendarDays className="size-4 shrink-0" /> {course.date}
                  </li>
                  <li className="flex items-center gap-2">
                    <Clock className="size-4 shrink-0" /> {course.time}
                  </li>
                  <li className="flex items-center gap-2">
                    <MapPin className="size-4 shrink-0" /> {course.place}
                  </li>
                  <li className="flex items-center gap-2">
                    <User className="size-4 shrink-0" /> {course.teacher}
                  </li>
                  <li className="flex items-center gap-2 font-medium text-primary">
                    <Ticket className="size-4 shrink-0" /> {course.fee}
                  </li>
                </ul>
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

@AGENTS.md

# 이 프로젝트에서 Claude가 지켜야 할 규칙

## 사용자에 대해
- 사용자는 **비개발자**입니다. 코드를 직접 쓰지 않고, 화면을 보며 요청합니다.
- 항상 **한국어**로, 전문용어는 쉬운 말로 풀어서 설명하세요. (예: "컴포넌트" → "화면 조각")
- 작업이 끝나면 **무엇을, 어느 파일에서, 왜** 바꿨는지 3줄 이내로 요약하세요.
- 확인할 방법을 알려주세요. (예: "브라우저에서 새로고침 후 맨 위를 보세요")

## 작업 방식
- **작게, 한 번에 하나씩.** 요청받은 것만 바꾸고, 요청하지 않은 파일은 건드리지 마세요.
- 여러 파일을 크게 바꾸거나 새 패키지를 설치해야 하면 **먼저 계획을 말하고 허락을 받으세요.**
- 요청이 모호하면 추측해서 크게 바꾸지 말고, 선택지 2~3개를 짧게 물어보세요.
- **개발 서버(npm run dev)는 사용자가 직접 켜 둡니다.** 직접 실행하지 마세요. 확인이 필요하면 `npm run build` 나 `npm run lint` 를 쓰세요.
- `node_modules`, `.next` 폴더는 읽지 마세요. (사용량 낭비)

## 절대 하지 말 것
- `.env.local` 파일을 읽거나, 내용을 화면에 출력하거나, 수정하지 마세요. (비밀 키)
- 비밀 키를 코드에 직접 적지 마세요. `SUPABASE_SECRET_KEY` 는 `lib/supabase-admin.ts` 에서만 사용합니다.
- 사용자가 요청하지 않은 파일 삭제, `git push`, `git reset --hard` 를 하지 마세요.
- `lib/admin-auth.ts`, `app/admin/actions.ts` 의 로그인 확인(`isAdmin`) 부분을 없애지 마세요.

## 프로젝트 지도 (어디에 무엇이 있나)
| 바꾸고 싶은 것 | 파일 |
|---|---|
| 사이트 글자 (이름, 소개, 메뉴, 연락처) | `site.config.ts` |
| 색, 폰트, 모서리 둥글기 (디자인 토큰) | `app/globals.css` 의 `:root` |
| 섹션 순서 / 추가 / 삭제 | `app/page.tsx` |
| 각 섹션 모양 | `components/sections/*.tsx` |
| 상단 메뉴 / 하단 푸터 | `components/layout/navbar.tsx`, `footer.tsx` |
| 버튼 등 공용 부품, 21st.dev·shadcn 컴포넌트 | `components/ui/` |
| 관리자 페이지 | `app/admin/` |
| 관리자에서 관리할 섹션 목록 | `site.config.ts` 의 `adminSections` |
| 데이터베이스 구조 | `supabase/schema.sql` |
| 디자인 참고 이미지 (캡처, 시안) | `design/references/` |

## 기술 스택
- Next.js (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui 구조 + Supabase + Vercel 배포
- 경로 별칭: `@/` = 프로젝트 최상위 폴더
- 아이콘: `lucide-react`
- 클래스 합치기: `@/lib/utils` 의 `cn()`

## 디자인 규칙 (디자인을 유연하게 바꾸기 위한 약속)
- 색은 `#xxxxxx` 를 컴포넌트에 직접 쓰지 말고 **디자인 토큰 클래스**를 쓰세요:
  `bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`, `border` 등.
  → 그래야 `app/globals.css` 만 바꿔도 사이트 전체가 바뀝니다.
- 디자인 시안(캡처 이미지)을 적용할 때 순서:
  1. 먼저 `app/globals.css` 의 토큰(색, 폰트, radius)을 시안에 맞게 바꾼다.
  2. 그다음 섹션 파일의 배치(레이아웃)를 바꾼다.
  3. 글자 내용은 `site.config.ts` 에서 가져오는 구조를 유지한다.
- 새 섹션은 `components/sections/` 에 만들고, `Container`, `SectionHeader` 를 재사용하세요.
- 모바일(390px)과 데스크톱(1440px) 모두에서 깨지지 않게 만드세요.

## 21st.dev / shadcn 컴포넌트를 넣을 때
- 컴포넌트 파일은 `components/ui/` 에 넣습니다. (`components.json` 이 이미 설정됨)
- shadcn 컴포넌트는 `npx shadcn@latest add <이름>` 으로 설치합니다.
- 필요한 npm 패키지가 있으면 **설치 전에 목록을 보여주고 허락**을 받으세요.
- 데모(demo.tsx) 코드는 그대로 페이지에 넣지 말고, `components/sections/` 에 섹션으로 감싸서 `site.config.ts` 의 글자를 쓰도록 바꾸세요.
- 기존 섹션을 교체할 때는 원래 파일을 지우지 말고 `app/page.tsx` 에서 바꿔 끼우세요. (되돌리기 쉽게)

## 배포 전 확인
- `npm run build` 가 에러 없이 끝나는지 확인하세요.
- Vercel 에 `.env.local` 과 같은 환경변수 4개가 등록돼 있어야 한다고 알려주세요.

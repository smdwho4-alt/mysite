# Vibe Starter — 바이브 코딩 웹사이트 스타터

비개발자가 **Claude Code**와 함께 웹사이트를 만들기 위한 출발점입니다.
처음 받자마자 실행되고, 글자·색·섹션을 바꿔 가며 나만의 사이트로 키워 나갑니다.

| 들어 있는 것 | 설명 |
|---|---|
| 네비바 · 히어로 · 소개 · 기능 · 연락처 · 푸터 | 어떤 사이트에도 쓰는 기본 섹션 |
| 관리자 페이지 (`/admin`) | 비밀번호로 들어가서 카드(항목)를 추가·수정·삭제, 이미지 업로드 |
| 디자인 토큰 | `app/globals.css` 한 곳만 바꾸면 전체 색·폰트가 바뀜 |
| shadcn / 21st.dev 준비 | `components/ui` 폴더와 설정이 되어 있어 외부 컴포넌트를 바로 넣을 수 있음 |
| `CLAUDE.md` | Claude Code가 자동으로 읽는 이 프로젝트의 규칙 |
| Claude 전용 명령어 | `/design` `/add-component` `/check` `/save` `/explain` |

---

## 1. 시작하기 (처음 한 번)

> 준비물: Node.js, Git, Claude Code 설치 + GitHub 계정 (설치 가이드 문서 참고)

### ① 내 저장소 만들기
1. 강사가 알려준 템플릿 주소로 들어갑니다.
2. 초록색 **Use this template → Create a new repository** 클릭
3. Repository name 에 영문 이름(예: `my-site`) 입력, **Private** 선택 → **Create repository**

### ② 내 컴퓨터로 가져오기
1. 내 저장소 화면에서 초록색 **Code** 버튼 → 주소(https://github.com/...git) 복사
2. 작업할 폴더(예: 문서)에서 터미널을 열고:
   ```
   git clone 복사한주소
   cd my-site
   ```
   (처음이면 GitHub 로그인 창이 뜹니다. 로그인하면 됩니다.)

### ③ 실행하기
```
npm install
npm run dev
```
브라우저에서 **http://localhost:3000** 을 열면 사이트가 보입니다. 🎉
- `npm install` 은 처음 한 번만 (부품 설치, 1~3분)
- `npm run dev` 는 작업할 때마다. 끄려면 터미널에서 `Ctrl + C`

### ④ Claude Code 켜기
**터미널을 하나 더** 열고 같은 폴더에서:
```
claude
```
(또는 Claude 데스크톱 앱의 **Code** 탭에서 이 폴더를 선택)

> 💡 터미널 2개: 하나는 `npm run dev`(사이트 실행용), 하나는 `claude`(대화용)

---

## 2. 무엇을 어디서 바꾸나

| 바꾸고 싶은 것 | 직접 바꾸기 | Claude에게 말하기 예시 |
|---|---|---|
| 이름, 소개 글, 메뉴, 연락처 | `site.config.ts` | "히어로 제목을 '안녕하세요, 추우주입니다'로 바꿔줘" |
| 색, 폰트, 모서리 | `app/globals.css` 맨 위 `:root` | "포인트 색을 #9a0002 로 바꿔줘" |
| 섹션 순서, 빼기 | `app/page.tsx` | "소개 섹션을 기능 섹션 아래로 옮겨줘" |
| 디자인 통째로 | — | `/design` + 시안 이미지 |
| 21st.dev 컴포넌트 | — | `/add-component` + 복사한 프롬프트 붙여넣기 |

### 좋은 요청 문장 = **어디를 + 무엇으로 + 얼마나**
- ❌ "좀 더 예쁘게 해줘"
- ✅ "기능 섹션 카드의 모서리를 더 둥글게 하고, 마우스를 올리면 살짝 떠오르게 해줘"

---

## 3. Claude 전용 명령어

Claude Code 입력창에 `/` 를 치면 목록이 나옵니다.

| 명령어 | 하는 일 |
|---|---|
| `/design 요청` | 시안 이미지(첨부 또는 `design/references/`)를 보고 디자인 변경 |
| `/add-component 붙여넣기` | 21st.dev 등에서 복사한 컴포넌트를 이 프로젝트에 맞게 넣기 |
| `/save 메모` | 지금 상태를 저장점(커밋)으로 남기기 |
| `/check` | 배포 전 점검 (빌드, 비밀 키 노출 여부 등) |
| `/explain 궁금한 것` | 구조나 방금 바뀐 내용을 쉽게 설명 |
| `/clear` | 대화 초기화 (작업 하나 끝날 때마다 쓰면 사용량 절약) |

**망가졌을 때:** "마지막 저장점으로 되돌려줘" 라고 말하세요. 그래서 `/save` 를 자주 하는 게 중요합니다.

---

## 4. 관리자 페이지 쓰기

1. `.env.example` 파일을 복사 → 이름을 **`.env.local`** 로 변경
2. `ADMIN_PASSWORD=` 뒤에 비밀번호 입력 후 저장
3. 개발 서버 재시작 (`Ctrl + C` → `npm run dev`)
4. 사이트 맨 아래 오른쪽의 작은 점 **•** 클릭 (또는 주소창에 `/admin`)

> Supabase를 연결하기 전에는 로그인까지만 되고, 카드 관리는 연결 후에 됩니다.
> 연결 전에는 사이트에 `site.config.ts` 의 예시 카드가 보입니다.

**관리할 섹션 늘리기:** `site.config.ts` 의 `adminSections` 에 한 줄 추가
(예: `{ key: "works", label: "작업물" }`) → Claude에게 "works 섹션을 사이트에 보여주는 섹션 만들어줘"

---

## 5. Supabase 연결하기 (데이터베이스)

1. [supabase.com](https://supabase.com) → **New project** (지역: Northeast Asia (Seoul))
2. 왼쪽 **SQL Editor** → **New query** → 이 프로젝트의 `supabase/schema.sql` 내용 전체 붙여넣기 → **Run**
3. **Project Settings** 에서 값 3개를 복사해 `.env.local` 에 붙여넣기
   - `NEXT_PUBLIC_SUPABASE_URL` ← Data API 의 Project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ← API Keys 의 Publishable key
   - `SUPABASE_SECRET_KEY` ← API Keys 의 Secret key (**절대 공유 금지**)
4. 개발 서버 재시작 → `/admin` 에서 카드 추가해 보기

---

## 6. 배포하기 (Vercel)

1. Claude에게 `/check` → 문제 없으면 "GitHub에 push 해줘"
2. [vercel.com](https://vercel.com) → **Add New → Project** → 내 저장소 **Import**
3. **Environment Variables** 에 `.env.local` 의 4개 값을 똑같이 입력
4. **Deploy** → 1~2분 뒤 `xxx.vercel.app` 주소가 생깁니다
5. 이후에는 push 할 때마다 자동으로 다시 배포됩니다

---

## 7. 자주 만나는 문제

| 증상 | 해결 |
|---|---|
| `'npm' 은(는) ... 인식되지 않습니다` | Node.js 설치 후 **터미널을 새로 열기** |
| `Port 3000 is in use` | 이미 켜진 서버가 있음. 그 터미널에서 `Ctrl + C` 또는 3001 주소로 접속 |
| `.env.local` 을 바꿨는데 반영 안 됨 | 개발 서버 재시작 |
| 화면이 하얗고 에러 | 에러 문구를 그대로 Claude에게 붙여넣고 "이 에러 고쳐줘" |
| Vercel 배포만 실패 | Vercel 환경변수 4개 확인 → Claude에게 `/check` |
| Claude 사용량이 금방 참 | 작업마다 `/clear`, 요청을 구체적으로, 큰 변경은 한 번에 하나씩 |

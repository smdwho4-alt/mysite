/* ==========================================================================
   ★ 사이트 내용 설정 파일
   --------------------------------------------------------------------------
   사이트에 보이는 글자(이름, 소개, 메뉴, 연락처 등)는 대부분 여기에 있습니다.
   따옴표 " " 안의 글자만 바꾸고 저장하면 화면에 바로 반영됩니다.
   (따옴표, 쉼표, 중괄호 { } 는 지우지 않도록 조심!)
   ========================================================================== */

import type { Item } from "@/lib/types";

export const siteConfig = {
  /* 브라우저 탭 제목과 검색 결과에 보이는 정보 */
  name: "My Studio",
  /* 상단 메뉴 왼쪽 로고 그림 (public 폴더 안의 경로). 글자(name)로 되돌리려면 "" 로 비우기 */
  logo: "/images/site-logo.png",
  title: "My Studio — 나의 첫 웹사이트",
  description: "바이브 코딩으로 만든 나의 웹사이트입니다.",

  /* 상단 메뉴 (href 의 #이름 은 아래 섹션의 id 와 같아야 해당 위치로 이동) */
  nav: [
    { label: "공지", href: "#notices" },
    { label: "소개", href: "#about" },
    { label: "강좌", href: "#courses" },
    { label: "기능", href: "#features" },
    { label: "연락처", href: "#contact" },
  ],

  /* 상단 메뉴 맨 오른쪽 버튼 (누르면 새 탭에서 관리자 페이지가 열림) */
  secretButton: { label: "비밀 버튼", href: "/admin" },

  /* 첫 화면(히어로) */
  hero: {
    eyebrow: "Hello, World",
    title: "생각을 바로\n화면으로 만듭니다",
    description:
      "이 문장을 바꿔 나를 소개해 보세요. site.config.ts 파일에서 글자만 바꾸면 여기가 바뀝니다.",
    primaryCta: { label: "더 알아보기", href: "#features" },
    secondaryCta: { label: "연락하기", href: "#contact" },
    /* 배경 그림: public 폴더 안의 경로. 그림을 빼려면 "" 로 비우기 */
    backgroundImage: "/images/hero-bg.png",
    /* 작은 제목 자리에 글자 대신 보여줄 로고. 글자로 되돌리려면 "" 로 비우기 */
    eyebrowImage: "/images/hero-logo.png",
  },

  /* 공지사항 · 주요소식 (첫 화면 아래 두 칸)
     - 공지 띠(첫 화면 바로 아래 한 줄)에는 notices.items 의 첫 번째 글이 나옵니다.
     - 글을 추가하려면 { title: "...", date: "YYYY-MM-DD" } 한 줄을 맨 위에 복사해 넣으세요. */
  notices: {
    title: "공지사항",
    items: [
      { title: "가을 정기 모임 및 작은 발표회 안내", date: "2026-10-20" },
      { title: "11월 원데이 클래스 참가자 모집", date: "2026-10-05" },
      { title: "홈페이지를 새롭게 단장했습니다", date: "2026-09-12" },
    ],
  },
  news: {
    title: "주요소식",
    items: [
      { title: "AI 활용 강좌 1기 수료", date: "2026-09-30" },
      { title: "지역 도서관과 협력 프로그램 시작", date: "2026-08-18" },
    ],
  },

  /* 강좌 안내 (옆으로 넘기는 카드)
     status: "모집중" 또는 "마감" */
  courses: {
    eyebrow: "Classes",
    title: "강좌 안내",
    description: "함께 배우고 나누는 강좌를 소개합니다.",
    items: [
      {
        title: "처음 만나는 생성형 AI",
        status: "모집중",
        date: "2026-11-07",
        time: "10:00~11:30",
        place: "작업 공간 세미나실",
        teacher: "이상호",
        fee: "무료",
      },
      {
        title: "말로 만드는 나만의 웹사이트",
        status: "모집중",
        date: "2026-11-14",
        time: "10:00~12:00",
        place: "작업 공간 세미나실",
        teacher: "이상호",
        fee: "무료",
      },
      {
        title: "스마트폰 사진 잘 찍는 법",
        status: "마감",
        date: "2026-10-24",
        time: "14:00~15:30",
        place: "작업 공간 2층",
        teacher: "초청 강사",
        fee: "무료",
      },
      {
        title: "업무 문서 자동화 맛보기",
        status: "마감",
        date: "2026-10-10",
        time: "14:00~16:00",
        place: "작업 공간 2층",
        teacher: "이상호",
        fee: "무료",
      },
    ],
  },

  /* 바로가기 (아이콘 메뉴)
     icon 에 쓸 수 있는 이름: book, megaphone, image, newspaper, message, map */
  quickLinks: {
    eyebrow: "Quick Menu",
    title: "바로가기",
    description: "자주 찾는 메뉴를 빠르게 이용하세요.",
    items: [
      { label: "강좌 신청", href: "#courses", icon: "book" },
      { label: "공지사항", href: "#notices", icon: "megaphone" },
      { label: "활동 모음", href: "#features", icon: "image" },
      { label: "소식지", href: "#notices", icon: "newspaper" },
      { label: "문의하기", href: "#contact", icon: "message" },
      { label: "오시는 길", href: "#contact", icon: "map" },
    ],
  },

  /* 소개 섹션 */
  about: {
    eyebrow: "About",
    title: "마을 소개",
    paragraphs: [
      "일봉동(日峰洞)은 충남 천안시 동남구의 행정동입니다. 다가동과 용곡동, 두 법정동으로 이루어져 있으며 동네 이름은 그 사이에 자리한 일봉산에서 따왔습니다.",
      "면적 약 2.7㎢에 8,700여 가구, 2만 3천여 명의 주민이 28개 통·170개 반을 이루어 살고 있습니다.",
      "일봉산 근린공원을 기준으로 북쪽에는 공구상가 거리와 오래된 주택가가, 남쪽에는 새로 들어선 아파트 단지가 자리합니다. 지하철 1호선이 지나는 다가동은 교통의 중심이고, 용곡동은 천안을 대표하는 주거지입니다.",
      "천안천을 따라 이어진 산책로는 주민들의 쉼터이며, 일봉초·용소초·용곡중학교가 동네 아이들의 배움터입니다.",
    ],
  },

  /* 기능(항목) 섹션의 제목 — 카드 목록 자체는 관리자 페이지(/admin)에서 관리 */
  features: {
    eyebrow: "Features",
    title: "기능",
    description: "관리자 페이지에서 카드를 추가·수정·삭제할 수 있는 영역입니다.",
  },

  /* 연락처 섹션 */
  contact: {
    eyebrow: "Contact",
    title: "함께 이야기해요",
    description: "궁금한 점이 있다면 언제든 연락 주세요.",
    email: "hello@example.com",
    links: [
      { label: "Instagram", href: "https://instagram.com" },
      { label: "GitHub", href: "https://github.com" },
    ],
  },

  /* 맨 아래(푸터) */
  footer: {
    copyright: "© 2026 My Studio. All rights reserved.",
  },

  /* 관리자 페이지에서 관리할 섹션 목록.
     key  = 데이터베이스에 저장되는 이름(영문 소문자),
     label = 관리자 화면에 보이는 이름.
     예) 포트폴리오라면 { key: "works", label: "작업물" } 을 추가 */
  adminSections: [{ key: "features", label: "기능" }],
};

/* Supabase를 아직 연결하지 않았을 때 대신 보여줄 예시 카드.
   Supabase를 연결하면 이 내용 대신 관리자 페이지에서 등록한 카드가 보입니다. */
export const sampleItems: Item[] = [
  {
    id: "sample-1",
    section: "features",
    title: "첫 번째 기능",
    description: "카드 하나에 제목, 설명, 이미지, 링크를 넣을 수 있어요.",
    image_url: null,
    link_url: null,
    sort_order: 1,
    is_visible: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "sample-2",
    section: "features",
    title: "두 번째 기능",
    description: "관리자 페이지에서 순서를 바꾸거나 숨길 수도 있어요.",
    image_url: null,
    link_url: null,
    sort_order: 2,
    is_visible: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "sample-3",
    section: "features",
    title: "세 번째 기능",
    description: "포트폴리오라면 작업물, 가게라면 메뉴처럼 자유롭게 쓰세요.",
    image_url: null,
    link_url: null,
    sort_order: 3,
    is_visible: true,
    created_at: "2026-01-01T00:00:00Z",
  },
];

/** 관리자 페이지에서 관리하는 카드(항목) 한 개의 모양. supabase/schema.sql 의 items 테이블과 같습니다. */
export type Item = {
  id: string;
  /** 어느 섹션에 속하는지 (예: "features") */
  section: string;
  title: string;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  /** 작은 숫자가 먼저 보임 */
  sort_order: number;
  /** false 면 사이트에서 숨김 */
  is_visible: boolean;
  created_at: string;
};

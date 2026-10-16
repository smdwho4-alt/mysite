import "server-only"; // 이 파일은 서버에서만 실행됨 (비밀 키가 브라우저로 새지 않게)
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
/* 비밀 키: 새 이름(SECRET)과 예전 이름(SERVICE_ROLE) 둘 다 지원 */
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

/** 이미지 저장 공간(버킷) 이름 — supabase/schema.sql 과 같아야 함 */
export const IMAGE_BUCKET = "images";

/** 관리자 전용 '쓰기 가능' 연결. 연결 정보가 없으면 null. */
export function getAdminClient() {
  if (!url || !secretKey) return null;
  return createClient(url, secretKey, { auth: { persistSession: false } });
}

import { createClient } from "@supabase/supabase-js";

/* Supabase 연결 정보는 .env.local 파일에서 읽어옵니다. (.env.example 참고)
   새 키 이름(PUBLISHABLE)과 예전 키 이름(ANON) 둘 다 지원합니다. */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Supabase가 연결되어 있는지 여부 */
export const isSupabaseReady = Boolean(url && publicKey);

/** 누구나 쓰는 '읽기 전용' 연결. 연결 정보가 없으면 null. */
export function getPublicClient() {
  if (!url || !publicKey) return null;
  return createClient(url, publicKey, { auth: { persistSession: false } });
}

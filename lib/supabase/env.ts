/* Supabase 연결 정보(공개용)를 .env.local 에서 읽습니다.
   - 주소 + 공개키(Publishable key)만 사용합니다. 비밀 키(SUPABASE_SECRET_KEY)는 여기서 읽지 않습니다.
   - 새 키 이름(PUBLISHABLE)과 예전 이름(ANON)을 모두 지원합니다. */

export function getSupabasePublicEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

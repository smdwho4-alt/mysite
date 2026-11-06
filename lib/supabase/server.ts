import "server-only"; // 서버에서만 실행됨
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { hardenCookieOptions } from "@/lib/supabase/cookie-options";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

/* 「지금 접속한 사람」의 로그인 정보(쿠키)를 사용하는 Supabase 연결 (Supabase 공식 SSR 방식)
   - 공개키만 사용합니다. 이 연결로 하는 요청은 로그인한 사용자의 권한(RLS)으로 처리됩니다.
   - 요청마다 새로 만들어야 합니다. (여러 요청이 하나를 공유하면 안 됨)
   - 관리자 여부 확인은 lib/admin-auth.ts 의 isAdmin() 으로 하세요. */
export async function createSupabaseServerClient() {
  const env = getSupabasePublicEnv();
  if (!env) return null;

  const cookieStore = await cookies();

  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, hardenCookieOptions(options)),
          );
        } catch {
          // 화면(서버 컴포넌트)에서는 쿠키를 쓸 수 없음 → proxy.ts 가 /admin 요청마다 세션을 새로 고쳐 줍니다.
        }
      },
    },
  });
}

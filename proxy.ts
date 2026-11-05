import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { hardenCookieOptions } from "@/lib/supabase/cookie-options";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

/* /admin 으로 오는 요청마다 로그인 세션을 새로 고칩니다. (Next.js 16 의 proxy = 예전 middleware)
   - 로그인 시간이 지나 토큰이 만료되면 쿠키를 갱신해 주는 역할만 합니다.
   - ⚠ 여기서는 「관리자인지」 판단하지 않습니다. 권한 확인은 서버 코드(lib/admin-auth.ts 의 isAdmin())가
     페이지와 모든 서버 액션에서 직접 합니다. (proxy 는 보조 장치일 뿐, 보안의 유일한 방어선이 아님)
   - 공개 홈페이지에는 적용되지 않습니다. (아래 matcher) */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const env = getSupabasePublicEnv();
  if (!env) return response;

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, hardenCookieOptions(options)),
        );
        // 로그인 쿠키가 담긴 응답은 캐시되면 안 됨 (라이브러리가 알려 주는 헤더 그대로 적용)
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // 만료된 토큰이면 여기서 갱신됩니다. (응답을 만들기 전에 호출해야 함)
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};

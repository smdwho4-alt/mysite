import type { CookieOptions } from "@supabase/ssr";

/* 관리자 로그인 쿠키의 보안 설정 (서버 코드와 proxy.ts 가 함께 사용)
   - httpOnly : 브라우저의 자바스크립트가 읽을 수 없게 함 (이 사이트는 브라우저에서 Supabase 를 직접 쓰지 않음)
   - secure   : 운영(https)에서는 https 로만 전송
   - sameSite : 다른 사이트에서 온 요청에는 쿠키를 보내지 않음(기본)
   - maxAge   : 최대 8시간 (그 이후에는 다시 로그인) */

export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export function hardenCookieOptions(options: CookieOptions = {}): CookieOptions {
  const isDeleting = options.maxAge === 0;
  return {
    ...options,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: isDeleting
      ? 0
      : Math.min(options.maxAge ?? ADMIN_SESSION_MAX_AGE_SECONDS, ADMIN_SESSION_MAX_AGE_SECONDS),
  };
}

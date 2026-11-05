import "server-only";
import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/* 관리자 로그인 확인 (Supabase Auth 방식)
   - 로그인: 이메일 + 비밀번호 (Supabase Auth). 로그인 정보는 서버가 관리하는 쿠키에 저장됩니다.
   - 「관리자인지」는 서버에서 두 단계로 확인합니다.
       ① supabase.auth.getUser()  : 쿠키의 로그인 정보가 진짜인지 Supabase Auth 서버에 물어 확인
       ② rpc("is_admin")          : 데이터베이스의 admins 명단에 있는 사람인지 확인 (로그인했다고 모두 관리자가 아님)
   - 둘 중 하나라도 실패하면 관리자가 아닌 것으로 처리합니다. (오류가 나도 열어 주지 않음)
   - 브라우저가 보내는 「나는 관리자」 같은 표시는 믿지 않습니다. */

export type AdminState =
  | { status: "unconfigured" } // Supabase 연결 정보(.env.local)가 없음
  | { status: "anonymous" } // 로그인 안 함
  | { status: "not_admin" } // 로그인은 했지만 관리자 명단에 없음
  | { status: "admin"; userId: string };

/** 지금 접속한 사람의 상태. 같은 요청 안에서는 한 번만 확인합니다. */
export const getAdminState = cache(async (): Promise<AdminState> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "unconfigured" };

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { status: "anonymous" };

  const { data: flag, error: rpcError } = await supabase.rpc("is_admin");
  if (rpcError || flag !== true) return { status: "not_admin" };

  return { status: "admin", userId: data.user.id };
});

/** 지금 접속한 사람이 로그인한 관리자인지 (모든 관리자 서버 액션이 맨 먼저 호출) */
export async function isAdmin() {
  return (await getAdminState()).status === "admin";
}

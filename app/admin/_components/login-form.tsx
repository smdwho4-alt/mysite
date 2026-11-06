"use client";

import { useActionState } from "react";

import { login, type ActionState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-11 w-full rounded-lg border bg-background px-4 outline-none focus:ring-2 focus:ring-ring/50";

/** 관리자 로그인 화면: 이메일 + 비밀번호 (Supabase Auth). 확인은 모두 서버에서 합니다. */
export function LoginForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(login, {});

  return (
    <form action={action} className="mx-auto mt-16 w-full max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">관리자 로그인</h1>
      <input
        type="email"
        name="email"
        placeholder="이메일"
        autoComplete="username"
        maxLength={254}
        required
        autoFocus
        className={inputClass}
      />
      <input
        type="password"
        name="password"
        placeholder="비밀번호"
        autoComplete="current-password"
        maxLength={200}
        required
        className={inputClass}
      />
      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "확인 중..." : "로그인"}
      </Button>
    </form>
  );
}

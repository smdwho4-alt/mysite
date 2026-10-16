"use client";

import { useActionState } from "react";

import { login, type ActionState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(login, {});

  return (
    <form action={action} className="mx-auto mt-16 w-full max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">관리자 로그인</h1>
      <input
        type="password"
        name="password"
        placeholder="비밀번호"
        required
        autoFocus
        className="h-11 w-full rounded-lg border bg-background px-4 outline-none focus:ring-2 focus:ring-ring/50"
      />
      {state.message ? <p className="text-sm text-destructive">{state.message}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "확인 중..." : "로그인"}
      </Button>
    </form>
  );
}

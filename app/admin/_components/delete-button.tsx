"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";

import { deleteItem, type ActionState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

/** 삭제 버튼 — 실수 방지를 위해 한 번 더 물어봅니다.
    서버에는 카드 번호(id)만 보냅니다. 이미지 파일은 서버가 DB 에서 직접 확인해 정리합니다. */
export function DeleteButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(deleteItem, {});

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("정말 삭제할까요? 되돌릴 수 없습니다.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="sm" className="text-destructive" disabled={pending}>
        <Trash2 />
        삭제
      </Button>
      {state.message && !state.ok ? (
        <p role="alert" className="mt-1 max-w-48 text-xs text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

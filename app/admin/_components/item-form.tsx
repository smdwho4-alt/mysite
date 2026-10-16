"use client";

import { useActionState, useEffect, useRef } from "react";

import { saveItem, type ActionState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import type { Item } from "@/lib/types";

const inputClass =
  "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/50";

/** 카드 추가/수정 입력 칸. item 을 넘기면 '수정', 안 넘기면 '새로 추가' 모드. */
export function ItemForm({ section, item }: { section: string; item?: Item }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveItem, {});
  const formRef = useRef<HTMLFormElement>(null);

  // 새로 추가에 성공하면 입력 칸 비우기
  useEffect(() => {
    if (state.ok && !item) formRef.current?.reset();
  }, [state, item]);

  return (
    <form ref={formRef} action={action} className="grid gap-4">
      <input type="hidden" name="section" value={section} />
      {item ? <input type="hidden" name="id" value={item.id} /> : null}

      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">제목 *</span>
        <input name="title" required defaultValue={item?.title ?? ""} className={inputClass} />
      </label>

      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">설명</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={item?.description ?? ""}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">링크 (선택)</span>
          <input
            name="link_url"
            type="url"
            placeholder="https://"
            defaultValue={item?.link_url ?? ""}
            className={inputClass}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">순서 (작을수록 앞)</span>
          <input
            name="sort_order"
            type="number"
            defaultValue={item?.sort_order ?? 0}
            className={inputClass}
          />
        </label>
      </div>

      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">이미지 (선택, 5MB 이하)</span>
        <input name="image" type="file" accept="image/*" className="text-sm" />
      </label>

      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="is_visible" defaultChecked={item?.is_visible ?? true} />
          사이트에 보이기
        </label>
        {item?.image_url ? (
          <label className="flex items-center gap-2">
            <input type="checkbox" name="remove_image" />
            기존 이미지 지우기
          </label>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중..." : item ? "수정 저장" : "추가하기"}
        </Button>
        {state.message ? (
          <p className={state.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

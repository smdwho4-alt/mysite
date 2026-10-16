"use client";

import { Trash2 } from "lucide-react";

import { deleteItem } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

/** 삭제 버튼 — 실수 방지를 위해 한 번 더 물어봅니다. */
export function DeleteButton({ id, imageUrl }: { id: string; imageUrl: string | null }) {
  return (
    <form
      action={deleteItem}
      onSubmit={(e) => {
        if (!window.confirm("정말 삭제할까요? 되돌릴 수 없습니다.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="image_url" value={imageUrl ?? ""} />
      <Button type="submit" variant="ghost" size="sm" className="text-destructive">
        <Trash2 />
        삭제
      </Button>
    </form>
  );
}

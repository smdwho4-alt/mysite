"use client";

import { useActionState } from "react";

import { saveHeroTexts, type ActionState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/50";

export type HeroTextField = { key: string; label: string; multiline: boolean; value: string };

/** 히어로(첫 화면) 글자 입력 칸. 칸마다 지금 사이트에 보이는 글자가 미리 채워져 있음. */
export function HeroTextForm({ fields }: { fields: HeroTextField[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveHeroTexts, {});

  return (
    <form action={action} className="grid gap-4">
      {fields.map((f) => (
        <label key={f.key} className="grid gap-1.5 text-sm">
          <span className="font-medium">{f.label}</span>
          {f.multiline ? (
            <textarea
              name={f.key}
              required
              rows={3}
              defaultValue={f.value}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            />
          ) : (
            <input name={f.key} required defaultValue={f.value} className={inputClass} />
          )}
        </label>
      ))}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중..." : "저장"}
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

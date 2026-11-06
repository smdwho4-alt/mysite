"use client";

import { useActionState, useEffect, useRef } from "react";

import { savePostAction, type PostActionState } from "@/app/admin/post-actions";
import { Button } from "@/components/ui/button";
import { BODY_MAX_CHARS, LINK_MAX_CHARS, TITLE_MAX_CHARS, type BoardCategory, type Post } from "@/lib/board-shared";

const inputClass =
  "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/50";

/** 게시글 추가/수정 입력 칸. post 를 넘기면 '수정', 안 넘기면 '새로 추가' 모드.
    브라우저에서 한 검사는 편의일 뿐이고, 같은 검사를 서버가 다시 합니다. */
export function PostForm({ category, today, post }: { category: BoardCategory; today: string; post?: Post }) {
  const [state, action, pending] = useActionState<PostActionState, FormData>(savePostAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  // 새로 추가에 성공하면 입력 칸 비우기
  useEffect(() => {
    if (state.ok && !post) formRef.current?.reset();
  }, [state, post]);

  return (
    <form ref={formRef} action={action} className="grid gap-4">
      <input type="hidden" name="category" value={category} />
      {post ? <input type="hidden" name="id" value={post.id} /> : null}

      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">제목 *</span>
        <input name="title" required maxLength={TITLE_MAX_CHARS} defaultValue={post?.title ?? ""} className={inputClass} />
      </label>

      <label className="grid gap-1.5 text-sm">
        <span className="font-medium">본문 (일반 글자만, 줄바꿈 가능)</span>
        <textarea
          name="body"
          rows={8}
          maxLength={BODY_MAX_CHARS}
          defaultValue={post?.body ?? ""}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring/50"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">관련 링크 (선택)</span>
          <input
            name="link_url"
            type="text"
            inputMode="url"
            maxLength={LINK_MAX_CHARS}
            placeholder="https://… 또는 /notice"
            defaultValue={post?.link_url ?? ""}
            className={inputClass}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">게시일 (한국 시간)</span>
          <input name="published_at" type="date" required defaultValue={post?.published_at ?? today} className={inputClass} />
        </label>
      </div>

      <div className="grid gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="is_visible" defaultChecked={post?.is_visible ?? true} />
          게시하기 <span className="text-muted-foreground">(끄면 비공개·임시저장 — 방문자에게 보이지 않음)</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="is_pinned" defaultChecked={post?.is_pinned ?? false} />
          목록 맨 위에 고정
        </label>
        <p className="text-xs text-muted-foreground">게시일이 오늘보다 뒤인 글은 게시할 수 없습니다. (예약 게시 미지원)</p>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중..." : post ? "수정 저장" : "추가하기"}
        </Button>
        {state.message ? (
          <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

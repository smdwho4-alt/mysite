"use server";

/* 관리자 게시글(공지사항·주민자치회 소식) 버튼들이 실제로 하는 일 (서버에서 실행됨)
   - savePostAction   : 글 추가 또는 수정
   - deletePostAction : 글 삭제
   ※ 모든 액션은 맨 처음에 isAdmin() 으로 서버에서 관리자를 확인합니다. (runIfAdmin)
   ※ 쓰기는 「로그인한 관리자의 권한」으로 실행됩니다. 서버 비밀 키는 쓰지 않습니다. (DB 의 RLS 가 한 번 더 막음)
   ※ 입력 검사 규칙은 lib/board-shared.ts, 저장 순서는 lib/admin-post-service.ts 에 있습니다. */

import { revalidatePath } from "next/cache";

import { isAdmin } from "@/lib/admin-auth";
import { runIfAdmin } from "@/lib/admin-card-service";
import { createPostDeps } from "@/lib/admin-post-deps";
import { deletePost, savePost } from "@/lib/admin-post-service";
import { BOARD_INFO, BOARD_CATEGORIES, todayInSeoul } from "@/lib/board-shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PostActionState = { ok?: boolean; message?: string };

const LOGIN_REQUIRED_MESSAGE = "로그인이 필요합니다. 새로고침 후 다시 로그인하세요.";
const NO_SUPABASE_MESSAGE = "Supabase가 연결되지 않았습니다. .env.local 을 확인하세요.";

/** 저장·삭제 후 화면 갱신 (첫 화면, 두 게시판 목록, 관리자 화면. 상세 글은 요청 때 새로 읽음) */
function refreshBoardPages() {
  revalidatePath("/");
  for (const c of BOARD_CATEGORIES) revalidatePath(BOARD_INFO[c].path);
  revalidatePath("/notice/[id]", "page");
  revalidatePath("/news/[id]", "page");
  revalidatePath("/admin");
}

export async function savePostAction(_prev: PostActionState, formData: FormData): Promise<PostActionState> {
  return runIfAdmin(isAdmin, () => savePostAsAdmin(formData), { message: LOGIN_REQUIRED_MESSAGE });
}

async function savePostAsAdmin(formData: FormData): Promise<PostActionState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: NO_SUPABASE_MESSAGE };

  const idValue = formData.get("id");
  const result = await savePost(createPostDeps(supabase), {
    id: typeof idValue === "string" && idValue !== "" ? idValue : null,
    raw: {
      category: formData.get("category"),
      title: formData.get("title"),
      body: formData.get("body"),
      link_url: formData.get("link_url"),
      is_pinned: formData.get("is_pinned") === "on",
      is_visible: formData.get("is_visible") === "on",
      published_at: formData.get("published_at"),
    },
    today: todayInSeoul(),
  });

  if (result.dbChanged) refreshBoardPages();
  return { ok: result.ok, message: result.message };
}

export async function deletePostAction(_prev: PostActionState, formData: FormData): Promise<PostActionState> {
  return runIfAdmin(isAdmin, () => deletePostAsAdmin(formData), { message: LOGIN_REQUIRED_MESSAGE });
}

async function deletePostAsAdmin(formData: FormData): Promise<PostActionState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: NO_SUPABASE_MESSAGE };

  const id = String(formData.get("id") ?? "");
  const result = await deletePost(createPostDeps(supabase), id);

  if (result.dbChanged) refreshBoardPages();
  return { ok: result.ok, message: result.message };
}

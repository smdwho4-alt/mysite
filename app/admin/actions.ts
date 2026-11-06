"use server";

/* 관리자 페이지의 버튼들이 실제로 하는 일 (서버에서 실행됨)
   - login / logout      : 로그인, 로그아웃 (Supabase Auth: 이메일 + 비밀번호)
   - saveItem            : 카드 추가 또는 수정 (이미지 업로드·교체·제거 포함)
   - deleteItem          : 카드 삭제 (카드의 이미지 파일 정리 포함)
   - saveHeroTexts       : 히어로(첫 화면) 글자 저장
   ※ 이미지 검사와 정리 규칙은 lib/admin-images.ts, lib/admin-card-service.ts 에 있습니다.
   ※ 모든 관리자 액션은 맨 처음에 isAdmin() 으로 서버에서 관리자를 확인합니다. */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { siteConfig } from "@/site.config";
import { isAdmin } from "@/lib/admin-auth";
import { createCardDeps } from "@/lib/admin-card-deps";
import { pickUploadedFile } from "@/lib/admin-images";
import { deleteCard, runIfAdmin, saveCard } from "@/lib/admin-card-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase-admin";
import { heroTextFields } from "@/lib/data";

export type ActionState = { ok?: boolean; message?: string };

const LOGIN_REQUIRED_MESSAGE = "로그인이 필요합니다. 새로고침 후 다시 로그인하세요.";
const NO_SUPABASE_MESSAGE = "Supabase가 연결되지 않았습니다. .env.local 을 확인하세요.";

/* ---------- 로그인 / 로그아웃 ---------- */

const LOGIN_FAILED_MESSAGE = "이메일 또는 비밀번호가 올바르지 않습니다.";

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { message: "이메일과 비밀번호를 입력하세요." };
  // 너무 긴 입력은 확인하지 않고 거절 (이유는 알려 주지 않음)
  if (email.length > 254 || password.length > 200) return { message: LOGIN_FAILED_MESSAGE };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { message: "Supabase가 연결되지 않았습니다. .env.local 을 확인하세요." };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // 계정이 있는지/없는지, 비밀번호만 틀렸는지 알려 주지 않도록 같은 문구로 안내 (요청 과다만 따로 안내)
    if (error.status === 429) return { message: "시도가 너무 많습니다. 잠시 후 다시 시도하세요." };
    return { message: LOGIN_FAILED_MESSAGE };
  }

  // 로그인에 성공해도 관리자 명단(admins)에 없으면 접근 거부 → 이 로그인은 바로 끝냄 (이 기기의 로그인만)
  const { data: isAdminFlag, error: rpcError } = await supabase.rpc("is_admin");
  if (rpcError || isAdminFlag !== true) {
    await supabase.auth.signOut({ scope: "local" });
    return { message: "이 계정은 관리자 권한이 없습니다." };
  }

  // 이동 위치는 항상 고정된 내부 주소 (주소창/입력값으로 바꿀 수 없음)
  redirect("/admin");
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut({ scope: "local" }); // 이 기기의 로그인만 종료
  redirect("/admin");
}

/* ---------- 카드 저장 (추가 / 수정) ---------- */

export async function saveItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runIfAdmin(isAdmin, () => saveItemAsAdmin(formData), { message: LOGIN_REQUIRED_MESSAGE });
}

async function saveItemAsAdmin(formData: FormData): Promise<ActionState> {
  const supabase = getAdminClient();
  if (!supabase) return { message: NO_SUPABASE_MESSAGE };

  const id = String(formData.get("id") ?? "");
  const section = String(formData.get("section") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const linkUrl = String(formData.get("link_url") ?? "").trim();
  const sortOrder = Number(formData.get("sort_order") ?? 0) || 0;
  const isVisible = formData.get("is_visible") === "on";
  const removeImage = formData.get("remove_image") === "on";
  const imageEntry = formData.get("image");

  if (!siteConfig.adminSections.some((s) => s.key === section)) {
    return { message: "알 수 없는 섹션입니다." };
  }
  if (!title) return { message: "제목을 입력하세요." };

  // 파일을 고르지 않아도 브라우저는 크기 0의 빈 파일을 보냅니다 → 크기가 0보다 클 때만 「선택한 파일」로 봅니다.
  // (이름으로 판단하면 안 됨: 서버로 전달되는 과정에서 이름이 비어 있지 않은 값으로 바뀔 수 있음)
  const image = pickUploadedFile(imageEntry);

  const result = await saveCard(createCardDeps(supabase), {
    id: id || null,
    fields: {
      section,
      title,
      description: description || null,
      link_url: linkUrl || null,
      sort_order: sortOrder,
      is_visible: isVisible,
    },
    image,
    removeImage,
  });

  if (result.dbChanged) {
    revalidatePath("/");
    revalidatePath("/admin");
  }
  return { ok: result.ok, message: result.message };
}

/* ---------- 카드 삭제 ---------- */

export async function deleteItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runIfAdmin(isAdmin, () => deleteItemAsAdmin(formData), { message: LOGIN_REQUIRED_MESSAGE });
}

async function deleteItemAsAdmin(formData: FormData): Promise<ActionState> {
  const supabase = getAdminClient();
  if (!supabase) return { message: NO_SUPABASE_MESSAGE };

  // 카드 번호만 사용합니다. (이미지 주소는 브라우저가 보낸 값이 아니라 서버가 DB 에서 직접 조회)
  const id = String(formData.get("id") ?? "");
  const result = await deleteCard(createCardDeps(supabase), id);

  if (!result.dbChanged) return { message: result.message };

  revalidatePath("/");
  revalidatePath("/admin");

  // 카드는 삭제됐지만 이미지 파일 정리에 실패한 경우: 카드가 목록에서 사라져 버튼의 안내가 보이지 않으므로
  // 정해진 안내 코드만 붙여 목록으로 돌아갑니다. (남은 파일 경로는 서버 기록 [image-cleanup] 에 있음)
  if (result.leftoverPaths.length > 0 && result.section && siteConfig.adminSections.some((s) => s.key === result.section)) {
    redirect(`/admin?section=${result.section}&notice=image-cleanup-failed`);
  }
  return { ok: true, message: result.message };
}

/* ---------- 히어로 글자 저장 ---------- */

export async function saveHeroTexts(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return { message: "로그인이 필요합니다. 새로고침 후 다시 로그인하세요." };

  const supabase = getAdminClient();
  if (!supabase) return { message: "Supabase가 연결되지 않았습니다. .env.local 을 확인하세요." };

  const rows = heroTextFields.map((f) => ({
    key: f.key,
    // 윈도우 줄바꿈(\r\n)을 \n 으로 맞춤
    value: String(formData.get(f.key) ?? "").replace(/\r\n/g, "\n").trim(),
    updated_at: new Date().toISOString(),
  }));

  if (rows.some((r) => !r.value)) return { message: "비어 있는 칸이 있습니다. 모두 입력하세요." };

  const { error } = await supabase.from("site_texts").upsert(rows, { onConflict: "key" });
  if (error) return { message: `저장 실패: ${error.message}` };

  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true, message: "저장했습니다. 사이트에 바로 반영됩니다." };
}

/* 관리자 게시글 저장·삭제의 「순서와 규칙」 (DB 는 바깥에서 넣어 주는 부품(db)을 통해서만 만짐 → mock 으로 시험 가능)
   원칙
   1) 관리자 확인은 호출하는 쪽(서버 액션)이 가장 먼저 합니다. (lib/admin-card-service.ts 의 runIfAdmin)
   2) 입력값 검사에 실패하면 DB 를 건드리지 않습니다.
   3) 저장은 로그인한 관리자의 권한(RLS)으로 실행됩니다. 작성자(created_by)는 DB 가 자동으로 기록하며 앱은 보내지 않습니다.
   4) DB 오류 문구는 화면에 그대로 보여주지 않고 정해진 안내로 바꿉니다. (표 이름·규칙 이름 등 내부 정보 노출 방지)
   ※ '@/' 경로 별칭을 쓰지 않습니다. (시험에서 직접 불러옴) */

import { isUuid, validatePostInput } from "./board-shared.ts";
import type { PostInput, RawPostInput } from "./board-shared.ts";
import { sanitizeError } from "./admin-images.ts";

export type DbResult = { error: { code?: string | null; message: string } | null };

export type PostDb = {
  insertPost(row: PostInput): Promise<DbResult>;
  updatePost(id: string, row: PostInput): Promise<DbResult & { updated: number }>;
  deletePost(id: string): Promise<DbResult & { deleted: number }>;
};

export type PostServiceResult = { ok: boolean; message: string; dbChanged: boolean };

export type PostServiceDeps = {
  db: PostDb;
  /** 서버 기록용 (비밀 제거된 짧은 문구만) */
  log(event: { event: "post-save" | "post-delete"; status: "failed"; code: string; reason: string }): void;
};

/** DB 오류를 사용자용 안내로 바꿈 */
export function describeDbError(error: { code?: string | null; message: string }): string {
  const code = error.code ?? "";
  if (code === "42501") return "권한이 없습니다. 다시 로그인한 뒤 시도하세요.";
  if (code === "23514") return "입력한 내용이 저장 규칙에 맞지 않습니다. 제목·링크·게시일을 확인하세요.";
  if (code === "42P01" || code === "PGRST205") return "게시판 표를 찾을 수 없습니다. 데이터베이스 설정(SQL)이 적용됐는지 확인하세요.";
  return "저장하지 못했습니다. 잠시 후 다시 시도하세요.";
}

function fail(message: string): PostServiceResult {
  return { ok: false, message, dbChanged: false };
}

/** 글 추가(id 가 null) 또는 수정(id 가 있음) */
export async function savePost(
  deps: PostServiceDeps,
  input: { id: string | null; raw: RawPostInput; today: string },
): Promise<PostServiceResult> {
  if (input.id !== null && !isUuid(input.id)) return fail("글 번호가 올바르지 않습니다.");

  const checked = validatePostInput(input.raw, input.today);
  if (!checked.ok) return fail(checked.message);

  if (input.id === null) {
    const { error } = await deps.db.insertPost(checked.value);
    if (error) {
      deps.log({ event: "post-save", status: "failed", code: error.code ?? "", reason: sanitizeError(error.message) });
      return fail(describeDbError(error));
    }
    return { ok: true, message: "추가했습니다.", dbChanged: true };
  }

  const { error, updated } = await deps.db.updatePost(input.id, checked.value);
  if (error) {
    deps.log({ event: "post-save", status: "failed", code: error.code ?? "", reason: sanitizeError(error.message) });
    return fail(describeDbError(error));
  }
  if (updated === 0) return fail("수정할 글을 찾지 못했습니다. 이미 삭제되었을 수 있습니다. 새로고침 해 주세요.");
  return { ok: true, message: "수정했습니다.", dbChanged: true };
}

/** 글 삭제 */
export async function deletePost(deps: PostServiceDeps, id: string): Promise<PostServiceResult> {
  if (!isUuid(id)) return fail("글 번호가 올바르지 않습니다.");
  const { error, deleted } = await deps.db.deletePost(id);
  if (error) {
    deps.log({ event: "post-delete", status: "failed", code: error.code ?? "", reason: sanitizeError(error.message) });
    return fail(describeDbError(error));
  }
  if (deleted === 0) return fail("삭제할 글을 찾지 못했습니다. 이미 삭제되었을 수 있습니다. 새로고침 해 주세요.");
  return { ok: true, message: "삭제했습니다.", dbChanged: true };
}

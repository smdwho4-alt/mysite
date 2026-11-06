/* 관리자 카드 저장·삭제의 「순서와 정리 규칙」 (DB·저장소는 바깥에서 넣어 주는 부품(deps)을 통해서만 만짐 → mock 으로 시험 가능)
   원칙
   1) 이미지 검사에 실패하면 DB 도 저장소도 건드리지 않는다.
   2) 새 이미지를 올린 뒤 DB 저장이 실패하면, 방금 올린 파일을 정리한다.
   3) DB 저장이 성공한 뒤에야 이전 이미지를 정리한다. (정리 실패해도 카드 데이터는 이미 정상 → 경고로 보고)
   4) 지울 파일은 「DB 에 실제로 저장된 image_url」에서 서버가 직접 구한다. 브라우저가 보낸 이미지 주소는 믿지 않는다.
   5) 다른 카드가 같은 이미지를 쓰고 있으면 지우지 않는다.
   6) 정리에 실패하면 숨기지 않고, 남은 파일 경로와 이유(비밀 제거)를 기록하고 결과에 담아 보고한다.
   ※ '@/' 경로 별칭을 쓰지 않습니다. (시험에서 직접 불러옴) */

import { buildImagePath, parseManagedImageUrl, sanitizeError, validateImageFile } from "./admin-images.ts";
import type { UploadedFileLike } from "./admin-images.ts";

export type CardRow = { id: string; section: string; image_url: string | null };

export type StorageApi = {
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<{ error: string | null }>;
  remove(path: string): Promise<{ error: string | null; removed: number }>;
  publicUrl(path: string): string;
};

export type CardDb = {
  getCard(id: string): Promise<{ card: CardRow | null; error: string | null }>;
  insertCard(row: Record<string, unknown>): Promise<{ error: string | null }>;
  updateCard(id: string, row: Record<string, unknown>): Promise<{ error: string | null; updated: number }>;
  deleteCard(id: string): Promise<{ error: string | null; deleted: number }>;
  countOtherReferences(imageUrl: string, excludeId: string | null): Promise<{ count: number; error: string | null }>;
};

export type CleanupStage = "replaced" | "removed" | "card_deleted" | "save_failed";
export type CleanupStatus = "removed" | "missing" | "kept_referenced" | "skipped_unmanaged" | "failed";

export type CleanupOutcome = { stage: CleanupStage; status: CleanupStatus; path: string | null; reason?: string };

export type ServiceDeps = {
  db: CardDb;
  storage: StorageApi;
  supabaseUrl: string;
  bucket: string;
  allowedSections: readonly string[];
  now(): number;
  random(): string;
  /** 정리 결과 기록 (파일 경로와 이유만, 비밀 없음) */
  log(event: { event: "image-cleanup" | "image-upload"; stage: string; status: string; path: string | null; reason?: string }): void;
};

export type ServiceResult = {
  ok: boolean;
  message: string;
  /** DB 의 카드 데이터가 실제로 바뀌었는지 (true 일 때만 화면 갱신) */
  dbChanged: boolean;
  cleanup: CleanupOutcome[];
  /** 정리에 실패해서 저장소에 남은 파일 경로 (복구 정보) */
  leftoverPaths: string[];
  /** 삭제된 카드의 섹션 (삭제 후 화면 이동용) */
  section?: string;
};

/* ---------- 관리자 확인 보호막 ---------- */

/** 관리자가 아니면 work 를 아예 실행하지 않고 unauthorized 를 돌려줌 (DB·저장소 접근 전에 차단) */
export async function runIfAdmin<T>(isAdmin: () => Promise<boolean>, work: () => Promise<T>, unauthorized: T): Promise<T> {
  if (!(await isAdmin())) return unauthorized;
  return work();
}

/* ---------- 이미지 정리 ---------- */

async function cleanupImage(
  deps: ServiceDeps,
  imageUrl: string | null,
  excludeCardId: string | null,
  stage: CleanupStage,
): Promise<CleanupOutcome | null> {
  const parsed = parseManagedImageUrl(imageUrl, {
    supabaseUrl: deps.supabaseUrl,
    bucket: deps.bucket,
    allowedSections: deps.allowedSections,
  });
  if (!parsed.ok) {
    if (parsed.reason === "none") return null; // 이미지가 없으면 할 일 없음
    // 이 프로젝트가 만든 파일이 아님 → 저장소 삭제를 시도하지 않음
    const outcome: CleanupOutcome = { stage, status: "skipped_unmanaged", path: null, reason: parsed.detail };
    deps.log({ event: "image-cleanup", stage, status: outcome.status, path: null, reason: parsed.detail });
    return outcome;
  }

  const path = parsed.path;
  const refs = await deps.db.countOtherReferences(imageUrl as string, excludeCardId);
  if (refs.error) {
    // 다른 카드가 쓰는지 확인할 수 없으면 지우지 않음 (안전 우선) → 남은 파일로 보고
    const reason = "다른 카드의 사용 여부를 확인하지 못해 삭제하지 않음: " + sanitizeError(refs.error);
    deps.log({ event: "image-cleanup", stage, status: "failed", path, reason });
    return { stage, status: "failed", path, reason };
  }
  if (refs.count > 0) {
    deps.log({ event: "image-cleanup", stage, status: "kept_referenced", path });
    return { stage, status: "kept_referenced", path };
  }

  const removed = await deps.storage.remove(path);
  if (removed.error) {
    const reason = sanitizeError(removed.error);
    deps.log({ event: "image-cleanup", stage, status: "failed", path, reason });
    return { stage, status: "failed", path, reason };
  }
  const status: CleanupStatus = removed.removed > 0 ? "removed" : "missing";
  deps.log({ event: "image-cleanup", stage, status, path });
  return { stage, status, path };
}

function leftovers(outcomes: CleanupOutcome[]) {
  return outcomes.filter((o) => o.status === "failed" && o.path).map((o) => o.path as string);
}

function warningText(outcomes: CleanupOutcome[]) {
  const left = leftovers(outcomes);
  if (left.length === 0) return "";
  return ` ⚠ 이미지 파일 정리에 실패했습니다. 카드 데이터는 정상이며, 저장소에 남은 파일: ${left.join(", ")}`;
}

/* ---------- 카드 저장 (추가 / 수정) ---------- */

export type SaveCardInput = {
  id: string | null;
  fields: {
    section: string;
    title: string;
    description: string | null;
    link_url: string | null;
    sort_order: number;
    is_visible: boolean;
  };
  /** 새로 올린 이미지 (없으면 null) */
  image: UploadedFileLike | null;
  /** 「기존 이미지 지우기」 체크 여부 */
  removeImage: boolean;
};

const fail = (message: string, extra: Partial<ServiceResult> = {}): ServiceResult => ({
  ok: false,
  message,
  dbChanged: false,
  cleanup: [],
  leftoverPaths: [],
  ...extra,
});

export async function saveCard(deps: ServiceDeps, input: SaveCardInput): Promise<ServiceResult> {
  const row: Record<string, unknown> = { ...input.fields };

  // 1) 이미지 검사 — 실패하면 아무것도 건드리지 않고 끝
  let checked: Awaited<ReturnType<typeof validateImageFile>> | null = null;
  if (input.image) {
    checked = await validateImageFile(input.image);
    if (!checked.ok) return fail(checked.message);
  }

  // 2) 수정이면 DB 의 실제 카드(와 image_url)를 서버에서 조회 — 브라우저가 보낸 값은 쓰지 않음
  let current: CardRow | null = null;
  if (input.id) {
    const found = await deps.db.getCard(input.id);
    if (found.error) return fail("카드 정보를 불러오지 못했습니다. 아무것도 변경하지 않았습니다.");
    if (!found.card) return fail("수정할 카드를 찾을 수 없습니다. 아무것도 변경하지 않았습니다.");
    current = found.card;
  }

  // 3) 새 이미지 업로드 (경로는 서버가 생성)
  let newPath: string | null = null;
  let newUrl: string | null = null;
  if (checked && checked.ok) {
    newPath = buildImagePath(input.fields.section, checked.ext, deps.now(), deps.random());
    if (!newPath) return fail("이미지 저장 경로를 만들 수 없습니다. 아무것도 변경하지 않았습니다.");
    const uploaded = await deps.storage.upload(newPath, checked.bytes, checked.mime);
    if (uploaded.error) {
      deps.log({ event: "image-upload", stage: "upload", status: "failed", path: newPath, reason: sanitizeError(uploaded.error) });
      return fail("이미지 업로드에 실패했습니다. 카드 데이터는 변경하지 않았습니다.");
    }
    newUrl = deps.storage.publicUrl(newPath);
    row.image_url = newUrl;
  } else if (input.removeImage && input.id) {
    row.image_url = null;
  }

  // 4) DB 저장
  let dbError: string | null = null;
  if (input.id) {
    const r = await deps.db.updateCard(input.id, row);
    dbError = r.error ?? (r.updated === 0 ? "수정된 행이 없습니다" : null);
  } else {
    dbError = (await deps.db.insertCard(row)).error;
  }

  if (dbError) {
    // DB 저장 실패 → 방금 올린 새 파일을 정리 (카드 데이터는 바뀌지 않음)
    const cleanup: CleanupOutcome[] = [];
    if (newUrl) {
      const outcome = await cleanupImage(deps, newUrl, input.id, "save_failed");
      if (outcome) cleanup.push(outcome);
    }
    const left = leftovers(cleanup);
    return fail(
      `저장하지 못했습니다: ${sanitizeError(dbError)}. 카드 데이터는 변경되지 않았습니다.` +
        (left.length ? ` ⚠ 방금 올린 이미지 파일을 정리하지 못했습니다. 저장소에 남은 파일: ${left.join(", ")}` : ""),
      { cleanup, leftoverPaths: left },
    );
  }

  // 5) DB 저장 성공 → 이전 이미지 정리 (교체 또는 제거였을 때만)
  const cleanup: CleanupOutcome[] = [];
  const oldUrl = current?.image_url ?? null;
  if (input.id && oldUrl && oldUrl !== newUrl && (newUrl || input.removeImage)) {
    const outcome = await cleanupImage(deps, oldUrl, input.id, newUrl ? "replaced" : "removed");
    if (outcome) cleanup.push(outcome);
  }
  const left = leftovers(cleanup);
  return {
    ok: true,
    message: (input.id ? "수정했습니다." : "추가했습니다.") + warningText(cleanup),
    dbChanged: true,
    cleanup,
    leftoverPaths: left,
  };
}

/* ---------- 카드 삭제 ---------- */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deleteCard(deps: ServiceDeps, id: string): Promise<ServiceResult> {
  if (!UUID_RE.test(id)) return fail("삭제할 카드 번호가 올바르지 않습니다. 아무것도 변경하지 않았습니다.");

  // 서버가 DB 에서 직접 카드와 image_url 을 조회 (브라우저의 숨은 값은 사용하지 않음)
  const found = await deps.db.getCard(id);
  if (found.error) return fail("카드 정보를 불러오지 못했습니다. 아무것도 변경하지 않았습니다.");
  if (!found.card) return fail("이미 삭제되었거나 없는 카드입니다. 아무것도 변경하지 않았습니다.");
  const card = found.card;

  // DB 삭제가 먼저 — 실패하면 저장소 파일은 그대로 둠
  const removed = await deps.db.deleteCard(id);
  if (removed.error) return fail(`삭제하지 못했습니다: ${sanitizeError(removed.error)}. 카드와 이미지 파일은 그대로입니다.`);
  if (removed.deleted === 0) return fail("삭제되지 않았습니다. 카드와 이미지 파일은 그대로입니다.");

  // DB 삭제 성공 → 이 카드의 이미지 정리 시도 (다른 카드가 쓰면 유지)
  const cleanup: CleanupOutcome[] = [];
  const outcome = await cleanupImage(deps, card.image_url, id, "card_deleted");
  if (outcome) cleanup.push(outcome);
  const left = leftovers(cleanup);
  return {
    ok: true,
    message: "삭제했습니다." + warningText(cleanup),
    dbChanged: true,
    cleanup,
    leftoverPaths: left,
    section: card.section,
  };
}

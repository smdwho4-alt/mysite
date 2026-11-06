import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { PostServiceDeps } from "@/lib/admin-post-service";

/* 게시글 저장·삭제에 쓰는 실제 DB 연결 부품 (lib/admin-post-service.ts 에 끼워 넣음)
   - 「로그인한 관리자」의 연결을 넘겨받습니다. (createSupabaseServerClient)
     → 모든 쓰기는 그 사용자의 권한으로 실행되고, 관리자가 아니면 DB 의 RLS 가 거부합니다. (서버 비밀 키를 쓰지 않음)
   - 보내는 컬럼은 PostInput 의 7개뿐입니다. 작성자(created_by)·id·시각은 DB 가 자동으로 채웁니다. */
export function createPostDeps(client: SupabaseClient): PostServiceDeps {
  return {
    db: {
      async insertPost(row) {
        const { error } = await client.from("posts").insert(row);
        return { error: error ? { code: error.code, message: error.message } : null };
      },
      async updatePost(id, row) {
        const { data, error } = await client.from("posts").update(row).eq("id", id).select("id");
        return { error: error ? { code: error.code, message: error.message } : null, updated: data?.length ?? 0 };
      },
      async deletePost(id) {
        const { data, error } = await client.from("posts").delete().eq("id", id).select("id");
        return { error: error ? { code: error.code, message: error.message } : null, deleted: data?.length ?? 0 };
      },
    },
    log(event) {
      // 오류 종류와 정리된 사유만 남깁니다. (글 내용·비밀 없음)
      console.error("[post-admin]", JSON.stringify(event));
    },
  };
}

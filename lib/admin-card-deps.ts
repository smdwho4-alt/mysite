import "server-only"; // 서버에서만 실행됨 (서버 전용 Secret Key 연결을 받아 사용)

import { siteConfig } from "@/site.config";
import { getAdminClient, IMAGE_BUCKET } from "@/lib/supabase-admin";
import type { ServiceDeps } from "@/lib/admin-card-service";

/* lib/admin-card-service.ts 가 쓰는 「실제 DB·저장소 연결」을 만들어 줍니다.
   - 개발/운영 프로젝트는 .env.local 의 주소를 따르고, 저장소 버킷은 IMAGE_BUCKET("images") 하나만 씁니다.
   - 이 파일은 server-only 라 브라우저 코드에 포함되지 않습니다. */

type AdminClient = NonNullable<ReturnType<typeof getAdminClient>>;

export function createCardDeps(supabase: AdminClient): ServiceDeps {
  const bucket = supabase.storage.from(IMAGE_BUCKET);

  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    bucket: IMAGE_BUCKET,
    allowedSections: siteConfig.adminSections.map((s) => s.key),
    now: () => Date.now(),
    random: () => crypto.randomUUID().replace(/-/g, "").slice(0, 16),
    // 정리 결과 기록: 파일 경로와 이유(비밀 제거됨)만 남깁니다. 서버 로그(Vercel Logs 등)에서 [image-cleanup] 으로 찾을 수 있음
    log: (event) => console.error("[image-cleanup]", JSON.stringify(event)),

    storage: {
      async upload(path, bytes, contentType) {
        const { error } = await bucket.upload(path, bytes, { contentType, upsert: false });
        return { error: error ? error.message : null };
      },
      async remove(path) {
        const { data, error } = await bucket.remove([path]); // 지정한 파일 1개만 삭제
        return { error: error ? error.message : null, removed: data?.length ?? 0 };
      },
      publicUrl: (path) => bucket.getPublicUrl(path).data.publicUrl,
    },

    db: {
      async getCard(id) {
        const { data, error } = await supabase.from("items").select("id, section, image_url").eq("id", id).maybeSingle();
        return { card: data ? { id: data.id as string, section: data.section as string, image_url: (data.image_url as string | null) ?? null } : null, error: error ? error.message : null };
      },
      async insertCard(row) {
        const { error } = await supabase.from("items").insert(row);
        return { error: error ? error.message : null };
      },
      async updateCard(id, row) {
        const { data, error } = await supabase.from("items").update(row).eq("id", id).select("id");
        return { error: error ? error.message : null, updated: data?.length ?? 0 };
      },
      async deleteCard(id) {
        const { data, error } = await supabase.from("items").delete().eq("id", id).select("id");
        return { error: error ? error.message : null, deleted: data?.length ?? 0 };
      },
      async countOtherReferences(imageUrl, excludeId) {
        let query = supabase.from("items").select("id", { count: "exact", head: true }).eq("image_url", imageUrl);
        if (excludeId) query = query.neq("id", excludeId);
        const { count, error } = await query;
        return { count: count ?? 0, error: error ? error.message : null };
      },
    },
  };
}

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // 외부 이미지를 허용할 주소 목록 (Supabase 저장소, Unsplash)
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  experimental: {
    serverActions: {
      // 관리자 페이지에서 올릴 수 있는 요청 최대 크기.
      // 이미지는 5MB 미만만 허용(lib/admin-images.ts). 요청에는 글자 칸 등이 함께 들어가므로 여유를 두어,
      // 5MB 이상 이미지는 서버 오류가 아니라 「5MB 미만만 올릴 수 있습니다」 안내가 나오게 함
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;

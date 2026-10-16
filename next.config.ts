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
      // 관리자 페이지에서 올릴 수 있는 이미지 최대 크기
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;

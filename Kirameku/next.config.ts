import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone 输出：build 时做依赖追踪，生成 .next/standalone，供 Docker 精简运行镜像
  // （Dockerfile runner 阶段只拷该产物，详见 Kirameku/Dockerfile）
  output: "standalone",

  compress: true,

  async rewrites() {
    // 后端地址（供服务端渲染内部请求）。注意：Next 会在 `next build` 时把该值
    // 固化进 routes-manifest，运行期修改不生效——
    //   · 裸机/宝塔：默认 http://127.0.0.1:8000（与源码运行一致）
    //   · Docker 镜像：Dockerfile 以 ARG BACKEND_URL=http://backend:8000 在构建期注入
    const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backendUrl}/uploads/:path*`,
      },
      {
        source: "/reader3/:path*",
        destination: `${process.env.NOVEL_API_URL || "http://localhost:8085"}/reader3/:path*`,
      },
    ];
  },

  experimental: {
    optimizePackageImports: [
      "framer-motion",
      "lucide-react",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
    ],
  },

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "static.hiromu.top" },
      { protocol: "https", hostname: "hiromu520.oss-cn-beijing.aliyuncs.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "http", hostname: "wfqqreader-1252317822.image.myqcloud.com" },
    ],
  },
};

export default nextConfig;

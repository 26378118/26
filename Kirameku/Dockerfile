# syntax=docker/dockerfile:1
#
# Kirameku 主站 Next.js 镜像
#
# 构建上下文：./Kirameku
#   docker build -t kirameku-next -f Kirameku/Dockerfile ./Kirameku
#
# 多阶段：
#   1. deps   —— node:22-alpine 按锁文件装依赖（含 devDependencies，供 next build 使用）
#   2. builder—— pnpm build 产出 .next
#   3. runner —— 精简运行镜像：.next + node_modules + public + next.config.ts
#
# 运行方式与现状一致：next start（未启用 output: 'standalone'）。
# 容器内 SSR 访问后端依赖 BACKEND_URL 环境变量（默认 http://127.0.0.1:8000），
# 见仓库根 docker-compose.yml。

########################## 1. 依赖安装 ##########################
FROM node:22-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1
# 锁文件为 lockfileVersion 9.0 → pnpm v9
RUN npm install -g pnpm@9 --silent

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

########################## 2. 构建 ##########################
FROM base AS builder
# Next 的 rewrites 目标在 next build 期间固化进 routes-manifest，
# 运行期改 BACKEND_URL 不生效，因此作为构建期 ARG 注入。
# 默认 http://backend:8000 对应根目录 docker-compose.yml 的 backend 服务；
# 其它拓扑可 --build-arg BACKEND_URL=http://host:port 覆盖。
ARG BACKEND_URL=http://backend:8000
ENV BACKEND_URL=$BACKEND_URL
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

########################## 3. 运行镜像 ##########################
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# 所有产物均归 nextjs 所有（next start 需写 .next/cache 图片优化缓存）
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start"]

# syntax=docker/dockerfile:1
#
# Kirameku 主站 Next.js 镜像
#
# 构建上下文：./Kirameku
#   docker build -t kirameku-next -f Kirameku/Dockerfile ./Kirameku
#
# 多阶段：
#   1. deps   —— node:22-alpine 按锁文件装依赖（含 devDependencies，供 next build 使用）
#   2. builder—— pnpm build（output: 'standalone'）产出 .next/standalone 等
#   3. runner —— 精简运行镜像：仅 standalone 产物 + .next/static + public
#
# standalone 模式让 next build 做依赖追踪，运行镜像只带 SSR 真正用到的 node_modules
# （约几十 MB，替代过去全量拷贝 ~700MB + chown 整层复制造成的镜像虚高）。
# 容器内 SSR 访问后端仍走构建期烘焙的 BACKEND_URL（next.config.ts rewrites 在
# next build 时固化），默认 http://backend:8000，见仓库根 docker-compose.yml。

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
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && mkdir -p /app/.next \
    && chown nextjs:nodejs /app/.next

# standalone 产物不含 public/ 与 .next/static，需手动拷入；
# 全程用 COPY --chown 直接定属主，避免过去 RUN chown -R 把整个 /app
# 复制进新层造成的镜像虚高（内容 ×2）。
# .next 目录先建好并归 nextjs：图片优化缓存 .next/cache 需要运行时写入。
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]

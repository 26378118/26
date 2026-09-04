# syntax=docker/dockerfile:1
#
# Kirameku 后端镜像：FastAPI + 内置 vue-pure-admin 管理后台产物
#
# 构建上下文：./Kirameku-backend（在仓库根目录执行）
#   docker build -t kirameku-backend -f Kirameku-backend/Dockerfile ./Kirameku-backend
#
# 多阶段：
#   1. admin-builder —— node:22-alpine 构建管理后台 admin/dist
#   2. py-deps       —— python:3.12-slim 安装 Python 依赖（crcmod 等无预编译轮子，需 gcc）
#   3. runtime       —— 精简运行镜像，仅拷贝依赖与代码
#
# 安全约定：镜像内【不写入任何密钥】。
#   DATABASE_URL / SECRET_KEY / OSS_* / CORS_ORIGINS 等均由运行时环境注入，
#   参考仓库根 docker-compose.yml 与 docs/docker-deploy.md。

########################## 1. 构建管理后台 (admin/dist) ##########################
FROM node:22-alpine AS admin-builder
WORKDIR /admin

# 锁文件为 lockfileVersion 9.0 → pnpm v9
RUN npm install -g pnpm@9 --silent

# 先拷贝清单 + .npmrc：.npmrc 的 shamefully-hoist=true 使 tippy.js 等被提升，
# 必须参与首次安装，否则 vite 解析不到 tippy.js/dist/tippy.css。
# （enable-pre-post-scripts=false 已禁用 preinstall(only-allow)/prepare(husky)，无需 git）
COPY admin/package.json admin/pnpm-lock.yaml admin/.npmrc ./
RUN pnpm install --frozen-lockfile

# 拷贝源码（.dockerignore 已排除 node_modules/dist）
COPY admin/ ./

# 生产构建：vite 默认读取 admin/.env.production → VITE_PUBLIC_PATH=/admin/（配合 hash 路由）
# 直接调用 vite build，跳过依赖 git 的 generate-version-file
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN pnpm exec rimraf dist && pnpm exec vite build

########################## 2. 安装 Python 依赖 ##########################
FROM python:3.12-slim AS py-deps
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

# gcc/g++/python3-dev：编译缺少 manylinux 轮子的扩展（如 oss2 依赖的 crcmod）
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc g++ python3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY requirements.txt .
# --prefix=/install：装到独立目录，运行时整体拷入 /usr/local
RUN pip install --prefix=/install -r requirements.txt

########################## 3. 运行镜像 ##########################
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# 非 root 运行（降低被攻破后的影响面）
RUN useradd --create-home --uid 10001 appuser

WORKDIR /app

# Python 依赖 + 后端代码
COPY --from=py-deps /install/ /usr/local/
COPY app ./app

# 管理后台产物 → main.py 期望的 admin/dist 位置（存在才会挂载 /admin）
COPY --from=admin-builder /admin/dist ./admin/dist

# 本地上传目录（OSS 未启用时的回退存储；建议用命名卷持久化）
RUN mkdir -p /app/uploads \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys;sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health',timeout=3).status==200 else 1)"

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

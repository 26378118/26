# Kirameku Docker 部署指南

> 数据库用远程 PostgreSQL（阿里云 RDS / 自建），图片走阿里云 OSS，**镜像内不含任何密钥**。
> 对外入口：**宿主机 Nginx**（宝塔面板/原生安装），Docker 只跑业务容器（backend、next），
> 两个容器仅发布 `127.0.0.1` 回环端口，由宿主机 Nginx 按域名反代。
> 这样与"一台主机多个 Docker 应用"兼容：每个应用占不同的回环端口，互不干扰、互不拖垮网关。
> 主站 Next 是动态 SSR，nginx 只反代，**不托管其静态文件**；管理后台产物在 backend 镜像内。

## 1. 镜像与工作流

| 镜像 | 内容 | 构建上下文 |
| --- | --- | --- |
| `ghcr.io/<owner>/kirameku-backend` | FastAPI(8000) + 内置管理后台产物（`/admin`） | `./Kirameku-backend` |
| `ghcr.io/<owner>/kirameku-next` | 主站 Next.js(3000) | `./Kirameku` |

CI 由 [.github/workflows/docker-build-push.yml](../.github/workflows/docker-build-push.yml) 驱动：

- push 到 `main` → 打 `latest` + `sha-<短哈希>`
- push `v*` 标签（如 `v1.0.0`）→ 打语义化版本标签
- 仓库 `Actions` 页可 `workflow_dispatch` 手动触发

> 镜像**不含任何密钥**。数据库、JWT 密钥、OSS 密钥全部在运行时通过环境变量注入。

## 2. 准备工作

### 2.1 首次构建（可选，CI 会自动构建）

本地有 Docker 时可直接验证镜像：

```bash
cd /d/project/Kirameku
docker build -t ghcr.io/frigidom1024/kirameku-backend:test -f Kirameku-backend/Dockerfile ./Kirameku-backend
docker build -t ghcr.io/frigidom1024/kirameku-next:test     -f Kirameku/Dockerfile ./Kirameku
```

### 2.2 服务器要求

- Docker Engine + Compose v2（宝塔面板可装 Docker 管理器）
- 宿主机 Nginx（宝塔自带或原生安装），需能配置站点反代
- 能连通远程 PostgreSQL（若改动过 `pg_hba.conf`，需把**服务器出口 IP**加入白名单）
- 1.8GB 内存：`next` 服务已通过 `NODE_OPTIONS` 限制堆内存

## 3. 在服务器上部署

```bash
# 1. 克隆/更新代码（或用 git pull 已有仓库）
git clone https://github.com/frigidom1024/Kirameku.git
cd Kirameku

# 2. 准备环境变量
cp Kirameku-backend/.env.example .env
# 编辑 .env，至少填：
#   DATABASE_URL=postgresql://<user>:<pwd>@<db-host>:5432/<db>
#   SECRET_KEY=<与现网一致或新生成的随机串>
#   CORS_ORIGINS=http://localhost:3000,https://<你的域名>
#   启用 OSS 上传则填 OSS_*；GitHub 评论登录可选填 GITHUB_*
# 注意：.env 已被 gitignore，不要提交

# 3. 拉取镜像并启动（backend/next 只占 127.0.0.1 回环端口）
docker compose pull
docker compose up -d
docker compose ps          # backend、next 均应 healthy/running
curl http://127.0.0.1:8000/api/health   # {"status":"ok"}
curl -I http://127.0.0.1:3000/          # Next 首页 200
```

首次启动时后端 `init_db()` 会自动建缺失的表（含安装表 `sys_install`）。
浏览器访问 `http(s)://<域名>/admin`，若数据库无安装记录，会出现**系统安装向导**，用于创建初始管理员账号——登录后即可正常使用后台。

> 两个容器只发布回环端口，外部一律经宿主机 Nginx 进入，避免绕过 HTTPS/缓存。
> 若 `127.0.0.1:8000`/`3000` 与主机上其他服务冲突，改 compose 里的宿主侧端口即可（如 `127.0.0.1:18000:8000`）。

## 4. 对外入口：宿主机 Nginx 反代

沿用 [DEPLOY_NOTES.md](../DEPLOY_NOTES.md) 的思路：**/api、/uploads、/admin 直接转发后端，
其余走主站**（带 hash 的静态资源和 Next SSR 不经过 Next 自己的 rewrite）。宝塔站点或 `/etc/nginx/conf.d/` 里：

```nginx
# 后端：API / 上传 / 管理后台
location /api/     { proxy_pass http://127.0.0.1:8000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; }
location /uploads/ { proxy_pass http://127.0.0.1:8000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
location /admin/   { proxy_pass http://127.0.0.1:8000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }

# 主站（关键：禁代理缓存，否则升级后浏览器拿到旧 HTML → 旧 chunk 404）
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_no_cache 1;
    proxy_cache_bypass 1;
    proxy_cache off;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400s;
}
```

改完 `nginx -s reload`。

**一台主机多个 Docker 应用时**：给每个应用分配不同回环端口（如本应用 8000/3000，别的应用 8001/3001…），
每个域名/站点一个 server 块，互不影响。多域名 TLS 就各站点各配证书，宿主机 Nginx 按 SNI 自动选。

> 可选：若这台主机**只跑 Kirameku、想免手工配 nginx**，可以给 backend/next 套一个 nginx 容器作唯一入口
> （在 compose 里加 `nginx` 服务，`/api /uploads /admin` → backend、其余 → next）。多应用共存时不建议。

## 5. 升级流程

```bash
cd /d/project/Kirameku   # 服务器上：进仓库目录
git pull                  # 更新到新 commit（CI 会推 latest 镜像）
docker compose pull       # 拉新镜像
docker compose up -d      # 无感重建
docker image prune -f     # 清理旧镜像
```

- 前端每次构建 chunk 名带 hash，配合第 4 步「禁缓存」配置，升级后强制刷新即可。
- 若沿用版本标签部署（推荐生产），把 compose 里 `:latest` 改成 `:vX.Y.Z`，
  通过打 `git tag` 控制发布。

## 6. 常见问题

**Q：拉私有镜像 401**
该 GitHub 仓库若为 private，GHCR 镜像默认也是 private，需在服务器登录一次：

```bash
echo <PAT, 需 packages:read> | docker login ghcr.io -u frigidom1024 --password-stdin
```

**Q：后台 /admin 白屏 / 资源 404**
1) 确认访问的是 `https://域名/admin`（生产基路径 `/admin/`，hash 路由，登录后地址栏是 `/admin/#/login`）；
2) 检查宿主机 Nginx `location /admin/` 是否带尾斜杠并指向 8000；
3) 浏览器强刷（旧 HTML 引用了旧 chunk）。若仍异常，`docker compose exec backend ls /app/admin/dist` 确认产物在。

**Q：管理后台提示"系统已初始化/未安装"异常**
安装记录只认 `sys_install` 表是否有行。全新数据库首次访问 `/admin` 应出现安装向导；
若已初始化想重装，需清库（谨慎）或重置该表。

**Q：Next 页面能开但数据 500**
容器内 SSR 请求走镜像内固化的 `http://backend:8000`。先确认 backend 健康
（`curl http://127.0.0.1:8000/api/health` 或 `docker compose exec backend wget -qO- http://127.0.0.1:8000/api/health`），再 `docker compose logs next`。
> 若改了后端服务名/拓扑，需重新构建镜像并注入新地址：`docker build --build-arg BACKEND_URL=http://<新地址> ... -f Kirameku/Dockerfile ./Kirameku`。
> 宿主机 Nginx 对 `/api` 的转发是另一条链路（直达 backend），与此无关。

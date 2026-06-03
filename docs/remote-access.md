# pi-web 远程访问

pi-web 支持从手机或其他电脑远程控制本机 Agent 会话（完整能力：发消息、分支、fork、读文件、改模型等）。

## 快速开始（局域网 / Tailscale）

1. 在本机启动 pi-web 并开启远程模式：

```bash
pi-web --remote --hostname 0.0.0.0
# 或 Tailscale IP：
pi-web --remote --hostname 100.x.y.z
```

2. 在本机浏览器打开 **Settings → Remote access**，点击 **Enable remote access**，再 **Generate pairing link**。
3. 用手机扫描 QR 或打开配对链接，完成设备配对。
4. 远程浏览器即可使用完整 pi-web UI。

## 认证方式

| 方式 | 用途 |
|------|------|
| 配对链接 / QR | 手机浏览器，写入 `pi_web_session` httpOnly cookie |
| Master token | `Authorization: Bearer <token>`，CLI/脚本；启用或轮换时在 Settings 显示一次 |
| `PI_WEB_REMOTE_TOKEN` | 非交互部署，启动前设置环境变量 |

配置文件：`~/.pi/agent/pi-web-remote.json`（可用 `PI_CODING_AGENT_DIR` 覆盖目录）。

推送订阅：`~/.pi/agent/pi-web-push.json`。

## CLI 与环境变量

```bash
pi-web --remote                  # 绑定 0.0.0.0 并启用远程鉴权
pi-web --remote -H 100.x.y.z     # 绑定 Tailscale 地址
PI_WEB_REMOTE=1 pi-web -H 0.0.0.0
PI_WEB_REMOTE_TOKEN=... pi-web --remote
npm run tunnel:cloudflare        # Cloudflare 快速隧道（需先安装 cloudflared）
```

| 变量 | 说明 |
|------|------|
| `PI_WEB_REMOTE=1` | 启用远程模式（非 loopback 需认证） |
| `PI_WEB_REMOTE_TOKEN` | 固定 Bearer token（部署用） |
| `PI_WEB_REMOTE_SIGNING_SECRET` | 会话 cookie 签名密钥（通常由配置文件同步） |
| `PI_WEB_ALLOW_REMOTE_MUTATIONS=1` | **已弃用**，请改用远程鉴权 |

## Tailscale 部署（推荐）

1. 在 Host 与 Remote 设备安装 [Tailscale](https://tailscale.com) 并加入同一 tailnet。
2. 启动：`pi-web --remote --hostname $(tailscale ip -4)` 或使用 MagicDNS 主机名。
3. 在 Settings 的 **Allowed hostnames** 填入 Tailscale IP 或 MagicDNS 主机名（可选，留空则任意 Host 均可）。
4. Remote 设备浏览器访问 `http://100.x.y.z:30141`（或 MagicDNS 名称），完成配对。

## 公网隧道（Phase 2）

无需公网 IP 或端口转发时，在 **Settings → Remote access** 复制以下命令之一（仍需配对 + token/cookie 鉴权）：

### Tailscale Funnel

```bash
pi-web --remote --hostname 127.0.0.1
tailscale funnel 30141
```

Funnel 提供 HTTPS 公网 URL。将 URL 中的 hostname 加入 **Allowed hostnames**（若启用了白名单）。

### Cloudflare Quick Tunnel

```bash
pi-web --remote
npm run tunnel:cloudflare
# 等价于：cloudflared tunnel --url http://127.0.0.1:30141
```

`cloudflared` 会输出临时 `*.trycloudflare.com` URL。用该 URL 完成配对后再远程访问。

## Web Push

1. 在 Settings → Remote access → **Push notifications** 点击 **Enable notifications**。
2. 浏览器会注册 Service Worker（`public/sw.js`）并保存订阅到 `pi-web-push.json`。
3. Agent 完成（`agent_end`）时，服务器向所有订阅推送通知；点击通知跳转到对应 session。

仅 HTTPS 或 localhost 下可用（隧道 / Funnel 满足 HTTPS 要求）。

## PWA / 离线壳

- `manifest.webmanifest` + `icon.svg` 支持「添加到主屏幕」。
- Service Worker 缓存首页壳资源；API 与 SSE 仍走网络，离线时仅显示缓存壳（不缓存 agent 状态）。

## 只读远程模式

Settings 中勾选 **Read-only remote access** 后，远程配对设备只能 GET/SSE；写操作返回 403。顶部会显示只读提示条。

## OAuth / API Key

模型 Provider 的 OAuth 回调默认绑定 `127.0.0.1`。远程模式下建议：

- **在 Host 本机**完成 OAuth / API Key 配置（Settings → Models）；或
- 将 `PI_OAUTH_CALLBACK_HOST` 设为 Tailscale 主机名（见 pi 文档 `docs/pi-web-remote.md`）。

## 反向代理 / SSE

SSE 流使用 30s 心跳。经 Nginx 等代理时需禁用缓冲：

```nginx
proxy_buffering off;
proxy_read_timeout 3600s;
add_header X-Accel-Buffering no;
```

## 手动验收清单

- [ ] Host：`pi-web --remote`，Settings 开启远程并生成配对链接
- [ ] Remote（Tailscale 或 LAN）：打开链接，配对成功，可浏览会话列表
- [ ] Remote：发 prompt、看 SSE 流式输出、steer/abort
- [ ] Remote：fork、分支导航、读文件、改 models.json
- [ ] Host：Revoke 已配对设备后 Remote 收到 401
- [ ] Read-only 模式：Remote 可 GET/SSE，写操作返回 403
- [ ] Push：开启通知后 agent 完成收到系统通知
- [ ] Tunnel：`npm run tunnel:cloudflare` 或 `tailscale funnel` 可访问并完成配对
- [ ] E2EE relay：`relay:server` + `relay:host` + `relay:client`，远程浏览器访问 client 代理端口
- [ ] 审计日志：Settings 可见 auth_failure / pairing 等事件
- [ ] 设备标签：重命名 paired device 并 revoke-all

## E2EE 中继隧道（Phase 3）

公网 dumb relay 只转发密文；Host 与 Client 通过 X25519 + AES-GCM 建立 E2EE 通道，再隧道 HTTP 到本机 pi-web。

1. Settings → Remote access → **Generate E2EE offer**，复制 offer URL。
2. 任意机器：`npm run relay:server`（默认 `http://127.0.0.1:30142`）。
3. Host：`pi-web --remote` 后运行 `npm run relay:host`（读取 `pi-web-remote.json` 中的 relay 密钥）。
4. Remote：`npm run relay:client -- '<offer-url>'`，浏览器打开 `http://127.0.0.1:30143`，再完成 pi-web 配对。

配置与密钥：`~/.pi/agent/pi-web-remote.json` 的 `relay` 字段。审计：`~/.pi/agent/pi-web-remote-audit.jsonl`。

## pi RPC 对齐（Phase 3）

非 pi-web 客户端可通过 `pi --mode rpc` 使用与 pi-web 相同的分支/工具命令：

- `navigate_tree` — 会话内分支导航
- `get_tools` / `set_tools` — 查询与设置活动工具

详见 pi 仓库 `packages/coding-agent/docs/rpc.md`。

# IM Service

Node.js IM 服务，负责连接腾讯云 IM 并发送游戏指令。

## 功能

- 自动连接腾讯云 IM
- 提供 HTTP API 接口供 Python 后端调用
- 提供 WebSocket 实时通信接口
- 实时推送 IM 消息和状态变化
- 自动重连机制
- 健康检查端点

## 安装

```bash
cd im-service
npm install
```

## 启动

```bash
npm start
```

开发模式（自动重启）：
```bash
npm run dev
```

## 服务地址

启动后服务将在以下地址可用：

- **HTTP API**: `http://localhost:3001`
- **WebSocket**: `ws://localhost:3001`

## API 文档

### HTTP API

提供 RESTful 接口，支持以下功能：
- 健康检查 (`GET /health`)
- 获取状态 (`GET /api/status`)
- 发送指令 (`POST /api/send-command`)
- 重新初始化 (`POST /api/reinit`)
- 使用凭证登录 (`POST /api/login`)

**详细文档**: [HTTP_API.md](docs/HTTP_API.md)

### WebSocket API

提供实时双向通信，支持所有 HTTP API 功能，并额外提供实时消息推送。

主要功能：
- 实时状态推送
- IM 消息接收
- 网络状态监控
- 心跳机制

**详细文档**: [WEBSOCKET_API.md](docs/WEBSOCKET_API.md)

## 日志

服务会输出详细的日志信息：

```
[2024-12-15T10:30:00.000Z] [INFO] 正在初始化 IM 客户端...
[2024-12-15T10:30:01.000Z] [INFO] 已加载配置: UID=game_5, UserID=5
[2024-12-15T10:30:02.000Z] [INFO] ✓ 获取 IM 签名成功
[2024-12-15T10:30:03.000Z] [INFO] 正在登录 IM...
[2024-12-15T10:30:04.000Z] [INFO] ✓ IM SDK 就绪
[2024-12-15T10:30:04.000Z] [INFO] ✓ IM 客户端初始化成功
[2024-12-15T10:30:04.000Z] [INFO] ============================================================
[2024-12-15T10:30:04.000Z] [INFO] CS2 IM 服务已启动
[2024-12-15T10:30:04.000Z] [INFO] HTTP 服务: http://localhost:3001
[2024-12-15T10:30:04.000Z] [INFO] WebSocket 服务: ws://localhost:3001
[2024-12-15T10:30:04.000Z] [INFO] ============================================================
```

## 错误处理

- **IM 未就绪**: 返回 503 状态码
- **缺少参数**: 返回 400 状态码
- **发送失败**: 返回 500 状态码，包含错误信息

## 自动重连

当 IM 连接断开时，服务会自动尝试重连：

- 被踢下线：5秒后自动重连
- 网络异常：自动检测并重连

## 心跳机制

服务每 30 秒输出一次心跳日志，确认 IM 连接状态。

## 优雅退出

按 `Ctrl+C` 退出时，服务会：
1. 登出 IM
2. 销毁 IM 实例
3. 关闭 HTTP 服务器

## 故障排查

### IM 初始化失败

1. 检查 `state.json` 文件是否存在
2. 确认 UID 和 Token 是否正确
3. 检查网络连接

### 指令发送失败

1. 确认 IM 状态为 `isReady: true`
2. 检查目标用户 ID 是否正确
3. 查看服务日志获取详细错误信息

### 端口冲突

如果 3001 端口被占用，修改 `server.js` 中的 `PORT` 常量。

## 技术栈

- Node.js 18+
- Express.js
- @tencentcloud/chat
- WebSocket (ws)

## 项目文件

### 核心文件
- `server.js` - 主服务器文件（HTTP + WebSocket）
- `package.json` - 项目配置和依赖

### 文档
- `README.md` - 项目说明文档（本文件）
- `HTTP_API.md` - HTTP API 完整文档
- `WEBSOCKET_API.md` - WebSocket API 完整文档
- `PROJECT_STRUCTURE.md` - 项目结构和开发指南

### 测试工具
- `test.html` - 统一测试页面（HTTP + WebSocket）
- `ws-client-test.html` - WebSocket 专用测试客户端

## 使用场景

### HTTP API
适用于简单的请求-响应场景：
- 发送单个指令
- 查询当前状态
- 触发重新初始化

### WebSocket
适用于需要实时通信的场景：
- 实时监控 IM 状态变化
- 接收 IM 消息推送
- 持续的双向通信
- 减少轮询开销

## 快速开始

### 1. 启动服务

```bash
npm start
```

### 2. 使用测试工具

在浏览器中打开 `test.html`，可以：
- 测试所有 HTTP API 接口
- 测试 WebSocket 连接和消息
- 使用自定义凭证登录 IM
- 查看实时日志和状态

### 3. 使用 HTTP API

```bash
# 健康检查
curl http://localhost:3001/health

# 使用凭证登录
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"uid": "5", "token": "your_token"}'

# 发送指令
curl -X POST http://localhost:3001/api/send-command \
  -H "Content-Type: application/json" \
  -d '{"commandId": "player_hurt"}'
```

更多示例请查看 [HTTP_API.md](docs/HTTP_API.md)

### 4. 使用 WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3001');

ws.onopen = () => {
  // 使用凭证登录
  ws.send(JSON.stringify({
    type: 'login',
    uid: '5',
    token: 'your_token'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('收到消息:', data);
};
```

更多示例请查看 [WEBSOCKET_API.md](docs/WEBSOCKET_API.md)

---

## 文档导航

- **[README.md](README.md)** - 项目概述和快速开始（当前文档）
- **[HTTP_API.md](docs/HTTP_API.md)** - HTTP API 完整文档
- **[WEBSOCKET_API.md](docs/WEBSOCKET_API.md)** - WebSocket API 完整文档
- **[PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)** - 项目结构和开发指南

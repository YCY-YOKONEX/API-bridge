# IM Service - 并发安全多用户版本

Node.js IM 服务，负责连接腾讯云 IM 并发送游戏指令。

> **🎉 v2.0 重大更新**: 现已支持多用户并发访问，可安全部署到公网！

## 主要特性

- ✅ **并发安全**: 支持多用户同时使用，互不干扰
- ✅ **会话管理**: 每个用户独立的 IM 会话实例
- ✅ **资源限制**: 可配置的连接数和会话超时限制
- ✅ **自动清理**: 过期会话自动回收，防止内存泄漏
- ✅ **向后兼容**: 保留旧版 API 支持
- 🔒 提供 HTTP API 接口供 Python 后端调用
- 🔌 提供 WebSocket 实时通信接口
- 📡 实时推送 IM 消息和状态变化
- 🔄 自动重连机制
- 💚 健康检查端点

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

开发模式（自动重启）：
```bash
npm run dev
```

服务将在 `http://localhost:3001` 启动。

### 3. 基本使用

```bash
# 步骤 1: 登录（创建会话）
curl -X POST http://your-server-ip:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"uid": "your_user_id", "token": "your_token"}'

# 步骤 2: 发送指令
curl -X POST http://your-server-ip:8080/api/send-command \
  -H "Content-Type: application/json" \
  -d '{"userId": "your_user_id", "commandId": "cmd_001"}'

# 步骤 3: 查看状态
curl http://your-server-ip:8080/health
```

**注意**:
- 默认使用 8080 端口（Nginx 反向代理）
- `your-server-ip` 替换为实际服务器 IP 地址
- 本地开发可以直接访问 `http://localhost:3001`

---

## 配置说明

### 资源限制

编辑 `server.js` 中的配置（第 23-26 行）：

```javascript
const MAX_SESSIONS = 10;                    // 最大会话数
const MAX_WS_CONNECTIONS = 200;             // 最大 WebSocket 连接数
const SESSION_TIMEOUT = 240 * 60 * 1000;    // 会话超时 (240分钟)
const SESSION_CLEANUP_INTERVAL = 5 * 60 * 1000; // 清理间隔 (5分钟)
```

---

## HTTP API

**访问方式说明：**
- **本地开发**: `http://localhost:3001`
- **生产环境**: `http://your-server-ip:8080`（通过 Nginx）


### 服务器广播事件

服务器会自动向所有连接的 WebSocket 客户端广播以下事件：

#### 连接成功
```json
{
  "type": "connected",
  "message": "WebSocket 连接成功",
  "data": { "totalSessions": 3 }
}
```

#### 心跳（每 30 秒）
```json
{
  "type": "heartbeat",
  "data": {
    "timestamp": 1702741234567,
    "stats": { "totalSessions": 3 }
  }
}
```

#### 状态变化
```json
{
  "type": "status",
  "userId": "12345",
  "data": {
    "isReady": true,
    "event": "SDK_READY"
  }
}
```

#### 收到消息
```json
{
  "type": "message",
  "userId": "12345",
  "data": {
    "count": 1,
    "messages": [...]
  }
}
```

---

## v2.0 版本说明

### 新特性

1. **多用户支持**: 从单用户升级到支持多个并发用户（默认 10 个）
2. **并发安全**: 使用 AsyncLock 保护关键操作，防止竞态条件
3. **会话隔离**: 每个用户独立的 IM 实例和状态
4. **资源管理**: 最大会话数、WebSocket 连接数限制
5. **自动清理**: 超时未活动的会话自动销毁

### API 变更

**重要:** 所有操作现在需要 `userId` 参数来标识用户。


## 部署建议

### ⚠️ 安全警告

**部署到公网前必读！**

管理后台 `admin.html` 包含敏感操作（登录、发送指令、登出会话），**直接暴露到公网存在严重安全风险**。

**必须配置访问保护：**

- 🔒 **HTTP 基本认证**（推荐）- 用户名密码保护
- 🔐 **HTTPS 加密** - SSL/TLS 证书
- 🚪 **SSH 隧道访问** - 不暴露在公网
- 🌍 **IP 白名单**（可选）- 限制特定 IP 访问

**完整安全配置方案请查看：[SECURITY.md](docs/SECURITY.md)** ⭐

---

### 生产环境部署

详细的 Ubuntu 服务器部署指南请查看：**[DEPLOY.md](docs/DEPLOY.md)**

#### 快速部署（一键脚本）

```bash
# 1. 上传部署脚本到服务器
scp deploy.sh user@your-server:/tmp/

# 2. 在服务器上执行
ssh user@your-server
sudo bash /tmp/deploy.sh
```

#### 手动部署步骤

1. **安装 Node.js 18+**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

2. **安装 PM2**
   ```bash
   sudo npm install -g pm2
   ```

3. **上传代码**
   ```bash
   # 使用 SCP
   scp -r /path/to/API-bridge user@server:/opt/im-service

   # 或使用 Git
   git clone https://github.com/your-repo.git /opt/im-service
   ```

4. **安装依赖并启动**
   ```bash
   cd /opt/im-service
   npm install --production
   pm2 start server.js --name im-service
   pm2 save
   pm2 startup
   ```

5. **配置 Nginx 反向代理**
   ```bash
   sudo apt install -y nginx
   # 参考 DEPLOY.md 中的 Nginx 配置
   ```

6. **配置 HTTPS（可选）**
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

### 常用管理命令

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs im-service

# 重启服务
pm2 restart im-service

# 查看资源使用
pm2 monit
```

详细说明请参考 [DEPLOY.md](docs/DEPLOY.md)

---

## 日志说明

日志格式: `[时间戳] [级别] [用户ID] 消息`

```
[2025-12-16T13:39:24.766Z] [INFO] CS2 IM 多用户并发安全服务已启动
[2025-12-16T13:39:24.766Z] [INFO] HTTP 服务: http://localhost:3001
[2025-12-16T13:39:24.766Z] [INFO] 最大会话数: 10
[2025-12-16T13:39:24.766Z] [INFO] 会话超时: 240 分钟
[2025-12-16T13:40:00.123Z] [INFO] [12345] 正在初始化 IM 会话...
[2025-12-16T13:40:01.456Z] [INFO] [12345] ✓ IM 会话初始化成功
[2025-12-16T13:40:05.789Z] [INFO] [12345] ✓ 指令发送成功: cmd_001
```

**级别说明:**
- `INFO` - 正常操作
- `WARN` - 警告信息
- `ERROR` - 错误信息
- `DEBUG` - 调试信息（心跳、清理等）

---

## 错误处理

### 常见错误

#### 1. 会话不存在
```json
{
  "success": false,
  "message": "会话不存在，请先登录"
}
```
**解决:** 调用 `/api/login` 创建会话

#### 2. 会话数已达上限
```json
{
  "success": false,
  "message": "会话数已达上限 (10)，请稍后再试"
}
```
**解决:** 等待过期会话自动清理，或手动调用 `/api/logout` 清理不需要的会话

#### 3. WebSocket 连接数已达上限
```json
{
  "type": "error",
  "message": "WebSocket 连接数已达上限 (200)"
}
```
**解决:** 关闭一些不使用的连接

#### 4. IM 会话未就绪
```json
{
  "success": false,
  "message": "IM 会话未就绪"
}
```
**解决:** 等待会话初始化完成（通常需要几秒钟）

---

## 故障排查

### 服务无法启动
- 检查端口 3001 是否被占用
- 检查 Node.js 版本 (需要 >= 18)
- 查看启动日志

### 登录失败
- 检查 uid 和 token 是否正确
- 检查网络连接
- 查看服务器日志中的错误信息

### 指令发送失败
- 确认会话已创建（调用过 `/api/login`）
- 检查 userId 是否正确
- 确认会话状态为 ready（通过 `/api/session/:userId` 查看）

### 内存持续增长
- 检查是否有会话泄漏
- 确认会话超时清理是否正常工作
- 监控 `/health` 端点的会话数

---

## 管理后台

### ⚠️ 安全警告

**管理后台包含敏感操作，生产环境必须配置访问保护！**

快速配置安全保护（推荐）：
```bash
# 上传安全配置脚本到服务器
scp secure-admin.sh user@your-server:/tmp/

# 在服务器上执行（会自动配置 HTTP 基本认证）
ssh user@your-server
sudo bash /tmp/secure-admin.sh
```

完整安全方案请查看：**[SECURITY.md](docs/SECURITY.md)**

---

### Web 管理界面

打开 `admin.html` 在浏览器中使用可视化管理界面：

```bash
# 在浏览器中打开
file:///D:/JavaProject/API-bridge/admin.html
# 或直接双击文件打开
```

**功能特性：**
- 📊 实时统计信息展示
- 🔐 用户登录管理
- 👥 活跃会话列表
- 📤 发送指令
- 🔌 WebSocket 实时连接
- 📋 活动日志记录
- 🎨 美观的现代化界面

### 浏览器测试工具

打开 `test.html` 或 `ws-client-test.html` 进行功能测试：
- 测试所有 HTTP API 接口
- 测试 WebSocket 连接和消息
- 使用自定义凭证登录 IM
- 查看实时日志和状态

---

## 技术栈

- **Node.js 18+** - 运行时环境
- **Express.js** - HTTP 服务器
- **ws** - WebSocket 服务器
- **async-lock** - 并发控制
- **@tencentcloud/chat** - 腾讯云 IM SDK
- **cors** - 跨域支持

---

## 常见问题

### Q: 旧客户端需要修改代码吗？
A: 需要。所有 API 调用现在需要提供 `userId` 参数。

### Q: 可以同时支持多少用户？
A: 默认 10 个并发会话。可通过修改 `server.js` 中的 `MAX_SESSIONS` 配置调整。

### Q: 会话会自动清理吗？
A: 是的。240 分钟（4 小时）未活动的会话会自动销毁，释放资源。

### Q: 如何监控系统状态？
A: 访问 `/health` 端点查看所有活跃会话和资源使用情况。

### Q: 支持负载均衡吗？
A: 需要使用 session sticky（根据 userId 路由到同一实例）或 Redis 共享会话状态。

---

## 文档导航

### 核心文档
- **[README.md](README.md)** - 项目说明（当前文档）
- **[SECURITY.md](docs/SECURITY.md)** - 安全配置指南 🔒 **必读**
- **[DEPLOY.md](docs/DEPLOY.md)** - Ubuntu 服务器部署指南 🚀
- **[server.js](server.js)** - 服务器源代码
- **[admin.html](admin.html)** - Web 管理后台
- **[deploy.sh](deploy.sh)** - 一键部署脚本
- **[secure-admin.sh](secure-admin.sh)** - 管理后台安全配置脚本

### 配置示例
- **[nginx.conf.example](nginx.conf.example)** - Nginx 完整配置示例
- **[nginx-examples.md](nginx-examples.md)** - 多种场景的配置示例集合

### 参考文档
- **[HTTP_API.md](docs/HTTP_API.md)** - 旧版 HTTP API 文档
- **[WEBSOCKET_API.md](docs/WEBSOCKET_API.md)** - 旧版 WebSocket API 文档
- **[PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)** - 项目结构说明

---

## 优雅退出

按 `Ctrl+C` 退出时，服务会：
1. 登出所有 IM 会话
2. 销毁所有 IM 实例
3. 关闭 HTTP 和 WebSocket 服务器

---

## 许可证

MIT

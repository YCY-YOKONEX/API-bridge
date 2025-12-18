# YOKONEX-API-Bridge
> 役次元玩具控制IM转WebSocket & Http 多用户支持版

Node.js IM 服务，负责连接腾讯云 IM 并发送游戏指令。


## 主要特性

### 核心功能
- ✅ **并发安全**: 支持多用户同时使用，互不干扰
- ✅ **会话管理**: 每个用户独立的会话实例
- ✅ **资源限制**: 可配置的连接数和会话超时限制
- ✅ **自动清理**: 过期会话自动回收，防止内存泄漏

### 管理功能
- 📊 **运营监控**: 实时核心指标、流量趋势、系统资源监控
- 🔐 **SM2 国密加密**: 非对称加密，更安全
- 📈 **真实响应时间**: 基于实际指令发送统计
- 🗄️ **SQLite 数据库**: 持久化存储管理员信息和日志
- 📋 **日志管理**: 连接日志和指令日志完整记录
- 🔑 **密码重置**: 在线修改管理员密码
- 🎨 **Vue3 管理后台**: 现代化的 Web 管理界面
- 💻 **真实系统指标**: CPU、内存、磁盘使用率监控

### API 接口
- 🔒 提供 HTTP API 接口
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

### 3. 访问管理后台

**开发环境:**

```bash
# 启动前端开发服务器
cd frontend
npm run dev
```

访问: `http://localhost:5173`

**默认管理员账号:**
- 用户名: `admin`
- 密码: `Admin@123`

⚠️ **首次登录后请立即修改默认密码！**

**管理后台功能:**
- 📊 **运营监控**: 实时查看系统运行状态、流量趋势、系统资源
- 👥 **控制台**: 管理用户会话和连接状态
- 📋 **日志管理**: 查询和分析连接日志、指令日志
- 🔑 **账号设置**: 修改管理员密码和系统配置

### 4. API 使用示例

```bash
# 步骤 1: 登录（创建会话）
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"uid": "your_user_id", "token": "your_token"}'

# 步骤 2: 发送指令
curl -X POST http://localhost:3001/api/send-command \
  -H "Content-Type: application/json" \
  -d '{"userId": "your_user_id", "commandId": "cmd_001"}'

# 步骤 3: 查看状态
curl http://localhost:3001/health
```

**注意**:
- 本地开发: `http://localhost:3001`
- 生产环境: `http://your-server-ip:8080` (通过 Nginx)

---

## 配置说明

### 资源限制

编辑 `server.js` 中的配置：

```javascript
const MAX_SESSIONS = 100;                   // 最大会话数
const MAX_WS_CONNECTIONS = 200;             // 最大 WebSocket 连接数
const SESSION_TIMEOUT = 240 * 60 * 1000;    // 会话超时 (240分钟)
const SESSION_CLEANUP_INTERVAL = 5 * 60 * 1000; // 清理间隔 (5分钟)
```

### SM2 加密密钥

**默认密钥对**:
- 公钥: `04fa45b30265e9bf0deef6412463ba1fa6abcb8c385793593e0894d146a266a1053d3a2eae9bfb7bea68fa4c9c5decbe32612e797f65cf2f31132b7aba4931c96c`
- 私钥: `d86fdbbee6a245da65ab1fa57739b2cca57e5985949cb50cb240cf9e38f877e5`

**修改方式:**

1. 使用环境变量（推荐）:

```bash
# 后端（server.js）
export SM2_PUBLIC_KEY=your_public_key
export SM2_PRIVATE_KEY=your_private_key

# 前端（frontend/src/utils/api.js）
export VITE_SM2_PUBLIC_KEY=your_public_key
```

2. 或直接编辑代码文件

⚠️ **重要**: 前端只需要公钥，后端需要公钥+私钥！

**生成新密钥对:**

```javascript
const sm2 = require('sm-crypto').sm2;
const keypair = sm2.generateKeyPairHex();
console.log('公钥:', keypair.publicKey);
console.log('私钥:', keypair.privateKey);
```

### 管理员账号

**默认账号**: `admin` / `Admin@123`

**修改密码**: 登录后台 → 账号设置 → 修改密码

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
- **[server.js](server.js)** - 服务器源代码
- **[frontend](frontend)** - Web 管理后台(基于Vue开发)

### 配置示例
- **[nginx.conf.example](nginx.conf.example)** - Nginx 完整配置示例

### 参考文档
- **[HTTP_API.md](docs/HTTP_API.md)** - HTTP API 文档
- **[WEBSOCKET_API.md](docs/WEBSOCKET_API.md)** - WebSocket API 文档
- **[PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)** - 项目结构说明

---


## 许可证

MIT

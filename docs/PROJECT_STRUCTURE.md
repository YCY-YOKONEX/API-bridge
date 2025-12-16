# 项目结构文档

## 目录结构

```
im-service/
├── server.js                 # 主服务器文件
├── package.json              # 项目配置和依赖
├── package-lock.json         # 依赖锁定文件
├── README.md                 # 项目说明文档
├── HTTP_API.md              # HTTP API 文档
├── WEBSOCKET_API.md         # WebSocket API 文档
├── PROJECT_STRUCTURE.md     # 项目结构文档（本文件）
├── test.html                # 统一测试页面
├── ws-client-test.html      # WebSocket 测试客户端
├── node_modules/            # 依赖包目录
└── ../state.json            # 配置文件（父目录）
```

## 核心文件说明

### server.js

主服务器文件，包含所有核心功能。

**主要模块：**

1. **配置管理**
   - `loadState()` - 从 state.json 加载配置
   - `config` 对象 - 存储 UID、Token、AppID、签名等

2. **IM 初始化**
   - `requestGameSign()` - 获取 IM 签名
   - `initIM()` - 初始化 IM 客户端
   - `waitReady()` - 等待 SDK 就绪

3. **消息发送**
   - `sendIMMessage()` - 发送 IM 消息

4. **HTTP API 路由**
   - `GET /health` - 健康检查
   - `GET /api/status` - 获取状态
   - `POST /api/send-command` - 发送指令
   - `POST /api/reinit` - 重新初始化
   - `POST /api/login` - 使用凭证登录

5. **WebSocket 服务**
   - `handleWebSocketMessage()` - 处理 WebSocket 消息
   - `broadcastToClients()` - 广播消息给所有客户端
   - WebSocket 连接管理

6. **事件监听**
   - SDK_READY - SDK 就绪
   - SDK_NOT_READY - SDK 未就绪
   - KICKED_OUT - 被踢下线
   - NET_STATE_CHANGE - 网络状态变化
   - MESSAGE_RECEIVED - 收到消息
   - ERROR - 错误事件

**代码结构：**

```javascript
// 导入依赖
import TencentCloudChat from '@tencentcloud/chat';
import express from 'express';
import { WebSocketServer } from 'ws';

// 全局变量
let chat = null;              // IM 客户端实例
let isReady = false;          // IM 就绪状态
let config = {...};           // 配置对象
const wsClients = new Set();  // WebSocket 客户端集合

// 工具函数
function log() {...}
function broadcastToClients() {...}

// 配置加载
async function loadState() {...}
async function requestGameSign() {...}

// IM 初始化
async function initIM() {...}
function waitReady() {...}

// 消息发送
async function sendIMMessage() {...}

// HTTP 路由
app.get('/health', ...)
app.get('/api/status', ...)
app.post('/api/send-command', ...)
app.post('/api/reinit', ...)
app.post('/api/login', ...)

// WebSocket 处理
function handleWebSocketMessage() {...}

// 服务器启动
async function startServer() {...}
```

### package.json

项目配置文件。

**主要依赖：**
- `@tencentcloud/chat` - 腾讯云 IM SDK
- `express` - Web 框架
- `cors` - 跨域支持
- `ws` - WebSocket 库

**脚本命令：**
- `npm start` - 启动服务
- `npm run dev` - 开发模式（自动重启）
- `npm run build` - 构建可执行文件

### state.json

配置文件，位于父目录。

**格式：**
```json
{
  "uid": "5",
  "token": "your_token_here"
}
```

**说明：**
- `uid` - 用户 ID，支持 "5" 或 "game_5" 格式
- `token` - 用户 Token

## 文档文件

### README.md

项目主文档，包含：
- 项目概述
- 安装和启动说明
- 功能列表
- 快速开始指南
- 故障排查

### HTTP_API.md

HTTP API 完整文档，包含：
- 所有 API 接口详细说明
- 请求/响应格式
- 参数说明
- 错误处理
- 使用示例（cURL、JavaScript、Python）

### WEBSOCKET_API.md

WebSocket API 完整文档，包含：
- 连接方式
- 消息类型
- 客户端请求格式
- 服务器推送格式
- 使用示例（JavaScript、Node.js、Python）

### PROJECT_STRUCTURE.md

项目结构文档（本文件），包含：
- 目录结构
- 文件说明
- 代码架构
- 数据流程

## 测试工具

### test.html

统一测试页面，功能最全面。

**功能模块：**

1. **HTTP API 测试**
   - 服务器配置
   - IM 登录凭证输入
   - 快速测试按钮
   - 自定义请求
   - 响应预览

2. **WebSocket 测试**
   - 连接管理
   - IM 登录凭证输入
   - 快速操作
   - 自定义消息
   - 服务器信息显示

3. **日志系统**
   - 统一日志显示
   - 类型区分（HTTP、WebSocket、成功、错误）
   - 日志导出

**技术特点：**
- 纯 HTML + JavaScript
- 无需构建
- 现代化 UI
- 响应式设计

### ws-client-test.html

WebSocket 专用测试客户端。

**功能：**
- WebSocket 连接测试
- 消息发送和接收
- 实时日志
- 服务器信息显示

## 数据流程

### IM 登录流程

```
1. 加载配置（state.json 或页面输入）
   ↓
2. 请求 IM 签名（API: /user/game_sign）
   ↓
3. 创建 IM 实例（TencentCloudChat.create）
   ↓
4. 注册事件监听
   ↓
5. 登录 IM（chat.login）
   ↓
6. 等待 SDK_READY 事件
   ↓
7. IM 就绪，可以发送消息
```

### 指令发送流程

```
客户端请求
   ↓
HTTP API 或 WebSocket
   ↓
检查 IM 状态（isReady）
   ↓
构造消息内容
   ↓
调用 chat.sendMessage()
   ↓
返回结果给客户端
```

### WebSocket 消息流程

```
客户端连接
   ↓
添加到 wsClients 集合
   ↓
发送 connected 消息
   ↓
接收客户端消息
   ↓
handleWebSocketMessage() 处理
   ↓
执行相应操作
   ↓
返回结果给客户端
```

### 事件广播流程

```
IM 事件触发（SDK_READY、MESSAGE_RECEIVED 等）
   ↓
broadcastToClients() 函数
   ↓
遍历 wsClients 集合
   ↓
发送消息给所有连接的客户端
```

## 技术架构

### 服务器架构

```
┌─────────────────────────────────────┐
│         Express HTTP Server         │
│  ┌───────────────────────────────┐  │
│  │      HTTP API Routes          │  │
│  │  /health, /api/status, etc.   │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │    WebSocket Server (ws)      │  │
│  │  Connection Management        │  │
│  │  Message Handling             │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│    Tencent Cloud IM SDK             │
│  ┌───────────────────────────────┐  │
│  │  Event Listeners              │  │
│  │  Message Sending              │  │
│  │  Connection Management        │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### 客户端架构

```
┌─────────────────────────────────────┐
│         Test Page (test.html)       │
│  ┌───────────────────────────────┐  │
│  │    HTTP API Client            │  │
│  │    - fetch() requests         │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │    WebSocket Client           │  │
│  │    - WebSocket connection     │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │    UI Components              │  │
│  │    - Forms, Buttons, Logs     │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

## 开发指南

### 添加新的 HTTP API

1. 在 `server.js` 中添加路由：
```javascript
app.post('/api/new-endpoint', async (req, res) => {
  try {
    // 处理逻辑
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

2. 更新 `HTTP_API.md` 文档

3. 在 `test.html` 中添加测试按钮

### 添加新的 WebSocket 消息类型

1. 在 `handleWebSocketMessage()` 中添加 case：
```javascript
case 'newType':
  // 处理逻辑
  ws.send(JSON.stringify({
    type: 'newTypeResult',
    success: true,
    data: result
  }));
  break;
```

2. 更新 `WEBSOCKET_API.md` 文档

3. 在 `test.html` 中添加发送函数

### 添加新的 IM 事件监听

1. 在 `initIM()` 函数中添加监听：
```javascript
chat.on(TencentCloudChat.EVENT.NEW_EVENT, (event) => {
  log('INFO', '新事件:', event.data);

  // 广播给 WebSocket 客户端
  broadcastToClients({
    type: 'newEvent',
    data: event.data
  });
});
```

## 部署说明

### 开发环境

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 生产环境

```bash
# 安装依赖
npm install --production

# 启动服务
npm start
```

### 使用 PM2 部署

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start server.js --name im-service

# 查看日志
pm2 logs im-service

# 重启服务
pm2 restart im-service
```

### Docker 部署

创建 `Dockerfile`：

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY .. .
EXPOSE 3001
CMD ["npm", "start"]
```

构建和运行：
```bash
docker build -t im-service .
docker run -p 3001:3001 -v $(pwd)/../state.json:/state.json im-service
```

## 维护指南

### 日志查看

服务器日志包含以下级别：
- `INFO` - 一般信息
- `WARN` - 警告信息
- `ERROR` - 错误信息
- `DEBUG` - 调试信息

### 常见问题

1. **IM 连接失败**
   - 检查 state.json 文件
   - 检查网络连接
   - 查看服务器日志

2. **端口被占用**
   - 修改 `server.js` 中的 `PORT` 常量
   - 或使用环境变量 `PORT=3002 npm start`

3. **WebSocket 连接失败**
   - 检查防火墙设置
   - 确认服务器已启动
   - 查看浏览器控制台错误

### 性能优化

1. **减少日志输出**
   - 调整 IM SDK 日志级别
   - 减少 DEBUG 日志

2. **WebSocket 连接管理**
   - 定期清理断开的连接
   - 限制最大连接数

3. **消息队列**
   - 对于高频消息，考虑使用消息队列
   - 批量处理消息

## 安全建议

1. **Token 保护**
   - 不要在代码中硬编码 Token
   - 使用环境变量或配置文件
   - 定期更换 Token

2. **API 访问控制**
   - 考虑添加 API 认证
   - 限制请求频率
   - 记录访问日志

3. **WebSocket 安全**
   - 使用 WSS（WebSocket Secure）
   - 验证客户端来源
   - 限制消息大小

4. **错误处理**
   - 不要在错误消息中暴露敏感信息
   - 记录详细错误日志
   - 实现优雅降级

# WebSocket API 文档

## 概述

本服务提供了 WebSocket 接口，实现了与 HTTP API 相同的功能，并支持实时消息推送和 IM 事件广播。

## 连接地址

```
ws://localhost:3001
```

无需认证，所有客户端均可直接连接。支持多用户并发会话管理。

## 消息格式

所有消息均使用 JSON 格式。

### 客户端发送消息格式

```json
{
  "type": "消息类型",
  "参数1": "值1",
  "参数2": "值2"
}
```

### 服务器响应消息格式

```json
{
  "type": "响应类型",
  "data": {},
  "message": "消息内容",
  "success": true|false
}
```

## 客户端请求类型

### 1. Ping（心跳检测）

发送心跳请求，服务器会立即响应 pong。

**请求：**
```json
{
  "type": "ping"
}
```

**响应：**
```json
{
  "type": "pong",
  "timestamp": 1234567890
}
```

### 2. 获取状态（getStatus）

获取当前 IM 服务统计信息。

**请求：**
```json
{
  "type": "getStatus"
}
```

**响应：**
```json
{
  "type": "status",
  "data": {
    "totalSessions": 2,
    "maxSessions": 100,
    "wsConnections": 1,
    "maxWsConnections": 200,
    "sessions": [
      {
        "userId": "123456",
        "uid": "game_123456",
        "appId": "1400853470",
        "isReady": true,
        "createdAt": 1234567890,
        "lastAccessTime": 1234567890,
        "age": 15000
      }
    ]
  }
}
```

### 3. 登录 IM（login）

使用 UID 和 Token 登录 IM，创建或复用会话。

**请求：**
```json
{
  "type": "login",
  "uid": "123456",
  "token": "your_token_here"
}
```

**参数说明：**
- `uid`: 用户 ID，支持 `123456` 或 `game_123456` 格式
- `token`: 用户 Token

**成功响应：**
```json
{
  "type": "loginResult",
  "success": true,
  "message": "IM 登录成功",
  "data": {
    "userId": "123456",
    "uid": "game_123456",
    "appId": "1400853470",
    "isReady": true
  }
}
```

**失败响应：**
```json
{
  "type": "loginResult",
  "success": false,
  "message": "获取 IM 签名失败"
}
```

### 4. 发送指令（sendCommand）

向指定用户的 IM 会话发送游戏指令，并自动记录响应时间。

**请求：**
```json
{
  "type": "sendCommand",
  "userId": "123456",
  "commandId": "player_hurt"
}
```

**参数说明：**
- `userId`: 用户 ID（纯数字格式）
- `commandId`: 指令 ID

**功能说明：**
- 自动记录指令发送的开始时间
- 接收响应后计算响应时间（毫秒）
- 将响应时间保存到数据库（用于运营监控）
- 失败的指令响应时间记录为 `null`

**成功响应：**
```json
{
  "type": "commandResult",
  "success": true,
  "data": {
    "success": true,
    "message": "指令发送成功",
    "data": {
      "message": {
        "ID": "msg_xxx",
        "type": "TIMTextElem",
        "payload": {
          "text": "{\"code\":\"game_cmd\",\"id\":\"player_hurt\",\"token\":\"xxx\"}"
        }
      }
    }
  }
}
```

**响应时间统计：**
- 成功的指令会记录响应时间到数据库
- 可在运营监控页面查看平均响应时间
- 用于系统性能分析和优化

**失败响应：**
```json
{
  "type": "commandResult",
  "success": false,
  "message": "会话不存在，请先登录"
}
```

### 5. 登出（logout）

销毁指定用户的 IM 会话。

**请求：**
```json
{
  "type": "logout",
  "userId": "123456"
}
```

**参数说明：**
- `userId`: 用户 ID（纯数字格式）

**成功响应：**
```json
{
  "type": "logoutResult",
  "success": true,
  "message": "登出成功"
}
```

**失败响应：**
```json
{
  "type": "logoutResult",
  "success": false,
  "message": "会话不存在"
}
```

## 服务器推送消息类型

服务器会主动推送以下类型的消息给所有连接的客户端：

### 1. 连接成功（connected）

客户端连接成功后立即收到。

```json
{
  "type": "connected",
  "message": "WebSocket 连接成功",
  "data": {
    "totalSessions": 2,
    "maxSessions": 100,
    "wsConnections": 1,
    "maxWsConnections": 200,
    "sessions": [...]
  }
}
```

### 2. 状态变化（status）

IM SDK 状态发生变化时推送。

```json
{
  "type": "status",
  "userId": "123456",
  "data": {
    "isReady": true,
    "event": "SDK_READY",
    "user": "game_123456"
  }
}
```

可能的事件类型：
- `SDK_READY` - SDK 就绪
- `SDK_NOT_READY` - SDK 未就绪
- `KICKED_OUT` - 被踢下线

### 3. 网络状态变化（network）

网络状态发生变化时推送。

```json
{
  "type": "network",
  "userId": "123456",
  "data": {
    "state": "CONNECTED"
  }
}
```

网络状态：
- `CONNECTED` - 已连接
- `CONNECTING` - 连接中
- `DISCONNECTED` - 已断开

### 4. 收到消息（message）

收到 IM 消息时推送。

```json
{
  "type": "message",
  "userId": "123456",
  "data": {
    "count": 1,
    "messages": [
      {
        "from": "user_789",
        "to": "game_123456",
        "type": "TIMTextElem",
        "payload": {
          "text": "{\"code\":\"game_cmd\",\"id\":\"player_attack\"}"
        },
        "time": 1234567890
      }
    ]
  }
}
```

### 5. 心跳（heartbeat）

服务器每 30 秒发送一次心跳，包含当前统计信息。

```json
{
  "type": "heartbeat",
  "data": {
    "timestamp": 1234567890,
    "stats": {
      "totalSessions": 2,
      "maxSessions": 100,
      "wsConnections": 1,
      "maxWsConnections": 200,
      "sessions": [...]
    }
  }
}
```

### 6. 错误（error）

发生错误时推送。

```json
{
  "type": "error",
  "message": "错误描述"
}
```

## 使用示例

### 完整流程示例

#### JavaScript (浏览器)

```javascript
// 创建 WebSocket 连接
const ws = new WebSocket('ws://localhost:3001');
let currentUserId = null;

// 连接打开
ws.onopen = () => {
  console.log('WebSocket 连接已建立');
};

// 接收消息
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('收到消息:', data);

  switch (data.type) {
    case 'connected':
      console.log('连接成功，当前统计:', data.data);
      // 连接成功后可以立即登录
      login('123456', 'your_token_here');
      break;

    case 'pong':
      console.log('Pong 响应，时间戳:', data.timestamp);
      break;

    case 'status':
      if (data.userId) {
        console.log(`用户 ${data.userId} 状态变化:`, data.data);
      } else {
        console.log('服务状态:', data.data);
      }
      break;

    case 'loginResult':
      if (data.success) {
        currentUserId = data.data.userId;
        console.log('登录成功:', data.data);
        // 登录成功后发送指令
        sendCommand(currentUserId, 'player_hurt');
      } else {
        console.error('登录失败:', data.message);
      }
      break;

    case 'logoutResult':
      if (data.success) {
        console.log('登出成功');
        currentUserId = null;
      } else {
        console.error('登出失败:', data.message);
      }
      break;

    case 'commandResult':
      if (data.success) {
        console.log('指令发送成功:', data.data);
      } else {
        console.error('指令发送失败:', data.message);
      }
      break;

    case 'message':
      console.log(`收到用户 ${data.userId} 的 IM 消息:`, data.data.messages);
      break;

    case 'network':
      console.log(`用户 ${data.userId} 网络状态变化:`, data.data.state);
      break;

    case 'heartbeat':
      console.log('心跳，当前统计:', data.data.stats);
      break;

    case 'error':
      console.error('错误:', data.message);
      break;
  }
};

// 错误处理
ws.onerror = (error) => {
  console.error('WebSocket 错误:', error);
};

// 连接关闭
ws.onclose = (event) => {
  console.log('WebSocket 连接已关闭:', event.code, event.reason);
  currentUserId = null;
};

// 辅助函数
function login(uid, token) {
  ws.send(JSON.stringify({
    type: 'login',
    uid: uid,
    token: token
  }));
}

function logout(userId) {
  ws.send(JSON.stringify({
    type: 'logout',
    userId: userId
  }));
}

function sendCommand(userId, commandId) {
  ws.send(JSON.stringify({
    type: 'sendCommand',
    userId: userId,
    commandId: commandId
  }));
}

function getStatus() {
  ws.send(JSON.stringify({
    type: 'getStatus'
  }));
}

// 每 30 秒发送一次心跳
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
  }
}, 30000);
```

#### Node.js 客户端示例

```javascript
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3001');

ws.on('open', () => {
  console.log('WebSocket 连接已建立');

  // 步骤 1: 登录
  ws.send(JSON.stringify({
    type: 'login',
    uid: '123456',
    token: 'your_token_here'
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('收到消息:', message);

  // 步骤 2: 登录成功后发送指令
  if (message.type === 'loginResult' && message.success) {
    const userId = message.data.userId;
    ws.send(JSON.stringify({
      type: 'sendCommand',
      userId: userId,
      commandId: 'player_hurt'
    }));
  }
});

ws.on('error', (error) => {
  console.error('WebSocket 错误:', error);
});

ws.on('close', () => {
  console.log('WebSocket 连接已关闭');
});
```

#### Python 客户端示例

```python
import websocket
import json
import threading
import time

def on_message(ws, message):
    data = json.loads(message)
    print(f"收到消息: {data}")

    # 步骤 2: 登录成功后发送指令
    if data.get('type') == 'loginResult' and data.get('success'):
        user_id = data['data']['userId']
        ws.send(json.dumps({
            'type': 'sendCommand',
            'userId': user_id,
            'commandId': 'player_hurt'
        }))

def on_error(ws, error):
    print(f"错误: {error}")

def on_close(ws, close_status_code, close_msg):
    print(f"连接已关闭: {close_status_code} {close_msg}")

def on_open(ws):
    print("连接已建立")

    # 步骤 1: 登录
    ws.send(json.dumps({
        'type': 'login',
        'uid': '123456',
        'token': 'your_token_here'
    }))

    # 启动心跳线程
    def heartbeat():
        while True:
            time.sleep(30)
            if ws.sock and ws.sock.connected:
                ws.send(json.dumps({'type': 'ping'}))

    threading.Thread(target=heartbeat, daemon=True).start()

if __name__ == "__main__":
    ws = websocket.WebSocketApp(
        "ws://localhost:3001",
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close
    )

    ws.run_forever()
```

## 错误代码

WebSocket 关闭代码：

- `1000` - 正常关闭
- `1008` - 策略冲突（如连接数超限）
- `1011` - 服务器内部错误

## 注意事项

1. **消息格式**：所有消息必须是有效的 JSON 格式
2. **UserID 格式**：
   - 登录时支持 `123456` 或 `game_123456` 两种格式
   - 其他消息请使用纯数字格式 `123456`
3. **连接保持**：建议实现心跳机制（每30秒发送一次 ping）
4. **错误处理**：务必处理 `error` 类型的消息和 `error` 事件
5. **重连机制**：建议实现自动重连逻辑，并处理重复登录
6. **并发限制**：
   - 最大会话数: 100个
   - 最大 WebSocket 连接数: 200个
7. **事件广播**：所有 IM 事件（消息、状态变化等）会广播给所有 WebSocket 客户端
8. **资源清理**：建议在使用完毕后调用 `logout` 主动销毁会话
9. **响应时间统计**：`sendCommand` 会自动记录响应时间，用于运营监控分析

## 与 HTTP API 对比

| 功能 | HTTP API | WebSocket API | 说明 |
|------|----------|---------------|------|
| 健康检查 | GET /health | type: ping | WebSocket 包含更多统计信息 |
| 获取状态 | GET /api/status | type: getStatus | 数据格式一致 |
| 登录 | POST /api/login | type: login | WebSocket 有独立的响应类型 |
| 发送指令 | POST /api/send-command | type: sendCommand | 都支持响应时间统计 |
| 登出 | POST /api/logout | type: logout | WebSocket 有独立的响应类型 |
| 查询会话 | GET /api/session/:userId | ❌ 不支持 | 仅 HTTP 支持 |
| 实时推送 | ❌ 不支持 | ✅ 支持 | WebSocket 实时接收 IM 事件 |
| 连接保持 | ❌ 短连接 | ✅ 长连接 | WebSocket 更高效 |
| 双向通信 | ❌ 请求-响应 | ✅ 全双工 | WebSocket 支持服务器推送 |
| 广播能力 | ❌ 无 | ✅ 有 | WebSocket 自动广播 IM 事件 |
| 运营监控 | GET /api/admin/stats/* | ❌ 不支持 | 仅 HTTP 支持统计查询 | |

## 优势

1. **实时性**：服务器可以主动推送消息，无需轮询
2. **效率**：长连接减少了连接建立的开销
3. **双向通信**：客户端和服务器可以随时互相发送消息
4. **状态同步**：自动接收 IM 状态变化和消息推送
5. **事件广播**：所有连接的客户端都能收到 IM 事件
6. **统一接口**：一个连接处理所有操作，无需多次 HTTP 请求
7. **实时统计**：通过心跳消息实时了解服务状态

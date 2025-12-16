# WebSocket API 文档

## 概述

本服务提供了 WebSocket 接口，实现了与 HTTP API 相同的功能，并支持实时消息推送。

## 连接地址

```
ws://localhost:3001
```

无需认证，所有客户端均可直接连接并使用所有功能。

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
  "message": "消息内容"
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

获取当前 IM 服务状态。

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
    "isReady": true,
    "config": {
      "uid": "game_123456",
      "userId": "123456",
      "appId": "1400000000",
      "hasToken": true,
      "hasSign": true
    }
  }
}
```

### 3. 登录役次元IM（login）

获取当前 IM 服务状态。

**请求：**
```json
{
  "type": "login",
  "uid": "uid",
  "token": "token"
}
```

**响应：**
```json
{
  "type": "status",
  "data": {
    "isReady": true,
    "config": {
      "uid": "game_123456",
      "userId": "123456",
      "appId": "1400000000",
      "hasToken": true,
      "hasSign": true
    }
  }
}
```

### 4. 发送指令（sendCommand）

发送游戏指令到 IM。

**请求：**
```json
{
  "type": "sendCommand",
  "commandId": "command_123"
}
```

**成功响应：**
```json
{
  "type": "commandResult",
  "success": true,
  "data": {
    "success": true,
    "message": "指令发送成功"
  }
}
```

**失败响应：**
```json
{
  "type": "commandResult",
  "success": false,
  "message": "错误信息"
}
```

### 5. 重新初始化（reinit）

重新初始化 IM 连接。

**请求：**
```json
{
  "type": "reinit"
}
```

**响应：**
```json
{
  "type": "reinitResult",
  "success": true,
  "message": "IM 重新初始化成功"
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
    "isReady": true,
    "uid": "game_123456",
    "userId": "123456"
  }
}
```

### 2. 状态变化（status）

IM SDK 状态发生变化时推送。

```json
{
  "type": "status",
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
  "data": {
    "state": "CONNECTED"
  }
}
```

### 4. 收到消息（message）

收到 IM 消息时推送。

```json
{
  "type": "message",
  "data": {
    "count": 1,
    "messages": [
      {
        "from": "user_123",
        "to": "game_123456",
        "type": "TIMTextElem",
        "payload": {
          "text": "消息内容"
        },
        "time": 1234567890
      }
    ]
  }
}
```

### 5. 心跳（heartbeat）

服务器每 30 秒发送一次心跳。

```json
{
  "type": "heartbeat",
  "data": {
    "isReady": true,
    "timestamp": 1234567890,
    "clients": 2
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

### JavaScript 客户端示例

```javascript
// 创建 WebSocket 连接
const ws = new WebSocket('ws://localhost:3001');

// 连接打开
ws.onopen = () => {
  console.log('WebSocket 连接已建立');

  // 发送 ping
  ws.send(JSON.stringify({ type: 'ping' }));

  // 获取状态
  ws.send(JSON.stringify({ type: 'getStatus' }));
};

// 接收消息
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('收到消息:', data);

  switch (data.type) {
    case 'connected':
      console.log('连接成功:', data.data);
      break;
    case 'pong':
      console.log('Pong 响应');
      break;
    case 'status':
      console.log('状态:', data.data);
      break;
    case 'message':
      console.log('收到 IM 消息:', data.data.messages);
      break;
    case 'heartbeat':
      console.log('心跳:', data.data);
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
};

// 发送指令
function sendCommand(commandId) {
  ws.send(JSON.stringify({
    type: 'sendCommand',
    commandId: commandId
  }));
}

// 重新初始化
function reinit() {
  ws.send(JSON.stringify({
    type: 'reinit'
  }));
}
```

### Node.js 客户端示例

```javascript
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3001');

ws.on('open', () => {
  console.log('WebSocket 连接已建立');

  // 发送 ping
  ws.send(JSON.stringify({ type: 'ping' }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('收到消息:', message);
});

ws.on('error', (error) => {
  console.error('WebSocket 错误:', error);
});

ws.on('close', () => {
  console.log('WebSocket 连接已关闭');
});
```

### Python 客户端示例

```python
import websocket
import json

def on_message(ws, message):
    data = json.loads(message)
    print(f"收到消息: {data}")

def on_error(ws, error):
    print(f"错误: {error}")

def on_close(ws, close_status_code, close_msg):
    print("连接已关闭")

def on_open(ws):
    print("连接已建立")
    # 发送 ping
    ws.send(json.dumps({"type": "ping"}))
    # 获取状态
    ws.send(json.dumps({"type": "getStatus"}))

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

## 测试工具

项目提供了一个 HTML 测试客户端，可以直接在浏览器中测试 WebSocket 功能。

打开 `ws-client-test.html` 文件即可使用。

## 错误代码

WebSocket 关闭代码：

- `1000` - 正常关闭
- `1011` - 服务器内部错误

## 注意事项

1. **消息格式**：所有消息必须是有效的 JSON 格式
2. **连接保持**：建议实现心跳机制保持连接活跃
3. **错误处理**：务必处理 `error` 类型的消息
4. **重连机制**：建议实现自动重连逻辑

## 与 HTTP API 对比

| 功能 | HTTP API | WebSocket API |
|------|----------|---------------|
| 健康检查 | GET /health | type: ping |
| 获取状态 | GET /api/status | type: getStatus |
| 发送指令 | POST /api/send-command | type: sendCommand |
| 重新初始化 | POST /api/reinit | type: reinit |
| 实时推送 | ❌ 不支持 | ✅ 支持 |
| 连接保持 | ❌ 短连接 | ✅ 长连接 |

## 优势

1. **实时性**：服务器可以主动推送消息，无需轮询
2. **效率**：长连接减少了连接建立的开销
3. **双向通信**：客户端和服务器可以随时互相发送消息
4. **状态同步**：自动接收 IM 状态变化和消息推送

# HTTP API 文档

## 概述

本服务提供 RESTful HTTP API 接口，用于 IM 登录、状态查询、指令发送等功能。支持多用户并发会话管理。

## 基础信息

- **Base URL**: `http://localhost:3001`
- **Content-Type**: `application/json`
- **认证**: 无需认证

## API 接口列表

### 1. 健康检查

检查服务运行状态和统计信息。

**请求**

```
GET /health
```

**响应**

```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "stats": {
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

**字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| status | string | 服务状态，固定为 "ok" |
| timestamp | number | 时间戳 |
| stats.totalSessions | number | 当前活跃会话数 |
| stats.maxSessions | number | 最大会话数限制 |
| stats.wsConnections | number | 当前 WebSocket 连接数 |
| stats.maxWsConnections | number | 最大 WebSocket 连接数限制 |
| stats.sessions | array | 会话详情列表 |

---

### 2. 获取状态

获取 IM 服务状态统计信息。

**请求**

```
GET /api/status
```

**响应**

```json
{
  "stats": {
    "totalSessions": 2,
    "maxSessions": 100,
    "wsConnections": 1,
    "maxWsConnections": 200,
    "sessions": [...]
  },
  "isReady": true
}
```

**字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| stats | object | 统计信息对象（同/health接口） |
| isReady | boolean | 是否有活跃会话 |

---

### 3. 使用凭证登录

使用自定义的 UID 和 Token 登录 IM，创建或复用会话。

**请求**

```
POST /api/login
Content-Type: application/json
```

**请求体**

```json
{
  "uid": "123456",
  "token": "your_token_here"
}
```

**参数说明**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uid | string | 是 | 用户 ID，支持 "123456" 或 "game_123456" 格式 |
| token | string | 是 | 用户 Token |

**成功响应**

```json
{
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

**错误响应**

```json
{
  "success": false,
  "message": "获取 IM 签名失败"
}
```

**状态码**

- `200` - 成功
- `400` - 缺少参数
- `500` - 登录失败

**说明**

- UID 会自动处理格式，支持纯数字和带 game_ 前缀两种格式
- 会自动获取 IM 签名
- 如果会话已存在且 token 相同，则复用现有会话
- 如果 token 不同，则销毁旧会话并创建新会话
- 登录成功后会等待 SDK 就绪（最多 15 秒）

---

### 4. 发送指令

向指定用户的 IM 会话发送游戏指令。

**请求**

```
POST /api/send-command
Content-Type: application/json
```

**请求体**

```json
{
  "userId": "123456",
  "commandId": "player_hurt"
}
```

**参数说明**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string | 是 | 用户 ID（纯数字格式） |
| commandId | string | 是 | 指令 ID |

**成功响应**

```json
{
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
```

**错误响应**

```json
{
  "success": false,
  "message": "会话不存在，请先登录"
}
```

或

```json
{
  "success": false,
  "message": "IM 会话未就绪"
}
```

**状态码**

- `200` - 成功
- `400` - 缺少参数
- `404` - 会话不存在
- `503` - IM 会话未就绪
- `500` - 发送失败

---

### 5. 登出

销毁指定用户的 IM 会话。

**请求**

```
POST /api/logout
Content-Type: application/json
```

**请求体**

```json
{
  "userId": "123456"
}
```

**参数说明**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string | 是 | 用户 ID（纯数字格式） |

**成功响应**

```json
{
  "success": true,
  "message": "登出成功"
}
```

**错误响应**

```json
{
  "success": false,
  "message": "会话不存在"
}
```

**状态码**

- `200` - 成功
- `400` - 缺少参数
- `404` - 会话不存在
- `500` - 登出失败

---

### 6. 获取会话详情

获取指定用户的会话详细信息。

**请求**

```
GET /api/session/:userId
```

**URL 参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string | 是 | 用户 ID（纯数字格式） |

**响应**

```json
{
  "success": true,
  "data": {
    "userId": "123456",
    "uid": "game_123456",
    "appId": "1400853470",
    "isReady": true,
    "createdAt": 1234567890,
    "lastAccessTime": 1234567890,
    "age": 15000
  }
}
```

**字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| userId | string | 用户 ID（纯数字） |
| uid | string | 完整 UID（带 game_ 前缀） |
| appId | string | 腾讯云 IM 应用 ID |
| isReady | boolean | IM SDK 是否就绪 |
| createdAt | number | 会话创建时间戳 |
| lastAccessTime | number | 最后访问时间戳 |
| age | number | 会话存活时间（毫秒） |

**状态码**

- `200` - 成功
- `404` - 会话不存在
- `500` - 查询失败

---

## 错误处理

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在（会话不存在） |
| 500 | 服务器内部错误 |
| 503 | 服务不可用（IM 未就绪） |

### 错误响应格式

```json
{
  "success": false,
  "message": "错误描述"
}
```

---

## 使用示例

### 完整流程示例

#### 1. 登录并发送指令

**JavaScript (Node.js)**

```javascript
// 步骤 1: 登录
const loginResponse = await fetch('http://localhost:3001/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    uid: '123456',
    token: 'your_token_here'
  })
});

const loginResult = await loginResponse.json();
console.log('登录结果:', loginResult);

if (loginResult.success) {
  const userId = loginResult.data.userId;

  // 步骤 2: 发送指令
  const commandResponse = await fetch('http://localhost:3001/api/send-command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: userId,
      commandId: 'player_hurt'
    })
  });

  const commandResult = await commandResponse.json();
  console.log('指令发送结果:', commandResult);

  // 步骤 3: 查询会话详情
  const sessionResponse = await fetch(`http://localhost:3001/api/session/${userId}`);
  const sessionInfo = await sessionResponse.json();
  console.log('会话详情:', sessionInfo);

  // 步骤 4: 登出
  const logoutResponse = await fetch('http://localhost:3001/api/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: userId })
  });

  const logoutResult = await logoutResponse.json();
  console.log('登出结果:', logoutResult);
}
```

**Python**

```python
import requests

# 步骤 1: 登录
login_response = requests.post(
    'http://localhost:3001/api/login',
    json={
        'uid': '123456',
        'token': 'your_token_here'
    }
)
login_result = login_response.json()
print('登录结果:', login_result)

if login_result.get('success'):
    user_id = login_result['data']['userId']

    # 步骤 2: 发送指令
    command_response = requests.post(
        'http://localhost:3001/api/send-command',
        json={
            'userId': user_id,
            'commandId': 'player_hurt'
        }
    )
    command_result = command_response.json()
    print('指令发送结果:', command_result)

    # 步骤 3: 查询会话详情
    session_response = requests.get(f'http://localhost:3001/api/session/{user_id}')
    session_info = session_response.json()
    print('会话详情:', session_info)

    # 步骤 4: 登出
    logout_response = requests.post(
        'http://localhost:3001/api/logout',
        json={'userId': user_id}
    )
    logout_result = logout_response.json()
    print('登出结果:', logout_result)
```

#### 2. cURL 命令示例

```bash
# 健康检查
curl http://localhost:3001/health

# 获取状态
curl http://localhost:3001/api/status

# 登录
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"uid": "123456", "token": "your_token_here"}'

# 发送指令（替换为你的userId）
curl -X POST http://localhost:3001/api/send-command \
  -H "Content-Type: application/json" \
  -d '{"userId": "123456", "commandId": "player_hurt"}'

# 查询会话详情（替换为你的userId）
curl http://localhost:3001/api/session/123456

# 登出
curl -X POST http://localhost:3001/api/logout \
  -H "Content-Type: application/json" \
  -d '{"userId": "123456"}'
```

---

## 注意事项

1. **会话管理**: 必须先调用 `/api/login` 创建会话，才能使用其他需要 userId 的接口
2. **UserID 格式**: 
   - 登录时支持 `123456` 或 `game_123456` 两种格式
   - 其他接口请使用纯数字格式 `123456`
3. **并发限制**: 
   - 最大会话数: 100个
   - 最大 WebSocket 连接数: 200个
   - 会话超时: 240分钟无访问自动销毁
4. **错误处理**: 务必检查响应中的 `success` 字段，并处理各种错误情况
5. **资源清理**: 建议在使用完毕后调用 `/api/logout` 主动销毁会话
6. **超时设置**: 建议设置合理的请求超时时间（推荐 30 秒）
7. **重试机制**: 对于网络错误或 503 错误，可以实现指数退避重试
8. **日志记录**: 建议记录所有 API 调用和响应，便于排查问题

---

## 系统架构

### 会话管理

- 每个用户（userId）拥有独立的 IM 会话
- 会话自动处理 IM SDK 的初始化和事件监听
- 支持会话复用和自动清理
- 使用异步锁保证会话操作的原子性

### 事件广播

- WebSocket 连接可以接收所有 IM 事件推送
- 包括：SDK 状态变化、网络状态、消息接收等
- 支持多客户端同时监听同一用户的 IM 事件

### 资源限制

- 达到最大会话数或连接数时，返回明确的错误信息
- 定期清理过期会话（每5分钟检查一次）
- 优雅退出时销毁所有会话

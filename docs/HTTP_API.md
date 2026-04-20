# HTTP API 文档

## 概述

本服务提供 RESTful HTTP API 接口，用于 IM 登录、状态查询、指令发送等功能。支持多用户并发会话管理。

**v3.0 新增**: 管理员认证、日志查询、密码重置等管理接口。

## 基础信息

- **Base URL**: `http://localhost:3001`
- **Content-Type**: `application/json`
- **认证**:
  - 用户接口: 无需认证
  - 管理接口: 需要 JWT Token 认证

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

## 管理接口

### 7. 管理员登录

管理员登录获取 JWT Token。

**请求**

```
POST /api/admin/login
Content-Type: application/json
```

**请求体**

```json
{
  "username": "admin",
  "password": "encrypted_password"
}
```

**参数说明**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 管理员用户名 |
| password | string | 是 | SM4 加密后的密码 |

**成功响应**

```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "username": "admin",
    "expiresIn": "24h"
  }
}
```

**错误响应**

```json
{
  "success": false,
  "message": "用户名或密码错误"
}
```

**状态码**

- `200` - 成功
- `400` - 缺少参数
- `401` - 用户名或密码错误
- `500` - 登录失败

---

### 8. 获取所有会话 (需要认证)

获取所有用户会话的详细信息。

**请求**

```
GET /api/admin/sessions
Authorization: Bearer <token>
```

**响应**

```json
{
  "success": true,
  "data": {
    "totalSessions": 3,
    "maxSessions": 100,
    "wsConnections": 5,
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

**状态码**

- `200` - 成功
- `401` - 未提供认证令牌
- `403` - 令牌无效或已过期
- `500` - 查询失败

---

### 9. 重置管理员密码 (需要认证)

修改当前管理员的密码。

**请求**

```
POST /api/admin/reset-password
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体**

```json
{
  "oldPassword": "encrypted_old_password",
  "newPassword": "encrypted_new_password"
}
```

**参数说明**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| oldPassword | string | 是 | SM4 加密后的原密码 |
| newPassword | string | 是 | SM4 加密后的新密码 (至少 6 位) |

**成功响应**

```json
{
  "success": true,
  "message": "密码重置成功"
}
```

**错误响应**

```json
{
  "success": false,
  "message": "原密码错误"
}
```

**状态码**

- `200` - 成功
- `400` - 参数错误或密码长度不足
- `401` - 未提供认证令牌
- `403` - 令牌无效或已过期
- `500` - 重置失败

---

### 10. 获取连接日志 (需要认证)

查询用户连接日志（登录/登出记录）。

**请求**

```
GET /api/admin/logs/connections?userId=xxx&action=login&status=success&limit=20&offset=0
Authorization: Bearer <token>
```

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string | 否 | 按用户 ID 筛选 |
| action | string | 否 | 按操作类型筛选 (login/logout) |
| status | string | 否 | 按状态筛选 (success/failed) |
| startTime | number | 否 | 开始时间戳 |
| endTime | number | 否 | 结束时间戳 |
| limit | number | 否 | 每页数量 (默认 100) |
| offset | number | 否 | 偏移量 (默认 0) |

**响应**

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": 1,
        "user_id": "123456",
        "uid": "game_123456",
        "action": "login",
        "status": "success",
        "message": "IM 登录成功",
        "ip_address": "127.0.0.1",
        "created_at": 1702741234567
      }
    ],
    "total": 100,
    "limit": 20,
    "offset": 0
  }
}
```

**状态码**

- `200` - 成功
- `401` - 未提供认证令牌
- `403` - 令牌无效或已过期
- `500` - 查询失败

---

### 11. 获取指令日志 (需要认证)

查询指令发送日志。

**请求**

```
GET /api/admin/logs/commands?userId=xxx&status=success&limit=20&offset=0
Authorization: Bearer <token>
```

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string | 否 | 按用户 ID 筛选 |
| status | string | 否 | 按状态筛选 (success/failed) |
| startTime | number | 否 | 开始时间戳 |
| endTime | number | 否 | 结束时间戳 |
| limit | number | 否 | 每页数量 (默认 100) |
| offset | number | 否 | 偏移量 (默认 0) |

**响应**

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": 1,
        "user_id": "123456",
        "command_id": "player_hurt",
        "status": "success",
        "message": "指令发送成功",
        "created_at": 1702741234567
      }
    ],
    "total": 50,
    "limit": 20,
    "offset": 0
  }
}
```

**状态码**

- `200` - 成功
- `401` - 未提供认证令牌
- `403` - 令牌无效或已过期
- `500` - 查询失败

---

### 12. 获取日志统计 (需要认证)

获取连接日志和指令日志的统计信息。

**请求**

```
GET /api/admin/logs/stats
Authorization: Bearer <token>
```

**响应**

```json
{
  "success": true,
  "data": {
    "connection": {
      "total": 100,
      "success": 95,
      "failed": 5
    },
    "command": {
      "total": 50,
      "success": 48,
      "failed": 2
    }
  }
}
```

**状态码**

- `200` - 成功
- `401` - 未提供认证令牌
- `403` - 令牌无效或已过期
- `500` - 查询失败

---

### 13. 获取实时统计数据 (需要认证)

获取运营监控所需的实时统计数据。

**请求**

```
GET /api/admin/stats/realtime
Authorization: Bearer <token>
```

**响应**

```json
{
  "success": true,
  "data": {
    "onlineUsers": 15,
    "todayMessages": 1247,
    "errorRate": 2.35,
    "avgResponseTime": 45.32,
    "timestamp": 1702741234567
  }
}
```

**字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| onlineUsers | number | 在线用户数（今日活跃会话） |
| todayMessages | number | 今日消息总数（指令日志） |
| errorRate | number | 错误率（百分比） |
| avgResponseTime | number | 平均响应时间（毫秒，真实数据） |
| timestamp | number | 时间戳 |

**状态码**

- `200` - 成功
- `401` - 未提供认证令牌
- `403` - 令牌无效或已过期
- `500` - 查询失败

---

### 14. 获取流量趋势数据 (需要认证)

获取指定时间范围内的流量趋势数据，用于柱状图展示。

**请求**

```
GET /api/admin/stats/traffic-trend?range=day
Authorization: Bearer <token>
```

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| range | string | 否 | 时间范围：day(日)/week(周)/month(月)/year(年)，默认 day |

**响应**

```json
{
  "success": true,
  "data": {
    "trend": [
      {
        "time": "00:00",
        "count": 45,
        "timestamp": 1702741200000
      },
      {
        "time": "01:00",
        "count": 38,
        "timestamp": 1702744800000
      }
    ],
    "range": "day",
    "interval": "1小时"
  }
}
```

**字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| trend | array | 流量数据数组 |
| trend[].time | string | 时间标签 |
| trend[].count | number | 消息数量 |
| trend[].timestamp | number | 时间戳 |
| range | string | 时间范围类型 |
| interval | string | 时间间隔说明 |

**状态码**

- `200` - 成功
- `401` - 未提供认证令牌
- `403` - 令牌无效或已过期
- `500` - 查询失败

---

### 15. 获取系统指标 (需要认证)

获取服务器系统资源使用情况（CPU、内存、磁盘）。

**请求**

```
GET /api/admin/stats/system-metrics
Authorization: Bearer <token>
```

**响应**

```json
{
  "success": true,
  "data": {
    "cpu": 45.2,
    "memory": 62.8,
    "disk": 73.5,
    "timestamp": 1702741234567
  }
}
```

**字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| cpu | number | CPU 使用率（百分比） |
| memory | number | 内存使用率（百分比） |
| disk | number | 磁盘使用率（百分比） |
| timestamp | number | 时间戳 |

**状态码**

- `200` - 成功
- `401` - 未提供认证令牌
- `403` - 令牌无效或已过期
- `500` - 查询失败

---

### 16. 获取报表总览 (需要认证)

返回统一的报表查询条件、总览统计和 KPI 卡片。

**请求**

```
GET /api/admin/reports/overview?presetRange=today&granularity=hour
Authorization: Bearer <token>
```

**查询参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| presetRange | string | 否 | today / last7days / last30days / thisMonth |
| granularity | string | 否 | hour / day / week / month |
| userId | string | 否 | 按用户筛选 |
| commandStatus | string | 否 | all / success / failed |
| startTime | string | 否 | 自定义开始时间（ISO 字符串） |
| endTime | string | 否 | 自定义结束时间（ISO 字符串） |

**响应**

```json
{
  "success": true,
  "data": {
    "query": {
      "presetRange": "today",
      "granularity": "hour",
      "page": 1,
      "pageSize": 20
    },
    "cards": [
      { "metric": "onlineUsers", "label": "在线用户", "value": 12, "unit": "人" },
      { "metric": "activeUsers", "label": "活跃用户", "value": 24, "unit": "人" }
    ],
    "stats": {
      "onlineUsers": 12,
      "activeUsers": 24,
      "todayMessages": 320,
      "totalCommands": 320,
      "successRate": 98.13,
      "avgResponseTime": 45.7,
      "p95ResponseTime": 110,
      "errorRate": 1.87
    }
  }
}
```

---

### 17. 获取报表趋势 (需要认证)

返回指定指标的趋势点位，供图表渲染使用。

**请求**

```
GET /api/admin/reports/trends?presetRange=last7days&granularity=day&metric=messageCount
Authorization: Bearer <token>
```

**响应**

```json
{
  "success": true,
  "data": {
    "metric": "messageCount",
    "granularity": "day",
    "points": [
      {
        "time": "04-20",
        "value": 52,
        "extra": { "timestamp": 1745078400000 }
      }
    ]
  }
}
```

---

### 18. 获取报表分布 (需要认证)

返回状态分布或指令分布，供饼图等结构分析组件使用。

**请求**

```
GET /api/admin/reports/distributions?metric=commandStatus
Authorization: Bearer <token>
```

**响应**

```json
{
  "success": true,
  "data": {
    "metric": "commandStatus",
    "dimension": "commandStatus",
    "items": [
      { "key": "success", "label": "success", "value": 80, "ratio": 88.89 },
      { "key": "failed", "label": "failed", "value": 10, "ratio": 11.11 }
    ]
  }
}
```

---

### 19. 获取报表排行 (需要认证)

返回 TOP 用户或 TOP 指令排行。

**请求**

```
GET /api/admin/reports/rankings?metric=topCommands
Authorization: Bearer <token>
```

**响应**

```json
{
  "success": true,
  "data": {
    "metric": "topCommands",
    "items": [
      { "key": "sendCommand", "label": "sendCommand", "value": 45 }
    ]
  }
}
```

---

### 20. 获取报表明细 (需要认证)

返回报表明细表数据，支持连接明细或指令明细。

**请求**

```
GET /api/admin/reports/details?type=commands&page=1&pageSize=20
Authorization: Bearer <token>
```

**响应**

```json
{
  "success": true,
  "data": {
    "type": "commands",
    "columns": ["user_id", "command_id", "status", "message", "response_time", "created_at"],
    "rows": [
      {
        "id": 1,
        "user_id": "123456",
        "command_id": "player_hurt",
        "status": "success",
        "message": "指令发送成功",
        "response_time": 48,
        "created_at": 1702741234567
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "pageSize": 20
    }
  }
}
```

---

### 21. 获取报表摘要 (需要认证)

返回结构化摘要，用于报表中心的洞察区块。

**请求**

```
GET /api/admin/reports/summary?presetRange=last7days
Authorization: Bearer <token>
```

**响应**

```json
{
  "success": true,
  "data": {
    "headline": "当前周期指令总量 120 次，成功率 98.2%",
    "highlights": ["sendCommand 为当前最高频指令"],
    "anomalies": ["错误率峰值: 14:00 (8.2%)"],
    "recommendations": ["建议优先排查异常时段相关日志与系统负载"]
  }
}
```

---

### 22. 导出报表 (需要认证)

按照当前筛选条件导出明细数据。

**请求**

```
POST /api/admin/reports/export
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体**

```json
{
  "format": "csv",
  "type": "commands",
  "presetRange": "today",
  "granularity": "hour",
  "userId": ""
}
```

**响应**

- 成功时返回 `text/csv`
- 当前版本仅支持 `csv` 导出

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

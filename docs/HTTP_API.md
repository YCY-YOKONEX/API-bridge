# HTTP API 文档

## 概述

本服务提供 RESTful HTTP API 接口，用于 IM 登录、状态查询、指令发送等功能。

## 基础信息

- **Base URL**: `http://localhost:3001`
- **Content-Type**: `application/json`
- **认证**: 无需认证

## API 接口列表

### 1. 健康检查

检查服务是否正常运行。

**请求**

```
GET /health
```

**响应**

```json
{
  "status": "ok",
  "imReady": true,
  "uid": "game_5",
  "userId": "5"
}
```

**字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| status | string | 服务状态，固定为 "ok" |
| imReady | boolean | IM 是否已就绪 |
| uid | string | 当前登录的 UID（带 game_ 前缀） |
| userId | string | 当前登录的用户 ID（不带前缀） |

---

### 2. 获取状态

获取详细的 IM 服务状态信息。

**请求**

```
GET /api/status
```

**响应**

```json
{
  "isReady": true,
  "config": {
    "uid": "game_5",
    "userId": "5",
    "appId": "1400853470",
    "hasToken": true,
    "hasSign": true
  }
}
```

**字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| isReady | boolean | IM SDK 是否已就绪 |
| config.uid | string | 当前登录的 UID |
| config.userId | string | 当前登录的用户 ID |
| config.appId | string | 腾讯云 IM 应用 ID |
| config.hasToken | boolean | 是否有 Token |
| config.hasSign | boolean | 是否有签名 |

---

### 3. 发送指令

向 IM 发送游戏指令。

**请求**

```
POST /api/send-command
Content-Type: application/json
```

**请求体**

```json
{
  "commandId": "player_hurt"
}
```

**参数说明**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
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
  "message": "IM 未就绪"
}
```

**状态码**

- `200` - 成功
- `400` - 缺少参数
- `503` - IM 未就绪
- `500` - 发送失败

---

### 4. 重新初始化

使用配置文件（state.json）重新初始化 IM 连接。

**请求**

```
POST /api/reinit
```

**响应**

```json
{
  "success": true,
  "message": "IM 重新初始化成功"
}
```

**说明**

- 会从 `../state.json` 文件读取 UID 和 Token
- 会重新获取 IM 签名
- 会销毁旧的 IM 实例并创建新实例
- 会重新登录 IM

---

### 5. 使用凭证登录

使用自定义的 UID 和 Token 登录 IM。

**请求**

```
POST /api/login
Content-Type: application/json
```

**请求体**

```json
{
  "uid": "5",
  "token": "your_token_here"
}
```

**参数说明**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uid | string | 是 | 用户 ID，支持 "5" 或 "game_5" 格式 |
| token | string | 是 | 用户 Token |

**成功响应**

```json
{
  "success": true,
  "message": "IM 登录成功",
  "data": {
    "uid": "game_5",
    "userId": "5",
    "appId": "1400853470"
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

- UID 会自动处理格式，支持 "5" 和 "game_5" 两种格式
- 会自动获取 IM 签名
- 会销毁旧的 IM 实例并创建新实例
- 登录成功后会等待 SDK 就绪（最多 15 秒）

---

## 错误处理

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
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

### cURL 示例

```bash
# 健康检查
curl http://localhost:3001/health

# 获取状态
curl http://localhost:3001/api/status

# 发送指令
curl -X POST http://localhost:3001/api/send-command \
  -H "Content-Type: application/json" \
  -d '{"commandId": "player_hurt"}'

# 重新初始化
curl -X POST http://localhost:3001/api/reinit

# 使用凭证登录
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"uid": "5", "token": "your_token_here"}'
```

### JavaScript 示例

```javascript
// 健康检查
const health = await fetch('http://localhost:3001/health');
const healthData = await health.json();
console.log(healthData);

// 获取状态
const status = await fetch('http://localhost:3001/api/status');
const statusData = await status.json();
console.log(statusData);

// 发送指令
const sendCommand = await fetch('http://localhost:3001/api/send-command', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ commandId: 'player_hurt' })
});
const commandResult = await sendCommand.json();
console.log(commandResult);

// 使用凭证登录
const login = await fetch('http://localhost:3001/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ uid: '5', token: 'your_token_here' })
});
const loginResult = await login.json();
console.log(loginResult);
```

### Python 示例

```python
import requests

# 健康检查
response = requests.get('http://localhost:3001/health')
print(response.json())

# 获取状态
response = requests.get('http://localhost:3001/api/status')
print(response.json())

# 发送指令
response = requests.post(
    'http://localhost:3001/api/send-command',
    json={'commandId': 'player_hurt'}
)
print(response.json())

# 使用凭证登录
response = requests.post(
    'http://localhost:3001/api/login',
    json={'uid': '5', 'token': 'your_token_here'}
)
print(response.json())
```

---

## 注意事项

1. **IM 状态检查**: 发送指令前建议先检查 IM 是否就绪
2. **错误处理**: 务必处理 HTTP 错误状态码和响应中的 success 字段
3. **超时设置**: 建议设置合理的请求超时时间（推荐 30 秒）
4. **重试机制**: 对于 503 错误，可以实现重试机制
5. **日志记录**: 建议记录所有 API 调用和响应，便于排查问题

---

## 测试工具

项目提供了 HTML 测试页面，可以方便地测试所有 HTTP API：

```bash
# 在浏览器中打开
test.html
```

测试页面功能：
- 可视化的 API 调用界面
- 实时日志显示
- 响应结果预览
- IM 登录状态监控

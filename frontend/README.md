# # YOKONEX-API-Bridge 前端

基于 Vue3 + Ant Design Vue 构建的现代化管理后台。

## 功能特性

- ✅ **登录认证**: JWT Token 认证,SM2国密加密传输,安全可靠
- ✅ **控制台**: 实时监控用户会话和服务器状态
- ✅ **运营监控**: ECharts可视化展示流量趋势、系统资源、响应时间
- ✅ **日志管理**: 查询和筛选连接日志、指令日志
- ✅ **账号设置**: 在线修改管理员密码
- ✅ **会话控制**: 断开用户连接,查看详细信息
- ✅ **实时更新**: WebSocket实时推送状态变化
- ✅ **响应式设计**: 适配各种屏幕尺寸

## 快速开始

### 1. 安装依赖

```bash
cd frontend
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

前端将在 `http://localhost:5173` 启动。

### 3. 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist` 目录。

## 默认登录凭证

- **用户名**: admin
- **密码**: Admin@123

> ⚠️ 生产环境请务必修改默认密码!

## 修改管理员密码

### 通过管理后台修改（推荐）

登录后进入"账号设置"页面,输入当前密码和新密码即可修改。

密码要求:
- 长度至少 6 位
- 使用 SM2 非对称加密传输
- 数据库存储使用加密后的密码

### 初始化默认密码

首次启动服务时会自动创建默认管理员账号:
- **用户名**: `admin`
- **密码**: `Admin@123`

如需修改默认密码,编辑后端 `database.js` 文件中的 `SM2_PUBLIC_KEY` 和 `SM2_PRIVATE_KEY`:

```javascript
// SM2 密钥配置
const SM2_PUBLIC_KEY = process.env.SM2_PUBLIC_KEY || 'your-public-key';
const SM2_PRIVATE_KEY = process.env.SM2_PRIVATE_KEY || 'your-private-key';
```

或使用环境变量:

```bash
export SM2_PUBLIC_KEY=your_public_key
export SM2_PRIVATE_KEY=your_private_key
```

⚠️ **重要**: 修改密钥后需要删除数据库文件(`im-service.db`)重新初始化!

### JWT 密钥配置

编辑后端 `server.js` 文件:

```javascript
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
```

或使用环境变量:

```bash
export JWT_SECRET=your_secret_key
```

## 功能说明

### 登录页面

- 输入用户名和密码登录
- 登录成功后自动跳转到管理后台
- Token 有效期 24 小时

### 管理后台

#### 1. 控制台

**统计面板:**
- **活跃会话**: 当前连接的用户数量
- **WebSocket 连接**: 当前 WebSocket 连接数
- **就绪会话**: 已就绪可用的会话数
- **服务器状态**: 服务器运行状态

**用户会话列表:**
显示所有连接用户的详细信息:
- 用户 ID、UID、App ID
- 状态 (就绪/未就绪)
- 创建时间、最后访问时间、连接时长

**操作功能:**
- **刷新**: 手动刷新会话列表
- **详情**: 查看用户会话的详细信息
- **断开**: 强制断开用户连接

**实时更新:**
- WebSocket 自动连接到后端
- 每 30 秒接收心跳更新
- 会话状态变化实时推送

#### 2. 运营监控

**核心指标:**
- **在线用户**: 今日活跃会话数
- **今日消息**: 指令发送总数
- **系统响应**: 平均响应时间（毫秒，真实数据）
- **错误率**: 失败指令占比（百分比）

**流量趋势:**
- ECharts 柱状图展示消息量变化
- 支持日/周/月/年四种时间范围
- 鼠标悬停显示详细数据
- 自动标记峰值数据

**系统资源:**
- **CPU 使用率**: 真实系统数据（%）
- **内存使用率**: 真实系统数据（%）
- **磁盘使用率**: 真实系统数据（%）
- 进度条颜色预警（绿/黄/红）

**最近活动:**
- 展示最近 10 条用户活动记录
- 包含时间、用户、操作、状态
- 自动刷新，实时更新

#### 3. 日志管理 

**连接日志:**
- 查询用户登录/登出记录
- 支持按用户、操作、状态筛选
- 显示 IP 地址和操作时间

**指令日志:**
- 查询指令发送记录
- 支持按用户、状态筛选
- 显示响应时间和操作结果

#### 4. 账号设置

- **修改密码**: 在线修改管理员密码
- **密码要求**: 至少 6 位长度
- **安全提示**: 密码强度建议和警告
- **SM2 加密**: 密码使用国密算法加密传输

## 技术栈

- **Vue 3**: 渐进式 JavaScript 框架
- **Ant Design Vue**: 企业级 UI 组件库
- **Vue Router**: 官方路由管理器
- **Axios**: HTTP 客户端
- **Day.js**: 轻量级日期处理库
- **ECharts**: 专业数据可视化图表库
- **sm-crypto**: 国密算法加密库
- **Vite**: 下一代前端构建工具

## 项目结构

```
frontend/
├── src/
│   ├── components/      # 可复用组件
│   │   └── Layout.vue   # 布局组件（导航栏）
│   ├── views/           # 页面组件
│   │   ├── Login.vue    # 登录页面
│   │   ├── Dashboard.vue # 控制台页面
│   │   ├── Monitor.vue  # 运营监控页面（v4.0 新增）
│   │   ├── Logs.vue     # 日志管理页面（v4.0 新增）
│   │   └── Settings.vue # 账号设置页面（v4.0 新增）
│   ├── utils/           # 工具函数
│   │   ├── api.js       # API 请求封装（含SM2加密）
│   │   └── websocket.js # WebSocket 客户端
│   ├── router/          # 路由配置
│   │   └── index.js
│   ├── App.vue          # 根组件
│   └── main.js          # 入口文件
├── index.html           # HTML 模板
├── vite.config.js       # Vite 配置
└── package.json         # 依赖配置
```

## 开发说明

### 代理配置

开发环境下,Vite 会自动代理 API 请求到后端服务器 (localhost:3001)。

配置文件: `vite.config.js`

```javascript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true
    }
  }
}
```

### 生产部署

1. 构建前端:

```bash
npm run build
```

2. 将 `dist` 目录部署到 Web 服务器 (Nginx/Apache)

3. 配置反向代理,将 API 请求转发到后端服务器

Nginx 配置示例:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 代理
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

## 安全建议

1. **修改默认密码**: 生产环境必须修改默认的管理员密码
2. **使用 HTTPS**: 启用 SSL/TLS 加密传输
3. **设置强密钥**: 修改 JWT_SECRET 为强随机字符串
4. **限制访问**: 使用防火墙或 IP 白名单限制管理后台访问
5. **定期更新**: 及时更新依赖包,修复安全漏洞

## 故障排查

### 无法登录

- 检查后端服务是否启动
- 检查用户名密码是否正确
- 查看浏览器控制台错误信息

### WebSocket 连接失败

- 检查后端 WebSocket 服务是否正常
- 检查防火墙是否阻止 WebSocket 连接
- 查看浏览器控制台 WebSocket 错误

### 页面空白

- 检查浏览器控制台错误
- 确认前端构建是否成功
- 检查 Nginx 配置是否正确

## 许可证

MIT

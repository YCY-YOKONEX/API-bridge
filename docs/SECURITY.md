# 安全配置指南

## ⚠️ 重要安全提示

管理后台 `admin.html` 包含敏感操作（登录、发送指令、登出会话），**必须添加访问保护后再部署到公网**！

---

## 🔒 推荐的安全方案

### 方案一：HTTP 基本认证（最简单，推荐）

仅使用用户名密码保护，配置简单，5 分钟完成。

#### 1. 安装工具并创建密码

```bash
# 安装 apache2-utils
sudo apt install -y apache2-utils

# 创建密码文件（用户名 admin）
sudo htpasswd -c /etc/nginx/.htpasswd admin
# 会提示输入两次密码

# 添加更多用户（不使用 -c 参数）
sudo htpasswd /etc/nginx/.htpasswd user2
```

#### 2. 配置 Nginx 保护管理后台

编辑 Nginx 配置：
```bash
sudo nano /etc/nginx/sites-available/im-service
```

完整的 Nginx 配置示例（使用 IP 和端口 8080）：

```nginx
upstream im_backend {
    server 127.0.0.1:3001;
    keepalive 64;
}

server {
    listen 8080;  # 自定义端口
    server_name _;  # 使用 IP 访问，不需要域名

    access_log /var/log/nginx/im-service-access.log;
    error_log /var/log/nginx/im-service-error.log;

    # 保护管理后台 admin.html
    location /admin.html {
        # HTTP 基本认证
        auth_basic "IM Service Admin Panel";
        auth_basic_user_file /etc/nginx/.htpasswd;

        # 静态文件路径
        root /opt/im-service;
        try_files $uri $uri/ =404;
    }

    # 同时保护测试页面
    location ~* ^/(test\.html|ws-client-test\.html)$ {
        auth_basic "IM Service Test Pages";
        auth_basic_user_file /etc/nginx/.htpasswd;

        root /opt/im-service;
        try_files $uri $uri/ =404;
    }

    # HTTP API
    location /api/ {
        proxy_pass http://im_backend;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket
    location / {
        proxy_pass http://im_backend;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    # 健康检查
    location /health {
        proxy_pass http://im_backend/health;
        access_log off;
    }
}
```

**说明：**
- `listen 8080` - 监听 8080 端口（可改为其他端口，如 8000、8888 等）
- `server_name _` - 使用 IP 访问，不需要配置域名

#### 3. 测试并重启 Nginx

```bash
# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl reload nginx
```

#### 4. 配置防火墙开放端口

```bash
# 开放自定义端口（8080）
sudo ufw allow 8080/tcp

# 查看防火墙状态
sudo ufw status
```

#### 5. 访问测试

现在可以通过以下地址访问：
- **管理后台**: `http://your-server-ip:8080/admin.html`
- **API 接口**: `http://your-server-ip:8080/api/`
- **健康检查**: `http://your-server-ip:8080/health`

访问时会弹出用户名密码输入框，验证通过后才能访问。

**注意**: 需要将 `admin.html` 中的 API 地址改为实际的服务器 IP 和端口：
```javascript
// 编辑 admin.html，找到这两行
const API_BASE = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3001';

// 修改为（替换为您的服务器 IP）
const API_BASE = 'http://123.45.67.89:8080';
const WS_URL = 'ws://123.45.67.89:8080';
```

#### 6. 添加 IP 白名单（可选，更安全）

如果您希望额外限制只有特定 IP 可以访问，可以添加：

```bash
# 查看您的公网 IP
curl ifconfig.me
```

在 Nginx 配置中添加 IP 限制（在 location /admin.html 块中）：

```nginx
location /admin.html {
    # IP 白名单（可选）
    allow 123.45.67.89;      # 您的办公室公网 IP
    allow 98.76.54.32;       # 您的家庭公网 IP
    deny all;                # 拒绝其他所有 IP

    # HTTP 基本认证
    auth_basic "IM Service Admin Panel";
    auth_basic_user_file /etc/nginx/.htpasswd;

    root /opt/im-service;
    try_files $uri $uri/ =404;
}
```

**注意**：如果您的 IP 经常变化（如家庭宽带），不建议使用 IP 白名单。

---

### 方案二：单独管理端口（更安全）

将管理后台放到单独的端口，仅允许通过 SSH 隧道或 VPN 访问。

#### 1. 配置 Nginx 双端口

编辑 Nginx 配置：
```bash
sudo nano /etc/nginx/sites-available/im-service
```

```nginx
# ============= 公网服务（80/443 端口）=============
upstream im_backend {
    server 127.0.0.1:3001;
    keepalive 64;
}

server {
    listen 80;
    server_name your-domain.com;

    # 禁止访问管理文件
    location ~* ^/(admin\.html|test\.html|ws-client-test\.html)$ {
        return 404;  # 直接返回 404，不暴露文件存在
    }

    # API 接口（公开）
    location /api/ {
        proxy_pass http://im_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket（公开）
    location / {
        proxy_pass http://im_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }

    # 健康检查（公开）
    location /health {
        proxy_pass http://im_backend/health;
        access_log off;
    }
}

# ============= 管理后台（9000 端口，仅本地）=============
server {
    listen 127.0.0.1:9000;  # 仅监听本地回环地址
    server_name _;

    # HTTP 基本认证（可选，双重保护）
    auth_basic "Admin Area";
    auth_basic_user_file /etc/nginx/.htpasswd;

    # 静态文件
    location / {
        root /opt/im-service;
        index admin.html;
        try_files $uri $uri/ =404;
    }

    # 代理后端 API（管理后台需要）
    location /api/ {
        proxy_pass http://im_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # 健康检查
    location /health {
        proxy_pass http://im_backend/health;
    }
}
```

#### 2. 重启 Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

#### 3. 通过 SSH 隧道访问

在本地电脑建立 SSH 隧道：
```bash
# 将服务器的 9000 端口映射到本地 8080
ssh -L 8080:127.0.0.1:9000 user@your-server-ip

# 保持 SSH 连接，然后在浏览器访问
# http://localhost:8080/admin.html
```

这样管理后台完全不暴露在公网，只能通过 SSH 隧道访问。

---

### 方案三：使用子域名 + 完整认证

为管理后台单独配置一个子域名，结合 HTTPS 和多重保护。

#### 1. 配置 DNS

在您的域名管理面板添加 A 记录：
```
admin.your-domain.com  →  服务器IP
```

#### 2. 配置 Nginx

```nginx
# ============= API 服务（主域名）=============
server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/api.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.your-domain.com/privkey.pem;

    # 禁止访问管理文件
    location ~* ^/(admin\.html|test\.html)$ {
        return 404;
    }

    # API 和 WebSocket
    location / {
        proxy_pass http://im_backend;
        # ... 其他配置
    }
}

# ============= 管理后台（单独子域名）=============
server {
    listen 443 ssl http2;
    server_name admin.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/admin.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.your-domain.com/privkey.pem;

    # IP 白名单
    allow 123.45.67.89;
    deny all;

    # HTTP 基本认证
    auth_basic "Admin Panel";
    auth_basic_user_file /etc/nginx/.htpasswd;

    # 静态文件
    location / {
        root /opt/im-service;
        index admin.html;
        try_files $uri $uri/ =404;
    }

    # API 代理（管理后台需要）
    location /api/ {
        proxy_pass http://im_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

#### 3. 获取 SSL 证书

```bash
# 为两个域名分别获取证书
sudo certbot --nginx -d api.your-domain.com
sudo certbot --nginx -d admin.your-domain.com
```

---

## 🛡️ 额外安全措施

### 1. 限流保护

防止暴力破解，在 Nginx 中添加限流：

```nginx
# 在 http 块中添加
http {
    # 定义限流区域
    limit_req_zone $binary_remote_addr zone=admin_limit:10m rate=5r/m;  # 每分钟5次
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;  # API每秒100次

    server {
        # 管理后台限流
        location /admin.html {
            limit_req zone=admin_limit burst=2 nodelay;
            # ... 其他配置
        }

        # API 限流
        location /api/ {
            limit_req zone=api_limit burst=200 nodelay;
            # ... 其他配置
        }
    }
}
```

### 2. 修改 admin.html 配置

如果使用子域名或不同端口，需要修改 `admin.html` 中的 API 地址：

```javascript
// 找到这两行（第 446-447 行）
const API_BASE = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3001';

// 修改为您的实际地址
const API_BASE = 'https://api.your-domain.com';
const WS_URL = 'wss://api.your-domain.com';
```

### 3. 禁用目录列表

确保 Nginx 不会列出目录内容：

```nginx
autoindex off;  # 在 server 块中添加
```

### 4. 隐藏 Nginx 版本

```nginx
# 在 http 块中添加
http {
    server_tokens off;
}
```

### 5. 配置防火墙规则

```bash
# 如果使用管理端口 9000，确保它不对外开放
sudo ufw status
# 应该只开放 22, 80, 443

# 如果不小心开放了 9000
sudo ufw delete allow 9000
```

---

## 📋 安全检查清单

部署前请确认：

- [ ] **必需**：管理后台已添加 HTTP 基本认证
- [ ] **强烈推荐**：已启用 HTTPS
- [ ] **推荐**：限流规则已配置
- [ ] **可选**：已配置 IP 白名单（如果您的 IP 固定）
- [ ] 测试页面已保护或删除
- [ ] 防火墙规则正确配置
- [ ] Nginx 版本号已隐藏
- [ ] 目录列表已禁用
- [ ] 定期更新密码
- [ ] 监控访问日志

---

## 🔍 监控和日志

### 查看访问日志

```bash
# 查看管理后台访问日志
sudo tail -f /var/log/nginx/im-service-access.log | grep admin.html

# 查看失败的认证尝试
sudo tail -f /var/log/nginx/error.log | grep auth_basic
```

### 设置告警

可以使用 fail2ban 自动封禁多次失败的登录尝试：

```bash
# 安装 fail2ban
sudo apt install -y fail2ban

# 创建配置文件
sudo nano /etc/fail2ban/jail.local
```

添加规则：
```ini
[nginx-auth]
enabled = true
port = http,https
filter = nginx-auth
logpath = /var/log/nginx/error.log
maxretry = 3
bantime = 3600
```

---

## ❓ 常见问题

### Q: 忘记了 HTTP 基本认证密码怎么办？

```bash
# 重新创建密码文件
sudo htpasswd -c /etc/nginx/.htpasswd admin
# 输入新密码

# 重启 Nginx
sudo systemctl reload nginx
```

### Q: 如何查看我的公网 IP？

```bash
curl ifconfig.me
# 或
curl ipinfo.io/ip
```

### Q: 如何允许动态 IP 访问？

如果您的 IP 经常变化：
- 使用方案二（SSH 隧道）
- 或使用 VPN 固定出口 IP
- 或仅依赖 HTTP 基本认证（不设置 IP 白名单）

### Q: 忘记开放端口怎么办？

如果 SSH 被防火墙锁定：
- 通过云服务商控制台的 VNC/串口登录
- 修改防火墙规则：`sudo ufw allow 22/tcp`

---

## 📚 相关文档

- [README.md](../README.md) - 项目说明
- [DEPLOY.md](DEPLOY.md) - 部署指南
- [Nginx 官方文档](https://nginx.org/en/docs/)
- [Let's Encrypt 文档](https://letsencrypt.org/docs/)

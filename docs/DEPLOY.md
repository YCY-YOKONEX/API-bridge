# Ubuntu 服务器部署指南

本指南将帮助你将 IM 服务部署到 Ubuntu 公网服务器。

## 📋 前提条件

- Ubuntu 18.04+ 服务器
- 具有 sudo 权限的用户
- 服务器已开放必要端口
- （可选）域名指向服务器 IP

---

## 🚀 快速部署（一键脚本）

```bash
# 下载并执行部署脚本
wget -O deploy.sh https://raw.githubusercontent.com/your-repo/deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh
```

---

## 📝 手动部署步骤

### 1. 更新系统

```bash
sudo apt update
sudo apt upgrade -y
```

### 2. 安装 Node.js 18+

```bash
# 使用 NodeSource 仓库安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node --version  # 应该显示 v18.x.x
npm --version
```

### 3. 安装 PM2

PM2 是 Node.js 进程管理器，用于保持应用运行。

```bash
sudo npm install -g pm2

# 验证安装
pm2 --version
```

### 4. 创建应用目录

```bash
# 创建应用目录
sudo mkdir -p /opt/im-service
sudo chown -R $USER:$USER /opt/im-service
cd /opt/im-service
```

### 5. 上传代码

**方法 1: 使用 Git**

```bash
# 如果代码在 Git 仓库
git clone https://github.com/your-username/your-repo.git .

# 或者如果已有仓库
git pull origin main
```

**方法 2: 使用 SCP 上传**

在本地电脑执行：

```bash
# 上传整个项目目录
scp -r D:\JavaProject\API-bridge/* user@your-server-ip:/opt/im-service/

# 或使用 rsync（更高效）
rsync -avz --exclude 'node_modules' D:\JavaProject\API-bridge/ user@your-server-ip:/opt/im-service/
```

**方法 3: 使用 FTP/SFTP 工具**

使用 FileZilla、WinSCP 等工具上传文件到 `/opt/im-service`

### 6. 安装依赖

```bash
cd /opt/im-service
npm install --production
```

### 7. 配置环境变量（可选）

```bash
# 创建环境变量文件
nano .env
```

添加以下内容：

```env
NODE_ENV=production
PORT=3001
MAX_SESSIONS=100
MAX_WS_CONNECTIONS=200
SESSION_TIMEOUT=14400000
```

### 8. 使用 PM2 启动服务

```bash
# 启动服务
pm2 start server.js --name im-service

# 查看状态
pm2 status

# 查看日志
pm2 logs im-service

# 查看实时日志
pm2 logs im-service --lines 100
```

### 9. 配置 PM2 开机自启

```bash
# 保存当前 PM2 配置
pm2 save

# 设置开机自启
pm2 startup

# 会输出一条命令，复制并执行
# 例如: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u user --hp /home/user
```

### 10. 安装和配置 Nginx

```bash
# 安装 Nginx
sudo apt install -y nginx

# 创建配置文件
sudo nano /etc/nginx/sites-available/im-service
```

添加以下配置：

```nginx
# HTTP 配置
upstream im_backend {
    server 127.0.0.1:3001;
    keepalive 64;
}

server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或服务器 IP

    # 日志
    access_log /var/log/nginx/im-service-access.log;
    error_log /var/log/nginx/im-service-error.log;

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

    # WebSocket 支持
    location / {
        proxy_pass http://im_backend;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 超时设置
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

启用配置：

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/im-service /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx

# 设置开机自启
sudo systemctl enable nginx
```

### 11. 配置防火墙

```bash
# 安装 UFW（如果未安装）
sudo apt install -y ufw

# 允许 SSH（重要！）
sudo ufw allow ssh
sudo ufw allow 22/tcp

# 允许 HTTP 和 HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status
```

### 12. 配置 HTTPS（使用 Let's Encrypt）

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取 SSL 证书
sudo certbot --nginx -d your-domain.com

# Certbot 会自动修改 Nginx 配置并重启
# 证书会自动续期
```

手动配置 HTTPS（如果使用自定义证书）：

```bash
sudo nano /etc/nginx/sites-available/im-service
```

添加 HTTPS 配置：

```nginx
# HTTPS 配置
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书
    ssl_certificate /etc/ssl/certs/your-cert.crt;
    ssl_certificate_key /etc/ssl/private/your-key.key;

    # SSL 优化
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 其他配置同上...
    location /api/ {
        # ...
    }
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 🔧 服务管理

### PM2 常用命令

```bash
# 启动服务
pm2 start server.js --name im-service

# 停止服务
pm2 stop im-service

# 重启服务
pm2 restart im-service

# 删除服务
pm2 delete im-service

# 查看状态
pm2 status

# 查看日志
pm2 logs im-service

# 查看实时日志
pm2 logs im-service --lines 50 -f

# 清空日志
pm2 flush

# 监控面板
pm2 monit

# 查看详细信息
pm2 show im-service
```

### Nginx 命令

```bash
# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx

# 重新加载配置（无需停机）
sudo systemctl reload nginx

# 查看状态
sudo systemctl status nginx

# 查看错误日志
sudo tail -f /var/log/nginx/error.log

# 查看访问日志
sudo tail -f /var/log/nginx/im-service-access.log
```

---

## 📊 监控和日志

### 1. 查看应用日志

```bash
# PM2 日志
pm2 logs im-service

# 应用日志位置
~/.pm2/logs/im-service-out.log    # 标准输出
~/.pm2/logs/im-service-error.log  # 错误输出
```

### 2. 查看系统资源

```bash
# 实时监控
pm2 monit

# 查看内存和 CPU 使用
pm2 status

# 系统资源
htop
# 或
top
```

### 3. 日志轮转（防止日志文件过大）

```bash
# 安装 pm2-logrotate
pm2 install pm2-logrotate

# 配置日志轮转
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

---

## 🔍 故障排查

### 服务无法启动

```bash
# 检查端口是否被占用
sudo netstat -tulpn | grep 3001

# 检查 Node.js 进程
ps aux | grep node

# 查看详细错误
pm2 logs im-service --err

# 手动启动查看错误
cd /opt/im-service
node server.js
```

### Nginx 502 Bad Gateway

```bash
# 检查后端服务是否运行
pm2 status

# 检查端口是否正确
sudo netstat -tulpn | grep 3001

# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log

# 检查 SELinux（如果启用）
sudo setenforce 0  # 临时禁用测试
```

### WebSocket 连接失败

```bash
# 检查 Nginx 配置
sudo nginx -t

# 确认 WebSocket 代理配置正确
sudo nano /etc/nginx/sites-available/im-service

# 检查防火墙
sudo ufw status

# 测试 WebSocket 连接
wscat -c ws://your-domain.com
```

### 内存泄漏

```bash
# 查看内存使用
pm2 show im-service

# 重启服务
pm2 restart im-service

# 设置最大内存限制
pm2 start server.js --name im-service --max-memory-restart 500M
```

---

## 🔄 更新和维护

### 更新代码

```bash
# 进入项目目录
cd /opt/im-service

# 备份当前版本
cp -r . ../im-service-backup-$(date +%Y%m%d)

# 拉取最新代码（如果使用 Git）
git pull origin main

# 或使用 rsync 上传新代码
# 在本地执行：
# rsync -avz --exclude 'node_modules' D:\JavaProject\API-bridge/ user@your-server-ip:/opt/im-service/

# 安装依赖
npm install --production

# 重启服务
pm2 restart im-service

# 查看日志确认
pm2 logs im-service --lines 50
```

### 数据库备份（如果使用）

```bash
# 创建备份脚本
nano /opt/im-service/backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups"
mkdir -p $BACKUP_DIR

# 备份配置和日志
tar -czf $BACKUP_DIR/im-service-$DATE.tar.gz \
    /opt/im-service \
    --exclude='node_modules' \
    --exclude='.git'

# 删除 7 天前的备份
find $BACKUP_DIR -name "im-service-*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/im-service-$DATE.tar.gz"
```

```bash
# 设置权限
chmod +x /opt/im-service/backup.sh

# 添加到定时任务
crontab -e
# 添加：每天凌晨 2 点备份
0 2 * * * /opt/im-service/backup.sh
```

---

## 🔒 安全建议

### 1. 限制访问

```bash
# 编辑 Nginx 配置
sudo nano /etc/nginx/sites-available/im-service
```

添加 IP 白名单：

```nginx
location /admin.html {
    # 仅允许特定 IP 访问
    allow 123.456.789.0/24;
    deny all;

    root /opt/im-service;
    try_files $uri $uri/ =404;
}
```

### 2. 添加基本认证

```bash
# 安装 apache2-utils
sudo apt install -y apache2-utils

# 创建密码文件
sudo htpasswd -c /etc/nginx/.htpasswd admin

# 在 Nginx 配置中添加
```

```nginx
location /admin.html {
    auth_basic "Restricted Access";
    auth_basic_user_file /etc/nginx/.htpasswd;

    root /opt/im-service;
    try_files $uri $uri/ =404;
}
```

### 3. 限流

```nginx
# 在 http 块中添加
http {
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

    # 在 server 块中使用
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        # 其他配置...
    }
}
```

---

## 📈 性能优化

### 1. PM2 Cluster 模式

```bash
# 使用所有 CPU 核心
pm2 start server.js -i max --name im-service

# 或指定进程数
pm2 start server.js -i 4 --name im-service
```

### 2. Nginx 缓存

```nginx
# 在 http 块中添加
http {
    proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g inactive=60m;

    # 在 location 中使用
    location /api/status {
        proxy_cache api_cache;
        proxy_cache_valid 200 10s;
        # 其他配置...
    }
}
```

### 3. 启用 Gzip 压缩

```nginx
http {
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
```

---

## ✅ 部署检查清单

- [ ] Node.js 18+ 已安装
- [ ] PM2 已安装并配置
- [ ] 应用成功启动（`pm2 status`）
- [ ] Nginx 已安装并配置
- [ ] 防火墙已配置（端口 80/443 开放）
- [ ] HTTPS 证书已配置（如果需要）
- [ ] 日志轮转已配置
- [ ] 开机自启已设置
- [ ] 备份计划已制定
- [ ] 监控告警已配置（可选）

---

## 🆘 获取帮助

如遇到问题，请检查：

1. **应用日志**: `pm2 logs im-service`
2. **Nginx 日志**: `sudo tail -f /var/log/nginx/error.log`
3. **系统日志**: `sudo journalctl -xe`
4. **端口状态**: `sudo netstat -tulpn | grep 3001`

---

## 📞 联系支持

- 查看 GitHub Issues
- 查看项目文档
- 联系系统管理员

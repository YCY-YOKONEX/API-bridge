# Linux 部署指南

## 概述

本文档介绍如何在 Linux 服务器上部署 IM Service 管理系统。

支持的发行版:
- Ubuntu 20.04/22.04/24.04
- Debian 11/12
- CentOS 7/8
- Rocky Linux 8/9
- AlmaLinux 8/9
- 其余系统版本请自行测试

## 系统要求

### 硬件要求

- **CPU**: 2 核心或以上
- **内存**: 2GB 或以上
- **磁盘**: 10GB 可用空间

### 软件要求

- **Node.js**: 18.x 或更高版本
- **npm**: 9.x 或更高版本
- **Nginx**: 1.18 或更高版本
- **Git**: 用于代码部署 (可选)

## 安装步骤

### 1. 更新系统

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt upgrade -y
```

**CentOS/Rocky/AlmaLinux:**

```bash
sudo yum update -y
# 或
sudo dnf update -y
```

### 2. 安装 Node.js

**方式一: 使用 NodeSource 仓库 (推荐)**

**Ubuntu/Debian:**

```bash
# 安装 Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node --version
npm --version
```

**CentOS/Rocky/AlmaLinux:**

```bash
# 安装 Node.js 18.x
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 验证安装
node --version
npm --version
```

**方式二: 使用 nvm**

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 重新加载配置
source ~/.bashrc

# 安装 Node.js 18
nvm install 18
nvm use 18

# 验证安装
node --version
npm --version
```

### 3. 安装 PM2

PM2 是一个进程管理器，用于保持应用持续运行。

```bash
sudo npm install -g pm2
```

### 4. 创建部署用户 (可选但推荐)

```bash
# 创建用户
sudo useradd -m -s /bin/bash imservice

# 设置密码
sudo passwd imservice

# 添加到 sudo 组 (如需要)
sudo usermod -aG sudo imservice

# 切换到新用户
sudo su - imservice
```

### 5. 下载项目代码

**方式一: 使用 Git**

```bash
# 安装 Git
sudo apt install -y git  # Ubuntu/Debian
sudo yum install -y git  # CentOS/Rocky/AlmaLinux

# 克隆项目
cd /opt
sudo git clone https://github.com/your-repo/API-bridge.git
sudo chown -R imservice:imservice /opt/API-bridge
cd /opt/API-bridge
```

**方式二: 手动上传**

```bash
# 在本地打包
tar -czf api-bridge.tar.gz API-bridge/

# 上传到服务器
scp api-bridge.tar.gz user@server:/opt/

# 在服务器上解压
cd /opt
sudo tar -xzf api-bridge.tar.gz
sudo chown -R imservice:imservice /opt/API-bridge
```

### 6. 安装依赖

```bash
cd /opt/API-bridge

# 安装后端依赖
npm install

# 安装前端依赖
cd frontend
npm install
cd ..
```

### 7. 配置环境变量(可选)

```bash
# 创建 .env 文件
nano .env
```

添加以下内容:

```env
# 管理员账号 (可选，默认 admin / Admin@123)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@123

# JWT 密钥 (建议修改)
JWT_SECRET=your_random_secret_key_at_least_32_characters

# SM4 加密密钥 (建议修改，必须 16 字节)
SM4_KEY=1qaz2wsX#edcVfr4

# 服务端口 (可选，默认 3001)
PORT=3001

# Node 环境
NODE_ENV=production
```

保存并退出 (Ctrl+X, Y, Enter)。

### 8. 构建前端

```bash
cd frontend
npm run build
cd ..
```

构建产物在 `frontend/dist` 目录。

### 9. 测试运行

```bash
# 启动后端服务
npm start
```

打开另一个终端，测试:

```bash
curl http://localhost:3001/health
```

如果看到 JSON 响应，说明服务启动成功。按 Ctrl+C 停止服务。

## 使用 PM2 部署

### 1. 启动服务

```bash
cd /opt/API-bridge

# 启动服务
pm2 start server.js --name im-service

# 查看状态
pm2 status
```

### 2. 设置开机自启

```bash
# 生成启动脚本
pm2 startup

# 复制输出的命令并执行 (类似下面的命令)
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u imservice --hp /home/imservice

# 保存当前进程列表
pm2 save
```

### 3. PM2 常用命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs im-service

# 实时日志
pm2 logs im-service --lines 100

# 重启服务
pm2 restart im-service

# 停止服务
pm2 stop im-service

# 删除服务
pm2 delete im-service

# 监控
pm2 monit

# 清空日志
pm2 flush

# 查看详细信息
pm2 show im-service
```

### 4. PM2 配置文件 (可选)

创建 `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'im-service',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_memory_restart: '1G',
    autorestart: true,
    watch: false
  }]
};
```

使用配置文件启动:

```bash
pm2 start ecosystem.config.js
pm2 save
```

## 配置 Nginx 反向代理

### 1. 安装 Nginx

**Ubuntu/Debian:**

```bash
sudo apt install -y nginx
```

**CentOS/Rocky/AlmaLinux:**

```bash
sudo yum install -y nginx
# 或
sudo dnf install -y nginx
```

### 2. 配置 Nginx

```bash
# 创建配置文件
sudo nano /etc/nginx/sites-available/im-service
```

添加以下内容:

```nginx
# 定义后端服务
upstream im_backend {
    server 127.0.0.1:3001;
    keepalive 64;
}

# 主服务配置
server {
    listen 80;
    server_name _;  # 或使用域名: your-domain.com

    # 日志文件
    access_log /var/log/nginx/im-service-access.log;
    error_log /var/log/nginx/im-service-error.log;

    # Vue3 前端静态文件
    location / {
        root /opt/API-bridge/frontend/dist;
        try_files $uri $uri/ /index.html;

        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API 接口代理
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

    # WebSocket 代理
    location /ws {
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

    # 健康检查端点
    location /health {
        proxy_pass http://im_backend/health;
        access_log off;
    }
}
```

保存并退出。

### 3. 启用配置

**Ubuntu/Debian:**

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/im-service /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

**CentOS/Rocky/AlmaLinux:**

```bash
# 复制配置文件
sudo cp /etc/nginx/sites-available/im-service /etc/nginx/conf.d/im-service.conf

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

### 4. 设置 Nginx 开机自启

```bash
sudo systemctl enable nginx
```

## 配置防火墙

### UFW (Ubuntu/Debian)

```bash
# 启用 UFW
sudo ufw enable

# 允许 SSH
sudo ufw allow 22/tcp

# 允许 HTTP
sudo ufw allow 80/tcp

# 允许 HTTPS (如果使用)
sudo ufw allow 443/tcp

# 查看状态
sudo ufw status
```

### firewalld (CentOS/Rocky/AlmaLinux)

```bash
# 启动 firewalld
sudo systemctl start firewalld
sudo systemctl enable firewalld

# 允许 HTTP
sudo firewall-cmd --permanent --add-service=http

# 允许 HTTPS (如果使用)
sudo firewall-cmd --permanent --add-service=https

# 重新加载
sudo firewall-cmd --reload

# 查看状态
sudo firewall-cmd --list-all
```

## 配置 HTTPS (可选但推荐)

### 使用 Let's Encrypt (免费)

**1. 安装 Certbot**

**Ubuntu/Debian:**

```bash
sudo apt install -y certbot python3-certbot-nginx
```

**CentOS/Rocky/AlmaLinux:**

```bash
sudo yum install -y certbot python3-certbot-nginx
# 或
sudo dnf install -y certbot python3-certbot-nginx
```

**2. 获取证书**

```bash
# 自动配置 Nginx
sudo certbot --nginx -d your-domain.com

# 或手动配置
sudo certbot certonly --nginx -d your-domain.com
```

**3. 自动续期**

```bash
# 测试续期
sudo certbot renew --dry-run

# 添加定时任务
sudo crontab -e

# 添加以下行 (每天凌晨 2 点检查续期)
0 2 * * * /usr/bin/certbot renew --quiet
```

## 访问管理后台

### 通过 IP 访问

```
http://your-server-ip
```

### 通过域名访问

```
http://your-domain.com
```

或 (如果配置了 HTTPS):

```
https://your-domain.com
```

**默认登录账号:**
- 用户名: `admin`
- 密码: `Admin@123`

⚠️ **首次登录后请立即修改默认密码！**

## 数据库备份

### 手动备份

```bash
# 备份数据库文件
cp /opt/API-bridge/im-service.db /opt/API-bridge/im-service.db.backup

# 或使用日期命名
cp /opt/API-bridge/im-service.db /opt/API-bridge/im-service.db.$(date +%Y%m%d)
```

### 自动备份脚本

创建 `/opt/API-bridge/backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/opt/API-bridge/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/im-service-$DATE.db"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
cp /opt/API-bridge/im-service.db $BACKUP_FILE

# 删除 30 天前的备份
find $BACKUP_DIR -name "im-service-*.db" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE"
```

设置权限并添加到 crontab:

```bash
# 设置执行权限
chmod +x /opt/API-bridge/backup.sh

# 添加定时任务
crontab -e

# 添加以下行 (每天凌晨 2 点备份)
0 2 * * * /opt/API-bridge/backup.sh >> /opt/API-bridge/backup.log 2>&1
```

## 日志管理

### PM2 日志

```bash
# 查看日志
pm2 logs im-service

# 日志文件位置
ls ~/.pm2/logs/

# 清空日志
pm2 flush
```

### Nginx 日志

```bash
# 访问日志
sudo tail -f /var/log/nginx/im-service-access.log

# 错误日志
sudo tail -f /var/log/nginx/im-service-error.log
```

### 日志轮转

创建 `/etc/logrotate.d/im-service`:

```
/var/log/nginx/im-service-*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}
```

## 监控和维护

### 使用 PM2 监控

```bash
# 实时监控
pm2 monit

# 查看资源使用
pm2 list
```

### 使用 htop

```bash
# 安装 htop
sudo apt install -y htop  # Ubuntu/Debian
sudo yum install -y htop  # CentOS/Rocky/AlmaLinux

# 运行
htop
```

### 使用 netstat 检查端口

```bash
# 检查端口占用
sudo netstat -tulpn | grep :3001
sudo netstat -tulpn | grep :80
```

## 故障排查

### 问题 1: 端口被占用

```bash
# 查看端口占用
sudo lsof -i :3001

# 结束进程
sudo kill -9 <PID>
```

### 问题 2: 服务无法启动

```bash
# 检查 Node.js 版本
node --version

# 检查依赖
npm list

# 重新安装依赖
rm -rf node_modules
npm install --production
```

### 问题 3: Nginx 配置错误

```bash
# 测试配置
sudo nginx -t

# 查看错误日志
sudo tail -f /var/log/nginx/error.log
```

### 问题 4: 权限问题

```bash
# 修改文件所有者
sudo chown -R imservice:imservice /opt/API-bridge

# 修改文件权限
sudo chmod -R 755 /opt/API-bridge
```

### 问题 5: 数据库文件损坏

```bash
# 从备份恢复
cp /opt/API-bridge/im-service.db.backup /opt/API-bridge/im-service.db

# 或删除数据库，重启服务会自动创建
rm /opt/API-bridge/im-service.db
pm2 restart im-service
```

## 性能优化

### 1. 增加 Node.js 内存限制

```bash
# 修改 PM2 配置
pm2 delete im-service
pm2 start server.js --name im-service --node-args="--max-old-space-size=4096"
pm2 save
```

### 2. 启用 Nginx 缓存

在 Nginx 配置中添加:

```nginx
# 在 http 块中
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m;

# 在 location /api/ 块中
proxy_cache api_cache;
proxy_cache_valid 200 5m;
proxy_cache_key "$scheme$request_method$host$request_uri";
```

### 3. 启用 Gzip 压缩

在 Nginx 配置中添加:

```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;
```

### 4. 系统优化

```bash
# 增加文件描述符限制
sudo nano /etc/security/limits.conf

# 添加以下行
* soft nofile 65536
* hard nofile 65536

# 重启生效
sudo reboot
```

## 安全建议

### 1. 修改默认密码

登录后台 → 账号设置 → 修改密码

### 2. 修改 SM4 密钥

编辑 `.env` 文件:

```bash
nano /opt/API-bridge/.env
```

修改:

```env
SM4_KEY=your_new_16_byte_key
```

重启服务:

```bash
pm2 restart im-service
```

### 3. 配置 fail2ban

```bash
# 安装 fail2ban
sudo apt install -y fail2ban  # Ubuntu/Debian
sudo yum install -y fail2ban  # CentOS/Rocky/AlmaLinux

# 启动服务
sudo systemctl start fail2ban
sudo systemctl enable fail2ban
```

### 4. 定期更新

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y  # Ubuntu/Debian
sudo yum update -y  # CentOS/Rocky/AlmaLinux

# 更新 Node.js 依赖
cd /opt/API-bridge
npm update

# 更新 PM2
sudo npm update -g pm2
```

### 5. 限制 SSH 访问

```bash
# 编辑 SSH 配置
sudo nano /etc/ssh/sshd_config

# 修改以下配置
PermitRootLogin no
PasswordAuthentication no  # 使用密钥登录
Port 2222  # 修改默认端口

# 重启 SSH
sudo systemctl restart sshd
```

## 更新部署

### 1. 备份数据

```bash
cp /opt/API-bridge/im-service.db /opt/API-bridge/im-service.db.backup
```

### 2. 停止服务

```bash
pm2 stop im-service
```

### 3. 更新代码

```bash
cd /opt/API-bridge
git pull
# 或手动替换文件
```

### 4. 更新依赖

```bash
npm install --production
cd frontend
npm install
npm run build
cd ..
```

### 5. 重启服务

```bash
pm2 restart im-service
```

### 6. 验证

```bash
# 检查服务状态
pm2 status

# 测试健康检查
curl http://localhost:3001/health
```

## 许可证

MIT

---

**文档版本**: v3.0.0
**更新时间**: 2025-12-17

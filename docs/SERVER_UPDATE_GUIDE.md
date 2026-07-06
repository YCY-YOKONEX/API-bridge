# 服务器更新程序文档

本文档用于在服务器上更新 API-bridge 程序。

默认目录按当前部署脚本约定：

- 程序目录：`/opt/im-service`
- 后端服务：`pm2` 管理，名称 `im-service`
- 前端目录：`/opt/im-service/frontend/dist`
- Nginx 配置：`/etc/nginx/sites-available/im-service`
- 后端默认端口：`3001`

如果你的服务器目录不同，请把命令里的路径换成实际路径。

## 1. 更新前检查

```bash
cd /opt/im-service

git status
pm2 status
curl http://127.0.0.1:3001/health
```

确认：

- `pm2` 里 `im-service` 正在运行。
- `health` 返回 `status: ok`。
- 当前目录没有未处理的重要修改。

## 2. 备份数据

先备份数据库和当前代码版本。

```bash
cd /opt/im-service

mkdir -p backups

cp -a im-service.db "backups/im-service.db.$(date +%Y%m%d%H%M%S).bak" 2>/dev/null || true
git rev-parse HEAD > "backups/version.$(date +%Y%m%d%H%M%S).txt"
```

如果有上传文件、额外配置文件，也要一起备份。

## 3. 拉取最新代码

```bash
cd /opt/im-service

git fetch --all
git pull
```

如果服务器不允许直接 `pull`，也可以上传新代码后覆盖程序文件。

注意：不要覆盖以下文件：

- `im-service.db`
- `.env`
- 日志目录
- 服务器自己的 Nginx 配置

## 4. 安装后端依赖

```bash
cd /opt/im-service
npm install --omit=dev
```

如果服务器需要运行测试，可以用：

```bash
npm install
npm test
```

## 5. 构建前端

```bash
cd /opt/im-service/frontend
npm install
npm run build
```

现在前端默认请求同源 `/api` 和 `/ws`。

所以后端端口变更时，不需要重新打包前端。

只需要修改 Nginx：

```nginx
upstream im_backend {
    server 127.0.0.1:你的后端端口;
}
```

## 6. 重启后端

```bash
cd /opt/im-service
pm2 restart im-service
pm2 save
```

如果服务之前没有启动：

```bash
pm2 start server.js --name im-service
pm2 save
```

## 7. 更新 Nginx

如果没有改端口或域名，一般不用动 Nginx。

如果改了后端端口，只改 `upstream im_backend`。

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 8. 验证更新

```bash
curl http://127.0.0.1:3001/health
curl http://你的域名或IP/health
```

然后打开管理后台：

```text
http://你的域名或IP/
```

重点检查：

- 能正常登录。
- 控制台能显示 WebSocket 已连接。
- 报表中心能正常查询。
- 用户会话列表能刷新。

查看日志：

```bash
pm2 logs im-service --lines 100
sudo tail -f /var/log/nginx/im-service-error.log
```

## 9. 回滚

如果更新后异常，先回滚代码。

```bash
cd /opt/im-service

git log --oneline -5
git reset --hard 上一个正常版本commit
```

恢复数据库备份：

```bash
cp -a backups/你的数据库备份文件 im-service.db
```

重新安装、构建、重启：

```bash
npm install --omit=dev

cd frontend
npm install
npm run build

cd ..
pm2 restart im-service
sudo nginx -t
sudo systemctl reload nginx
```

## 10. 常见问题

### 前端接口不通

检查 Nginx `/api/` 是否代理到正确后端端口。

```bash
sudo nginx -T | grep -A5 im_backend
curl http://127.0.0.1:3001/health
```

### WebSocket 不连接

检查 Nginx 是否有 `/ws` 代理。

```nginx
location /ws {
    proxy_pass http://im_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
}
```

### 后端启动失败

```bash
pm2 logs im-service --lines 200
node server.js
```

常见原因：

- 端口被占用。
- `.env` 配置错误。
- 依赖没有安装。
- 数据库文件权限不对。

### 端口被占用

```bash
sudo lsof -i :3001
sudo netstat -tulpn | grep 3001
```

修改端口后，记得同步修改 Nginx `upstream im_backend`。


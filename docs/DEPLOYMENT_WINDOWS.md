# Windows 部署指南

## 概述

本文档介绍如何在 Windows 服务器上部署 IM Service 管理系统。

## 系统要求

### 硬件要求

- **CPU**: 2 核心或以上
- **内存**: 2GB 或以上
- **磁盘**: 10GB 可用空间

### 软件要求

- **操作系统**: Windows Server 2016/2019/2022 或 Windows 10/11
- **Node.js**: 18.x 或更高版本
- **npm**: 9.x 或更高版本
- **Git**: 用于代码部署 (可选)

## 安装步骤

### 1. 安装 Node.js

**方式一: 使用官方安装包**

1. 访问 [Node.js 官网](https://nodejs.org/)
2. 下载 LTS 版本 (推荐 18.x)
3. 运行安装程序，按默认选项安装
4. 验证安装:

```cmd
node --version
npm --version
```

**方式二: 使用 Chocolatey**

```powershell
# 以管理员身份运行 PowerShell
choco install nodejs-lts -y

# 验证安装
node --version
npm --version
```

### 2. 下载项目代码

**方式一: 使用 Git**

```cmd
cd C:\
git clone https://github.com/your-repo/API-bridge.git
cd API-bridge
```

**方式二: 手动下载**

1. 下载项目 ZIP 文件
2. 解压到 `C:\API-bridge`
3. 打开命令提示符，进入项目目录:

```cmd
cd C:\API-bridge
```

### 3. 安装依赖

```cmd
# 安装后端依赖
npm install

# 安装前端依赖
cd frontend
npm install
cd ..
```

### 4. 配置环境变量 (可选)

创建 `.env` 文件:

```cmd
notepad .env
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
```

### 5. 构建前端

```cmd
cd frontend
npm run build
cd ..
```

构建产物在 `frontend\dist` 目录。

### 6. 测试运行

```cmd
# 启动后端服务
npm start
```

打开浏览器访问: `http://localhost:3001/health`

如果看到 JSON 响应，说明服务启动成功。

## 生产部署

### 方式一: 使用 PM2 (推荐)

PM2 是一个进程管理器，可以保持应用持续运行。

**1. 安装 PM2**

```cmd
npm install -g pm2
```

**2. 启动服务**

```cmd
pm2 start server.js --name im-service
```

**3. 设置开机自启**

```cmd
# 生成启动脚本
pm2 startup

# 保存当前进程列表
pm2 save
```

**4. 常用命令**

```cmd
# 查看状态
pm2 status

# 查看日志
pm2 logs im-service

# 重启服务
pm2 restart im-service

# 停止服务
pm2 stop im-service

# 删除服务
pm2 delete im-service

# 监控
pm2 monit
```

### 方式二: 使用 Windows 服务

**1. 安装 node-windows**

```cmd
npm install -g node-windows
```

**2. 创建服务脚本**

创建 `install-service.js`:

```javascript
const Service = require('node-windows').Service;

// 创建服务对象
const svc = new Service({
  name: 'IM Service',
  description: 'IM Service 管理系统',
  script: 'C:\\API-bridge\\server.js',
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ],
  env: {
    name: "NODE_ENV",
    value: "production"
  }
});

// 监听安装事件
svc.on('install', function() {
  svc.start();
  console.log('服务安装成功并已启动');
});

// 安装服务
svc.install();
```

**3. 安装服务**

```cmd
node install-service.js
```

**4. 管理服务**

```cmd
# 启动服务
sc start "IM Service"

# 停止服务
sc stop "IM Service"

# 查看状态
sc query "IM Service"

# 卸载服务
sc delete "IM Service"
```

### 方式三: 使用 NSSM

NSSM (Non-Sucking Service Manager) 是一个轻量级的服务管理工具。

**1. 下载 NSSM**

访问 [NSSM 官网](https://nssm.cc/download) 下载并解压。

**2. 安装服务**

```cmd
# 进入 NSSM 目录
cd C:\nssm\win64

# 安装服务 (会打开 GUI 配置界面)
nssm install IMService

# 或使用命令行
nssm install IMService "C:\Program Files\nodejs\node.exe" "C:\API-bridge\server.js"
```

**3. 配置服务**

在 GUI 界面中配置:

- **Path**: `C:\Program Files\nodejs\node.exe`
- **Startup directory**: `C:\API-bridge`
- **Arguments**: `server.js`
- **Service name**: `IMService`

**4. 启动服务**

```cmd
nssm start IMService
```

**5. 常用命令**

```cmd
# 查看状态
nssm status IMService

# 停止服务
nssm stop IMService

# 重启服务
nssm restart IMService

# 卸载服务
nssm remove IMService confirm
```

## 配置 IIS 反向代理 (可选)

如果需要使用 IIS 作为反向代理:

### 1. 安装 IIS

```powershell
# 以管理员身份运行 PowerShell
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServer
```

### 2. 安装 URL Rewrite 和 ARR

1. 下载并安装 [URL Rewrite](https://www.iis.net/downloads/microsoft/url-rewrite)
2. 下载并安装 [Application Request Routing (ARR)](https://www.iis.net/downloads/microsoft/application-request-routing)

### 3. 配置反向代理

创建 `web.config`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <!-- API 代理 -->
        <rule name="API Proxy" stopProcessing="true">
          <match url="^api/(.*)" />
          <action type="Rewrite" url="http://localhost:3001/api/{R:1}" />
        </rule>

        <!-- WebSocket 代理 -->
        <rule name="WebSocket Proxy" stopProcessing="true">
          <match url="^ws$" />
          <action type="Rewrite" url="http://localhost:3001/" />
        </rule>

        <!-- 健康检查 -->
        <rule name="Health Check" stopProcessing="true">
          <match url="^health$" />
          <action type="Rewrite" url="http://localhost:3001/health" />
        </rule>

        <!-- 前端路由 -->
        <rule name="Frontend" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

## 防火墙配置

### 允许端口访问

```powershell
# 以管理员身份运行 PowerShell

# 允许 3001 端口 (后端服务)
New-NetFirewallRule -DisplayName "IM Service Backend" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow

# 允许 8080 端口 (Nginx/IIS)
New-NetFirewallRule -DisplayName "IM Service Frontend" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
```

### 查看防火墙规则

```powershell
Get-NetFirewallRule -DisplayName "IM Service*"
```

### 删除防火墙规则

```powershell
Remove-NetFirewallRule -DisplayName "IM Service Backend"
```

## 访问管理后台

### 开发环境

1. 启动后端: `npm start`
2. 启动前端: `cd frontend && npm run dev`
3. 访问: `http://localhost:5173`

### 生产环境

1. 确保服务已启动 (PM2/Windows 服务/NSSM)
2. 访问: `http://your-server-ip:3001`
3. 或通过 IIS: `http://your-server-ip:8080`

**默认登录账号:**
- 用户名: `admin`
- 密码: `Admin@123`

⚠️ **首次登录后请立即修改默认密码！**

## 数据库备份

### 手动备份

```cmd
# 备份数据库文件
copy im-service.db im-service.db.backup

# 或使用日期命名
copy im-service.db im-service.db.%date:~0,10%
```

### 自动备份脚本

创建 `backup.bat`:

```batch
@echo off
set BACKUP_DIR=C:\API-bridge\backups
set DATE=%date:~0,4%%date:~5,2%%date:~8,2%
set TIME=%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_FILE=%BACKUP_DIR%\im-service-%DATE%-%TIME%.db

if not exist %BACKUP_DIR% mkdir %BACKUP_DIR%
copy C:\API-bridge\im-service.db %BACKUP_FILE%

echo Backup completed: %BACKUP_FILE%
```

### 使用任务计划程序自动备份

```powershell
# 创建每天凌晨 2 点的备份任务
$action = New-ScheduledTaskAction -Execute "C:\API-bridge\backup.bat"
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "IM Service Backup" -Description "每天备份 IM Service 数据库"
```

## 日志管理

### PM2 日志

```cmd
# 查看日志
pm2 logs im-service

# 清空日志
pm2 flush

# 日志文件位置
# C:\Users\<username>\.pm2\logs\
```

### Windows 事件日志

如果使用 Windows 服务，日志会记录在事件查看器中:

1. 打开"事件查看器"
2. 导航到: Windows 日志 → 应用程序
3. 筛选来源: "IM Service"

## 故障排查

### 问题 1: 端口被占用

```cmd
# 查看端口占用
netstat -ano | findstr :3001

# 结束进程
taskkill /PID <进程ID> /F
```

### 问题 2: 服务无法启动

```cmd
# 检查 Node.js 版本
node --version

# 检查依赖是否安装
npm list

# 重新安装依赖
rmdir /s /q node_modules
npm install
```

### 问题 3: 数据库文件损坏

```cmd
# 从备份恢复
copy im-service.db.backup im-service.db

# 或删除数据库，重启服务会自动创建
del im-service.db
pm2 restart im-service
```

### 问题 4: 前端无法访问

```cmd
# 检查前端是否构建
dir frontend\dist

# 重新构建
cd frontend
npm run build
cd ..
```

## 性能优化

### 1. 增加 Node.js 内存限制

```cmd
# PM2 方式
pm2 start server.js --name im-service --node-args="--max-old-space-size=4096"

# 直接运行
node --max-old-space-size=4096 server.js
```

### 2. 启用 Windows 性能模式

```powershell
# 设置为高性能模式
powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c
```

### 3. 定期清理日志

创建清理脚本 `cleanup.bat`:

```batch
@echo off
# 删除 30 天前的备份
forfiles /p "C:\API-bridge\backups" /s /m *.db /d -30 /c "cmd /c del @path"

# 清理 PM2 日志
pm2 flush

echo Cleanup completed
```

## 安全建议

### 1. 修改默认密码

登录后台 → 账号设置 → 修改密码

### 2. 修改 SM4 密钥

编辑 `.env` 文件:

```env
SM4_KEY=your_new_16_byte_key
```

### 3. 限制访问 IP

在 IIS 或防火墙中配置 IP 白名单。

### 4. 启用 HTTPS

使用 IIS 配置 SSL 证书。

### 5. 定期更新

```cmd
# 更新依赖
npm update

# 更新 PM2
npm update -g pm2
```

## 监控和维护

### 使用 PM2 监控

```cmd
# 实时监控
pm2 monit

# 查看资源使用
pm2 list
```

### 使用 Windows 性能监视器

1. 打开"性能监视器"
2. 添加计数器:
   - 处理器 → % Processor Time
   - 内存 → Available MBytes
   - 网络接口 → Bytes Total/sec

## 更新部署

### 1. 备份数据

```cmd
copy im-service.db im-service.db.backup
```

### 2. 停止服务

```cmd
pm2 stop im-service
```

### 3. 更新代码

```cmd
git pull
# 或手动替换文件
```

### 4. 更新依赖

```cmd
npm install
cd frontend
npm install
npm run build
cd ..
```

### 5. 重启服务

```cmd
pm2 restart im-service
```

## 许可证

MIT

---

**文档版本**: v3.0.0
**更新时间**: 2025-12-17

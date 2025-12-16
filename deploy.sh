#!/bin/bash

###############################################################################
# IM 服务一键部署脚本
# 适用于 Ubuntu 18.04+
###############################################################################

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
APP_NAME="im-service"
APP_DIR="/opt/${APP_NAME}"
NODE_VERSION="18"
DOMAIN=""
USE_HTTPS="n"

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否以 root 运行
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "请使用 sudo 运行此脚本"
        exit 1
    fi
}

# 显示欢迎信息
show_welcome() {
    clear
    echo "=========================================="
    echo "  IM 服务一键部署脚本"
    echo "=========================================="
    echo ""
    echo "本脚本将自动安装以下组件："
    echo "  - Node.js ${NODE_VERSION}"
    echo "  - PM2 进程管理器"
    echo "  - Nginx 反向代理"
    echo "  - 防火墙配置"
    echo ""
    read -p "按回车键继续..."
}

# 收集配置信息
collect_config() {
    echo ""
    print_info "请提供以下配置信息："
    echo ""

    # 应用目录
    read -p "应用安装目录 [${APP_DIR}]: " input_dir
    APP_DIR=${input_dir:-$APP_DIR}

    # 域名
    read -p "域名或 IP 地址（留空使用 IP）: " DOMAIN
    if [ -z "$DOMAIN" ]; then
        DOMAIN=$(curl -s ifconfig.me)
        print_info "将使用服务器 IP: ${DOMAIN}"
    fi

    # HTTPS
    read -p "是否配置 HTTPS？(y/n) [n]: " USE_HTTPS
    USE_HTTPS=${USE_HTTPS:-n}

    echo ""
    print_info "配置摘要："
    echo "  应用目录: ${APP_DIR}"
    echo "  域名/IP: ${DOMAIN}"
    echo "  启用 HTTPS: ${USE_HTTPS}"
    echo ""
    read -p "确认开始部署？(y/n) [y]: " confirm
    confirm=${confirm:-y}

    if [ "$confirm" != "y" ]; then
        print_warning "部署已取消"
        exit 0
    fi
}

# 更新系统
update_system() {
    print_info "更新系统包..."
    apt update -y
    apt upgrade -y
    print_success "系统更新完成"
}

# 安装 Node.js
install_nodejs() {
    print_info "安装 Node.js ${NODE_VERSION}..."

    if command -v node &> /dev/null; then
        local current_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$current_version" -ge "$NODE_VERSION" ]; then
            print_success "Node.js 已安装 ($(node --version))"
            return
        fi
    fi

    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt install -y nodejs

    print_success "Node.js 安装完成 ($(node --version))"
}

# 安装 PM2
install_pm2() {
    print_info "安装 PM2..."

    if command -v pm2 &> /dev/null; then
        print_success "PM2 已安装 ($(pm2 --version))"
        return
    fi

    npm install -g pm2
    print_success "PM2 安装完成"
}

# 创建应用目录
create_app_dir() {
    print_info "创建应用目录: ${APP_DIR}"
    mkdir -p ${APP_DIR}
    print_success "应用目录创建完成"
}

# 提示上传代码
prompt_upload() {
    echo ""
    print_warning "请上传代码到服务器"
    echo ""
    echo "方法 1: 使用 SCP"
    echo "  在本地执行："
    echo "  scp -r /path/to/API-bridge/* $(whoami)@${DOMAIN}:${APP_DIR}/"
    echo ""
    echo "方法 2: 使用 Git"
    echo "  在服务器执行："
    echo "  cd ${APP_DIR}"
    echo "  git clone https://github.com/your-repo.git ."
    echo ""
    read -p "代码上传完成后，按回车继续..."
}

# 安装应用依赖
install_dependencies() {
    print_info "安装应用依赖..."
    cd ${APP_DIR}

    if [ ! -f "package.json" ]; then
        print_error "未找到 package.json 文件，请检查代码是否正确上传"
        exit 1
    fi

    npm install --production
    print_success "依赖安装完成"
}

# 配置 PM2
configure_pm2() {
    print_info "配置 PM2..."
    cd ${APP_DIR}

    # 停止已存在的进程
    pm2 delete ${APP_NAME} 2>/dev/null || true

    # 启动应用
    pm2 start server.js --name ${APP_NAME}

    # 保存配置
    pm2 save

    # 设置开机自启
    pm2 startup systemd -u $(logname) --hp $(eval echo ~$(logname))

    print_success "PM2 配置完成"
}

# 安装 Nginx
install_nginx() {
    print_info "安装 Nginx..."

    if command -v nginx &> /dev/null; then
        print_success "Nginx 已安装"
        return
    fi

    apt install -y nginx
    systemctl enable nginx
    print_success "Nginx 安装完成"
}

# 配置 Nginx
configure_nginx() {
    print_info "配置 Nginx..."

    # 创建配置文件
    cat > /etc/nginx/sites-available/${APP_NAME} <<EOF
upstream im_backend {
    server 127.0.0.1:3001;
    keepalive 64;
}

server {
    listen 80;
    server_name ${DOMAIN};

    access_log /var/log/nginx/${APP_NAME}-access.log;
    error_log /var/log/nginx/${APP_NAME}-error.log;

    # HTTP API
    location /api/ {
        proxy_pass http://im_backend;
        proxy_http_version 1.1;

        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket
    location / {
        proxy_pass http://im_backend;
        proxy_http_version 1.1;

        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

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
EOF

    # 启用站点
    ln -sf /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/

    # 删除默认站点
    rm -f /etc/nginx/sites-enabled/default

    # 测试配置
    nginx -t

    # 重启 Nginx
    systemctl restart nginx

    print_success "Nginx 配置完成"
}

# 配置防火墙
configure_firewall() {
    print_info "配置防火墙..."

    # 安装 UFW
    if ! command -v ufw &> /dev/null; then
        apt install -y ufw
    fi

    # 配置规则
    ufw allow ssh
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp

    # 启用防火墙
    ufw --force enable

    print_success "防火墙配置完成"
}

# 配置 HTTPS
configure_https() {
    if [ "$USE_HTTPS" != "y" ]; then
        return
    fi

    print_info "配置 HTTPS..."

    # 安装 Certbot
    apt install -y certbot python3-certbot-nginx

    # 获取证书
    certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos --register-unsafely-without-email

    print_success "HTTPS 配置完成"
}

# 安装日志轮转
configure_log_rotation() {
    print_info "配置日志轮转..."
    pm2 install pm2-logrotate
    pm2 set pm2-logrotate:max_size 10M
    pm2 set pm2-logrotate:retain 7
    pm2 set pm2-logrotate:compress true
    print_success "日志轮转配置完成"
}

# 显示部署结果
show_result() {
    echo ""
    echo "=========================================="
    print_success "部署完成！"
    echo "=========================================="
    echo ""
    echo "访问地址："
    if [ "$USE_HTTPS" == "y" ]; then
        echo "  HTTPS: https://${DOMAIN}"
        echo "  管理后台: https://${DOMAIN}/admin.html"
        echo "  健康检查: https://${DOMAIN}/health"
    else
        echo "  HTTP: http://${DOMAIN}"
        echo "  管理后台: http://${DOMAIN}/admin.html"
        echo "  健康检查: http://${DOMAIN}/health"
    fi
    echo ""
    echo "常用命令："
    echo "  查看状态: pm2 status"
    echo "  查看日志: pm2 logs ${APP_NAME}"
    echo "  重启服务: pm2 restart ${APP_NAME}"
    echo "  停止服务: pm2 stop ${APP_NAME}"
    echo ""
    echo "配置文件位置："
    echo "  应用目录: ${APP_DIR}"
    echo "  Nginx 配置: /etc/nginx/sites-available/${APP_NAME}"
    echo "  PM2 日志: ~/.pm2/logs/"
    echo ""
    print_info "建议阅读部署文档: DEPLOY.md"
    echo ""
}

# 主函数
main() {
    check_root
    show_welcome
    collect_config

    print_info "开始部署..."
    echo ""

    update_system
    install_nodejs
    install_pm2
    create_app_dir
    prompt_upload
    install_dependencies
    configure_pm2
    install_nginx
    configure_nginx
    configure_firewall
    configure_https
    configure_log_rotation

    show_result
}

# 执行主函数
main

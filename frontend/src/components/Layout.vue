<template>
  <div class="dashboard-container">
    <!-- 顶部导航栏 -->
    <div class="header">
      <div class="header-left">
        <h1>YOKONEX-API-Bridge</h1>
        <a-menu
          v-model:selectedKeys="selectedKeys"
          mode="horizontal"
          style="border: none; background: transparent; margin-left: 40px"
        >
          <a-menu-item key="dashboard" @click="$router.push('/')">
            <template #icon><DashboardOutlined /></template>
            控制台
          </a-menu-item>
          <a-menu-item key="monitor" @click="$router.push('/monitor')">
            <template #icon><LineChartOutlined /></template>
            运营监控
          </a-menu-item>
          <a-menu-item key="logs" @click="$router.push('/logs')">
            <template #icon><FileTextOutlined /></template>
            日志管理
          </a-menu-item>
          <a-menu-item key="settings" @click="$router.push('/settings')">
            <template #icon><SettingOutlined /></template>
            账号设置
          </a-menu-item>
        </a-menu>
      </div>
      <div class="header-right">
        <a-space>
          <a-badge :count="wsConnected ? 0 : 1" :dot="true">
            <a-tag :color="wsConnected ? 'success' : 'error'">
              {{ wsConnected ? 'WebSocket 已连接' : 'WebSocket 断开' }}
            </a-tag>
          </a-badge>
          <span>欢迎, {{ username }}</span>
          <a-button type="link" danger @click="handleLogout">退出登录</a-button>
        </a-space>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="content-container">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  DashboardOutlined,
  LineChartOutlined,
  FileTextOutlined,
  SettingOutlined
} from '@ant-design/icons-vue'

const router = useRouter()
const route = useRoute()

const username = ref(localStorage.getItem('admin_username') || '管理员')
const wsConnected = ref(true)

const selectedKeys = computed(() => {
  const path = route.path
  if (path === '/') return ['dashboard']
  if (path === '/monitor') return ['monitor']
  if (path === '/logs') return ['logs']
  if (path === '/settings') return ['settings']
  return ['dashboard']
})

const handleLogout = () => {
  localStorage.removeItem('admin_token')
  localStorage.removeItem('admin_username')
  message.success('已退出登录')
  router.push('/login')
}
</script>

<style scoped>
.dashboard-container {
  min-height: 100vh;
  background: #f0f2f5;
}

.header {
  background: white;
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
}

.header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #000;
}

.content-container {
  padding: 24px;
}
</style>

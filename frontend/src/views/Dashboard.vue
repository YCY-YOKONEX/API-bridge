<template>
  <Layout>
    <!-- 统计卡片 -->
    <div class="stats-container">
      <a-row :gutter="16">
        <a-col :span="6">
          <a-card>
            <a-statistic
              title="活跃会话"
              :value="stats.totalSessions"
              :suffix="`/ ${stats.maxSessions}`"
            >
              <template #prefix>
                <UserOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card>
            <a-statistic
              title="WebSocket 连接"
              :value="stats.wsConnections"
              :suffix="`/ ${stats.maxWsConnections}`"
            >
              <template #prefix>
                <ApiOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card>
            <a-statistic
              title="就绪会话"
              :value="readySessions"
              :value-style="{ color: '#3f8600' }"
            >
              <template #prefix>
                <CheckCircleOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card>
            <a-statistic
              title="服务器状态"
              value="运行中"
              :value-style="{ color: '#3f8600' }"
            >
              <template #prefix>
                <CloudServerOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
      </a-row>

      <!-- 第二行：运营统计 -->
      <a-row :gutter="16" style="margin-top: 16px">
        <a-col :span="6">
          <a-card>
            <a-statistic
              title="今日消息"
              :value="operationStats.todayMessages"
              :value-style="{ color: '#1890ff' }"
            >
              <template #prefix>
                <MessageOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card>
            <a-statistic
              title="系统响应(ms)"
              :value="operationStats.avgResponseTime"
              :precision="2"
              :value-style="{ color: '#faad14' }"
            >
              <template #prefix>
                <ClockCircleOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card>
            <a-statistic
              title="错误率(%)"
              :value="operationStats.errorRate"
              :precision="2"
              :value-style="{ color: operationStats.errorRate > 1 ? '#cf1322' : '#3f8600' }"
            >
              <template #prefix>
                <ExclamationCircleOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card>
            <a-statistic
              title="在线用户"
              :value="operationStats.onlineUsers"
              :value-style="{ color: '#52c41a' }"
            >
              <template #prefix>
                <TeamOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
      </a-row>
    </div>

    <!-- 用户会话列表 -->
    <div class="sessions-container">
      <a-card title="用户会话管理" :bordered="false">
        <template #extra>
          <a-space>
            <a-button @click="refreshSessions" :loading="loading">
              <template #icon><ReloadOutlined /></template>
              刷新
            </a-button>
          </a-space>
        </template>

        <a-table
          :columns="columns"
          :data-source="sessions"
          :loading="loading"
          :pagination="{ pageSize: 10 }"
          row-key="userId"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag :color="record.isReady ? 'success' : 'warning'">
                {{ record.isReady ? '就绪' : '未就绪' }}
              </a-tag>
            </template>

            <template v-else-if="column.key === 'createdAt'">
              {{ formatTime(record.createdAt) }}
            </template>

            <template v-else-if="column.key === 'lastAccessTime'">
              {{ formatTime(record.lastAccessTime) }}
            </template>

            <template v-else-if="column.key === 'duration'">
              {{ formatDuration(record.age) }}
            </template>

            <template v-else-if="column.key === 'action'">
              <a-space>
                <a-button
                  type="link"
                  size="small"
                  @click="showSessionDetail(record)"
                >
                  详情
                </a-button>
                <a-popconfirm
                  title="确定要断开此用户的连接吗?"
                  ok-text="确定"
                  cancel-text="取消"
                  @confirm="disconnectUser(record.userId)"
                >
                  <a-button type="link" danger size="small">
                    断开
                  </a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- 会话详情模态框 -->
    <a-modal
      v-model:open="detailModalVisible"
      title="会话详情"
      :footer="null"
      width="600px"
    >
      <a-descriptions v-if="selectedSession" :column="1" bordered>
        <a-descriptions-item label="用户 ID">
          {{ selectedSession.userId }}
        </a-descriptions-item>
        <a-descriptions-item label="UID">
          {{ selectedSession.uid }}
        </a-descriptions-item>
        <a-descriptions-item label="App ID">
          {{ selectedSession.appId }}
        </a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="selectedSession.isReady ? 'success' : 'warning'">
            {{ selectedSession.isReady ? '就绪' : '未就绪' }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="创建时间">
          {{ formatTime(selectedSession.createdAt) }}
        </a-descriptions-item>
        <a-descriptions-item label="最后访问">
          {{ formatTime(selectedSession.lastAccessTime) }}
        </a-descriptions-item>
        <a-descriptions-item label="连接时长">
          {{ formatDuration(selectedSession.age) }}
        </a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </Layout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import Layout from '../components/Layout.vue'
import {
  UserOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  ReloadOutlined,
  DashboardOutlined,
  FileTextOutlined,
  SettingOutlined,
  MessageOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  TeamOutlined
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import api from '../utils/api'
import ws from '../utils/websocket'

const router = useRouter()
const loading = ref(false)
const wsConnected = ref(false)

const stats = reactive({
  totalSessions: 0,
  maxSessions: 0,
  wsConnections: 0,
  maxWsConnections: 0
})

// 运营统计数据
const operationStats = reactive({
  todayMessages: 0,
  avgResponseTime: 0,
  errorRate: 0,
  onlineUsers: 0
})

const sessions = ref([])
const detailModalVisible = ref(false)
const selectedSession = ref(null)

const columns = [
  {
    title: '用户 ID',
    dataIndex: 'userId',
    key: 'userId',
    width: 150
  },
  {
    title: 'UID',
    dataIndex: 'uid',
    key: 'uid',
    width: 150
  },
  {
    title: 'App ID',
    dataIndex: 'appId',
    key: 'appId',
    width: 120
  },
  {
    title: '状态',
    key: 'status',
    width: 100
  },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 180
  },
  {
    title: '最后访问',
    key: 'lastAccessTime',
    width: 180
  },
  {
    title: '连接时长',
    key: 'duration',
    width: 120
  },
  {
    title: '操作',
    key: 'action',
    width: 150,
    fixed: 'right'
  }
]

const readySessions = computed(() => {
  return sessions.value.filter(s => s.isReady).length
})

// 格式化时间
const formatTime = (timestamp) => {
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')
}

// 格式化时长
const formatDuration = (ms) => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}天 ${hours % 24}小时`
  } else if (hours > 0) {
    return `${hours}小时 ${minutes % 60}分钟`
  } else if (minutes > 0) {
    return `${minutes}分钟 ${seconds % 60}秒`
  } else {
    return `${seconds}秒`
  }
}

// 刷新会话列表
const refreshSessions = async () => {
  loading.value = true
  try {
    const response = await api.getSessions()
    if (response.success) {
      stats.totalSessions = response.data.totalSessions
      stats.maxSessions = response.data.maxSessions
      stats.wsConnections = response.data.wsConnections
      stats.maxWsConnections = response.data.maxWsConnections
      sessions.value = response.data.sessions || []
    }
  } catch (error) {
    console.error('刷新会话列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 获取运营统计数据
const fetchOperationStats = async () => {
  try {
    const response = await api.getRealtimeStats()
    if (response.success) {
      const data = response.data
      operationStats.todayMessages = data.todayMessages || 0
      operationStats.avgResponseTime = data.avgResponseTime || 0
      operationStats.errorRate = data.errorRate || 0
      operationStats.onlineUsers = data.onlineUsers || 0
    }
  } catch (error) {
    console.error('获取运营统计失败:', error)
  }
}

// 断开用户连接
const disconnectUser = async (userId) => {
  try {
    const response = await api.disconnectUser(userId)
    if (response.success) {
      message.success('用户连接已断开')
      refreshSessions()
    }
  } catch (error) {
    console.error('断开用户连接失败:', error)
  }
}

// 显示会话详情
const showSessionDetail = (session) => {
  selectedSession.value = session
  detailModalVisible.value = true
}

// WebSocket 连接
const connectWebSocket = () => {
  const wsUrl = import.meta.env.DEV
    ? 'ws://localhost:3001?admin=true'
    : `ws://${window.location.hostname}:3001?admin=true`

  ws.connect(wsUrl)

  ws.on('connected', () => {
    wsConnected.value = true
  })

  ws.on('disconnected', () => {
    wsConnected.value = false
  })

  ws.on('heartbeat', (data) => {
    if (data.data && data.data.stats) {
      stats.totalSessions = data.data.stats.totalSessions
      stats.maxSessions = data.data.stats.maxSessions
      stats.wsConnections = data.data.stats.wsConnections
      stats.maxWsConnections = data.data.stats.maxWsConnections
      sessions.value = data.data.stats.sessions || []
    }
  })

  ws.on('status', () => {
    refreshSessions()
  })
}

onMounted(() => {
  refreshSessions()
  fetchOperationStats()
  connectWebSocket()

  // 每30秒刷新一次运营统计
  setInterval(() => {
    fetchOperationStats()
  }, 30000)
})

onUnmounted(() => {
  ws.disconnect()
})
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
}

.stats-container {
  padding: 24px;
}

.sessions-container {
  padding: 0 24px 24px;
}
</style>

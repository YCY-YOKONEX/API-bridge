<template>
  <Layout>
  <div class="logs-container">
    <a-card title="日志管理" :bordered="false">
      <template #extra>
        <a-space>
          <a-button @click="refreshLogs" :loading="loading">
            <template #icon><ReloadOutlined /></template>
            刷新
          </a-button>
        </a-space>
      </template>

      <!-- 统计卡片 -->
      <a-row :gutter="16" style="margin-bottom: 24px">
        <a-col :span="8">
          <a-card>
            <a-statistic
              title="连接日志总数"
              :value="stats.connection.total"
            >
              <template #prefix>
                <LinkOutlined />
              </template>
            </a-statistic>
            <div style="margin-top: 8px; font-size: 12px; color: #666">
              成功: {{ stats.connection.success }} / 失败: {{ stats.connection.failed }}
            </div>
          </a-card>
        </a-col>
        <a-col :span="8">
          <a-card>
            <a-statistic
              title="指令日志总数"
              :value="stats.command.total"
            >
              <template #prefix>
                <ThunderboltOutlined />
              </template>
            </a-statistic>
            <div style="margin-top: 8px; font-size: 12px; color: #666">
              成功: {{ stats.command.success }} / 失败: {{ stats.command.failed }}
            </div>
          </a-card>
        </a-col>
        <a-col :span="8">
          <a-card>
            <a-statistic
              title="成功率"
              :value="successRate"
              suffix="%"
              :value-style="{ color: '#3f8600' }"
            >
              <template #prefix>
                <CheckCircleOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
      </a-row>

      <!-- 日志类型切换 -->
      <a-tabs v-model:activeKey="activeTab" @change="handleTabChange">
        <a-tab-pane key="connection" tab="连接日志">
          <!-- 筛选条件 -->
          <div style="margin-bottom: 16px">
            <a-space>
              <a-input
                v-model:value="connectionFilters.userId"
                placeholder="用户 ID"
                style="width: 150px"
                allow-clear
              />
              <a-select
                v-model:value="connectionFilters.action"
                placeholder="操作类型"
                style="width: 120px"
                allow-clear
              >
                <a-select-option value="login">登录</a-select-option>
                <a-select-option value="logout">登出</a-select-option>
              </a-select>
              <a-select
                v-model:value="connectionFilters.status"
                placeholder="状态"
                style="width: 100px"
                allow-clear
              >
                <a-select-option value="success">成功</a-select-option>
                <a-select-option value="failed">失败</a-select-option>
              </a-select>
              <a-button type="primary" @click="searchConnectionLogs">
                <template #icon><SearchOutlined /></template>
                查询
              </a-button>
              <a-button @click="resetConnectionFilters">重置</a-button>
            </a-space>
          </div>

          <!-- 连接日志表格 -->
          <a-table
            :columns="connectionColumns"
            :data-source="connectionLogs"
            :loading="loading"
            :pagination="connectionPagination"
            @change="handleConnectionTableChange"
            row-key="id"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-tag :color="record.status === 'success' ? 'success' : 'error'">
                  {{ record.status === 'success' ? '成功' : '失败' }}
                </a-tag>
              </template>

              <template v-else-if="column.key === 'action'">
                <a-tag :color="record.action === 'login' ? 'blue' : 'orange'">
                  {{ record.action === 'login' ? '登录' : '登出' }}
                </a-tag>
              </template>

              <template v-else-if="column.key === 'created_at'">
                {{ formatTime(record.created_at) }}
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane key="command" tab="指令日志">
          <!-- 筛选条件 -->
          <div style="margin-bottom: 16px">
            <a-space>
              <a-input
                v-model:value="commandFilters.userId"
                placeholder="用户 ID"
                style="width: 150px"
                allow-clear
              />
              <a-select
                v-model:value="commandFilters.status"
                placeholder="状态"
                style="width: 100px"
                allow-clear
              >
                <a-select-option value="success">成功</a-select-option>
                <a-select-option value="failed">失败</a-select-option>
              </a-select>
              <a-button type="primary" @click="searchCommandLogs">
                <template #icon><SearchOutlined /></template>
                查询
              </a-button>
              <a-button @click="resetCommandFilters">重置</a-button>
            </a-space>
          </div>

          <!-- 指令日志表格 -->
          <a-table
            :columns="commandColumns"
            :data-source="commandLogs"
            :loading="loading"
            :pagination="commandPagination"
            @change="handleCommandTableChange"
            row-key="id"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-tag :color="record.status === 'success' ? 'success' : 'error'">
                  {{ record.status === 'success' ? '成功' : '失败' }}
                </a-tag>
              </template>

              <template v-else-if="column.key === 'created_at'">
                {{ formatTime(record.created_at) }}
              </template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
  </Layout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import Layout from '../components/Layout.vue'
import {
  ReloadOutlined,
  LinkOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  SearchOutlined
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import api from '../utils/api'

const loading = ref(false)
const activeTab = ref('connection')

const stats = reactive({
  connection: {
    total: 0,
    success: 0,
    failed: 0
  },
  command: {
    total: 0,
    success: 0,
    failed: 0
  }
})

// 连接日志
const connectionLogs = ref([])
const connectionFilters = reactive({
  userId: '',
  action: undefined,
  status: undefined
})
const connectionPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  showSizeChanger: true,
  showTotal: (total) => `共 ${total} 条`
})

// 指令日志
const commandLogs = ref([])
const commandFilters = reactive({
  userId: '',
  status: undefined
})
const commandPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  showSizeChanger: true,
  showTotal: (total) => `共 ${total} 条`
})

const connectionColumns = [
  {
    title: 'ID',
    dataIndex: 'id',
    key: 'id',
    width: 80
  },
  {
    title: '用户 ID',
    dataIndex: 'user_id',
    key: 'user_id',
    width: 150
  },
  {
    title: 'UID',
    dataIndex: 'uid',
    key: 'uid',
    width: 150
  },
  {
    title: '操作',
    key: 'action',
    width: 100
  },
  {
    title: '状态',
    key: 'status',
    width: 100
  },
  {
    title: '消息',
    dataIndex: 'message',
    key: 'message'
  },
  {
    title: 'IP 地址',
    dataIndex: 'ip_address',
    key: 'ip_address',
    width: 150
  },
  {
    title: '时间',
    key: 'created_at',
    width: 180
  }
]

const commandColumns = [
  {
    title: 'ID',
    dataIndex: 'id',
    key: 'id',
    width: 80
  },
  {
    title: '用户 ID',
    dataIndex: 'user_id',
    key: 'user_id',
    width: 150
  },
  {
    title: '指令 ID',
    dataIndex: 'command_id',
    key: 'command_id',
    width: 200
  },
  {
    title: '状态',
    key: 'status',
    width: 100
  },
  {
    title: '消息',
    dataIndex: 'message',
    key: 'message'
  },
  {
    title: '时间',
    key: 'created_at',
    width: 180
  }
]

const successRate = computed(() => {
  const totalSuccess = stats.connection.success + stats.command.success
  const totalAll = stats.connection.total + stats.command.total
  if (totalAll === 0) return 0
  return ((totalSuccess / totalAll) * 100).toFixed(2)
})

// 格式化时间
const formatTime = (timestamp) => {
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')
}

// 获取日志统计
const fetchLogStats = async () => {
  try {
    const response = await api.getLogStats()
    if (response.success) {
      Object.assign(stats.connection, response.data.connection)
      Object.assign(stats.command, response.data.command)
    }
  } catch (error) {
    console.error('获取日志统计失败:', error)
  }
}

// 获取连接日志
const fetchConnectionLogs = async () => {
  loading.value = true
  try {
    const params = {
      userId: connectionFilters.userId || undefined,
      action: connectionFilters.action,
      status: connectionFilters.status,
      limit: connectionPagination.pageSize,
      offset: (connectionPagination.current - 1) * connectionPagination.pageSize
    }

    const response = await api.getConnectionLogs(params)
    if (response.success) {
      connectionLogs.value = response.data.logs
      connectionPagination.total = response.data.total
    }
  } catch (error) {
    console.error('获取连接日志失败:', error)
  } finally {
    loading.value = false
  }
}

// 获取指令日志
const fetchCommandLogs = async () => {
  loading.value = true
  try {
    const params = {
      userId: commandFilters.userId || undefined,
      status: commandFilters.status,
      limit: commandPagination.pageSize,
      offset: (commandPagination.current - 1) * commandPagination.pageSize
    }

    const response = await api.getCommandLogs(params)
    if (response.success) {
      commandLogs.value = response.data.logs
      commandPagination.total = response.data.total
    }
  } catch (error) {
    console.error('获取指令日志失败:', error)
  } finally {
    loading.value = false
  }
}

// 刷新日志
const refreshLogs = () => {
  fetchLogStats()
  if (activeTab.value === 'connection') {
    fetchConnectionLogs()
  } else {
    fetchCommandLogs()
  }
}

// 切换标签页
const handleTabChange = (key) => {
  if (key === 'connection') {
    fetchConnectionLogs()
  } else {
    fetchCommandLogs()
  }
}

// 搜索连接日志
const searchConnectionLogs = () => {
  connectionPagination.current = 1
  fetchConnectionLogs()
}

// 重置连接日志筛选
const resetConnectionFilters = () => {
  connectionFilters.userId = ''
  connectionFilters.action = undefined
  connectionFilters.status = undefined
  connectionPagination.current = 1
  fetchConnectionLogs()
}

// 搜索指令日志
const searchCommandLogs = () => {
  commandPagination.current = 1
  fetchCommandLogs()
}

// 重置指令日志筛选
const resetCommandFilters = () => {
  commandFilters.userId = ''
  commandFilters.status = undefined
  commandPagination.current = 1
  fetchCommandLogs()
}

// 连接日志表格变化
const handleConnectionTableChange = (pagination) => {
  connectionPagination.current = pagination.current
  connectionPagination.pageSize = pagination.pageSize
  fetchConnectionLogs()
}

// 指令日志表格变化
const handleCommandTableChange = (pagination) => {
  commandPagination.current = pagination.current
  commandPagination.pageSize = pagination.pageSize
  fetchCommandLogs()
}

onMounted(() => {
  fetchLogStats()
  fetchConnectionLogs()
})
</script>

<style scoped>
.logs-container {
  padding: 24px;
  background: #f0f2f5;
  min-height: calc(100vh - 64px);
}
</style>

<template>
  <Layout>
    <!-- 核心指标卡片 -->
    <div class="stats-container">
      <a-spin :spinning="loadingStats">
        <a-alert
          v-if="statsError"
          :message="statsError"
          type="error"
          closable
          show-icon
          style="margin-bottom: 16px"
          @close="statsError = null"
        />
        <a-row :gutter="16">
          <a-col :span="6">
            <a-card>
              <a-statistic
                title="在线用户"
                :value="stats.onlineUsers"
                :value-style="{ color: '#3f8600' }"
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
                title="今日消息"
                :value="stats.todayMessages"
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
                :value="stats.avgResponseTime"
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
                :value="stats.errorRate"
                :precision="2"
                :value-style="{ color: stats.errorRate > 1 ? '#cf1322' : '#3f8600' }"
              >
                <template #prefix>
                  <ExclamationCircleOutlined />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
        </a-row>
      </a-spin>
    </div>

    <!-- 实时监控 -->
    <a-card title="实时监控" :bordered="false" style="margin-top: 24px">
      <a-row :gutter="16">
        <a-col :span="12">
          <div class="monitor-chart">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px">
              <h3>流量趋势统计</h3>
              <a-radio-group v-model:value="timeRange" size="small" @change="handleTimeRangeChange">
                <a-radio-button value="day">日</a-radio-button>
                <a-radio-button value="week">周</a-radio-button>
                <a-radio-button value="month">月</a-radio-button>
                <a-radio-button value="year">年</a-radio-button>
              </a-radio-group>
            </div>
            <a-spin :spinning="loadingTraffic">
              <a-alert
                v-if="trafficError"
                :message="trafficError"
                type="error"
                closable
                show-icon
                style="margin-bottom: 16px"
                @close="trafficError = null"
              />
              <div v-if="!trafficError && trafficTrend.length > 0">
                <div ref="chartContainer" class="echarts-container"></div>
                <div class="chart-summary">
                  <a-space>
                    <span>峰值: {{ maxMessageCount }} 条</span>
                    <a-divider type="vertical" />
                    <span>平均值: {{ Math.round(trafficTrend.reduce((sum, item) => sum + item.count, 0) / trafficTrend.length) }} 条{{ timeRange === 'day' ? '/小时' : timeRange === 'week' ? '/4小时' : timeRange === 'month' ? '/天' : '/周' }}</span>
                  </a-space>
                </div>
              </div>
              <a-empty v-else-if="!trafficError && !loadingTraffic" description="暂无数据" />
            </a-spin>
          </div>
        </a-col>
        <a-col :span="12">
          <div class="monitor-chart">
            <h3>系统资源</h3>
            <a-spin :spinning="loadingSystem">
              <a-alert
                v-if="systemError"
                :message="systemError"
                type="error"
                closable
                show-icon
                style="margin-bottom: 16px"
                @close="systemError = null"
              />
              <a-space v-if="!systemError" direction="vertical" style="width: 100%">
                <div>
                  <div style="margin-bottom: 8px">CPU使用率</div>
                  <a-progress :percent="systemResources.cpu" :stroke-color="getProgressColor(systemResources.cpu)" />
                </div>
                <div>
                  <div style="margin-bottom: 8px">内存使用率</div>
                  <a-progress :percent="systemResources.memory" :stroke-color="getProgressColor(systemResources.memory)" />
                </div>
                <div>
                  <div style="margin-bottom: 8px">磁盘使用率</div>
                  <a-progress :percent="systemResources.disk" :stroke-color="getProgressColor(systemResources.disk)" />
                </div>
              </a-space>
            </a-spin>
          </div>
        </a-col>
      </a-row>
    </a-card>

    <!-- 最近活动 -->
    <a-card title="最近活动" :bordered="false" style="margin-top: 24px">
      <a-spin :spinning="loadingActivities">
        <a-alert
          v-if="activitiesError"
          :message="activitiesError"
          type="error"
          closable
          show-icon
          style="margin-bottom: 16px"
          @close="activitiesError = null"
        />
        <a-table
          v-if="!activitiesError"
          :columns="activityColumns"
          :data-source="recentActivities"
          :pagination="false"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag :color="record.status === 'success' ? 'success' : 'error'">
                {{ record.status === 'success' ? '成功' : '失败' }}
              </a-tag>
            </template>
          </template>
        </a-table>
        <a-empty v-else-if="!activitiesError && !loadingActivities && recentActivities.length === 0" description="暂无活动记录" />
      </a-spin>
    </a-card>
  </Layout>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick, watch } from 'vue'
import Layout from '../components/Layout.vue'
import { message } from 'ant-design-vue'
import * as echarts from 'echarts'
import { syncTrafficChart } from './monitorChart.js'
import {
  UserOutlined,
  MessageOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons-vue'
import api from '../utils/api'

// 核心指标
const stats = reactive({
  onlineUsers: 0,
  todayMessages: 0,
  avgResponseTime: 0,
  errorRate: 0
})

// 加载状态
const loadingStats = ref(false)
const loadingTraffic = ref(false)
const loadingSystem = ref(false)
const loadingActivities = ref(false)

// 错误状态
const statsError = ref(null)
const trafficError = ref(null)
const systemError = ref(null)
const activitiesError = ref(null)

// 流量趋势（模拟数据）
const trafficTrend = ref([])
const maxMessageCount = ref(100)
const timeRange = ref('day') // day, week, month, year

// 系统资源
const systemResources = reactive({
  cpu: 0,
  memory: 0,
  disk: 0
})

// 最近活动
const recentActivities = ref([])

// ECharts图表
const chartContainer = ref(null)
let chart = null
let trafficRefreshInterval = null

const handleChartResize = () => {
  if (chart) {
    chart.resize()
  }
}

const updateChart = () => {
  chart = syncTrafficChart({
    chart,
    container: chartContainer.value,
    echartsLib: echarts,
    trafficTrend: trafficTrend.value,
    range: timeRange.value,
    maxMessageCount: maxMessageCount.value
  })
}

const activityColumns = [
  { title: '时间', dataIndex: 'time', key: 'time' },
  { title: '用户', dataIndex: 'user', key: 'user' },
  { title: '操作', dataIndex: 'action', key: 'action' },
  { title: '状态', dataIndex: 'status', key: 'status' }
]

// 获取监控数据
const fetchMonitorData = async () => {
  loadingStats.value = true
  statsError.value = null
  try {
    const response = await api.getRealtimeStats()
    if (response.success) {
      const data = response.data
      stats.onlineUsers = data.onlineUsers || 0
      stats.todayMessages = data.todayMessages || 0
      stats.avgResponseTime = data.avgResponseTime || 0
      stats.errorRate = data.errorRate || 0
    } else {
      statsError.value = response.message || '获取统计数据失败'
    }
  } catch (error) {
    console.error('获取监控数据失败:', error)
    statsError.value = '获取统计数据失败，请稍后重试'
  } finally {
    loadingStats.value = false
  }
}

// 获取流量趋势
const fetchTrafficTrend = async (range = 'day') => {
  loadingTraffic.value = true
  trafficError.value = null
  try {
    const rangeMapping = {
      day: { presetRange: 'today', granularity: 'hour', metric: 'messageCount' },
      week: { presetRange: 'last7days', granularity: 'day', metric: 'messageCount' },
      month: { presetRange: 'last30days', granularity: 'day', metric: 'messageCount' },
      year: { presetRange: 'thisMonth', granularity: 'week', metric: 'messageCount' }
    }
    const reportParams = rangeMapping[range] || rangeMapping.day
    const response = await api.getReportTrends(reportParams)
    if (response.success) {
      const points = Array.isArray(response.data?.points) ? response.data.points : []
      trafficTrend.value = points.map(item => ({
        time: item.time,
        count: item.value,
        timestamp: item.extra?.timestamp || Date.now()
      }))
      // 计算最大值
      maxMessageCount.value = Math.max(...trafficTrend.value.map(item => item.count), 100)
      // 更新图表
      nextTick(() => {
        updateChart()
      })
    } else {
      trafficError.value = response.message || '获取流量趋势失败'
      trafficTrend.value = []
      if (chart) {
        chart.dispose()
        chart = null
      }
    }
  } catch (error) {
    console.error('获取流量趋势失败:', error)
    trafficError.value = '获取流量趋势失败，请稍后重试'
    trafficTrend.value = []
    if (chart) {
      chart.dispose()
      chart = null
    }
  } finally {
    loadingTraffic.value = false
  }
}

// 处理时间范围变化
const handleTimeRangeChange = () => {
  fetchTrafficTrend(timeRange.value)
}

// 获取系统资源
const fetchSystemResources = async () => {
  loadingSystem.value = true
  systemError.value = null
  try {
    const response = await api.getSystemMetrics()
    if (response.success) {
      const data = response.data
      systemResources.cpu = data.cpu || 0
      systemResources.memory = data.memory || 0
      systemResources.disk = data.disk || 0
    } else {
      systemError.value = response.message || '获取系统资源失败'
    }
  } catch (error) {
    console.error('获取系统资源失败:', error)
    systemError.value = '获取系统资源失败，请稍后重试'
  } finally {
    loadingSystem.value = false
  }
}

// 获取最近活动
const fetchRecentActivities = async () => {
  loadingActivities.value = true
  activitiesError.value = null
  try {
    const response = await api.getConnectionLogs({ limit: 10 })
    if (response.success) {
      recentActivities.value = response.data.logs.map(log => ({
        time: new Date(log.created_at).toLocaleString(),
        user: log.user_id,
        action: log.action === 'login' ? '登录' : log.action === 'logout' ? '登出' : '未知',
        status: log.status
      }))
    } else {
      activitiesError.value = response.message || '获取活动日志失败'
    }
  } catch (error) {
    console.error('获取活动日志失败:', error)
    activitiesError.value = '获取活动日志失败，请稍后重试'
  } finally {
    loadingActivities.value = false
  }
}

// 获取进度条颜色
const getProgressColor = (percent) => {
  if (percent < 60) return '#3f8600'
  if (percent < 80) return '#faad14'
  return '#cf1322'
}

// 定时刷新数据
let refreshInterval

onMounted(() => {
  fetchMonitorData()
  fetchTrafficTrend(timeRange.value)
  fetchSystemResources()
  fetchRecentActivities()

  // 每30秒刷新一次
  refreshInterval = setInterval(() => {
    fetchMonitorData()
    fetchSystemResources()
  }, 30000)

  // 每分钟刷新流量趋势
  trafficRefreshInterval = setInterval(() => {
    fetchTrafficTrend(timeRange.value)
  }, 60000)

  window.addEventListener('resize', handleChartResize)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
  if (trafficRefreshInterval) {
    clearInterval(trafficRefreshInterval)
  }
  window.removeEventListener('resize', handleChartResize)
  if (chart) {
    chart.dispose()
    chart = null
  }
})

watch(
  [chartContainer, trafficTrend, timeRange],
  () => {
    nextTick(() => {
      updateChart()
    })
  },
  { flush: 'post' }
)
</script>

<style scoped>
.stats-container {
  padding: 24px;
}

.monitor-chart {
  padding: 16px;
}

.monitor-chart h3 {
  margin-bottom: 16px;
  font-size: 16px;
  font-weight: 600;
}

.chart-placeholder {
  min-height: 200px;
  padding: 16px;
  background: #fafafa;
  border-radius: 4px;
}

/* ECharts容器样式 */
.echarts-container {
  width: 100%;
  height: 300px;
  margin-bottom: 16px;
}

.chart-summary {
  text-align: center;
  padding: 12px;
  background: #f6f8fa;
  border-radius: 4px;
  font-size: 14px;
}
</style>

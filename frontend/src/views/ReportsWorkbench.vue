<template>
  <Layout>
    <div class="reports-page">
      <div class="reports-shell">
        <div class="reports-header">
          <h2>综合报表中心</h2>
        </div>
        <a-space direction="vertical" style="width: 100%" size="large">
          <a-form layout="inline">
            <a-form-item label="时间范围">
              <a-select v-model:value="filters.presetRange" style="width: 140px">
                <a-select-option value="today">今日</a-select-option>
                <a-select-option value="last7days">近7天</a-select-option>
                <a-select-option value="last30days">近30天</a-select-option>
                <a-select-option value="thisMonth">本月</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="粒度">
              <a-select v-model:value="filters.granularity" style="width: 120px">
                <a-select-option value="hour">小时</a-select-option>
                <a-select-option value="day">天</a-select-option>
                <a-select-option value="week">周</a-select-option>
                <a-select-option value="month">月</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="用户ID">
              <a-input v-model:value="filters.userId" placeholder="按用户筛选" style="width: 180px" />
            </a-form-item>
            <a-form-item label="状态">
              <a-select v-model:value="filters.commandStatus" style="width: 120px">
                <a-select-option value="all">全部</a-select-option>
                <a-select-option value="success">成功</a-select-option>
                <a-select-option value="failed">失败</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="趋势">
              <a-select v-model:value="filters.metric" style="width: 150px">
                <a-select-option v-for="item in trendMetricOptions" :key="item.value" :value="item.value">
                  {{ item.label }}
                </a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="分布">
              <a-select v-model:value="filters.distributionMetric" style="width: 140px">
                <a-select-option v-for="item in distributionMetricOptions" :key="item.value" :value="item.value">
                  {{ item.label }}
                </a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="排行">
              <a-select v-model:value="filters.rankingMetric" style="width: 140px">
                <a-select-option v-for="item in rankingMetricOptions" :key="item.value" :value="item.value">
                  {{ item.label }}
                </a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="明细">
              <a-select v-model:value="filters.detailType" style="width: 120px">
                <a-select-option value="commands">指令</a-select-option>
                <a-select-option value="connections">连接</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item>
              <a-space>
                <a-button type="primary" :loading="loading" @click="handleSearch">查询</a-button>
                <a-button @click="resetFilters">重置</a-button>
                <a-button :loading="exporting" @click="exportCsv">导出 CSV</a-button>
              </a-space>
            </a-form-item>
          </a-form>

          <a-alert v-if="pageError" type="error" show-icon :message="pageError" />

          <a-row :gutter="[16, 16]">
            <a-col v-for="card in overviewCards" :key="card.metric" :xs="24" :sm="12" :lg="6">
              <a-card>
                <a-statistic :title="card.label" :value="card.value" :suffix="card.unit" />
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[16, 16]">
            <a-col :xs="24" :lg="14">
              <a-card title="趋势分析">
                <div ref="trendChartRef" class="report-chart"></div>
              </a-card>
            </a-col>
            <a-col :xs="24" :lg="10">
              <a-card title="结构分布">
                <div ref="distributionChartRef" class="report-chart"></div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[16, 16]">
            <a-col :xs="24" :lg="10">
              <a-card title="TOP 排行">
                <a-table
                  :columns="rankingColumns"
                  :data-source="rankingRows"
                  :pagination="false"
                  size="small"
                  row-key="key"
                />
              </a-card>
            </a-col>
            <a-col :xs="24" :lg="14">
              <a-card title="结构化摘要">
                <a-space direction="vertical" style="width: 100%">
                  <a-alert type="info" :message="summary.headline || '暂无摘要'" show-icon />
                  <div>
                    <h4>亮点</h4>
                    <a-empty v-if="summary.highlights.length === 0" description="暂无亮点" />
                    <ul v-else class="summary-list">
                      <li v-for="item in summary.highlights" :key="item">{{ item }}</li>
                    </ul>
                  </div>
                  <div>
                    <h4>异常</h4>
                    <a-empty v-if="summary.anomalies.length === 0" description="暂无异常" />
                    <ul v-else class="summary-list">
                      <li v-for="item in summary.anomalies" :key="item">{{ item }}</li>
                    </ul>
                  </div>
                  <div>
                    <h4>建议</h4>
                    <ul class="summary-list">
                      <li v-for="item in summary.recommendations" :key="item">{{ item }}</li>
                    </ul>
                  </div>
                </a-space>
              </a-card>
            </a-col>
          </a-row>

          <a-card title="明细数据">
            <a-table
              :columns="detailColumns"
              :data-source="detailRows"
              :loading="loading"
              :pagination="detailTablePagination"
              size="small"
              row-key="id"
              :scroll="{ x: 900 }"
              @change="handleDetailTableChange"
            />
          </a-card>
        </a-space>
      </div>
    </div>
  </Layout>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { message } from 'ant-design-vue'
import Layout from '../components/Layout.vue'
import api from '../utils/api'
import { buildDistributionChartOption, buildTrendChartOption } from './reports/reportingCharts.js'
import { createReportFilters, defaultReportFilters, serializeReportFilters } from './reports/reportingState.js'
import { toDetailRows, toOverviewCards, toRankingRows } from './reports/reportingTransforms.js'

const filters = reactive(createReportFilters())
const loading = ref(false)
const exporting = ref(false)
const pageError = ref('')
const overviewCards = ref([])
const rankingRows = ref([])
const detailRows = ref([])
const detailColumns = ref([])
const detailPagination = reactive({
  total: 0
})
const summary = reactive({
  headline: '',
  highlights: [],
  anomalies: [],
  recommendations: []
})

const trendChartRef = ref(null)
const distributionChartRef = ref(null)
let trendChart = null
let distributionChart = null

const trendMetricOptions = [
  { label: '指令量', value: 'messageCount' },
  { label: '活跃用户', value: 'activeUsers' },
  { label: '成功率', value: 'successRate' },
  { label: '失败指令', value: 'failedCommands' },
  { label: '错误率', value: 'errorRate' },
  { label: '平均耗时', value: 'avgResponseTime' },
  { label: 'P95耗时', value: 'p95ResponseTime' },
  { label: '慢指令', value: 'slowCommands' },
  { label: '登录失败', value: 'loginFailures' }
]

const distributionMetricOptions = [
  { label: '状态分布', value: 'commandStatus' },
  { label: '指令分布', value: 'commandId' },
  { label: '耗时分布', value: 'responseTimeBucket' }
]

const rankingMetricOptions = [
  { label: 'TOP 指令', value: 'topCommands' },
  { label: 'TOP 用户', value: 'topUsers' },
  { label: 'TOP 失败指令', value: 'topFailedCommands' }
]

const rankingColumns = [
  { title: '排名', dataIndex: 'rank', key: 'rank', width: 80 },
  { title: '名称', dataIndex: 'label', key: 'label' },
  { title: '数值', dataIndex: 'value', key: 'value', width: 120 }
]

const detailTablePagination = computed(() => ({
  current: filters.page,
  pageSize: filters.pageSize,
  total: detailPagination.total,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: total => `共 ${total} 条`
}))

function ensureCharts() {
  if (trendChartRef.value && !trendChart) {
    trendChart = echarts.init(trendChartRef.value)
  }

  if (distributionChartRef.value && !distributionChart) {
    distributionChart = echarts.init(distributionChartRef.value)
  }
}

function resizeCharts() {
  if (trendChart) {
    trendChart.resize()
  }

  if (distributionChart) {
    distributionChart.resize()
  }
}

async function loadReports(options = {}) {
  if (options.resetPage) {
    filters.page = 1
  }

  loading.value = true
  pageError.value = ''

  try {
    const params = serializeReportFilters(filters)
    const trendParams = { ...params, metric: filters.metric }
    const distributionParams = { ...params, metric: filters.distributionMetric }
    const rankingParams = { ...params, metric: filters.rankingMetric }
    const detailParams = { ...params, type: filters.detailType }

    const [overviewRes, trendRes, distributionRes, rankingRes, detailRes, summaryRes] = await Promise.all([
      api.getReportOverview(params),
      api.getReportTrends(trendParams),
      api.getReportDistributions(distributionParams),
      api.getReportRankings(rankingParams),
      api.getReportDetails(detailParams),
      api.getReportSummary(params)
    ])

    overviewCards.value = toOverviewCards(overviewRes.data)
    rankingRows.value = toRankingRows(rankingRes.data?.items || [])
    detailRows.value = toDetailRows(detailRes.data)
    detailColumns.value = (detailRes.data?.columns || []).map(column => ({
      title: column,
      dataIndex: column,
      key: column,
      ellipsis: true
    }))
    detailPagination.total = detailRes.data?.pagination?.total || 0
    filters.page = detailRes.data?.pagination?.page || filters.page
    filters.pageSize = detailRes.data?.pagination?.pageSize || filters.pageSize

    summary.headline = summaryRes.data?.headline || ''
    summary.highlights = summaryRes.data?.highlights || []
    summary.anomalies = summaryRes.data?.anomalies || []
    summary.recommendations = summaryRes.data?.recommendations || []

    await nextTick()
    ensureCharts()

    if (trendChart) {
      trendChart.setOption(buildTrendChartOption(trendRes.data), true)
    }

    if (distributionChart) {
      distributionChart.setOption(buildDistributionChartOption(distributionRes.data), true)
    }
  } catch (error) {
    console.error('加载报表失败:', error)
    pageError.value = '加载报表失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  loadReports({ resetPage: true })
}

function resetFilters() {
  Object.assign(filters, createReportFilters(), {
    page: defaultReportFilters.page,
    pageSize: defaultReportFilters.pageSize
  })
  loadReports()
}

function handleDetailTableChange(pagination) {
  filters.page = pagination.current || defaultReportFilters.page
  filters.pageSize = pagination.pageSize || defaultReportFilters.pageSize
  loadReports()
}

async function exportCsv() {
  exporting.value = true
  try {
    await api.exportReport({
      ...serializeReportFilters(filters),
      format: 'csv',
      type: filters.detailType
    })
    message.success('报表导出请求已发起')
  } catch (error) {
    console.error('导出报表失败:', error)
    message.error('导出报表失败')
  } finally {
    exporting.value = false
  }
}

watch(
  () => [filters.presetRange, filters.granularity, filters.metric, filters.distributionMetric],
  () => {
    nextTick(() => {
      resizeCharts()
    })
  }
)

onMounted(() => {
  loadReports()
  window.addEventListener('resize', resizeCharts)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeCharts)
  if (trendChart) {
    trendChart.dispose()
    trendChart = null
  }
  if (distributionChart) {
    distributionChart.dispose()
    distributionChart = null
  }
})
</script>

<style scoped>
.reports-page {
  padding: 24px;
}

.reports-shell {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
}

.reports-header {
  margin-bottom: 18px;
}

.reports-header h2 {
  margin: 0;
  color: rgba(0, 0, 0, 0.88);
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}

.report-chart {
  width: 100%;
  height: 320px;
}

.summary-list {
  margin: 0;
  padding-left: 18px;
}
</style>

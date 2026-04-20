<template>
  <Layout>
    <div class="reports-page">
      <a-card title="综合报表中心" :bordered="false">
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
            <a-form-item>
              <a-space>
                <a-button type="primary" :loading="loading" @click="loadReports">查询</a-button>
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
              :pagination="false"
              size="small"
              row-key="id"
              :scroll="{ x: 900 }"
            />
          </a-card>
        </a-space>
      </a-card>
    </div>
  </Layout>
</template>

<script setup>
import { nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
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

const rankingColumns = [
  { title: '排名', dataIndex: 'rank', key: 'rank', width: 80 },
  { title: '名称', dataIndex: 'label', key: 'label' },
  { title: '数值', dataIndex: 'value', key: 'value', width: 120 }
]

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

async function loadReports() {
  loading.value = true
  pageError.value = ''

  try {
    const params = serializeReportFilters(filters)
    const [overviewRes, trendRes, distributionRes, rankingRes, detailRes, summaryRes] = await Promise.all([
      api.getReportOverview(params),
      api.getReportTrends(params),
      api.getReportDistributions(params),
      api.getReportRankings(params),
      api.getReportDetails(params),
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

function resetFilters() {
  Object.assign(filters, createReportFilters(), { page: defaultReportFilters.page, pageSize: defaultReportFilters.pageSize })
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
  () => [filters.presetRange, filters.granularity],
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

.report-chart {
  width: 100%;
  height: 320px;
}

.summary-list {
  margin: 0;
  padding-left: 18px;
}
</style>

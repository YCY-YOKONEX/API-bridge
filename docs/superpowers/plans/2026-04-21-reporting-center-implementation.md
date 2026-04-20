# 综合报表中心 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为现有管理后台新增统一的综合报表工作台，打通报表聚合接口、统一筛选上下文、趋势/分布/明细展示、摘要与导出能力。

**Architecture:** 在后端新增报表聚合服务层，统一封装筛选条件解析、统计查询、图表数据转换、导出与摘要生成；前端新增 `ReportsWorkbench` 工作台页面，并将原有 `Dashboard`、`Monitor`、`Logs` 的统计能力逐步收口到新的报表数据层。整个实现遵循小步迭代，先建立查询与聚合底座，再接前端视图，最后补摘要与导出。

**Tech Stack:** Node.js、Express、better-sqlite3、Vue 3、Vue Router、Ant Design Vue、ECharts、Node 原生 `node:test`

---

## 文件结构

### 后端新增文件

- Create: `D:\hosgoo\API-bridge\reporting\query.js`
- Create: `D:\hosgoo\API-bridge\reporting\metrics.js`
- Create: `D:\hosgoo\API-bridge\reporting\summary.js`
- Create: `D:\hosgoo\API-bridge\reporting\export.js`
- Create: `D:\hosgoo\API-bridge\tests\reporting\query.test.js`
- Create: `D:\hosgoo\API-bridge\tests\reporting\metrics.test.js`
- Create: `D:\hosgoo\API-bridge\tests\reporting\summary.test.js`

### 后端修改文件

- Modify: `D:\hosgoo\API-bridge\database.js`
- Modify: `D:\hosgoo\API-bridge\server.js`
- Modify: `D:\hosgoo\API-bridge\package.json`
- Modify: `D:\hosgoo\API-bridge\docs\HTTP_API.md`

### 前端新增文件

- Create: `D:\hosgoo\API-bridge\frontend\src\views\ReportsWorkbench.vue`
- Create: `D:\hosgoo\API-bridge\frontend\src\views\reports\reportingState.js`
- Create: `D:\hosgoo\API-bridge\frontend\src\views\reports\reportingTransforms.js`
- Create: `D:\hosgoo\API-bridge\frontend\src\views\reports\reportingCharts.js`
- Create: `D:\hosgoo\API-bridge\frontend\src\views\reports\__tests__\reporting-transforms.test.js`

### 前端修改文件

- Modify: `D:\hosgoo\API-bridge\frontend\src\router\index.js`
- Modify: `D:\hosgoo\API-bridge\frontend\src\components\Layout.vue`
- Modify: `D:\hosgoo\API-bridge\frontend\src\utils\api.js`
- Modify: `D:\hosgoo\API-bridge\frontend\src\views\Dashboard.vue`
- Modify: `D:\hosgoo\API-bridge\frontend\src\views\Monitor.vue`
- Modify: `D:\hosgoo\API-bridge\frontend\package.json`

---

### Task 1: 建立报表查询模型与参数解析

**Files:**
- Create: `D:\hosgoo\API-bridge\reporting\query.js`
- Test: `D:\hosgoo\API-bridge\tests\reporting\query.test.js`

- [ ] **Step 1: 写失败测试，定义 `ReportQuery` 的标准化行为**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeReportQuery } from '../../reporting/query.js'

test('normalizeReportQuery会补全默认时间范围和粒度', () => {
  const query = normalizeReportQuery({})
  assert.equal(query.presetRange, 'today')
  assert.equal(query.granularity, 'hour')
})

test('normalizeReportQuery会解析自定义时间并限制非法范围', () => {
  const query = normalizeReportQuery({
    startTime: '2026-04-01T00:00:00.000Z',
    endTime: '2026-04-07T00:00:00.000Z',
    page: '0',
    pageSize: '5000'
  })
  assert.equal(query.page, 1)
  assert.equal(query.pageSize, 200)
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/reporting/query.test.js`
Expected: FAIL，提示 `normalizeReportQuery` 未定义或导入失败

- [ ] **Step 3: 实现最小查询标准化逻辑**

```js
export function normalizeReportQuery(input = {}) {
  const page = Math.max(1, Number.parseInt(input.page || '1', 10) || 1)
  const pageSize = Math.min(200, Math.max(1, Number.parseInt(input.pageSize || '20', 10) || 20))

  return {
    presetRange: input.presetRange || 'today',
    startTime: input.startTime || null,
    endTime: input.endTime || null,
    granularity: input.granularity || 'hour',
    userId: input.userId || '',
    onlineStatus: input.onlineStatus || 'all',
    userSegment: input.userSegment || 'all',
    commandType: input.commandType || 'all',
    commandStatus: input.commandStatus || 'all',
    errorType: input.errorType || 'all',
    latencyMin: Number(input.latencyMin || 0),
    latencyMax: Number(input.latencyMax || 0),
    cpuMin: Number(input.cpuMin || 0),
    cpuMax: Number(input.cpuMax || 0),
    memoryMin: Number(input.memoryMin || 0),
    memoryMax: Number(input.memoryMax || 0),
    diskMin: Number(input.diskMin || 0),
    diskMax: Number(input.diskMax || 0),
    page,
    pageSize,
    sortField: input.sortField || 'created_at',
    sortOrder: input.sortOrder === 'ascend' ? 'asc' : 'desc'
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/reporting/query.test.js`
Expected: PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add tests/reporting/query.test.js reporting/query.js
git commit -m "feat: add reporting query normalization"
```

---

### Task 2: 实现报表总览与趋势聚合服务

**Files:**
- Create: `D:\hosgoo\API-bridge\reporting\metrics.js`
- Modify: `D:\hosgoo\API-bridge\database.js`
- Test: `D:\hosgoo\API-bridge\tests\reporting\metrics.test.js`

- [ ] **Step 1: 写失败测试，锁定总览与趋势返回结构**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOverviewCards, buildTrendSeries } from '../../reporting/metrics.js'

test('buildOverviewCards会返回统一KPI结构', () => {
  const cards = buildOverviewCards({
    onlineUsers: 5,
    activeUsers: 8,
    totalCommands: 30,
    successRate: 96.6
  })
  assert.equal(cards[0].metric, 'onlineUsers')
  assert.equal(cards[2].value, 30)
})

test('buildTrendSeries会输出ECharts友好的点位数组', () => {
  const series = buildTrendSeries('messageCount', [
    { time: '04-01 10:00', value: 12 },
    { time: '04-01 11:00', value: 20 }
  ], 'hour')
  assert.equal(series.metric, 'messageCount')
  assert.equal(series.points.length, 2)
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/reporting/metrics.test.js`
Expected: FAIL，提示 `buildOverviewCards` 或 `buildTrendSeries` 不存在

- [ ] **Step 3: 在 `database.js` 提取底层统计查询函数**

```js
export function getReportOverviewStats(query) {
  return {
    onlineUsers: 0,
    activeUsers: 0,
    todayMessages: 0,
    totalCommands: 0,
    successRate: 0,
    avgResponseTime: 0,
    p95ResponseTime: 0,
    errorRate: 0
  }
}

export function getReportTrendPoints(query, metric) {
  return []
}
```

- [ ] **Step 4: 在 `reporting/metrics.js` 实现最小聚合转换层**

```js
export function buildOverviewCards(stats) {
  return [
    { metric: 'onlineUsers', label: '在线用户', value: stats.onlineUsers, unit: '人' },
    { metric: 'activeUsers', label: '活跃用户', value: stats.activeUsers, unit: '人' },
    { metric: 'totalCommands', label: '指令量', value: stats.totalCommands, unit: '次' },
    { metric: 'successRate', label: '成功率', value: stats.successRate, unit: '%' }
  ]
}

export function buildTrendSeries(metric, points, granularity) {
  return { metric, granularity, points }
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `node --test tests/reporting/metrics.test.js`
Expected: PASS

- [ ] **Step 6: 扩展底层统计，补充真实 SQL 聚合**

实现内容：
- 复用 `command_logs`、`connection_logs` 计算时间窗口内的总调用量、成功率、错误率
- 为响应时间计算补充 `P95/P99` 所需的排序样本
- 为趋势图统一输出 `[{ time, value, extra }]`
- 将现有 `getRealtimeStats`、`getTrafficTrend` 内部逻辑逐步复用到新函数，而不是复制一份

- [ ] **Step 7: 跑回归验证**

Run: `node --test tests/reporting/metrics.test.js`
Expected: PASS

- [ ] **Step 8: 提交这一小步**

```bash
git add tests/reporting/metrics.test.js reporting/metrics.js database.js
git commit -m "feat: add reporting metrics aggregation"
```

---

### Task 3: 暴露报表接口并接入认证

**Files:**
- Modify: `D:\hosgoo\API-bridge\server.js`
- Modify: `D:\hosgoo\API-bridge\docs\HTTP_API.md`
- Modify: `D:\hosgoo\API-bridge\package.json`

- [ ] **Step 1: 在 `package.json` 增加统一测试脚本**

```json
{
  "scripts": {
    "test": "node --test tests/**/*.test.js"
  }
}
```

- [ ] **Step 2: 在 `server.js` 新增报表接口路由骨架**

```js
app.get('/api/admin/reports/overview', authenticateToken, (req, res) => {})
app.get('/api/admin/reports/trends', authenticateToken, (req, res) => {})
app.get('/api/admin/reports/distributions', authenticateToken, (req, res) => {})
app.get('/api/admin/reports/rankings', authenticateToken, (req, res) => {})
app.get('/api/admin/reports/details', authenticateToken, (req, res) => {})
app.get('/api/admin/reports/summary', authenticateToken, (req, res) => {})
app.post('/api/admin/reports/export', authenticateToken, (req, res) => {})
```

- [ ] **Step 3: 将 `normalizeReportQuery` 接入接口层**

要求：
- 所有接口都使用统一 query/body 解析
- 出错时保持 `{ success: false, message }` 的现有响应风格
- `overview` / `trends` / `details` 等接口返回结构和设计文档一致

- [ ] **Step 4: 更新接口文档**

在 `docs/HTTP_API.md` 新增：
- 报表总览接口示例
- 趋势接口示例
- 明细接口示例
- 导出接口说明
- 摘要接口说明

- [ ] **Step 5: 运行后端测试**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: 提交这一小步**

```bash
git add package.json server.js docs/HTTP_API.md
git commit -m "feat: add reporting api endpoints"
```

---

### Task 4: 实现前端报表数据层与转换工具

**Files:**
- Create: `D:\hosgoo\API-bridge\frontend\src\views\reports\reportingState.js`
- Create: `D:\hosgoo\API-bridge\frontend\src\views\reports\reportingTransforms.js`
- Create: `D:\hosgoo\API-bridge\frontend\src\views\reports\reportingCharts.js`
- Create: `D:\hosgoo\API-bridge\frontend\src\views\reports\__tests__\reporting-transforms.test.js`
- Modify: `D:\hosgoo\API-bridge\frontend\src\utils\api.js`

- [ ] **Step 1: 写失败测试，锁定图表转换函数**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { toLineSeriesOption, toRankingRows } from '../reportingTransforms.js'

test('toLineSeriesOption会把趋势点转成折线图配置', () => {
  const option = toLineSeriesOption({
    metric: 'messageCount',
    points: [{ time: '10:00', value: 12 }]
  })
  assert.deepEqual(option.xAxis.data, ['10:00'])
  assert.deepEqual(option.series[0].data, [12])
})

test('toRankingRows会补全排行表key', () => {
  const rows = toRankingRows([{ label: 'sendCommand', value: 20 }])
  assert.equal(rows[0].key, 'sendCommand')
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test src/views/reports/__tests__/reporting-transforms.test.js`
Expected: FAIL

- [ ] **Step 3: 实现前端数据层**

`reportingState.js` 负责：
- 默认筛选值
- 查询参数序列化
- 页面级加载状态

`reportingTransforms.js` 负责：
- KPI 卡片映射
- 趋势数据映射
- 分布图、排行表、明细表映射

`reportingCharts.js` 负责：
- 统一 ECharts option 生成函数
- 颜色、tooltip、网格、空态处理

- [ ] **Step 4: 在 `api.js` 增加报表接口调用方法**

```js
getReportOverview(params = {}) {
  return api.get('/api/admin/reports/overview', { params })
}

getReportTrends(params = {}) {
  return api.get('/api/admin/reports/trends', { params })
}
```

同时补齐：
- `getReportDistributions`
- `getReportRankings`
- `getReportDetails`
- `getReportSummary`
- `exportReport`

- [ ] **Step 5: 跑前端转换测试**

Run: `node --test src/views/reports/__tests__/reporting-transforms.test.js`
Expected: PASS

- [ ] **Step 6: 提交这一小步**

```bash
git add src/views/reports src/utils/api.js
git commit -m "feat: add frontend reporting data layer"
```

---

### Task 5: 实现报表工作台页面

**Files:**
- Create: `D:\hosgoo\API-bridge\frontend\src\views\ReportsWorkbench.vue`
- Modify: `D:\hosgoo\API-bridge\frontend\src\router\index.js`
- Modify: `D:\hosgoo\API-bridge\frontend\src\components\Layout.vue`

- [ ] **Step 1: 新增路由与导航入口**

路由要求：
- 新增 `/reports`
- 名称建议为 `ReportsWorkbench`
- 需要登录认证

导航要求：
- 在 `Layout.vue` 顶部菜单增加“报表中心”
- 选中态与现有菜单保持一致

- [ ] **Step 2: 先写最小页面骨架**

页面应先能渲染出以下区域：
- 筛选栏
- KPI 卡片区
- 趋势图区
- 结构分析区
- 明细区
- 摘要区

- [ ] **Step 3: 接入统一查询状态**

要求：
- 页面初始化加载 `overview`、`trends`、`rankings`、`details`、`summary`
- 所有区域共用同一套筛选条件
- 查询按钮统一刷新所有模块
- 重置按钮恢复默认筛选

- [ ] **Step 4: 接入图表与表格渲染**

要求：
- 趋势图使用统一 chart option 工具
- 结构图与排行表共享数据转换函数
- 明细区支持 tab 切换
- 页面异常和空态与现有风格一致

- [ ] **Step 5: 验证前端构建**

Run: `npm run build`
Workdir: `D:\hosgoo\API-bridge\frontend`
Expected: PASS

- [ ] **Step 6: 提交这一小步**

```bash
git add src/views/ReportsWorkbench.vue src/router/index.js src/components/Layout.vue
git commit -m "feat: add reporting workbench page"
```

---

### Task 6: 收口现有 Dashboard / Monitor / Logs 的统计入口

**Files:**
- Modify: `D:\hosgoo\API-bridge\frontend\src\views\Dashboard.vue`
- Modify: `D:\hosgoo\API-bridge\frontend\src\views\Monitor.vue`
- Modify: `D:\hosgoo\API-bridge\frontend\src\utils\api.js`

- [ ] **Step 1: 精简 `Dashboard` 的统计职责**

目标：
- 保留健康概览与快捷入口
- 增加“进入报表中心”按钮
- 不再继续堆叠完整统计分析模块

- [ ] **Step 2: 让 `Monitor` 逐步复用报表趋势接口**

要求：
- `Monitor` 的趋势图可复用新的 `reports/trends` 数据结构
- 不破坏已有实时监控体验
- 复用通用图表工具时避免引入重复逻辑

- [ ] **Step 3: 保持 `Logs` 作为深查页，但统一明细筛选口径**

要求：
- 筛选字段命名与报表中心一致
- 后续可逐步切换到底层 `reports/details` 接口

- [ ] **Step 4: 跑前端构建与关键回归**

Run:
- `node --test src/views/__tests__/monitor-chart.test.js`
- `node --test src/views/reports/__tests__/reporting-transforms.test.js`
- `npm run build`

Expected: 全部 PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add src/views/Dashboard.vue src/views/Monitor.vue src/utils/api.js
git commit -m "refactor: align existing pages with reporting center"
```

---

### Task 7: 实现结构化摘要

**Files:**
- Create: `D:\hosgoo\API-bridge\reporting\summary.js`
- Test: `D:\hosgoo\API-bridge\tests\reporting\summary.test.js`
- Modify: `D:\hosgoo\API-bridge\server.js`

- [ ] **Step 1: 写失败测试，定义摘要模板输出**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReportSummary } from '../../reporting/summary.js'

test('buildReportSummary会输出结构化摘要段落', () => {
  const summary = buildReportSummary({
    overview: { totalCommands: 120, successRate: 98.2 },
    rankings: { topCommands: [{ label: 'sendCommand', value: 80 }] },
    anomalies: [{ label: '错误率升高', value: '14:00-15:00' }]
  })

  assert.match(summary.headline, /120/)
  assert.equal(summary.highlights.length, 1)
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/reporting/summary.test.js`
Expected: FAIL

- [ ] **Step 3: 实现结构化摘要构造**

要求：
- 不依赖外部 AI 服务
- 输出固定结构：
  - `headline`
  - `highlights`
  - `anomalies`
  - `recommendations`
- 规则基于 overview、trend、ranking 和异常口径推断

- [ ] **Step 4: 接入 `/api/admin/reports/summary`**

返回示例：

```json
{
  "success": true,
  "data": {
    "headline": "近7天指令总量 120 次，成功率 98.2%",
    "highlights": ["sendCommand 占比最高"],
    "anomalies": ["14:00-15:00 错误率明显升高"],
    "recommendations": ["建议排查该时段失败指令日志"]
  }
}
```

- [ ] **Step 5: 跑测试**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: 提交这一小步**

```bash
git add reporting/summary.js tests/reporting/summary.test.js server.js
git commit -m "feat: add reporting summary generation"
```

---

### Task 8: 实现导出能力

**Files:**
- Create: `D:\hosgoo\API-bridge\reporting\export.js`
- Modify: `D:\hosgoo\API-bridge\server.js`
- Modify: `D:\hosgoo\API-bridge\frontend\src\views\ReportsWorkbench.vue`

- [ ] **Step 1: 先实现 CSV 导出**

要求：
- 输入：统一 `ReportQuery`
- 输出：`text/csv`
- 字段与当前明细表保持一致
- 文件名包含日期范围和报表类型

- [ ] **Step 2: 再扩展 Excel 导出**

建议：
- 优先使用项目已有依赖方案；如果需要引入新依赖，先最小化接入
- 保持与 CSV 一致的列头和筛选上下文

- [ ] **Step 3: 在前端接入导出按钮**

要求：
- Excel / CSV 两个导出入口
- 导出时携带当前筛选条件
- 展示导出中的加载态与失败提示

- [ ] **Step 4: 手动验证导出**

Run:
- 启动后端与前端
- 在报表中心选择任意时间范围
- 触发 CSV 导出
- 触发 Excel 导出

Expected:
- 文件成功下载
- 数据列与页面明细一致

- [ ] **Step 5: 提交这一小步**

```bash
git add reporting/export.js server.js src/views/ReportsWorkbench.vue
git commit -m "feat: add reporting export support"
```

---

### Task 9: 文档与最终回归

**Files:**
- Modify: `D:\hosgoo\API-bridge\docs\HTTP_API.md`
- Modify: `D:\hosgoo\API-bridge\README.md`

- [ ] **Step 1: 更新使用说明**

补充：
- 报表中心入口说明
- 主要筛选能力
- 新增接口说明
- 导出与摘要说明

- [ ] **Step 2: 运行完整回归**

Run:
- `npm test`
- `node --test frontend/src/views/__tests__/monitor-chart.test.js`
- `node --test frontend/src/views/reports/__tests__/reporting-transforms.test.js`
- `npm run build`

Expected: 全部 PASS

- [ ] **Step 3: 手动验收**

检查项：
- 顶部导航可进入报表中心
- 全局筛选能联动所有模块
- 概览、趋势、结构、明细、摘要都能显示数据
- 导出文件与当前筛选一致
- `Dashboard` / `Monitor` / `Logs` 功能未回退

- [ ] **Step 4: 最终提交**

```bash
git add docs/HTTP_API.md README.md
git commit -m "docs: document reporting center"
```


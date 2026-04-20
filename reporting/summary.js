import { getOverviewReport, getRankingReport, getTrendReport } from './service.js'

export function buildReportSummary({ overview, rankings, anomalies = [] }) {
  const totalCommands = overview.totalCommands ?? 0
  const successRate = overview.successRate ?? 0
  const topCommand = rankings.topCommands?.[0]?.label

  return {
    headline: `当前周期指令总量 ${totalCommands} 次，成功率 ${successRate}%`,
    highlights: topCommand ? [`${topCommand} 为当前最高频指令`] : [],
    anomalies: anomalies.map(item => `${item.label}: ${item.value}`),
    recommendations: anomalies.length > 0 ? ['建议优先排查异常时段相关日志与系统负载'] : ['当前未发现明显异常，可继续观察趋势变化']
  }
}

export function getSummaryReport(rawQuery = {}) {
  const overview = getOverviewReport(rawQuery).stats
  const rankings = {
    topCommands: getRankingReport(rawQuery, 'topCommands').items
  }
  const errorTrend = getTrendReport(rawQuery, 'errorRate')
  const peakErrorPoint = [...errorTrend.points].sort((left, right) => right.value - left.value)[0]
  const anomalies = peakErrorPoint && peakErrorPoint.value > 0
    ? [{ label: '错误率峰值', value: `${peakErrorPoint.time} (${peakErrorPoint.value}%)` }]
    : []

  return buildReportSummary({ overview, rankings, anomalies })
}

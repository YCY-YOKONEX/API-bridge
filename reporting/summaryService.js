import { buildReportSummary } from './summary.js'
import { getOverviewReport, getRankingReport, getTrendReport } from './service.js'

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

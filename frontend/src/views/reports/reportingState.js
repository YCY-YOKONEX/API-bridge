export const defaultReportFilters = {
  presetRange: 'today',
  granularity: 'hour',
  metric: 'messageCount',
  rankingMetric: 'topCommands',
  distributionMetric: 'commandStatus',
  detailType: 'commands',
  userId: '',
  commandStatus: 'all',
  startTime: null,
  endTime: null,
  page: 1,
  pageSize: 20
}

export function createReportFilters() {
  return { ...defaultReportFilters }
}

export function serializeReportFilters(filters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== null && value !== undefined && value !== '')
  )
}

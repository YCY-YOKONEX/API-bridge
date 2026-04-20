export function buildOverviewCards(stats) {
  return [
    { metric: 'onlineUsers', label: '在线用户', value: stats.onlineUsers ?? 0, unit: '人' },
    { metric: 'activeUsers', label: '活跃用户', value: stats.activeUsers ?? 0, unit: '人' },
    { metric: 'totalCommands', label: '指令量', value: stats.totalCommands ?? 0, unit: '次' },
    { metric: 'successRate', label: '成功率', value: stats.successRate ?? 0, unit: '%' }
  ]
}

export function buildTrendSeries(metric, points, granularity) {
  return {
    metric,
    granularity,
    points
  }
}

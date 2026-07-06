export function buildOverviewCards(stats) {
  return [
    { metric: 'onlineUsers', label: '在线用户', value: stats.onlineUsers ?? 0, unit: '人' },
    { metric: 'activeUsers', label: '活跃用户', value: stats.activeUsers ?? 0, unit: '人' },
    { metric: 'totalCommands', label: '指令量', value: stats.totalCommands ?? 0, unit: '次' },
    { metric: 'successRate', label: '成功率', value: stats.successRate ?? 0, unit: '%' },
    { metric: 'failedCommands', label: '失败指令', value: stats.failedCommands ?? 0, unit: '次' },
    { metric: 'errorRate', label: '错误率', value: stats.errorRate ?? 0, unit: '%' },
    { metric: 'avgResponseTime', label: '平均耗时', value: stats.avgResponseTime ?? 0, unit: 'ms' },
    { metric: 'p95ResponseTime', label: 'P95耗时', value: stats.p95ResponseTime ?? 0, unit: 'ms' },
    { metric: 'slowCommands', label: '慢指令', value: stats.slowCommands ?? 0, unit: '次' },
    { metric: 'loginFailures', label: '登录失败', value: stats.loginFailures ?? 0, unit: '次' }
  ]
}

export function buildTrendSeries(metric, points, granularity) {
  return {
    metric,
    granularity,
    points
  }
}

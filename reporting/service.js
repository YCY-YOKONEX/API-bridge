import {
  getConnectionLogs,
  getCommandLogs,
  getReportOverviewStats,
  getReportTrendPoints
} from '../database.js'
import { buildOverviewCards, buildTrendSeries } from './metrics.js'
import { normalizeReportQuery } from './query.js'

export function getOverviewReport(rawQuery = {}) {
  const query = normalizeReportQuery(rawQuery)
  const stats = getReportOverviewStats(query)

  return {
    query,
    cards: buildOverviewCards(stats),
    stats
  }
}

export function getTrendReport(rawQuery = {}, metric = 'messageCount') {
  const query = normalizeReportQuery(rawQuery)
  const points = getReportTrendPoints(query, metric)

  return buildTrendSeries(metric, points, query.granularity)
}

export function getDistributionReport(rawQuery = {}, metric = 'commandStatus') {
  const query = normalizeReportQuery(rawQuery)
  const commandLogs = getCommandLogs({
    userId: query.userId || null,
    status: query.commandStatus !== 'all' ? query.commandStatus : null,
    startTime: query.startTime ? new Date(query.startTime).getTime() : null,
    endTime: query.endTime ? new Date(query.endTime).getTime() : null,
    limit: 500,
    offset: 0
  })

  const bucketMap = new Map()
  const logs = commandLogs.success ? commandLogs.data.logs : []

  for (const log of logs) {
    const key = metric === 'commandId' ? log.command_id : log.status
    bucketMap.set(key, (bucketMap.get(key) || 0) + 1)
  }

  const total = logs.length || 1
  const items = Array.from(bucketMap.entries()).map(([key, value]) => ({
    key,
    label: key,
    value,
    ratio: Number(((value / total) * 100).toFixed(2))
  }))

  return {
    metric,
    dimension: metric,
    items
  }
}

export function getRankingReport(rawQuery = {}, metric = 'topCommands') {
  const query = normalizeReportQuery(rawQuery)
  const commandLogs = getCommandLogs({
    userId: query.userId || null,
    status: query.commandStatus !== 'all' ? query.commandStatus : null,
    startTime: query.startTime ? new Date(query.startTime).getTime() : null,
    endTime: query.endTime ? new Date(query.endTime).getTime() : null,
    limit: 1000,
    offset: 0
  })
  const connectionLogs = getConnectionLogs({
    userId: query.userId || null,
    startTime: query.startTime ? new Date(query.startTime).getTime() : null,
    endTime: query.endTime ? new Date(query.endTime).getTime() : null,
    limit: 1000,
    offset: 0
  })

  const source = metric === 'topUsers'
    ? (connectionLogs.success ? connectionLogs.data.logs : [])
    : (commandLogs.success ? commandLogs.data.logs : [])
  const keySelector = metric === 'topUsers'
    ? (item) => item.user_id
    : (item) => item.command_id

  const rankingMap = new Map()
  for (const item of source) {
    const key = keySelector(item)
    rankingMap.set(key, (rankingMap.get(key) || 0) + 1)
  }

  const items = Array.from(rankingMap.entries())
    .map(([key, value]) => ({ key, label: key, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 10)

  return {
    metric,
    items
  }
}

export function getDetailReport(rawQuery = {}, type = 'commands') {
  const query = normalizeReportQuery(rawQuery)
  const startTime = query.startTime ? new Date(query.startTime).getTime() : null
  const endTime = query.endTime ? new Date(query.endTime).getTime() : null
  const limit = query.pageSize
  const offset = (query.page - 1) * query.pageSize

  if (type === 'connections') {
    const result = getConnectionLogs({
      userId: query.userId || null,
      startTime,
      endTime,
      limit,
      offset
    })

    return {
      type,
      columns: ['user_id', 'uid', 'action', 'status', 'message', 'created_at'],
      rows: result.success ? result.data.logs : [],
      pagination: result.success ? {
        total: result.data.total,
        page: query.page,
        pageSize: query.pageSize
      } : { total: 0, page: 1, pageSize: query.pageSize }
    }
  }

  const result = getCommandLogs({
    userId: query.userId || null,
    status: query.commandStatus !== 'all' ? query.commandStatus : null,
    startTime,
    endTime,
    limit,
    offset
  })

  return {
    type,
    columns: ['user_id', 'command_id', 'status', 'message', 'response_time', 'created_at'],
    rows: result.success ? result.data.logs : [],
    pagination: result.success ? {
      total: result.data.total,
      page: query.page,
      pageSize: query.pageSize
    } : { total: 0, page: 1, pageSize: query.pageSize }
  }
}

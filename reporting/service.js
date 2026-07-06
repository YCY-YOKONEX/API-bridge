import {
  getConnectionUserRanking,
  getConnectionLogs,
  getCommandLogs,
  getCommandRanking,
  getReportOverviewStats,
  getReportTrendPoints
} from '../database.js'
import { buildOverviewCards, buildTrendSeries } from './metrics.js'
import { normalizeReportQuery } from './query.js'

function getQueryTimeRange(query) {
  return {
    startTime: query.windowStart ?? null,
    endTime: query.windowEnd ?? null
  }
}

function getResponseTimeBucket(responseTime) {
  if (!Number.isFinite(responseTime)) {
    return null
  }

  if (responseTime <= 100) {
    return '0-100ms'
  }

  if (responseTime <= 500) {
    return '101-500ms'
  }

  if (responseTime <= 1000) {
    return '501-1000ms'
  }

  return '1000ms以上'
}

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
  const { startTime, endTime } = getQueryTimeRange(query)
  const commandLogs = getCommandLogs({
    userId: query.userId || null,
    status: query.commandStatus !== 'all' ? query.commandStatus : null,
    startTime,
    endTime,
    limit: 500,
    offset: 0
  })

  const bucketMap = new Map()
  const logs = commandLogs.success ? commandLogs.data.logs : []

  for (const log of logs) {
    const key = metric === 'commandId'
      ? log.command_id
      : metric === 'responseTimeBucket'
        ? getResponseTimeBucket(log.response_time)
        : log.status
    if (!key) {
      continue
    }

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
  const { startTime, endTime } = getQueryTimeRange(query)
  const result = metric === 'topUsers'
    ? getConnectionUserRanking({
      userId: query.userId || null,
      startTime,
      endTime,
      limit: 10
    })
    : getCommandRanking({
      userId: query.userId || null,
      status: metric === 'topFailedCommands'
        ? 'failed'
        : query.commandStatus !== 'all'
          ? query.commandStatus
          : null,
      startTime,
      endTime,
      limit: 10
    })

  return {
    metric,
    items: result.success ? result.data.items : []
  }
}

export function getDetailReport(rawQuery = {}, type = 'commands') {
  const query = normalizeReportQuery(rawQuery)
  const { startTime, endTime } = getQueryTimeRange(query)
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

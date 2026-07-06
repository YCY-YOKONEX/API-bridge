const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 200

function toTimestamp(value) {
  if (!value) {
    return null
  }

  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function getPresetRangeWindow(presetRange = 'today') {
  const now = Date.now()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  switch (presetRange) {
    case 'last7days':
      return {
        startTime: now - (7 * 24 * 60 * 60 * 1000),
        endTime: now
      }
    case 'last30days':
      return {
        startTime: now - (30 * 24 * 60 * 60 * 1000),
        endTime: now
      }
    case 'thisMonth': {
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)
      return {
        startTime: monthStart.getTime(),
        endTime: now
      }
    }
    case 'today':
    default:
      return {
        startTime: todayStart.getTime(),
        endTime: now
      }
  }
}

export function resolveReportTimeRange(input = {}) {
  const customStart = toTimestamp(input.startTime)
  const customEnd = toTimestamp(input.endTime)

  if (customStart && customEnd && customEnd >= customStart) {
    return {
      startTime: customStart,
      endTime: customEnd
    }
  }

  return getPresetRangeWindow(input.presetRange)
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }

  return parsed
}

function toNumber(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function normalizeReportQuery(input = {}) {
  const page = toPositiveInt(input.page, DEFAULT_PAGE)
  const requestedPageSize = toPositiveInt(input.pageSize, DEFAULT_PAGE_SIZE)
  const pageSize = Math.min(MAX_PAGE_SIZE, requestedPageSize)
  const timeRange = resolveReportTimeRange(input)

  return {
    presetRange: input.presetRange || 'today',
    startTime: input.startTime || null,
    endTime: input.endTime || null,
    // 报表明细、排行和导出统一使用毫秒窗口，避免预设时间只对部分接口生效。
    windowStart: timeRange.startTime,
    windowEnd: timeRange.endTime,
    granularity: input.granularity || 'hour',
    userId: input.userId || '',
    onlineStatus: input.onlineStatus || 'all',
    userSegment: input.userSegment || 'all',
    commandType: input.commandType || 'all',
    commandStatus: input.commandStatus || 'all',
    errorType: input.errorType || 'all',
    latencyMin: toNumber(input.latencyMin),
    latencyMax: toNumber(input.latencyMax),
    cpuMin: toNumber(input.cpuMin),
    cpuMax: toNumber(input.cpuMax),
    memoryMin: toNumber(input.memoryMin),
    memoryMax: toNumber(input.memoryMax),
    diskMin: toNumber(input.diskMin),
    diskMax: toNumber(input.diskMax),
    page,
    pageSize,
    sortField: input.sortField || 'created_at',
    sortOrder: input.sortOrder === 'ascend' || input.sortOrder === 'asc' ? 'asc' : 'desc'
  }
}

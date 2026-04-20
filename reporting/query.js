const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 200

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

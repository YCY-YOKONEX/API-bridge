import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeReportQuery } from '../../reporting/query.js'

test('normalizeReportQuery会补全默认时间范围和粒度', () => {
  const query = normalizeReportQuery({})

  assert.equal(query.presetRange, 'today')
  assert.equal(query.granularity, 'hour')
  assert.equal(query.page, 1)
  assert.equal(query.pageSize, 20)
})

test('normalizeReportQuery会解析自定义时间并限制非法范围', () => {
  const query = normalizeReportQuery({
    startTime: '2026-04-01T00:00:00.000Z',
    endTime: '2026-04-07T00:00:00.000Z',
    page: '0',
    pageSize: '5000',
    sortOrder: 'ascend'
  })

  assert.equal(query.startTime, '2026-04-01T00:00:00.000Z')
  assert.equal(query.endTime, '2026-04-07T00:00:00.000Z')
  assert.equal(query.windowStart, new Date('2026-04-01T00:00:00.000Z').getTime())
  assert.equal(query.windowEnd, new Date('2026-04-07T00:00:00.000Z').getTime())
  assert.equal(query.page, 1)
  assert.equal(query.pageSize, 200)
  assert.equal(query.sortOrder, 'asc')
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOverviewCards, buildTrendSeries } from '../../reporting/metrics.js'

test('buildOverviewCards会返回统一KPI结构', () => {
  const cards = buildOverviewCards({
    onlineUsers: 5,
    activeUsers: 8,
    totalCommands: 30,
    successRate: 96.6
  })

  assert.equal(cards[0].metric, 'onlineUsers')
  assert.equal(cards[0].label, '在线用户')
  assert.equal(cards[2].value, 30)
  assert.equal(cards[3].unit, '%')
})

test('buildTrendSeries会输出ECharts友好的点位数组', () => {
  const series = buildTrendSeries(
    'messageCount',
    [
      { time: '04-01 10:00', value: 12 },
      { time: '04-01 11:00', value: 20 }
    ],
    'hour'
  )

  assert.equal(series.metric, 'messageCount')
  assert.equal(series.granularity, 'hour')
  assert.equal(series.points.length, 2)
  assert.deepEqual(series.points[1], { time: '04-01 11:00', value: 20 })
})

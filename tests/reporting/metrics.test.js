import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOverviewCards, buildTrendSeries } from '../../reporting/metrics.js'

test('buildOverviewCards会返回统一KPI结构', () => {
  const cards = buildOverviewCards({
    onlineUsers: 5,
    activeUsers: 8,
    totalCommands: 30,
    successRate: 96.6,
    failedCommands: 3,
    errorRate: 10,
    avgResponseTime: 52,
    p95ResponseTime: 120,
    slowCommands: 1,
    loginFailures: 2
  })

  assert.equal(cards[0].metric, 'onlineUsers')
  assert.equal(cards[0].label, '在线用户')
  assert.equal(cards[2].value, 30)
  assert.equal(cards[3].unit, '%')
  assert.equal(cards.find(card => card.metric === 'failedCommands').value, 3)
  assert.equal(cards.find(card => card.metric === 'p95ResponseTime').unit, 'ms')
  assert.equal(cards.find(card => card.metric === 'loginFailures').value, 2)
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

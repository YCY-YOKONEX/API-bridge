import test from 'node:test'
import assert from 'node:assert/strict'
import { toLineSeriesOption, toRankingRows } from '../reportingTransforms.js'

test('toLineSeriesOption会把趋势点转成折线图配置', () => {
  const option = toLineSeriesOption({
    metric: 'messageCount',
    points: [{ time: '10:00', value: 12 }]
  })

  assert.deepEqual(option.xAxis.data, ['10:00'])
  assert.deepEqual(option.series[0].data, [12])
})

test('toRankingRows会补全排行表key', () => {
  const rows = toRankingRows([{ label: 'sendCommand', value: 20 }])

  assert.equal(rows[0].key, 'sendCommand')
  assert.equal(rows[0].rank, 1)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReportSummary } from '../../reporting/summary.js'

test('buildReportSummary会输出结构化摘要段落', () => {
  const summary = buildReportSummary({
    overview: { totalCommands: 120, successRate: 98.2 },
    rankings: { topCommands: [{ label: 'sendCommand', value: 80 }] },
    anomalies: [{ label: '错误率升高', value: '14:00-15:00' }]
  })

  assert.match(summary.headline, /120/)
  assert.equal(summary.highlights.length, 1)
  assert.equal(summary.anomalies[0], '错误率升高: 14:00-15:00')
  assert.equal(summary.recommendations.length, 1)
})

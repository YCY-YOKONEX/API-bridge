import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTrafficChartOption, syncTrafficChart } from '../monitorChart.js'

test('syncTrafficChart会在容器后出现时初始化图表并写入数据', () => {
  const setOptionCalls = []
  const resizeCalls = []
  const fakeChart = {
    setOption(option, replace) {
      setOptionCalls.push({ option, replace })
    },
    resize() {
      resizeCalls.push(true)
    }
  }
  const fakeEcharts = {
    init(container) {
      assert.equal(container.id, 'traffic-chart')
      return fakeChart
    }
  }

  const chart = syncTrafficChart({
    chart: null,
    container: { id: 'traffic-chart' },
    echartsLib: fakeEcharts,
    trafficTrend: [{ time: '00:00', count: 12 }],
    range: 'day',
    maxMessageCount: 100
  })

  assert.equal(chart, fakeChart)
  assert.equal(setOptionCalls.length, 1)
  assert.equal(setOptionCalls[0].replace, true)
  assert.deepEqual(setOptionCalls[0].option.xAxis.data, ['00:00'])
  assert.deepEqual(setOptionCalls[0].option.series[0].data, [12])
  assert.equal(resizeCalls.length, 1)
})

test('buildTrafficChartOption会根据时间范围生成合适的横轴标签间隔', () => {
  const option = buildTrafficChartOption(
    [
      { time: '00:00', count: 10 },
      { time: '01:00', count: 20 }
    ],
    'week',
    100
  )

  assert.equal(option.xAxis.axisLabel.interval, 5)
  assert.equal(option.series[0].itemStyle.color({ value: 80 }), '#ff4d4f')
  assert.equal(option.series[0].itemStyle.color({ value: 50 }), '#1890ff')
})

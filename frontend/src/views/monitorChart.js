export function getTrafficAxisInterval(range) {
  if (range === 'day') return 2
  if (range === 'week') return 5
  if (range === 'month') return 4
  return 3
}

export function buildTrafficChartOption(trafficTrend, range, maxMessageCount) {
  const times = trafficTrend.map(item => item.time)
  const counts = trafficTrend.map(item => item.count)

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter(params) {
        return `${params[0].name}<br/>消息数: ${params[0].value} 条`
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '5%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: times,
      axisLabel: {
        interval: getTrafficAxisInterval(range),
        rotate: 0,
        fontSize: 10
      }
    },
    yAxis: {
      type: 'value',
      name: '消息数'
    },
    series: [{
      name: '消息数',
      type: 'bar',
      data: counts,
      itemStyle: {
        color(params) {
          return params.value > maxMessageCount * 0.7 ? '#ff4d4f' : '#1890ff'
        }
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }]
  }
}

export function syncTrafficChart({
  chart,
  container,
  echartsLib,
  trafficTrend,
  range,
  maxMessageCount
}) {
  if (!container || !trafficTrend.length) {
    return chart
  }

  const currentChart = chart || echartsLib.init(container)
  currentChart.setOption(buildTrafficChartOption(trafficTrend, range, maxMessageCount), true)
  currentChart.resize()

  return currentChart
}

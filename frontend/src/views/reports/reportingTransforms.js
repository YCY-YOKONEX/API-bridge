export function toOverviewCards(report) {
  return report?.cards || []
}

export function toLineSeriesOption(series) {
  const points = series?.points || []

  return {
    tooltip: {
      trigger: 'axis'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: points.map(point => point.time)
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        type: 'line',
        smooth: true,
        data: points.map(point => point.value),
        areaStyle: {
          opacity: 0.12
        }
      }
    ]
  }
}

export function toDistributionOption(report) {
  const items = report?.items || []

  return {
    tooltip: {
      trigger: 'item'
    },
    series: [
      {
        type: 'pie',
        radius: ['42%', '68%'],
        data: items.map(item => ({
          name: item.label,
          value: item.value
        }))
      }
    ]
  }
}

export function toRankingRows(items = []) {
  return items.map((item, index) => ({
    key: item.key || item.label || String(index),
    rank: index + 1,
    label: item.label,
    value: item.value
  }))
}

export function toDetailRows(report) {
  return report?.rows || []
}

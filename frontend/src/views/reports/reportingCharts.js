import { toDistributionOption, toLineSeriesOption } from './reportingTransforms.js'

export function buildTrendChartOption(series) {
  return toLineSeriesOption(series)
}

export function buildDistributionChartOption(report) {
  return toDistributionOption(report)
}

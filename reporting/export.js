import { getDetailReport } from './service.js'

function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return ''
  }

  const stringValue = String(value).replace(/"/g, '""')
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue}"`
  }

  return stringValue
}

export function buildCsvExport(rawQuery = {}, type = 'commands') {
  const detail = getDetailReport(rawQuery, type)
  const header = detail.columns.join(',')
  const rows = detail.rows.map(row => detail.columns.map(column => escapeCsvValue(row[column])).join(','))

  return {
    filename: `report-${type}-${Date.now()}.csv`,
    contentType: 'text/csv; charset=utf-8',
    body: [header, ...rows].join('\n')
  }
}

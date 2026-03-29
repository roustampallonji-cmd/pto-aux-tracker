import * as XLSX from 'xlsx';
import { AUX_DIAGNOSTICS } from '../api/diagnostics';
import { fmtDateTime } from './formatters';

// Build export rows for a list of asset results
function buildRows(assetResults, deviceMap, deviceDataMap) {
  return assetResults.map((r) => {
    const device = deviceMap[r.deviceId] || {};
    const deviceData = deviceDataMap[r.deviceId] || {};
    const labels = deviceData.labels || {};

    const row = {
      'Device ID': r.deviceId,
      'Device Name': device.name || r.deviceId,
      'Serial Number': device.serialNumber || '',
      'Communication': r.isDeviceCommunicating ? 'Communicating' : 'Offline',
      'Last Seen': r.lastCommunication ? fmtDateTime(r.lastCommunication) : '—',
    };

    for (const { key, label } of AUX_DIAGNOSTICS) {
      const displayLabel = labels[key] ? `${label} — ${labels[key]}` : label;
      const baseline = r.baselines?.[key] ?? 0;
      const duration = r.hours?.[key] ?? 0;
      const total = baseline + duration;
      row[`${displayLabel} Baseline (hrs)`] = baseline || '';
      row[`${displayLabel} Duration (hrs)`] = duration != null ? +duration.toFixed(2) : '';
      row[`${displayLabel} Total (hrs)`] = total ? +total.toFixed(2) : '';
    }

    return row;
  });
}

export function exportToExcel(assetResults, deviceMap, deviceDataMap, dateRange, mode = 'view') {
  const rows = buildRows(assetResults, deviceMap, deviceDataMap);
  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto column widths
  const colWidths = Object.keys(rows[0] || {}).map((k) => ({
    wch: Math.max(k.length, 14),
  }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PTO AUX Hours');

  const from = dateRange.from.toLocaleDateString();
  const to = dateRange.to.toLocaleDateString();
  const filename = `PTO-AUX-${mode === 'all' ? 'All' : 'Selected'}-${from}-to-${to}.xlsx`;
  XLSX.writeFile(wb, filename);
}

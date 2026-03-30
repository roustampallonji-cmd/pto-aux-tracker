import * as XLSX from 'xlsx-js-style';
import { AUX_DIAGNOSTICS } from '../api/diagnostics';
import { fmtDateTime } from './formatters';

// ── Helpers ───────────────────────────────────────────────────────────────────

function thin(rgb = 'D0D7E0') { return { style: 'thin', color: { rgb } }; }
function border(rgb = 'D0D7E0') { return { top: thin(rgb), bottom: thin(rgb), left: thin(rgb), right: thin(rgb) }; }
function fill(rgb) { return { patternType: 'solid', fgColor: { rgb } }; }

function cell(ws, r, c, value, style, type) {
  ws[XLSX.utils.encode_cell({ r, c })] = { v: value, t: type || (typeof value === 'number' ? 'n' : 's'), s: style };
}

// ── Colour palette ────────────────────────────────────────────────────────────

const NAVY   = '1F4E79';
const BLUE   = '2E75B6';
const TEAL   = '1A8A72';
const GREY   = '4A5568';
const WHITE  = 'FFFFFF';

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  title: {
    font: { bold: true, sz: 14, color: { rgb: WHITE } },
    fill: fill(NAVY),
    alignment: { horizontal: 'left', vertical: 'center' },
  },
  meta: {
    font: { sz: 9, italic: true, color: { rgb: '5A6A7A' } },
    fill: fill('EDF2F7'),
    alignment: { horizontal: 'left', vertical: 'center' },
  },
  hInfo: {
    font: { bold: true, sz: 10, color: { rgb: WHITE } },
    fill: fill(BLUE),
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: border(),
  },
  hBaseline: {
    font: { bold: true, sz: 10, color: { rgb: WHITE } },
    fill: fill(TEAL),
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: border(),
  },
  hDuration: {
    font: { bold: true, sz: 10, color: { rgb: WHITE } },
    fill: fill('2980B9'),
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: border(),
  },
  hTotal: {
    font: { bold: true, sz: 10, color: { rgb: WHITE } },
    fill: fill(NAVY),
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: border(),
  },
  dInfo: (alt) => ({
    font: { sz: 10, color: { rgb: '2D3748' } },
    fill: fill(alt ? 'DDE3EC' : 'EBF0F7'),
    alignment: { horizontal: 'left', vertical: 'center' },
    border: border('D0D7E0'),
  }),
  dNum: (alt) => ({
    font: { sz: 10, color: { rgb: GREY } },
    fill: fill(alt ? 'F7FAFD' : WHITE),
    alignment: { horizontal: 'right', vertical: 'center' },
    border: border('D0D7E0'),
    numFmt: '#,##0.00',
  }),
  dTotal: (alt) => ({
    font: { bold: true, sz: 10, color: { rgb: NAVY } },
    fill: fill(alt ? 'C5D8EE' : 'DDEEFF'),
    alignment: { horizontal: 'right', vertical: 'center' },
    border: border('AABFD4'),
    numFmt: '#,##0.00',
  }),
};

// ── Export ────────────────────────────────────────────────────────────────────

export function exportToExcel(assetResults, deviceMap, deviceDataMap, dateRange, mode = 'view') {
  const TITLE_R = 0, META_R = 1, HEAD_R = 2, DATA_R = 3;

  const infoCols = ['Device Name', 'Serial Number', 'Communication', 'Last Seen'];
  const auxColDefs = AUX_DIAGNOSTICS.flatMap(({ label }) => [
    { header: `${label} — Baseline (hrs)`, type: 'baseline' },
    { header: `${label} — Duration (hrs)`, type: 'duration' },
    { header: `${label} — Total (hrs)`,    type: 'total' },
  ]);

  const allCols = [
    ...infoCols.map(h => ({ header: h, type: 'info' })),
    ...auxColDefs,
  ];
  const numCols = allCols.length;
  const numRows = DATA_R + assetResults.length;

  const ws = {};
  const merges = [];

  // Title row
  const label = mode === 'all' ? 'All Assets' : 'Selected Assets';
  cell(ws, TITLE_R, 0, `PTO AUX Hours Tracker — ${label}`, S.title);
  for (let c = 1; c < numCols; c++) cell(ws, TITLE_R, c, '', S.title);
  merges.push({ s: { r: TITLE_R, c: 0 }, e: { r: TITLE_R, c: numCols - 1 } });

  // Meta row
  const from = dateRange.from.toLocaleDateString();
  const to   = dateRange.to.toLocaleDateString();
  const meta = `Date Range: ${from} — ${to}     |     Generated: ${new Date().toLocaleString()}     |     ${assetResults.length} asset${assetResults.length !== 1 ? 's' : ''}`;
  cell(ws, META_R, 0, meta, S.meta);
  for (let c = 1; c < numCols; c++) cell(ws, META_R, c, '', S.meta);
  merges.push({ s: { r: META_R, c: 0 }, e: { r: META_R, c: numCols - 1 } });

  // Header row
  allCols.forEach(({ header, type }, c) => {
    const s = type === 'info' ? S.hInfo : type === 'baseline' ? S.hBaseline : type === 'duration' ? S.hDuration : S.hTotal;
    cell(ws, HEAD_R, c, header, s);
  });

  // Data rows
  assetResults.forEach((r, ri) => {
    const device     = deviceMap[r.deviceId] || {};
    const deviceData = deviceDataMap[r.deviceId] || {};
    const alt        = ri % 2 === 1;
    const row        = DATA_R + ri;

    const infoVals = [
      device.name || r.deviceId,
      device.serialNumber || '',
      r.isDeviceCommunicating ? 'Communicating' : 'Offline',
      r.lastCommunication ? fmtDateTime(r.lastCommunication) : '—',
    ];
    infoVals.forEach((v, c) => cell(ws, row, c, v, S.dInfo(alt)));

    let c = infoCols.length;
    for (const { key } of AUX_DIAGNOSTICS) {
      const baseline = r.baselines?.[key] ?? 0;
      const duration = r.hours?.[key] != null ? +r.hours[key].toFixed(4) : 0;
      const total    = +(baseline + duration).toFixed(4);

      cell(ws, row, c++, baseline, S.dNum(alt), 'n');
      cell(ws, row, c++, duration, S.dNum(alt), 'n');
      cell(ws, row, c++, total,    S.dTotal(alt), 'n');
    }
  });

  ws['!ref']    = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: numRows - 1, c: numCols - 1 } });
  ws['!merges'] = merges;
  ws['!cols']   = [
    { wch: 26 }, { wch: 16 }, { wch: 16 }, { wch: 22 },
    ...AUX_DIAGNOSTICS.flatMap(() => [{ wch: 22 }, { wch: 22 }, { wch: 20 }]),
  ];
  ws['!rows'] = [
    { hpt: 28 },
    { hpt: 16 },
    { hpt: 42 },
    ...assetResults.map(() => ({ hpt: 20 })),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PTO AUX Hours');

  const fromStr = dateRange.from.toLocaleDateString('en-CA');
  const toStr   = dateRange.to.toLocaleDateString('en-CA');
  XLSX.writeFile(wb, `PTO-AUX-${mode === 'all' ? 'All' : 'Selected'}-${fromStr}-to-${toStr}.xlsx`);
}

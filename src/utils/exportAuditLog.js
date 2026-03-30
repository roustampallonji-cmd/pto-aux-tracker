import * as XLSX from 'xlsx-js-style';

function thin(rgb = 'D0D7E0') { return { style: 'thin', color: { rgb } }; }
function border() { return { top: thin(), bottom: thin(), left: thin(), right: thin() }; }
function fill(rgb) { return { patternType: 'solid', fgColor: { rgb } }; }
function cell(ws, r, c, value, style, type) {
  ws[XLSX.utils.encode_cell({ r, c })] = { v: value, t: type || (typeof value === 'number' ? 'n' : 's'), s: style };
}

const NAVY = '1F4E79';
const WHITE = 'FFFFFF';

const S = {
  title: { font: { bold: true, sz: 13, color: { rgb: WHITE } }, fill: fill(NAVY), alignment: { horizontal: 'left', vertical: 'center' } },
  meta:  { font: { sz: 9, italic: true, color: { rgb: '5A6A7A' } }, fill: fill('EDF2F7'), alignment: { horizontal: 'left' } },
  hdr:   { font: { bold: true, sz: 10, color: { rgb: WHITE } }, fill: fill('2E75B6'), alignment: { horizontal: 'center', wrapText: true }, border: border() },
  dStr:  (alt) => ({ font: { sz: 10, color: { rgb: '2D3748' } }, fill: fill(alt ? 'DDE3EC' : 'EBF0F7'), border: border(), alignment: { horizontal: 'left' } }),
  dNum:  (alt) => ({ font: { bold: true, sz: 10, color: { rgb: NAVY } }, fill: fill(alt ? 'C5D8EE' : 'DDEEFF'), border: border(), alignment: { horizontal: 'right' }, numFmt: '#,##0.00' }),
};

const HEADERS = ['Date / Time', 'User', 'Asset', 'AUX Channel', 'Value (hrs)', 'Comment'];
const WIDTHS   = [{ wch: 22 }, { wch: 28 }, { wch: 24 }, { wch: 26 }, { wch: 14 }, { wch: 50 }];

export function exportAuditLog(rows, auxLabelFn) {
  const TITLE_R = 0, META_R = 1, HEAD_R = 2, DATA_R = 3;
  const numCols = HEADERS.length;
  const ws = {};
  const merges = [];

  cell(ws, TITLE_R, 0, 'PTO AUX Hours — Baseline Audit Log', S.title);
  for (let c = 1; c < numCols; c++) cell(ws, TITLE_R, c, '', S.title);
  merges.push({ s: { r: TITLE_R, c: 0 }, e: { r: TITLE_R, c: numCols - 1 } });

  const meta = `Exported: ${new Date().toLocaleString()}     |     ${rows.length} record${rows.length !== 1 ? 's' : ''}`;
  cell(ws, META_R, 0, meta, S.meta);
  for (let c = 1; c < numCols; c++) cell(ws, META_R, c, '', S.meta);
  merges.push({ s: { r: META_R, c: 0 }, e: { r: META_R, c: numCols - 1 } });

  HEADERS.forEach((h, c) => cell(ws, HEAD_R, c, h, S.hdr));

  rows.forEach((r, ri) => {
    const alt = ri % 2 === 1;
    const row = DATA_R + ri;
    const ts = r.timestamp ? new Date(r.timestamp).toLocaleString() : '—';
    cell(ws, row, 0, ts, S.dStr(alt));
    cell(ws, row, 1, r.user || '—', S.dStr(alt));
    cell(ws, row, 2, r.deviceName || r.deviceId, S.dStr(alt));
    cell(ws, row, 3, auxLabelFn(r.deviceId, r.auxKey), S.dStr(alt));
    cell(ws, row, 4, typeof r.value === 'number' ? +r.value.toFixed(4) : 0, S.dNum(alt), 'n');
    cell(ws, row, 5, r.comment || '', S.dStr(alt));
  });

  const numRows = DATA_R + rows.length;
  ws['!ref']    = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: numRows - 1, c: numCols - 1 } });
  ws['!merges'] = merges;
  ws['!cols']   = WIDTHS;
  ws['!rows']   = [{ hpt: 24 }, { hpt: 14 }, { hpt: 36 }, ...rows.map(() => ({ hpt: 18 }))];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Audit Log');
  XLSX.writeFile(wb, `PTO-AUX-AuditLog-${new Date().toLocaleDateString('en-CA')}.xlsx`);
}

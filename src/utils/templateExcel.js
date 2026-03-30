import * as XLSX from 'xlsx-js-style';
import { AUX_DIAGNOSTICS } from '../api/diagnostics';

// ── Helpers ───────────────────────────────────────────────────────────────────

function thin(rgb = 'D0D7E0') { return { style: 'thin', color: { rgb } }; }
function border(rgb = 'D0D7E0') { return { top: thin(rgb), bottom: thin(rgb), left: thin(rgb), right: thin(rgb) }; }
function fill(rgb) { return { patternType: 'solid', fgColor: { rgb } }; }

function setCell(ws, r, c, value, style, formula) {
  const addr = XLSX.utils.encode_cell({ r, c });
  if (formula) {
    ws[addr] = { t: 'str', f: formula, s: style };
  } else {
    ws[addr] = { v: value, t: typeof value === 'number' ? 'n' : 's', s: style };
  }
}

// ── Colour groups ─────────────────────────────────────────────────────────────
// Locked (Device ID/Name/Serial):  Steel blue
// Current values (read-only ref):  Grey
// Editable (New Label/Hrs):        Green
// Comment:                         Amber
// Status:                          Purple

const S = {
  hLocked:   { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: fill('2E75B6'), alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: border() },
  hCurrent:  { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: fill('595959'), alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: border() },
  hEditable: { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: fill('375623'), alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: border() },
  hComment:  { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: fill('BF5A00'), alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: border() },
  hStatus:   { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: fill('5B2C8D'), alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: border() },

  dLocked:   (alt) => ({ font: { sz: 10, color: { rgb: '2D3748' } }, fill: fill(alt ? 'D6E4F7' : 'EBF3FB'), alignment: { horizontal: 'left',   vertical: 'center' }, border: border('C5D5E8') }),
  dCurrent:  (alt) => ({ font: { sz: 10, color: { rgb: '4A5568' } }, fill: fill(alt ? 'E2E2E2' : 'F2F2F2'), alignment: { horizontal: 'center', vertical: 'center' }, border: border('D0D0D0') }),
  dEditable: (alt) => ({ font: { sz: 10, color: { rgb: '1E3A12' } }, fill: fill(alt ? 'D5ECC2' : 'E8F5D9'), alignment: { horizontal: 'left',   vertical: 'center' }, border: border('B8DDA0') }),
  dComment:  (alt) => ({ font: { sz: 10, color: { rgb: '5C3000' } }, fill: fill(alt ? 'F5E0BB' : 'FFF2CC'), alignment: { horizontal: 'left',   vertical: 'center' }, border: border('E8C880') }),
  dStatus:   (alt) => ({ font: { sz: 10, color: { rgb: '3B1A6B' } }, fill: fill(alt ? 'D5C8E8' : 'EDE0F8'), alignment: { horizontal: 'center', vertical: 'center' }, border: border('C0A8DE') }),
};

// ── Column header definitions ─────────────────────────────────────────────────

function buildHeaders() {
  const locked      = ['Device ID', 'Device Name', 'Serial Number'];
  const currentCols = [];
  const editable    = [];

  for (const { label } of AUX_DIAGNOSTICS) {
    currentCols.push(`${label} Current Label`);
    currentCols.push(`${label} Current Hrs`);
    editable.push(`${label} New Label`);
    editable.push(`${label} New Hrs`);
  }

  return {
    locked,
    currentCols,
    editable,
    comment: 'Comment (required if changes made)',
    status: 'Status',
  };
}

// ── Build a row for one device ────────────────────────────────────────────────

function buildDeviceRow(device, deviceData) {
  const labels    = deviceData?.labels || {};
  const baselines = deviceData?.baselines || {};
  const row       = {};

  row['Device ID']     = device.id;
  row['Device Name']   = device.name;
  row['Serial Number'] = device.serialNumber || '';

  for (const { label, key } of AUX_DIAGNOSTICS) {
    const history         = baselines[key];
    const currentBaseline = Array.isArray(history) && history.length ? history[history.length - 1].value : '';
    row[`${label} Current Label`] = labels[key] || '';
    row[`${label} Current Hrs`]   = currentBaseline;
    row[`${label} New Label`]     = '';
    row[`${label} New Hrs`]       = '';
  }

  row['Comment (required if changes made)'] = '';
  row['Status'] = '';

  return row;
}

// ── Generate template ─────────────────────────────────────────────────────────

export function generateTemplate(devices, deviceDataMap) {
  const { locked, currentCols, editable, comment, status } = buildHeaders();
  const allCols = [...locked, ...currentCols, ...editable, comment, status];

  const rows = devices.map(device => buildDeviceRow(device, deviceDataMap[device.id]));

  const ws         = {};
  const numCols    = allCols.length;
  const numDataRows = rows.length;

  // Column group boundaries (0-based indices)
  const lockedEnd   = locked.length - 1;
  const currentEnd  = locked.length + currentCols.length - 1;
  const editableEnd = locked.length + currentCols.length + editable.length - 1;
  const commentIdx  = editableEnd + 1;
  const statusIdx   = commentIdx + 1;

  function headerStyle(c) {
    if (c <= lockedEnd)   return S.hLocked;
    if (c <= currentEnd)  return S.hCurrent;
    if (c <= editableEnd) return S.hEditable;
    if (c === commentIdx) return S.hComment;
    return S.hStatus;
  }

  function cellStyle(c, alt) {
    if (c <= lockedEnd)   return S.dLocked(alt);
    if (c <= currentEnd)  return S.dCurrent(alt);
    if (c <= editableEnd) return S.dEditable(alt);
    if (c === commentIdx) return S.dComment(alt);
    return S.dStatus(alt);
  }

  // Header row (row 0)
  allCols.forEach((header, c) => {
    setCell(ws, 0, c, header, headerStyle(c));
  });

  // Data rows
  rows.forEach((row, ri) => {
    const alt     = ri % 2 === 1;
    const excelR  = ri + 1;
    allCols.forEach((col, c) => {
      const val = row[col] ?? '';
      setCell(ws, excelR, c, val, cellStyle(c, alt));
    });
  });

  // Status formula for each data row
  const commentCol  = XLSX.utils.encode_col(commentIdx);
  const editStartCol = XLSX.utils.encode_col(locked.length + currentCols.length);
  const editEndCol  = XLSX.utils.encode_col(editableEnd);

  for (let r = 2; r <= numDataRows + 1; r++) {
    const alt      = (r - 2) % 2 === 1;
    const editRange = `${editStartCol}${r}:${editEndCol}${r}`;
    const formula   = `IF(COUNTA(${editRange})=0,"— No Changes",IF(${commentCol}${r}="","⚠ Comment Required","✅ Ready"))`;
    setCell(ws, r - 1, statusIdx, '', cellStyle(statusIdx, alt), formula);
  }

  ws['!ref']        = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: numDataRows, c: numCols - 1 } });
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } }) };
  ws['!cols']       = allCols.map(h => ({ wch: Math.max(h.length + 2, 18) }));
  ws['!rows']       = [{ hpt: 40 }, ...rows.map(() => ({ hpt: 20 }))];

  // ── Instructions sheet ──────────────────────────────────────────────────────

  const instrRows = [
    ['PTO AUX Hours Tracker — Baseline Import Template'],
    [''],
    ['INSTRUCTIONS'],
    ['1.', 'Blue columns (Device ID, Name, Serial, Current values) are reference only — do not edit.'],
    ['2.', 'Green columns — fill in "New Label" and/or "New Hrs" for any AUX you want to update.'],
    ['3.', 'Leave New columns blank to keep existing values unchanged.'],
    ['4.', 'The amber Comment column is REQUIRED for any row where you make changes.'],
    ['5.', 'Check the Status column: ✅ Ready = good to upload | ⚠ Comment Required = add a comment first.'],
    ['6.', 'Filter the Status column to find rows needing attention before uploading.'],
    ['7.', 'Do NOT modify the Device ID column — it is used to match records on upload.'],
    [''],
    ['COLOUR LEGEND'],
    ['🔵 Blue',    'Locked — reference only (Device ID, Name, Serial, Current values)'],
    ['🟢 Green',   'Editable — fill these in (New Label, New Hrs)'],
    ['🟡 Amber',   'Comment — required when making changes'],
    ['🟣 Purple',  'Status — auto-calculated, do not edit'],
  ];

  const instrHeaderStyle = {
    font: { bold: true, sz: 13, color: { rgb: 'FFFFFF' } },
    fill: fill('1F4E79'),
    alignment: { horizontal: 'left', vertical: 'center' },
  };
  const instrSectionStyle = {
    font: { bold: true, sz: 11, color: { rgb: '1F4E79' } },
    fill: fill('EBF3FB'),
    alignment: { horizontal: 'left', vertical: 'center' },
  };
  const instrBodyStyle = {
    font: { sz: 10, color: { rgb: '2D3748' } },
    fill: fill('FFFFFF'),
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
  };

  const iws = {};
  instrRows.forEach((rowData, ri) => {
    const isTitle   = ri === 0;
    const isSection = rowData[0] === 'INSTRUCTIONS' || rowData[0] === 'COLOUR LEGEND';
    const style     = isTitle ? instrHeaderStyle : isSection ? instrSectionStyle : instrBodyStyle;

    rowData.forEach((val, c) => {
      iws[XLSX.utils.encode_cell({ r: ri, c })] = { v: val || '', t: 's', s: style };
    });
  });

  iws['!ref']  = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: instrRows.length - 1, c: 1 } });
  iws['!cols'] = [{ wch: 14 }, { wch: 80 }];
  iws['!rows'] = instrRows.map((r, i) => ({ hpt: i === 0 ? 26 : 20 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Baseline Import');
  XLSX.utils.book_append_sheet(wb, iws, 'Instructions');

  XLSX.writeFile(wb, 'PTO-AUX-Baseline-Template.xlsx');
}

// ── Parse uploaded template ───────────────────────────────────────────────────

export function parseTemplate(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets['Baseline Import'];
        if (!ws) return reject(new Error('Sheet "Baseline Import" not found'));

        const rows   = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const valid  = [];
        const errors = [];

        rows.forEach((row, i) => {
          const rowNum   = i + 2;
          const deviceId = String(row['Device ID'] || '').trim();
          if (!deviceId) return;

          const comment    = String(row['Comment (required if changes made)'] || '').trim();
          let hasChanges   = false;

          for (const { label, key } of AUX_DIAGNOSTICS) {
            const newLabel      = String(row[`${label} New Label`] || '').trim();
            const newHrs        = row[`${label} New Hrs`];
            const hasLabelChange = newLabel !== '';
            const hasHrsChange   = newHrs !== '' && newHrs !== null && newHrs !== undefined;

            if (hasLabelChange || hasHrsChange) {
              hasChanges = true;
              if (!comment) {
                errors.push({ row: rowNum, deviceId, reason: 'Comment required' });
                break;
              }
              valid.push({
                deviceId,
                auxKey:   key,
                newLabel: hasLabelChange ? newLabel : null,
                newHrs:   hasHrsChange   ? Number(newHrs) : null,
                comment,
              });
            }
          }
        });

        resolve({ valid, errors });
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsBinaryString(file);
  });
}

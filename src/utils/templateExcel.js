import * as XLSX from 'xlsx';
import { AUX_DIAGNOSTICS } from '../api/diagnostics';

// Column header definitions
function buildHeaders() {
  const locked = ['Device ID', 'Device Name', 'Serial Number'];
  const editable = [];
  const currentCols = [];

  for (const { label, key } of AUX_DIAGNOSTICS) {
    currentCols.push(`${label} Current Label`);
    currentCols.push(`${label} Current Hrs`);
    editable.push(`${label} New Label`);
    editable.push(`${label} New Hrs`);
  }

  return { locked, currentCols, editable, comment: 'Comment (required if changes made)', status: 'Status' };
}

// Build a row for one device
function buildDeviceRow(device, deviceData, colOrder) {
  const labels = deviceData?.labels || {};
  const baselines = deviceData?.baselines || {};
  const row = {};

  row['Device ID'] = device.id;
  row['Device Name'] = device.name;
  row['Serial Number'] = device.serialNumber || '';

  for (const { label, key } of AUX_DIAGNOSTICS) {
    const history = baselines[key];
    const currentBaseline = Array.isArray(history) && history.length
      ? history[history.length - 1].value
      : '';
    row[`${label} Current Label`] = labels[key] || '';
    row[`${label} Current Hrs`] = currentBaseline;
    row[`${label} New Label`] = '';
    row[`${label} New Hrs`] = '';
  }

  row['Comment (required if changes made)'] = '';
  row['Status'] = '';  // will be formula

  return row;
}

export function generateTemplate(devices, deviceDataMap) {
  const { locked, currentCols, editable, comment, status } = buildHeaders();
  const allCols = [...locked, ...currentCols, ...editable, comment, status];

  const rows = devices.map((device) =>
    buildDeviceRow(device, deviceDataMap[device.id], allCols)
  );

  const ws = XLSX.utils.json_to_sheet(rows, { header: allCols });

  const numDataRows = rows.length;
  const numCols = allCols.length;

  // Column indices (1-based for Excel)
  const commentColIdx = allCols.indexOf(comment) + 1;
  const statusColIdx = allCols.indexOf(status) + 1;

  // Find editable column indices for the Status formula
  const editableStartIdx = allCols.indexOf(editable[0]) + 1;
  const editableEndIdx = allCols.indexOf(editable[editable.length - 1]) + 1;

  const commentCol = XLSX.utils.encode_col(commentColIdx - 1);
  const editStartCol = XLSX.utils.encode_col(editableStartIdx - 1);
  const editEndCol = XLSX.utils.encode_col(editableEndIdx - 1);

  // Add Status formula for each data row
  for (let r = 2; r <= numDataRows + 1; r++) {
    const statusCell = XLSX.utils.encode_cell({ r: r - 1, c: statusColIdx - 1 });
    const commentCell = `${commentCol}${r}`;
    const editRange = `${editStartCol}${r}:${editEndCol}${r}`;

    ws[statusCell] = {
      t: 'str',
      f: `IF(COUNTA(${editRange})=0,"— No Changes",IF(${commentCell}="","⚠ Comment Required","✅ Ready"))`,
    };
  }

  // AutoFilter on header row
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } }) };

  // Column widths
  ws['!cols'] = allCols.map((h) => ({
    wch: Math.max(h.length + 2, 16),
  }));

  // Add instructions sheet
  const instructions = XLSX.utils.aoa_to_sheet([
    ['PTO AUX Hours — Baseline Import Template'],
    [''],
    ['INSTRUCTIONS:'],
    ['1. Grey-labeled columns (Device ID, Device Name, Serial, Current values) are for reference only — do not modify.'],
    ['2. Fill in "New Label" and/or "New Hrs" columns for any AUX channels you want to update.'],
    ['3. Leave blank to skip (existing values will be kept).'],
    ['4. The Comment column is REQUIRED for any row where you make changes.'],
    ['5. Check the Status column: ✅ Ready = good to upload, ⚠ Comment Required = add a comment first.'],
    ['6. Filter the Status column to find rows needing attention before uploading.'],
    ['7. Do NOT modify the Device ID column — it is used to match records on upload.'],
    [''],
    ['LEGEND:'],
    ['Locked (reference only): Device ID, Device Name, Serial Number, Current Label, Current Hrs'],
    ['Editable: New Label, New Hrs, Comment'],
    ['Auto-calculated: Status'],
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Baseline Import');
  XLSX.utils.book_append_sheet(wb, instructions, 'Instructions');

  XLSX.writeFile(wb, 'PTO-AUX-Baseline-Template.xlsx');
}

// Parse an uploaded template file and extract changes.
// Returns { valid: [{deviceId, auxKey, newLabel, newHrs, comment}], errors: [{row, reason}] }
export function parseTemplate(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets['Baseline Import'];
        if (!ws) return reject(new Error('Sheet "Baseline Import" not found'));

        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const valid = [];
        const errors = [];

        rows.forEach((row, i) => {
          const rowNum = i + 2;
          const deviceId = String(row['Device ID'] || '').trim();
          if (!deviceId) return;

          const comment = String(row['Comment (required if changes made)'] || '').trim();
          let hasChanges = false;

          for (const { label, key } of AUX_DIAGNOSTICS) {
            const newLabel = String(row[`${label} New Label`] || '').trim();
            const newHrs = row[`${label} New Hrs`];
            const hasLabelChange = newLabel !== '';
            const hasHrsChange = newHrs !== '' && newHrs !== null && newHrs !== undefined;

            if (hasLabelChange || hasHrsChange) {
              hasChanges = true;
              if (!comment) {
                errors.push({ row: rowNum, deviceId, reason: 'Comment required' });
                break;
              }
              valid.push({
                deviceId,
                auxKey: key,
                newLabel: hasLabelChange ? newLabel : null,
                newHrs: hasHrsChange ? Number(newHrs) : null,
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

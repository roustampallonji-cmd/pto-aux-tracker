// AddInData API — persists baselines, labels, and audit history per device.
// One AddInData record per device, stored database-wide (company group).
// All users on the same database see the same data.

const ADD_IN_ID = 'a3QGFxWlrEuyBr9YipuEhA'; // matches configuration.json
const COMPANY_GROUP = { id: 'GroupCompanyId' };

// ── Internal helpers ──────────────────────────────────────────────────────

function getAllRecords(api) {
  return new Promise((resolve, reject) => {
    api.call(
      'Get',
      { typeName: 'AddInData', search: { addInId: ADD_IN_ID } },
      (records) => resolve(records || []),
      reject
    );
  });
}

function parseRecord(record) {
  try { return JSON.parse(record.data); } catch { return null; }
}

// ── Read ──────────────────────────────────────────────────────────────────

// Returns a map of deviceId → { recordId, labels, baselines }
export async function loadAllDeviceData(api) {
  const records = await getAllRecords(api);
  const map = {};
  for (const record of records) {
    const data = parseRecord(record);
    if (data?.deviceId) {
      map[data.deviceId] = {
        recordId: record.id,
        labels: data.labels || {},
        baselines: data.baselines || {},
      };
    }
  }
  return map;
}

// Returns { recordId, labels, baselines } for a single device (or defaults).
export async function loadDeviceData(api, deviceId) {
  const all = await loadAllDeviceData(api);
  return all[deviceId] || { recordId: null, labels: {}, baselines: {} };
}

// ── Write helpers ─────────────────────────────────────────────────────────

function saveRecord(api, recordId, payload) {
  return new Promise((resolve, reject) => {
    const entity = {
      addInId: ADD_IN_ID,
      groups: [COMPANY_GROUP],
      data: JSON.stringify(payload),
    };
    if (recordId) {
      api.call('Set', { typeName: 'AddInData', entity: { id: recordId, ...entity } },
        resolve, reject);
    } else {
      api.call('Add', { typeName: 'AddInData', entity },
        (newId) => resolve(newId), reject);
    }
  });
}

// ── Baseline ──────────────────────────────────────────────────────────────

// Save a new baseline entry for a device+AUX. Returns updated data.
export async function saveBaseline(api, deviceId, auxKey, value, comment, user, userId) {
  const existing = await loadDeviceData(api, deviceId);

  const entry = {
    value: Number(value),
    comment,
    user,
    userId,
    timestamp: new Date().toISOString(),
  };

  const baselines = { ...existing.baselines };
  if (!Array.isArray(baselines[auxKey])) baselines[auxKey] = [];
  baselines[auxKey] = [...baselines[auxKey], entry];

  await saveRecord(api, existing.recordId, {
    deviceId,
    labels: existing.labels,
    baselines,
  });

  return baselines[auxKey];
}

// Get active (latest) baseline value for a device+AUX. Returns 0 if none.
export function getActiveBaseline(deviceData, auxKey) {
  const history = deviceData?.baselines?.[auxKey];
  if (!Array.isArray(history) || !history.length) return 0;
  return history[history.length - 1].value;
}

// Get full baseline history for a device+AUX.
export function getBaselineHistory(deviceData, auxKey) {
  return deviceData?.baselines?.[auxKey] || [];
}

// ── Labels ────────────────────────────────────────────────────────────────

// Save labels for a single device. Only updates provided keys.
export async function saveDeviceLabels(api, deviceId, newLabels) {
  const existing = await loadDeviceData(api, deviceId);
  const labels = { ...existing.labels, ...newLabels };
  await saveRecord(api, existing.recordId, {
    deviceId,
    labels,
    baselines: existing.baselines,
  });
  return labels;
}

// Bulk save labels for multiple devices at once.
export async function bulkSaveLabels(api, deviceIds, newLabels, allDeviceData) {
  await Promise.all(
    deviceIds.map(async (deviceId) => {
      const existing = allDeviceData[deviceId] || { recordId: null, labels: {}, baselines: {} };
      const labels = { ...existing.labels };
      // Only apply keys where newLabels[key] is not empty string (skip blanks)
      for (const [k, v] of Object.entries(newLabels)) {
        if (v !== '') labels[k] = v;
      }
      await saveRecord(api, existing.recordId, {
        deviceId,
        labels,
        baselines: existing.baselines || {},
      });
    })
  );
}

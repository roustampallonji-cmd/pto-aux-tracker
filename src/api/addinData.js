// Storage layer: tries Geotab AddInData first (shared across all users),
// falls back to localStorage if AddInData is unavailable.

const FALLBACK_ADD_IN_ID = 'a3QGFxWlrEuyBr9YipuEhA';
const COMPANY_GROUP = { id: 'GroupCompanyId' };
const LS_PREFIX = 'pto_aux_v1_';

let resolvedAddInId = FALLBACK_ADD_IN_ID;
let addInDataAvailable = null; // null = untested, true/false after first write

// ── Helpers ───────────────────────────────────────────────────────────────

function lsKey(deviceId) { return `${LS_PREFIX}${deviceId}`; }
function lsRead(deviceId) {
  try { return JSON.parse(localStorage.getItem(lsKey(deviceId))) || null; }
  catch { return null; }
}
function lsWrite(deviceId, data) {
  localStorage.setItem(lsKey(deviceId), JSON.stringify(data));
}

// Find the actual addInId registered for this add-in in SystemSettings
async function resolveAddInId(api) {
  return new Promise((resolve) => {
    api.call('Get', { typeName: 'SystemSettings' }, (settings) => {
      const pages = settings?.customerPages || [];
      const match = pages.find(p =>
        p.url?.includes('pto-aux-tracker') ||
        p.addInId === FALLBACK_ADD_IN_ID
      );
      const id = match?.addInId || FALLBACK_ADD_IN_ID;
      console.log('[storage] registered addInId:', id, '| pages:', pages.length);
      resolve(id);
    }, () => resolve(FALLBACK_ADD_IN_ID));
  });
}

// ── AddInData API wrappers ─────────────────────────────────────────────────

function addinGet(api) {
  return new Promise((resolve, reject) => {
    api.call('Get', { typeName: 'AddInData', search: { addInId: resolvedAddInId } },
      (r) => resolve(r || []), reject);
  });
}

function addinSave(api, recordId, payload) {
  return new Promise((resolve, reject) => {
    const entity = { addInId: resolvedAddInId, groups: [COMPANY_GROUP], data: JSON.stringify(payload) };
    if (recordId) {
      api.call('Set', { typeName: 'AddInData', entity: { id: recordId, ...entity } }, resolve, reject);
    } else {
      api.call('Add', { typeName: 'AddInData', entity }, (id) => resolve(id), reject);
    }
  });
}

// ── Init (call once at app startup) ───────────────────────────────────────

export async function initStorage(api) {
  resolvedAddInId = await resolveAddInId(api);
}

// ── Read ──────────────────────────────────────────────────────────────────

export async function loadAllDeviceData(api) {
  // Always merge AddInData + localStorage so nothing is lost
  const map = {};

  // 1. Try AddInData
  try {
    const records = await addinGet(api);
    for (const rec of records) {
      try {
        const data = JSON.parse(rec.data);
        if (data?.deviceId) {
          map[data.deviceId] = { recordId: rec.id, labels: data.labels || {}, baselines: data.baselines || {} };
        }
      } catch {}
    }
    if (records.length > 0) addInDataAvailable = true;
  } catch (e) {
    console.warn('[storage] AddInData read failed, using localStorage:', e);
  }

  // 2. Merge localStorage (fills in devices not in AddInData)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(LS_PREFIX)) continue;
    const deviceId = key.slice(LS_PREFIX.length);
    if (!map[deviceId]) {
      const data = lsRead(deviceId);
      if (data) map[deviceId] = { labels: data.labels || {}, baselines: data.baselines || {} };
    }
  }

  return map;
}

// ── Write (tries AddInData, falls back to localStorage) ───────────────────

async function saveRecord(api, deviceId, existingRecordId, payload) {
  // Try AddInData if not already known to be unavailable
  if (addInDataAvailable !== false) {
    try {
      const newId = await addinSave(api, existingRecordId, { deviceId, ...payload });
      addInDataAvailable = true;
      console.log('[storage] AddInData save OK');
      return newId;
    } catch (e) {
      console.warn('[storage] AddInData save failed, falling back to localStorage:', e);
      addInDataAvailable = false;
    }
  }
  // Fallback: localStorage
  const existing = lsRead(deviceId) || {};
  lsWrite(deviceId, { ...existing, ...payload });
}

// ── Baseline ──────────────────────────────────────────────────────────────

export async function saveBaseline(api, deviceId, auxKey, value, comment, user, userId) {
  const allData = await loadAllDeviceData(api);
  const existing = allData[deviceId] || { labels: {}, baselines: {} };

  const entry = { value: Number(value), comment, user, userId, timestamp: new Date().toISOString() };
  const baselines = { ...existing.baselines };
  if (!Array.isArray(baselines[auxKey])) baselines[auxKey] = [];
  baselines[auxKey] = [...baselines[auxKey], entry];

  await saveRecord(api, deviceId, existing.recordId, { labels: existing.labels, baselines });
  // Always mirror to localStorage as backup
  lsWrite(deviceId, { labels: existing.labels, baselines });
  return baselines[auxKey];
}

export function getActiveBaseline(deviceData, auxKey) {
  const history = deviceData?.baselines?.[auxKey];
  if (!Array.isArray(history) || !history.length) return 0;
  return history[history.length - 1].value;
}

export function getBaselineHistory(deviceData, auxKey) {
  return deviceData?.baselines?.[auxKey] || [];
}

// ── Labels ────────────────────────────────────────────────────────────────

export async function saveDeviceLabels(api, deviceId, newLabels) {
  const allData = await loadAllDeviceData(api);
  const existing = allData[deviceId] || { labels: {}, baselines: {} };
  const labels = { ...existing.labels, ...newLabels };

  await saveRecord(api, deviceId, existing.recordId, { labels, baselines: existing.baselines });
  lsWrite(deviceId, { labels, baselines: existing.baselines });
  return labels;
}

export async function bulkSaveLabels(api, deviceIds, newLabels) {
  const allData = await loadAllDeviceData(api);
  for (const deviceId of deviceIds) {
    const existing = allData[deviceId] || { labels: {}, baselines: {} };
    const labels = { ...existing.labels };
    for (const [k, v] of Object.entries(newLabels)) {
      if (v !== '') labels[k] = v;
    }
    await saveRecord(api, deviceId, existing.recordId, { labels, baselines: existing.baselines });
    lsWrite(deviceId, { labels, baselines: existing.baselines });
  }
}

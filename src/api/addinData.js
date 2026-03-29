// Storage layer for baselines, labels, and audit history per device.
// Uses localStorage (per browser). All function signatures match the
// original AddInData API so no component changes are needed.

const LS_PREFIX = 'pto_aux_v1_';

function lsKey(deviceId) { return `${LS_PREFIX}${deviceId}`; }

function lsRead(deviceId) {
  try { return JSON.parse(localStorage.getItem(lsKey(deviceId))) || null; }
  catch { return null; }
}

function lsWrite(deviceId, data) {
  localStorage.setItem(lsKey(deviceId), JSON.stringify(data));
}

// ── Read ──────────────────────────────────────────────────────────────────

// Returns a map of deviceId → { labels, baselines }
export function loadAllDeviceData(_api) {
  const map = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(LS_PREFIX)) continue;
    const deviceId = key.slice(LS_PREFIX.length);
    const data = lsRead(deviceId);
    if (data) map[deviceId] = { labels: data.labels || {}, baselines: data.baselines || {} };
  }
  return Promise.resolve(map);
}

export function loadDeviceData(_api, deviceId) {
  const data = lsRead(deviceId) || {};
  return Promise.resolve({ labels: data.labels || {}, baselines: data.baselines || {} });
}

// ── Baseline ──────────────────────────────────────────────────────────────

export async function saveBaseline(_api, deviceId, auxKey, value, comment, user, userId) {
  const existing = lsRead(deviceId) || { labels: {}, baselines: {} };
  const entry = { value: Number(value), comment, user, userId, timestamp: new Date().toISOString() };
  const baselines = { ...existing.baselines };
  if (!Array.isArray(baselines[auxKey])) baselines[auxKey] = [];
  baselines[auxKey] = [...baselines[auxKey], entry];
  lsWrite(deviceId, { ...existing, baselines });
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

export async function saveDeviceLabels(_api, deviceId, newLabels) {
  const existing = lsRead(deviceId) || { labels: {}, baselines: {} };
  const labels = { ...existing.labels, ...newLabels };
  lsWrite(deviceId, { ...existing, labels });
  return labels;
}

export async function bulkSaveLabels(_api, deviceIds, newLabels) {
  for (const deviceId of deviceIds) {
    const existing = lsRead(deviceId) || { labels: {}, baselines: {} };
    const labels = { ...existing.labels };
    for (const [k, v] of Object.entries(newLabels)) {
      if (v !== '') labels[k] = v;
    }
    lsWrite(deviceId, { ...existing, labels });
  }
}

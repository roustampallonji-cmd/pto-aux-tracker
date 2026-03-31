// Storage layer: Firestore REST API (no npm package needed — uses fetch directly)
// Drop-in replacement for addinData.js — identical exports, same function signatures.

const PROJECT_ID = 'pto-aux-tracker';
const API_KEY    = 'AIzaSyB22ts_n5s-6Dtskd5kGz7162iP80XEcyY';
const BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

let databaseId = 'unknown';

// ── Firestore value serializers ───────────────────────────────────────────

function toVal(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number')  return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string')  return { stringValue: v };
  if (Array.isArray(v))       return { arrayValue: { values: v.map(toVal) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toVal(x)])) } };
}

function fromVal(v) {
  if ('nullValue'    in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue'  in v) return v.doubleValue;
  if ('stringValue'  in v) return v.stringValue;
  if ('arrayValue'   in v) return (v.arrayValue.values || []).map(fromVal);
  if ('mapValue'     in v) return Object.fromEntries(
    Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromVal(x)])
  );
  return null;
}

function fromDoc(doc) {
  if (!doc?.fields) return null;
  return Object.fromEntries(Object.entries(doc.fields).map(([k, v]) => [k, fromVal(v)]));
}

// ── Firestore REST helpers ────────────────────────────────────────────────

async function readDoc(docPath) {
  const res = await fetch(`${BASE}/${docPath}?key=${API_KEY}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore read error ${res.status}`);
  return fromDoc(await res.json());
}

async function writeDoc(docPath, data) {
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toVal(v)]));
  const res = await fetch(`${BASE}/${docPath}?key=${API_KEY}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Firestore write error ${res.status}: ${await res.text()}`);
}

async function queryCollection(collectionId, fieldPath, value) {
  const res = await fetch(`${BASE}:runQuery?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: { fieldFilter: { field: { fieldPath }, op: 'EQUAL', value: toVal(value) } },
      },
    }),
  });
  if (!res.ok) throw new Error(`Firestore query error ${res.status}`);
  const rows = await res.json();
  return rows.filter(r => r.document).map(r => fromDoc(r.document));
}

// ── Init (call once at app startup) ──────────────────────────────────────

export async function initStorage(api, state) {
  try {
    const st = state?.getState?.();
    if (st?.database) databaseId = st.database;
  } catch {}
  console.log('[firebase] initialized, databaseId:', databaseId);
}

// ── Read ──────────────────────────────────────────────────────────────────

export async function loadAllDeviceData(api) {
  const docs = await queryCollection('device_data', 'database_id', databaseId);
  const map = {};
  for (const data of docs) {
    if (data?.deviceId) {
      map[data.deviceId] = { labels: data.labels || {}, baselines: data.baselines || {} };
    }
  }
  return map;
}

// ── Baseline ──────────────────────────────────────────────────────────────

export async function saveBaseline(api, deviceId, auxKey, value, comment, user, userId) {
  const docPath = `device_data/${databaseId}__${deviceId}`;
  const existing = (await readDoc(docPath)) || { labels: {}, baselines: {} };

  const entry = { value: Number(value), comment, user, userId, timestamp: new Date().toISOString() };
  const baselines = { ...existing.baselines };
  if (!Array.isArray(baselines[auxKey])) baselines[auxKey] = [];
  baselines[auxKey] = [...baselines[auxKey], entry];

  await writeDoc(docPath, { database_id: databaseId, deviceId, labels: existing.labels || {}, baselines });
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
  const docPath = `device_data/${databaseId}__${deviceId}`;
  const existing = (await readDoc(docPath)) || { labels: {}, baselines: {} };
  const labels = { ...existing.labels, ...newLabels };

  await writeDoc(docPath, { database_id: databaseId, deviceId, labels, baselines: existing.baselines || {} });
  return labels;
}

export async function bulkSaveLabels(api, deviceIds, newLabels) {
  for (const deviceId of deviceIds) {
    const docPath = `device_data/${databaseId}__${deviceId}`;
    const existing = (await readDoc(docPath)) || { labels: {}, baselines: {} };
    const labels = { ...existing.labels };
    for (const [k, v] of Object.entries(newLabels)) {
      if (v !== '') labels[k] = v;
    }
    await writeDoc(docPath, { database_id: databaseId, deviceId, labels, baselines: existing.baselines || {} });
  }
}

import { AUX_DIAGNOSTICS } from './diagnostics';

// Fetch StatusData for a device + AUX diagnostic over a date range.
// Returns array of { dateTime, data (0 or 1) } sorted by time.
function fetchAuxStatusData(api, deviceId, diagnosticId, fromDate, toDate) {
  return new Promise((resolve, reject) => {
    api.call(
      'Get',
      {
        typeName: 'StatusData',
        search: {
          deviceSearch: { id: deviceId },
          diagnosticSearch: { id: diagnosticId },
          fromDate: fromDate.toISOString(),
          toDate: toDate.toISOString(),
        },
      },
      (result) => resolve(result || []),
      (err) => reject(err)
    );
  });
}

// Calculate total ON-time hours from a series of 0/1 status readings.
// Sums duration of all spans where value === 1.
function calcOnHours(readings, fromDate, toDate) {
  if (!readings.length) return 0;

  const sorted = [...readings].sort(
    (a, b) => new Date(a.dateTime) - new Date(b.dateTime)
  );

  let totalMs = 0;
  let onStart = null;

  for (const r of sorted) {
    const val = Number(r.data);
    const ts = new Date(r.dateTime);

    if (val === 1 && onStart === null) {
      onStart = ts;
    } else if (val === 0 && onStart !== null) {
      totalMs += ts - onStart;
      onStart = null;
    }
  }

  // If still ON at end of range, count up to toDate
  if (onStart !== null) {
    totalMs += toDate - onStart;
  }

  return totalMs / 1000 / 3600; // convert ms → hours
}

// Fetch ON-hours for ALL 8 AUX channels for a single device.
// Returns { AUX1: hrs, AUX2: hrs, ... AUX8: hrs }
export async function fetchDeviceAuxHours(api, deviceId, fromDate, toDate) {
  const results = {};

  await Promise.all(
    AUX_DIAGNOSTICS.map(async ({ id, key }) => {
      try {
        const readings = await fetchAuxStatusData(api, deviceId, id, fromDate, toDate);
        results[key] = calcOnHours(readings, fromDate, toDate);
      } catch {
        results[key] = null; // null = error/no data
      }
    })
  );

  return results;
}

// Fetch AUX hours for multiple devices in parallel.
// Returns { [deviceId]: { AUX1: hrs, ... AUX8: hrs } }
export async function fetchFleetAuxHours(api, deviceIds, fromDate, toDate) {
  const entries = await Promise.all(
    deviceIds.map(async (id) => {
      const hours = await fetchDeviceAuxHours(api, id, fromDate, toDate);
      return [id, hours];
    })
  );
  return Object.fromEntries(entries);
}

// Determine which AUX channels are active (have any readings) for a device.
// Returns Set of keys e.g. { 'AUX1', 'AUX2' }
export async function fetchActiveAuxChannels(api, deviceId, fromDate, toDate) {
  const hours = await fetchDeviceAuxHours(api, deviceId, fromDate, toDate);
  return new Set(
    Object.entries(hours)
      .filter(([, v]) => v !== null && v > 0)
      .map(([k]) => k)
  );
}

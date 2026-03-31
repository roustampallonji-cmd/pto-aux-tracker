// Fetch DeviceStatusInfo for a list of device IDs.
// Returns { [deviceId]: { isDeviceCommunicating, lastCommunication, latitude, longitude } }
export function fetchDeviceStatuses(api, deviceIds) {
  return new Promise((resolve, reject) => {
    const calls = deviceIds.map((id) => [
      'Get',
      {
        typeName: 'DeviceStatusInfo',
        search: { deviceSearch: { id } },
      },
    ]);

    api.multiCall(calls, (results) => {
      const map = {};
      deviceIds.forEach((id, i) => {
        const info = results[i]?.[0] || {};
        map[id] = {
          isDeviceCommunicating: info.isDeviceCommunicating ?? false,
          lastCommunication: info.lastCommunication
            ? new Date(info.lastCommunication)
            : info.dateTime
              ? new Date(info.dateTime)
              : null,
          latitude:  info.latitude  ?? null,
          longitude: info.longitude ?? null,
        };
      });
      resolve(map);
    }, reject);
  });
}

// Batch reverse-geocode using Geotab's built-in GetAddresses API.
// Returns { [deviceId]: addressString }
export function fetchAddresses(api, deviceIds, statusMap) {
  const toGeocode = deviceIds.filter(
    id => statusMap[id]?.latitude !== null && statusMap[id]?.longitude !== null
  );
  if (!toGeocode.length) return Promise.resolve({});

  return new Promise((resolve) => {
    const coordinates = toGeocode.map(id => ({
      x: statusMap[id].longitude,
      y: statusMap[id].latitude,
    }));
    api.call('GetAddresses', { coordinates }, (addresses) => {
      const map = {};
      toGeocode.forEach((id, i) => { map[id] = addresses?.[i] || ''; });
      resolve(map);
    }, () => resolve({}));
  });
}

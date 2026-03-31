// Fetch DeviceStatusInfo for a list of device IDs.
// Returns { [deviceId]: { isDeviceCommunicating, lastCommunication } }
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
        };
      });
      resolve(map);
    }, reject);
  });
}

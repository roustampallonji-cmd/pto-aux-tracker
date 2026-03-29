// Fetch all devices visible to the current user.
// Returns array of { id, name, serialNumber, groups }
export function fetchDevices(api) {
  return new Promise((resolve, reject) => {
    api.call(
      'Get',
      { typeName: 'Device', resultsLimit: 50000 },
      (devices) => resolve(
        (devices || []).map((d) => ({
          id: d.id,
          name: d.name || d.id,
          serialNumber: d.serialNumber || '',
          groups: d.groups || [],
        }))
      ),
      reject
    );
  });
}

// Fetch all groups.
// Returns array of { id, name, children }
export function fetchGroups(api) {
  return new Promise((resolve, reject) => {
    api.call(
      'Get',
      { typeName: 'Group' },
      (groups) => resolve(
        (groups || []).filter(g => g.name).map((g) => ({
          id: g.id,
          name: g.name,
          children: g.children || [],
        }))
      ),
      reject
    );
  });
}

// Get device IDs that belong to a group (including sub-groups).
export function getDeviceIdsInGroup(groupId, allDevices, allGroups) {
  const groupIds = collectGroupIds(groupId, allGroups);
  return allDevices
    .filter((d) => d.groups.some((g) => groupIds.has(g.id)))
    .map((d) => d.id);
}

function collectGroupIds(groupId, allGroups, visited = new Set()) {
  if (visited.has(groupId)) return visited;
  visited.add(groupId);
  const group = allGroups.find((g) => g.id === groupId);
  if (group) {
    group.children.forEach((c) => collectGroupIds(c.id, allGroups, visited));
  }
  return visited;
}

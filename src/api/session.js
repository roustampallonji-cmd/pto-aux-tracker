const STORAGE_KEY = 'pto_aux_selected_user_v1';

// Save user selection to localStorage
export function saveSelectedUser(user) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(user)); } catch (e) {}
}

// Load saved user from localStorage
export function loadSelectedUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

// Fetch all users for the picker
export function fetchUsers(api) {
  return new Promise((resolve) => {
    api.call('Get', { typeName: 'User', search: {} },
      (users) => resolve((users || []).filter(u => u.userName).sort((a, b) => a.userName.localeCompare(b.userName))),
      () => resolve([])
    );
  });
}

// Try to auto-detect session (works in non-SSO environments)
export function getSession(api) {
  return new Promise((resolve) => {
    // 1. Check localStorage for a previously saved user selection
    const saved = loadSelectedUser();
    if (saved?.userName) { resolve(saved); return; }

    // 2. Try api.getSession() — throws in SSO/Keycloak environments
    try {
      api.getSession((result) => {
        const creds = result?.credentials || result || {};
        const email = creds.userName || creds.username || creds.name || '';
        if (email) {
          api.call('Get', { typeName: 'User', search: { userName: email } },
            (users) => {
              const u = users?.[0];
              const session = { userName: u?.userName || email, displayName: u?.userName || email, userId: u?.id || creds.userId || '' };
              saveSelectedUser(session);
              resolve(session);
            },
            () => resolve({ userName: email, displayName: email, userId: creds.userId || '' })
          );
        } else {
          resolve({ userName: '', displayName: '', userId: '' });
        }
      }, () => resolve({ userName: '', displayName: '', userId: '' }));
    } catch (e) {
      // SSO environment — caller will show user picker
      resolve({ userName: '', displayName: '', userId: '' });
    }
  });
}

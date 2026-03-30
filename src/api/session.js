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
      (users) => {
        console.log('[fetchUsers] first user keys:', users?.[0] ? Object.keys(users[0]) : 'none');
        console.log('[fetchUsers] first user sample:', JSON.stringify(users?.[0]));
        const filtered = (users || []).filter(u => u.name || u.userName);
        console.log('[fetchUsers] raw:', users?.length, 'filtered:', filtered.length);
        resolve(filtered.sort((a, b) => (a.name || a.userName || '').localeCompare(b.name || b.userName || '')));
      },
      (err) => {
        console.error('[fetchUsers] API error:', err);
        resolve([]);
      }
    );
  });
}

// Try to auto-detect session (works in non-SSO environments)
export function getSession(api, state) {
  return new Promise((resolve) => {
    // 1. Check localStorage for a previously saved user selection
    const saved = loadSelectedUser();
    if (saved?.userName) { resolve(saved); return; }

    // 2. Try state.getState() — MyGeotab page state may include userName
    try {
      const pageState = typeof state?.getState === 'function' ? state.getState() : null;
      const email = pageState?.userName || pageState?.username || '';
      if (email) {
        const session = { userName: email, displayName: email, userId: pageState?.userId || '' };
        saveSelectedUser(session);
        resolve(session);
        return;
      }
    } catch (e) {}

    // 3. Try api.getSession() — throws in SSO/Keycloak environments
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
      // SSO environment — user picker will handle it
      resolve({ userName: '', displayName: '', userId: '' });
    }
  });
}

// Fetch current user email (userName in Geotab = email address).
// Strategy (in order):
//   1. state.getUserName() — available in some MyGeotab lifecycle environments
//   2. api.getSession()   — throws MethodNotSupported in SSO/Keycloak environments
//   3. Get<User> search   — if we have an email, search by it (exact match, 1 result);
//                           if we have no email, accept only if exactly 1 user is returned.
// displayName is always set to the email (userName field) — unique, unambiguous.
export function getSession(api, state) {
  return new Promise((resolve) => {
    const empty = { userName: '', displayName: '', userId: '', sessionId: '', database: '' };

    function resolveFromUsers(users, base) {
      console.log('[session] Get<User> count:', users?.length, '| base.userName:', base.userName);
      let u = null;
      if (Array.isArray(users) && users.length > 0) {
        if (base.userName) {
          // We have an email — find exact match
          u = users.find(x => x.userName === base.userName) || null;
        } else if (users.length === 1) {
          // No email but only one user returned — must be us
          u = users[0];
        }
        // If multiple users and no email to match — don't guess, leave u = null
      }
      const email = u?.userName || base.userName;
      resolve({
        ...base,
        userName:    email,
        displayName: email,   // use email as the saved-by identifier
        userId:      u?.id || base.userId,
      });
    }

    function tryGetUser(base) {
      // If we already know the email, search specifically for that user
      const search = base.userName ? { userName: base.userName } : {};
      api.call('Get', { typeName: 'User', search },
        (users) => resolveFromUsers(users, base),
        ()      => resolve(base)
      );
    }

    // Diagnostic — print every api and state property so we can find the email
    try {
      const apiKeys = Object.getOwnPropertyNames(api);
      console.log('[session] api own props:', JSON.stringify(apiKeys));
      apiKeys.forEach(k => {
        try { console.log(`[session] api.${k} (${typeof api[k]}):`, typeof api[k] !== 'function' ? JSON.stringify(api[k]) : '(fn)'); } catch(e) {}
      });

      const stateKeys = state ? Object.getOwnPropertyNames(state) : [];
      console.log('[session] state own props:', JSON.stringify(stateKeys));
      stateKeys.forEach(k => {
        try { console.log(`[session] state.${k} (${typeof state[k]}):`, typeof state[k] !== 'function' ? JSON.stringify(state[k]) : '(fn)'); } catch(e) {}
      });
    } catch (e) { console.log('[session] diag error:', e); }

    // 1. Try state object (MyGeotab lifecycle may expose getUserName())
    let stateEmail = '';
    try {
      if (typeof state?.getUserName === 'function') stateEmail = state.getUserName() || '';
      else if (typeof state?.userName === 'string')  stateEmail = state.userName;
    } catch (e) {}

    if (stateEmail) {
      console.log('[session] got email from state:', stateEmail);
      tryGetUser({ ...empty, userName: stateEmail, displayName: stateEmail });
      return;
    }

    // 2. Try api.getSession()
    try {
      api.getSession((result) => {
        const creds = result?.credentials || result || {};
        const email = creds.userName || creds.username || creds.name || '';
        console.log('[session] getSession OK, email:', email);
        tryGetUser({
          userName:    email,
          displayName: email,
          userId:      creds.userId    || '',
          sessionId:   creds.sessionId || '',
          database:    creds.database  || '',
        });
      }, () => tryGetUser(empty));
    } catch (e) {
      // 3. SSO environment — no email available, Get<User> with no filter
      console.log('[session] getSession unavailable, using Get<User>');
      tryGetUser(empty);
    }
  });
}

// Fetch the current session + enrich with User display name via Get<User>.
// Returns { userName (email), displayName, userId, sessionId, database }
export function getSession(api) {
  return new Promise((resolve) => {
    const empty = { userName: '', displayName: '', userId: '', sessionId: '', database: '' };

    try {
      api.getSession((result) => {
        const creds = result?.credentials || result || {};
        const email = creds.userName || creds.username || creds.name || '';

        console.log('[session] raw:', JSON.stringify(result));
        console.log('[session] email resolved:', email);

        const base = {
          userName:    email,
          displayName: email,
          userId:      creds.userId    || '',
          sessionId:   creds.sessionId || '',
          database:    creds.database  || '',
        };

        // Get<User> with no search — returns only the current user's own record
        // for non-admin sessions; safest way to identify "me"
        api.call('Get', { typeName: 'User', search: {} }, (users) => {
          console.log('[session] Get<User> result:', JSON.stringify(users?.slice?.(0, 2)));

          // If only 1 user returned it's definitely "me"; otherwise match by email
          let u = null;
          if (Array.isArray(users)) {
            if (users.length === 1) {
              u = users[0];
            } else if (email) {
              u = users.find(x => x.userName === email || x.name === email) || null;
            }
          }

          console.log('[session] matched user:', u?.name, u?.userName);

          resolve({
            ...base,
            userName:    u?.userName || email,
            displayName: u?.name     || u?.userName || email,
            userId:      u?.id       || base.userId,
          });
        }, (err) => {
          console.warn('[session] Get<User> failed:', err);
          resolve(base);
        });

      }, () => resolve(empty));
    } catch (e) {
      resolve(empty);
    }
  });
}

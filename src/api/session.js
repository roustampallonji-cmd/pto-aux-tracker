// Fetch the current session + enrich with User display name via Get<User>.
// Returns { userName (email), displayName, userId, sessionId, database }
export function getSession(api) {
  return new Promise((resolve) => {
    const empty = { userName: '', displayName: '', userId: '', sessionId: '', database: '' };

    try {
      api.getSession((result) => {
        // Geotab passes either { credentials, server } or credentials directly
        const creds = result?.credentials || result || {};
        const email = creds.userName || creds.username || creds.name || '';

        const base = {
          userName:  email,
          displayName: email,   // fallback — overwritten below if Get<User> succeeds
          userId:    creds.userId    || '',
          sessionId: creds.sessionId || '',
          database:  creds.database  || '',
        };

        if (!email) {
          // No email — try Get<User> with no search (returns current user for non-admins)
          api.call('Get', { typeName: 'User', search: {} }, (users) => {
            const u = Array.isArray(users) && users.length === 1 ? users[0] : null;
            resolve({
              ...base,
              userName:    u?.userName || '',
              displayName: u?.name     || u?.userName || '',
              userId:      u?.id       || '',
            });
          }, () => resolve(base));
          return;
        }

        // We have the email — look up the User object to get the display name
        api.call('Get', { typeName: 'User', search: { userName: email } }, (users) => {
          const u = Array.isArray(users) ? users[0] : null;
          resolve({
            ...base,
            displayName: u?.name || email,
            userId:      u?.id   || base.userId,
          });
        }, () => resolve(base));

      }, () => resolve(empty));
    } catch (e) {
      resolve(empty);
    }
  });
}

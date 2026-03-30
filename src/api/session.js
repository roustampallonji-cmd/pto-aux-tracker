// Fetch current user info.
// api.getSession() is not supported in all MyGeotab environments (throws MethodNotSupported).
// Primary strategy: call Get<User> with no search — in add-in context this returns
// only the current user's record (or all users for admins, in which case we try to match).
export function getSession(api) {
  return new Promise((resolve) => {
    const empty = { userName: '', displayName: '', userId: '', sessionId: '', database: '' };

    function resolveFromUsers(users, base) {
      console.log('[session] Get<User> count:', users?.length, '| first:', users?.[0]?.name, users?.[0]?.userName);
      let u = null;
      if (Array.isArray(users) && users.length > 0) {
        // If only 1 result it's definitely the current user
        u = users.length === 1 ? users[0]
          // Otherwise try to match by email from session
          : users.find(x => x.userName === base.userName) || users[0];
      }
      resolve({
        ...base,
        userName:    u?.userName || base.userName,
        displayName: u?.name     || u?.userName || base.userName,
        userId:      u?.id       || base.userId,
      });
    }

    function tryGetUser(base) {
      api.call('Get', { typeName: 'User', search: {} },
        (users) => resolveFromUsers(users, base),
        ()      => resolve(base)
      );
    }

    // Try getSession first — if it works, we get the email for better matching
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
      // getSession not supported in this environment — go straight to Get<User>
      console.log('[session] getSession unavailable, using Get<User>');
      tryGetUser(empty);
    }
  });
}

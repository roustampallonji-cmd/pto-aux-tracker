// Fetch the current logged-in user's session info.
// Returns { userName, userId, database }
export function getSession(api) {
  return new Promise((resolve) => {
    try {
      api.getSession((result) => {
        // Geotab passes either { credentials, server } or the credentials directly
        const creds = result?.credentials || result || {};
        console.log('[session] raw result:', result);
        resolve({
          userName: creds.userName || creds.name || '',
          userId:   creds.userId   || '',
          sessionId: creds.sessionId || '',
          database:  creds.database  || '',
        });
      }, () => resolve({ userName: '', userId: '', sessionId: '', database: '' }));
    } catch (e) {
      console.error('[session] getSession error:', e);
      resolve({ userName: '', userId: '', sessionId: '', database: '' });
    }
  });
}

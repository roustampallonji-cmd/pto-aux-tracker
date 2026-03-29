// Fetch the current logged-in user's session info.
// Returns { userName, userId, database }
export function getSession(api) {
  return new Promise((resolve, reject) => {
    api.getSession((session) => resolve(session), reject);
  });
}

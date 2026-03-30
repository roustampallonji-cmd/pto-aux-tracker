import React, { useState, useEffect } from 'react';
import { fetchUsers, saveSelectedUser } from '../../api/session';

export default function UserPicker({ api, session, onSessionChange }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  // Auto-open the picker if no user is set yet
  useEffect(() => {
    if (!session?.userName) setOpen(true);
  }, [session?.userName]);

  // Load users on mount — don't wait for picker to open
  useEffect(() => {
    fetchUsers(api).then(list => {
      console.log('[UserPicker] fetchUsers returned:', list.length, 'users');
      setUsers(list);
    });
  }, []);

  function select(u) {
    const selected = { userName: u.userName, displayName: u.userName, userId: u.id || '' };
    saveSelectedUser(selected);
    onSessionChange(selected);
    setOpen(false);
    setSearch('');
  }

  const filtered = users.filter(u =>
    u.userName.toLowerCase().includes(search.toLowerCase()) ||
    (u.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="user-picker-bar">
      {session?.userName ? (
        <>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Saved by:</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#1f4e79' }}>{session.userName}</span>
          <button className="small-btn" onClick={() => setOpen(v => !v)}>Change</button>
        </>
      ) : (
        <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>⚠ Select your user to enable saving</span>
      )}

      {open && (
        <div className="user-picker-dropdown">
          <div style={{ padding: '8px 8px 4px', borderBottom: '1px solid #e5e7eb' }}>
            <input
              autoFocus
              type="text"
              placeholder="Search by email or name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
            />
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filtered.length === 0
              ? <div style={{ padding: '8px 12px', fontSize: 12, color: '#9ca3af' }}>No results</div>
              : filtered.map(u => (
                <div
                  key={u.id}
                  onClick={() => select(u)}
                  style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <div style={{ fontWeight: 500 }}>{u.userName}</div>
                  {u.name && <div style={{ fontSize: 11, color: '#6b7280' }}>{u.name}</div>}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

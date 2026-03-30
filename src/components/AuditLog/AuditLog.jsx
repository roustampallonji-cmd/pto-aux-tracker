import React, { useState, useMemo } from 'react';
import { AUX_DIAGNOSTICS } from '../../api/diagnostics';
import { fmtDateTime, getPresetRange, startOfDay, endOfDay } from '../../utils/formatters';
import { exportAuditLog } from '../../utils/exportAuditLog';

function buildAllRows(deviceDataMap, deviceMap) {
  const rows = [];
  for (const [deviceId, devData] of Object.entries(deviceDataMap)) {
    const baselines = devData.baselines || {};
    for (const [auxKey, history] of Object.entries(baselines)) {
      if (!Array.isArray(history)) continue;
      for (const entry of history) {
        rows.push({
          deviceId,
          deviceName: deviceMap[deviceId]?.name || deviceId,
          auxKey,
          value: entry.value,
          comment: entry.comment || '',
          user: entry.user || '',
          userId: entry.userId || '',
          timestamp: entry.timestamp,
        });
      }
    }
  }
  return rows;
}

const DATE_PRESETS = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'thisWeek', label: 'This Week' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

export default function AuditLog({ deviceDataMap, deviceMap, visible, onToggle }) {
  const [searched, setSearched] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [userSearch, setUserSearch] = useState('');
  const [userDropOpen, setUserDropOpen] = useState(false);
  const [datePreset, setDatePreset] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState(new Set());
  const [assetSearch, setAssetSearch] = useState('');
  const [assetDropOpen, setAssetDropOpen] = useState(false);

  const allRows = useMemo(() => buildAllRows(deviceDataMap, deviceMap), [deviceDataMap, deviceMap]);

  const allUsers = useMemo(() => {
    const s = new Set(allRows.map(r => r.user).filter(Boolean));
    return [...s].sort();
  }, [allRows]);

  const allDevicesWithData = useMemo(() => {
    const ids = new Set(allRows.map(r => r.deviceId));
    return [...ids]
      .map(id => ({ id, name: deviceMap[id]?.name || id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allRows, deviceMap]);

  function auxLabel(deviceId, auxKey) {
    const diag = AUX_DIAGNOSTICS.find(d => d.key === auxKey);
    const base = diag?.label || auxKey;
    const custom = deviceDataMap[deviceId]?.labels?.[auxKey];
    return custom ? `${base} — ${custom}` : base;
  }

  function toggleUser(u) {
    setSelectedUsers(prev => { const n = new Set(prev); n.has(u) ? n.delete(u) : n.add(u); return n; });
  }
  function toggleDevice(id) {
    setSelectedDeviceIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const filteredRows = useMemo(() => {
    if (!searched) return [];
    let rows = [...allRows];

    if (selectedUsers.size > 0) rows = rows.filter(r => selectedUsers.has(r.user));

    if (datePreset !== 'all') {
      let from, to;
      if (datePreset === 'custom') {
        from = customFrom ? startOfDay(new Date(customFrom)) : null;
        to   = customTo   ? endOfDay(new Date(customTo))   : null;
      } else {
        const range = getPresetRange(datePreset);
        from = range.from; to = range.to;
      }
      if (from) rows = rows.filter(r => new Date(r.timestamp) >= from);
      if (to)   rows = rows.filter(r => new Date(r.timestamp) <= to);
    }

    if (selectedDeviceIds.size > 0) rows = rows.filter(r => selectedDeviceIds.has(r.deviceId));

    return rows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [searched, allRows, selectedUsers, datePreset, customFrom, customTo, selectedDeviceIds]);

  const filteredUsers   = allUsers.filter(u => u.toLowerCase().includes(userSearch.toLowerCase()));
  const filteredDevices = allDevicesWithData.filter(d => d.name.toLowerCase().includes(assetSearch.toLowerCase()));

  function closeDrops() { setUserDropOpen(false); setAssetDropOpen(false); }

  return (
    <div className="chart-section" style={{ marginTop: 16 }}>
      <div className="chart-header">
        <span className="chart-title">Baseline Audit Log</span>
        <button className="small-btn" onClick={onToggle}>{visible ? '▲ Collapse' : '▼ Expand'}</button>
      </div>

      {visible && (
        <div style={{ padding: '12px 16px' }}>

          {/* ── Filter bar ── */}
          <div className="audit-filters">

            {/* User picker */}
            <div className="audit-filter-group">
              <div className="audit-filter-label">User</div>
              <div style={{ position: 'relative' }}>
                <button className="audit-select-btn" onClick={() => { setUserDropOpen(v => !v); setAssetDropOpen(false); }}>
                  {selectedUsers.size === 0 ? 'All users' : `${selectedUsers.size} selected`} ▾
                </button>
                {userDropOpen && (
                  <div className="audit-dropdown">
                    <div style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                      <input autoFocus type="text" placeholder="Search…" value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        style={{ width: '100%', padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }} />
                    </div>
                    <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                      {filteredUsers.length === 0
                        ? <div style={{ padding: '6px 10px', fontSize: 12, color: '#9ca3af' }}>No users found</div>
                        : filteredUsers.map(u => (
                          <label key={u} className="audit-check-row">
                            <input type="checkbox" checked={selectedUsers.has(u)} onChange={() => toggleUser(u)} />
                            {u}
                          </label>
                        ))}
                    </div>
                    {selectedUsers.size > 0 && (
                      <div style={{ padding: '4px 8px', borderTop: '1px solid #e5e7eb' }}>
                        <button className="small-btn" onClick={() => setSelectedUsers(new Set())}>Clear</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Date range */}
            <div className="audit-filter-group">
              <div className="audit-filter-label">Date Range</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {DATE_PRESETS.map(p => (
                  <button key={p.key} className={`preset-btn${datePreset === p.key ? ' active' : ''}`} onClick={() => setDatePreset(p.key)}>
                    {p.label}
                  </button>
                ))}
                {datePreset === 'custom' && (
                  <>
                    <input type="date" className="date-input" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ width: 150 }} />
                    <span style={{ fontSize: 12, color: '#6b7280' }}>→</span>
                    <input type="date" className="date-input" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ width: 150 }} />
                  </>
                )}
              </div>
            </div>

            {/* Asset picker */}
            <div className="audit-filter-group">
              <div className="audit-filter-label">Asset</div>
              <div style={{ position: 'relative' }}>
                <button className="audit-select-btn" onClick={() => { setAssetDropOpen(v => !v); setUserDropOpen(false); }}>
                  {selectedDeviceIds.size === 0 ? 'All assets' : `${selectedDeviceIds.size} selected`} ▾
                </button>
                {assetDropOpen && (
                  <div className="audit-dropdown">
                    <div style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                      <input autoFocus type="text" placeholder="Search assets…" value={assetSearch}
                        onChange={e => setAssetSearch(e.target.value)}
                        style={{ width: '100%', padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }} />
                    </div>
                    <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                      {filteredDevices.length === 0
                        ? <div style={{ padding: '6px 10px', fontSize: 12, color: '#9ca3af' }}>No assets found</div>
                        : filteredDevices.map(d => (
                          <label key={d.id} className="audit-check-row">
                            <input type="checkbox" checked={selectedDeviceIds.has(d.id)} onChange={() => toggleDevice(d.id)} />
                            {d.name}
                          </label>
                        ))}
                    </div>
                    {selectedDeviceIds.size > 0 && (
                      <div style={{ padding: '4px 8px', borderTop: '1px solid #e5e7eb' }}>
                        <button className="small-btn" onClick={() => setSelectedDeviceIds(new Set())}>Clear</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <button
                style={{ padding: '6px 20px', background: '#1f4e79', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                onClick={() => { setSearched(true); closeDrops(); }}
              >
                Search
              </button>
              {searched && filteredRows.length > 0 && (
                <button className="small-btn" onClick={() => exportAuditLog(filteredRows, auxLabel)}>
                  ↓ Export Excel
                </button>
              )}
            </div>
          </div>

          {/* ── Results ── */}
          {!searched ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              Apply filters and click <strong>Search</strong> to view the audit log.
            </div>
          ) : filteredRows.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              No baseline changes match the selected filters.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table className="results-table" style={{ minWidth: 700, borderRadius: 0 }}>
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>User</th>
                    <th>Asset</th>
                    <th>AUX Channel</th>
                    <th style={{ textAlign: 'right' }}>Value (hrs)</th>
                    <th>Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDateTime(r.timestamp)}</td>
                      <td style={{ fontSize: 12 }}>{r.user || '—'}</td>
                      <td style={{ fontSize: 12, fontWeight: 500 }}>{r.deviceName}</td>
                      <td style={{ fontSize: 12 }}>{auxLabel(r.deviceId, r.auxKey)}</td>
                      <td className="total-cell" style={{ textAlign: 'right' }}>{typeof r.value === 'number' ? r.value.toFixed(2) : '—'}</td>
                      <td style={{ fontSize: 12, color: '#4b5563' }}>{r.comment || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 11, color: '#9ca3af', padding: '6px 2px', textAlign: 'right' }}>
                {filteredRows.length} record{filteredRows.length !== 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

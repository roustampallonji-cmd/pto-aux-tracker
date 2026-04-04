import React from 'react';
import { AUX_KEYS } from '../../api/diagnostics';
import { fmtSmartDateTime } from '../../utils/formatters';

function fmtDateRange(dateRange) {
  if (!dateRange?.from || !dateRange?.to) return '—';
  const opts = { month: 'short', day: 'numeric' };
  const toOpts = { month: 'short', day: 'numeric', year: 'numeric' };
  const from = new Date(dateRange.from).toLocaleDateString(undefined, opts);
  const to   = new Date(dateRange.to).toLocaleDateString(undefined, toOpts);
  return `${from} – ${to}`;
}

function fmtStatusLabel(statusFilter) {
  if (statusFilter === 'communicating') return 'Communicating';
  if (statusFilter === 'offline') return 'Not Communicating';
  return 'All';
}

function sumAuxHrs(hours, activeAux) {
  return activeAux.reduce((sum, key) => sum + (hours[key] || 0), 0);
}

function fmtHrs(n) {
  if (!n) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' hrs';
}

export default function FleetConsole({
  assetResults, dateRange, activeAux, statusFilter, deviceMap, loading,
}) {
  const hasData = assetResults.length > 0;
  const communicating = assetResults.filter(r => r.isDeviceCommunicating === true).length;
  const offline       = assetResults.filter(r => r.isDeviceCommunicating === false).length;

  const tiles = [
    {
      label: 'Assets Loaded',
      value: hasData ? assetResults.length : '—',
      sub:   hasData ? `${assetResults.length} selected` : '0 selected',
    },
    {
      label: 'Communicating',
      value: hasData ? communicating : '—',
      sub:   hasData ? `${communicating} assets` : '0 assets',
      accent: hasData && communicating > 0 ? 'green' : null,
    },
    {
      label: 'Offline',
      value: hasData ? offline : '—',
      sub:   hasData ? `${offline} assets` : '0 assets',
      accent: hasData && offline > 0 ? 'red' : null,
    },
    {
      label: 'AUX Tracked',
      value: hasData ? activeAux.length : '—',
      sub:   `${activeAux.length} / ${AUX_KEYS.length} columns`,
    },
  ];

  return (
    <div className="fc-panel">

      {/* ── Header ── */}
      <div className="fc-header">
        <div className="fc-header-left">
          <span className="fc-header-bar">▌</span>
          <div>
            <div className="fc-header-title">Fleet Console</div>
            <div className="fc-header-sub">Fleet auxiliary hours monitoring</div>
          </div>
        </div>
        <div className="fc-header-right">
          <span className="fc-header-badge">📅 {fmtDateRange(dateRange)}</span>
          <span className="fc-header-badge">Status: {fmtStatusLabel(statusFilter)}</span>
        </div>
      </div>

      {/* ── Stat tiles ── */}
      <div className="fc-tiles">
        {tiles.map(t => (
          <div key={t.label} className="fc-tile">
            <div className="fc-tile-label">{t.label}</div>
            <div className={`fc-tile-value${t.accent === 'green' ? ' fc-tile-value--green' : t.accent === 'red' ? ' fc-tile-value--red' : ''}`}>
              {t.value}
            </div>
            <div className="fc-tile-sub">{t.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Mini grid ── */}
      <div className="fc-grid">
        <div className="fc-grid-header">
          <span className="fc-grid-col fc-grid-col--name">Asset Name</span>
          <span className="fc-grid-col">Last Seen</span>
          <span className="fc-grid-col">AUX Hrs</span>
          <span className="fc-grid-col fc-grid-col--status">Status</span>
        </div>

        <div className="fc-grid-body">
          {loading && (
            <div className="fc-grid-empty">⏳ Loading data...</div>
          )}
          {!loading && !hasData && (
            <div className="fc-grid-empty">
              No assets selected — choose a group or device above to begin.
            </div>
          )}
          {!loading && hasData && assetResults.map(r => {
            const device = deviceMap[r.deviceId];
            const totalHrs = sumAuxHrs(r.hours, activeAux);
            const online  = r.isDeviceCommunicating === true;
            const unknown = r.isDeviceCommunicating === null;
            return (
              <div key={r.deviceId} className="fc-grid-row">
                <span className="fc-grid-col fc-grid-col--name">{device?.name || r.deviceId}</span>
                <span className="fc-grid-col fc-grid-col--secondary">
                  {r.lastCommunication ? fmtSmartDateTime(r.lastCommunication) : '—'}
                </span>
                <span className="fc-grid-col fc-grid-col--secondary">{fmtHrs(totalHrs)}</span>
                <span className="fc-grid-col fc-grid-col--status">
                  <span className={`fc-dot ${unknown ? 'fc-dot--unknown' : online ? 'fc-dot--online' : 'fc-dot--offline'}`} />
                  <span className="fc-grid-col--secondary">{unknown ? 'Unknown' : online ? 'Online' : 'Offline'}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

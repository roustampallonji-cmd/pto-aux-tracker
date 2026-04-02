import React, { useState, useMemo } from 'react';
import { AUX_DIAGNOSTICS } from '../../api/diagnostics';
import { getPresetRange } from '../../utils/formatters';

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'thisWeek', label: 'This Week' },
  { key: 'lastWeek', label: 'Last Week' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'custom', label: 'Custom' },
];

const STATUS_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'communicating', label: 'Communicating' },
  { key: 'offline', label: 'Not Communicating' },
];

function toDatetimeLocal(date) {
  if (!date) return '';
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function FilterPane({
  devices, groups,
  selectedDeviceIds, onSelectionChange,
  dateRange, onDateRangeChange,
  activeAux, onAuxChange,
  statusFilter, onStatusFilterChange,
  activeAuxSet,
}) {
  const [search, setSearch] = useState('');
  const [activePreset, setActivePreset] = useState('thisMonth');

  function applyPreset(key) {
    setActivePreset(key);
    if (key !== 'custom') {
      onDateRangeChange(getPresetRange(key));
    }
  }

  const filteredGroups = useMemo(() =>
    groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase())),
    [groups, search]
  );

  const filteredDevices = useMemo(() =>
    devices.filter(d => d.name.toLowerCase().includes(search.toLowerCase())),
    [devices, search]
  );

  function toggleDevice(id) {
    const next = new Set(selectedDeviceIds);
    next.has(id) ? next.delete(id) : next.add(id);
    onSelectionChange([...next]);
  }

  function toggleGroup(groupId) {
    const groupDeviceIds = devices
      .filter(d => d.groups?.some(g => g.id === groupId))
      .map(d => d.id);
    const allSelected = groupDeviceIds.every(id => selectedDeviceIds.includes(id));
    const next = new Set(selectedDeviceIds);
    groupDeviceIds.forEach(id => allSelected ? next.delete(id) : next.add(id));
    onSelectionChange([...next]);
  }

  function toggleAux(key) {
    const next = new Set(activeAux);
    next.has(key) ? next.delete(key) : next.add(key);
    onAuxChange([...next]);
  }

  const allDeviceIds = devices.map(d => d.id);
  const allSelected = allDeviceIds.length > 0 && allDeviceIds.every(id => selectedDeviceIds.includes(id));

  function selectAll() { onSelectionChange(allDeviceIds); }
  function clearAll() { onSelectionChange([]); }

  return (
    <div className="filter-pallet">
      {/* Date Range */}
      <div className="filter-section">
        <div className="filter-label">Date Range</div>
        <div className="preset-pills">
          {PRESETS.map(p => (
            <button
              key={p.key}
              className={`preset-btn ${activePreset === p.key ? 'active' : ''}`}
              onClick={() => applyPreset(p.key)}
            >{p.label}</button>
          ))}
        </div>
        <div className="date-inputs">
          <div className="date-input-row">
            <span className="text-muted">From</span>
            <input
              type="datetime-local"
              className="date-input"
              value={toDatetimeLocal(dateRange.from)}
              onChange={e => { setActivePreset('custom'); onDateRangeChange({ ...dateRange, from: new Date(e.target.value) }); }}
            />
          </div>
          <div className="date-input-row">
            <span className="text-muted">To</span>
            <input
              type="datetime-local"
              className="date-input"
              value={toDatetimeLocal(dateRange.to)}
              onChange={e => { setActivePreset('custom'); onDateRangeChange({ ...dateRange, to: new Date(e.target.value) }); }}
            />
          </div>
        </div>
      </div>

      {/* Assets */}
      <div className="filter-section">
        <div className="filter-label-row">
          <div className="filter-label">Assets</div>
          <div className="filter-quick-actions">
            <button className="filter-link-btn" onClick={selectAll} disabled={allSelected}>All</button>
            <button className="filter-link-btn" onClick={clearAll} disabled={selectedDeviceIds.length === 0}>Clear</button>
          </div>
        </div>
        <div className="asset-search">
          <input
            type="text"
            placeholder="Search assets or groups..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="asset-lists">
          <div className="asset-list-section">
            <h4>Groups</h4>
            {filteredGroups.map(g => {
              const groupDeviceIds = devices.filter(d => d.groups?.some(x => x.id === g.id)).map(d => d.id);
              const allSel = groupDeviceIds.length > 0 && groupDeviceIds.every(id => selectedDeviceIds.includes(id));
              return (
                <label key={g.id} className="asset-list-item">
                  <input type="checkbox" checked={allSel} onChange={() => toggleGroup(g.id)} />
                  {g.name}
                </label>
              );
            })}
          </div>
          <div className="asset-list-section">
            <h4>Devices</h4>
            {filteredDevices.map(d => (
              <label key={d.id} className="asset-list-item">
                <input type="checkbox" checked={selectedDeviceIds.includes(d.id)} onChange={() => toggleDevice(d.id)} />
                {d.name}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* AUX Columns */}
      <div className="filter-section">
        <div className="filter-label">AUX Columns</div>
        <div className="aux-pills">
          {AUX_DIAGNOSTICS.map(({ key, label }) => (
            <button
              key={key}
              className={`aux-pill ${activeAux.includes(key) ? 'active' : ''}`}
              onClick={() => toggleAux(key)}
              title={activeAuxSet.has(key) ? 'Has data' : 'No data in selected range'}
              style={{ opacity: activeAuxSet.has(key) ? 1 : 0.5 }}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* Status Filter */}
      <div className="filter-section">
        <div className="filter-label">Status Filter</div>
        <div className="status-filter">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s.key}
              className={`status-btn ${statusFilter === s.key ? 'active' : ''}`}
              onClick={() => onStatusFilterChange(s.key)}
            >{s.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

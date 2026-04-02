import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Card,
  DateRange,
  GET_TODAY_OPTION,
  GET_YESTERDAY_OPTION,
  GET_THIS_WEEK_OPTION,
  GET_LAST_WEEK_OPTION,
  GET_THIS_MONTH_OPTION,
  GET_LAST_MONTH_OPTION,
  FiltersChip,
  GroupButton,
} from '@geotab/zenith';
import { AUX_DIAGNOSTICS } from '../../api/diagnostics';
import { getPresetRange } from '../../utils/formatters';

const DATE_OPTIONS = [
  GET_TODAY_OPTION(),
  GET_YESTERDAY_OPTION(),
  GET_THIS_WEEK_OPTION(),
  GET_LAST_WEEK_OPTION(),
  GET_THIS_MONTH_OPTION(),
  GET_LAST_MONTH_OPTION(),
];

const STATUS_GROUP_DATA = [
  { name: 'All', value: 'all' },
  { name: 'Communicating', value: 'communicating' },
  { name: 'Not Communicating', value: 'offline' },
];

/** Inline dropdown — no portal, opens within the card */
function AssetDropdown({ label, items, selectedIds, onToggle, onSelectAll, onClearAll }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = useMemo(() =>
    items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())),
    [items, search]
  );

  const count = selectedIds.length;

  return (
    <div className="adr-wrap" ref={ref}>
      <button className="adr-trigger" onClick={() => setOpen(v => !v)}>
        <span className="adr-trigger-label">{label}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {count > 0 && <span className="adr-badge">{count}</span>}
          <span className="adr-chevron">{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div className="adr-panel">
          <div className="adr-search-row">
            <input
              autoFocus
              className="adr-search"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="adr-actions-row">
            <button className="adr-link" onClick={onSelectAll}>Select all</button>
            <button className="adr-link" onClick={onClearAll}>Clear</button>
          </div>
          <div className="adr-list">
            {filtered.map(item => (
              <label key={item.id} className="adr-item">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => onToggle(item.id)}
                />
                <span>{item.name}</span>
              </label>
            ))}
            {filtered.length === 0 && (
              <div className="adr-empty">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FilterPane({
  devices, groups,
  selectedDeviceIds, onSelectionChange,
  dateRange, onDateRangeChange,
  activeAux, onAuxChange,
  statusFilter, onStatusFilterChange,
  activeAuxSet,
}) {
  const initialDateValue = useMemo(() => ({
    ...getPresetRange('thisMonth'),
    label: 'This Month',
  }), []);

  // Which groups have all their devices selected
  const selectedGroupIds = useMemo(() =>
    groups
      .filter(g => {
        const ids = devices.filter(d => d.groups?.some(x => x.id === g.id)).map(d => d.id);
        return ids.length > 0 && ids.every(id => selectedDeviceIds.includes(id));
      })
      .map(g => g.id),
    [groups, devices, selectedDeviceIds]
  );

  function toggleGroup(groupId) {
    const ids = devices.filter(d => d.groups?.some(x => x.id === groupId)).map(d => d.id);
    const allSel = ids.every(id => selectedDeviceIds.includes(id));
    const next = new Set(selectedDeviceIds);
    ids.forEach(id => allSel ? next.delete(id) : next.add(id));
    onSelectionChange([...next]);
  }

  function toggleDevice(deviceId) {
    const next = new Set(selectedDeviceIds);
    next.has(deviceId) ? next.delete(deviceId) : next.add(deviceId);
    onSelectionChange([...next]);
  }

  return (
    <div className="filter-card-row">

      {/* Date Range */}
      <Card title="Date Range">
        <Card.Content>
          <DateRange
            options={DATE_OPTIONS}
            defaultValue={initialDateValue}
            value={{ from: dateRange.from, to: dateRange.to }}
            onChange={({ from, to }) => onDateRangeChange({ from, to })}
            withCalendar
            timeSelect
          />
        </Card.Content>
      </Card>

      {/* Assets */}
      <Card title="Assets">
        <Card.Content>
          <AssetDropdown
            label="Groups"
            items={groups.map(g => ({ id: g.id, name: g.name }))}
            selectedIds={selectedGroupIds}
            onToggle={toggleGroup}
            onSelectAll={() => onSelectionChange(devices.map(d => d.id))}
            onClearAll={() => onSelectionChange([])}
          />
          <div style={{ marginTop: 10 }}>
            <AssetDropdown
              label="Devices"
              items={devices.map(d => ({ id: d.id, name: d.name }))}
              selectedIds={selectedDeviceIds}
              onToggle={toggleDevice}
              onSelectAll={() => onSelectionChange(devices.map(d => d.id))}
              onClearAll={() => onSelectionChange([])}
            />
          </div>
        </Card.Content>
      </Card>

      {/* AUX Columns */}
      <Card title="AUX Columns">
        <Card.Content>
          <div className="aux-chip-grid">
            {AUX_DIAGNOSTICS.map(({ key, label }) => (
              <FiltersChip
                key={key}
                id={key}
                name={label}
                state={activeAux.includes(key)}
                onChange={newState => {
                  const next = new Set(activeAux);
                  newState ? next.add(key) : next.delete(key);
                  onAuxChange([...next]);
                }}
                style={{ opacity: activeAuxSet.has(key) ? 1 : 0.4 }}
              />
            ))}
          </div>
        </Card.Content>
      </Card>

      {/* Status */}
      <Card title="Status">
        <Card.Content>
          <GroupButton
            groupData={STATUS_GROUP_DATA}
            value={statusFilter}
            onChange={e => onStatusFilterChange(e.target.value)}
            fullWidth
          />
        </Card.Content>
      </Card>

    </div>
  );
}

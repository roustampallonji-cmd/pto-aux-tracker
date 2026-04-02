import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Card, FiltersChip, GroupButton } from '@geotab/zenith';
import { AUX_DIAGNOSTICS } from '../../api/diagnostics';
import { getPresetRange } from '../../utils/formatters';

// ── Inline Date Range ──────────────────────────────────────────────────────────

const IDR_PRESETS = [
  { key: 'today',     label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'thisWeek',  label: 'This week' },
  { key: 'lastWeek',  label: 'Last week' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'custom',    label: 'Custom' },
];

const IDR_TIME_START = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
const IDR_TIME_END   = [...IDR_TIME_START, '23:59'];

function toLocalDateStr(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, '0'),
    String(dt.getDate()).padStart(2, '0'),
  ].join('-');
}

function buildLocalDate(dateStr, timeStr) {
  if (!dateStr) return null;
  const [y, m, dd] = dateStr.split('-').map(Number);
  const [h, min]   = timeStr.split(':').map(Number);
  return new Date(y, m - 1, dd, h, min, 0, 0);
}

function presetSubLabel(key) {
  if (key === 'today' || key === 'yesterday' || key === 'custom') return null;
  const r = getPresetRange(key);
  return `${toLocalDateStr(r.from)} - ${toLocalDateStr(r.to)}`;
}

function buildCalDays(ref) {
  const year  = ref.getFullYear();
  const month = ref.getMonth();
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const startDow = (first.getDay() + 6) % 7; // Mon = 0
  const days = [];
  for (let i = 0; i < startDow; i++)
    days.push({ date: new Date(year, month, 1 - startDow + i), inMonth: false });
  for (let d = 1; d <= last.getDate(); d++)
    days.push({ date: new Date(year, month, d), inMonth: true });
  while (days.length % 7 !== 0) {
    const prev = days[days.length - 1].date;
    days.push({ date: new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1), inMonth: false });
  }
  return days;
}

function sameDay(a, b) {
  return a && b && a.toDateString() === b.toDateString();
}

function InlineDateRange({ value, onChange }) {
  const [selected,   setSelected]   = useState('thisMonth');
  const [customFrom, setCustomFrom] = useState(() => toLocalDateStr(value.from));
  const [customTo,   setCustomTo]   = useState(() => toLocalDateStr(value.to));
  const [fromTime,   setFromTime]   = useState('00:00');
  const [toTime,     setToTime]     = useState('23:59');
  const [calMonth,   setCalMonth]   = useState(() => new Date(value.from || new Date()));

  function selectPreset(key) {
    setSelected(key);
    if (key !== 'custom') {
      const r = getPresetRange(key);
      onChange(r);
      setCalMonth(new Date(r.from));
    }
  }

  const displayRange = useMemo(() => {
    if (selected === 'custom') {
      return {
        from: buildLocalDate(customFrom, fromTime),
        to:   buildLocalDate(customTo, toTime),
      };
    }
    return getPresetRange(selected);
  }, [selected, customFrom, customTo, fromTime, toTime]);

  const calDays = useMemo(() => buildCalDays(calMonth), [calMonth]);

  const calLabel = calMonth.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

  function prevMonth() { setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1)); }
  function nextMonth() { setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1)); }

  return (
    <div className="idr-root">

      {/* Preset radio list */}
      <div className="idr-presets">
        {IDR_PRESETS.map(({ key, label }) => {
          const sub = presetSubLabel(key);
          return (
            <label key={key} className={`idr-row${selected === key ? ' idr-row--active' : ''}`}>
              <input
                type="radio"
                name="idr-preset"
                checked={selected === key}
                onChange={() => selectPreset(key)}
                className="idr-radio"
              />
              <span className="idr-row-content">
                <span className="idr-row-label">{label}</span>
                {sub && <span className="idr-row-sub">{sub}</span>}
              </span>
            </label>
          );
        })}
      </div>

      {/* Custom date + time inputs */}
      {selected === 'custom' && (
        <div className="idr-custom">
          <div className="idr-field">
            <span className="idr-field-label">Start date</span>
            <div className="idr-field-row">
              <input
                type="date"
                className="idr-date-input"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
              />
              <select className="idr-time-sel" value={fromTime} onChange={e => setFromTime(e.target.value)}>
                {IDR_TIME_START.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="idr-field">
            <span className="idr-field-label">End date</span>
            <div className="idr-field-row">
              <input
                type="date"
                className="idr-date-input"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
              />
              <select className="idr-time-sel" value={toTime} onChange={e => setToTime(e.target.value)}>
                {IDR_TIME_END.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Mini calendar */}
      <div className="idr-cal">
        <div className="idr-cal-hdr">
          <button className="idr-cal-nav" onClick={prevMonth}>‹</button>
          <span className="idr-cal-month">{calLabel}</span>
          <button className="idr-cal-today-btn" onClick={() => setCalMonth(new Date())}>Today</button>
          <button className="idr-cal-nav" onClick={nextMonth}>›</button>
        </div>
        <div className="idr-cal-grid">
          {['M','T','W','T','F','S','S'].map((d, i) => (
            <span key={i} className="idr-cal-dow">{d}</span>
          ))}
          {calDays.map(({ date, inMonth }, i) => {
            const isStart = sameDay(date, displayRange.from);
            const isEnd   = sameDay(date, displayRange.to);
            const single  = isStart && isEnd;
            const inRange = displayRange.from && displayRange.to &&
                            date > displayRange.from && date < displayRange.to;
            const cls = [
              'idr-cal-day',
              !inMonth              ? 'idr-cal-day--out'    : '',
              single                ? 'idr-cal-day--single' : '',
              !single && isStart    ? 'idr-cal-day--start'  : '',
              !single && isEnd      ? 'idr-cal-day--end'    : '',
              inRange               ? 'idr-cal-day--range'  : '',
            ].filter(Boolean).join(' ');
            return <span key={i} className={cls}>{date.getDate()}</span>;
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="idr-actions">
        <button className="idr-clear-btn" onClick={() => {
          const r = getPresetRange('thisMonth');
          setSelected('thisMonth');
          onChange(r);
          setCalMonth(new Date(r.from));
        }}>Clear</button>
        {selected === 'custom' && (
          <button className="idr-apply-btn" onClick={() => onChange(displayRange)}>Apply</button>
        )}
      </div>

    </div>
  );
}

// ── Asset Dropdown (inline, no portal) ────────────────────────────────────────

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

// ── Status group data ─────────────────────────────────────────────────────────

const STATUS_GROUP_DATA = [
  { name: 'All',               value: 'all' },
  { name: 'Communicating',     value: 'communicating' },
  { name: 'Not Communicating', value: 'offline' },
];

// ── FilterPane ────────────────────────────────────────────────────────────────

export default function FilterPane({
  devices, groups,
  selectedDeviceIds, onSelectionChange,
  dateRange, onDateRangeChange,
  activeAux, onAuxChange,
  statusFilter, onStatusFilterChange,
  activeAuxSet,
}) {
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
          <InlineDateRange value={dateRange} onChange={onDateRangeChange} />
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

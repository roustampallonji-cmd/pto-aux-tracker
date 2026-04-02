import React, { useState, useMemo } from 'react';
import {
  Card,
  DateRange,
  GET_TODAY_OPTION,
  GET_YESTERDAY_OPTION,
  GET_THIS_WEEK_OPTION,
  GET_LAST_WEEK_OPTION,
  GET_THIS_MONTH_OPTION,
  GET_LAST_MONTH_OPTION,
  SearchInput,
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

export default function FilterPane({
  devices, groups,
  selectedDeviceIds, onSelectionChange,
  dateRange, onDateRangeChange,
  activeAux, onAuxChange,
  statusFilter, onStatusFilterChange,
  activeAuxSet,
}) {
  const [search, setSearch] = useState('');

  const initialDateValue = useMemo(() => ({
    ...getPresetRange('thisMonth'),
    label: 'This Month',
  }), []);

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
          <SearchInput
            value={search}
            onChange={val => setSearch(val)}
            placeholder="Search assets or groups..."
          />
          <div className="asset-scroll-list">
            {filteredGroups.length > 0 && (
              <div className="asset-section-label">Groups</div>
            )}
            {filteredGroups.map(g => {
              const groupDeviceIds = devices
                .filter(d => d.groups?.some(x => x.id === g.id))
                .map(d => d.id);
              const allSel = groupDeviceIds.length > 0 &&
                groupDeviceIds.every(id => selectedDeviceIds.includes(id));
              return (
                <label key={g.id} className="asset-check-item">
                  <input type="checkbox" checked={allSel} onChange={() => toggleGroup(g.id)} />
                  <span>{g.name}</span>
                </label>
              );
            })}
            {filteredDevices.length > 0 && (
              <div className="asset-section-label">Devices</div>
            )}
            {filteredDevices.map(d => (
              <label key={d.id} className="asset-check-item">
                <input type="checkbox" checked={selectedDeviceIds.includes(d.id)} onChange={() => toggleDevice(d.id)} />
                <span>{d.name}</span>
              </label>
            ))}
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

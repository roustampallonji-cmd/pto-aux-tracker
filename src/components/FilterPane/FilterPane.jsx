import React, { useMemo } from 'react';
import {
  Card,
  DateRange,
  GET_TODAY_OPTION,
  GET_YESTERDAY_OPTION,
  GET_THIS_WEEK_OPTION,
  GET_LAST_WEEK_OPTION,
  GET_THIS_MONTH_OPTION,
  GET_LAST_MONTH_OPTION,
  Dropdown,
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
  const initialDateValue = useMemo(() => ({
    ...getPresetRange('thisMonth'),
    label: 'This Month',
  }), []);

  // Compute which groups are fully selected
  const selectedGroupIds = useMemo(() =>
    groups
      .filter(g => {
        const ids = devices
          .filter(d => d.groups?.some(x => x.id === g.id))
          .map(d => d.id);
        return ids.length > 0 && ids.every(id => selectedDeviceIds.includes(id));
      })
      .map(g => g.id),
    [groups, devices, selectedDeviceIds]
  );

  function handleGroupChange(selected) {
    const newGroupIds = selected.map(s => s.id);
    const next = new Set(selectedDeviceIds);
    groups.forEach(g => {
      const ids = devices
        .filter(d => d.groups?.some(x => x.id === g.id))
        .map(d => d.id);
      if (newGroupIds.includes(g.id)) {
        ids.forEach(id => next.add(id));
      } else if (selectedGroupIds.includes(g.id)) {
        ids.forEach(id => next.delete(id));
      }
    });
    onSelectionChange([...next]);
  }

  function handleDeviceChange(selected) {
    onSelectionChange(selected.map(s => s.id));
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

      {/* Assets — Groups + Devices as separate Zenith Dropdowns */}
      <Card title="Assets">
        <Card.Content>
          <Dropdown
            label="Groups"
            dataItems={groups.map(g => ({ id: g.id, name: g.name }))}
            value={selectedGroupIds}
            onChange={handleGroupChange}
            multiselect
            searchField
            fullWidthTriggerButton
            showCounterPill
            errorHandler={() => {}}
          />
          <div style={{ marginTop: 10 }}>
            <Dropdown
              label="Devices"
              dataItems={devices.map(d => ({ id: d.id, name: d.name }))}
              value={selectedDeviceIds}
              onChange={handleDeviceChange}
              multiselect
              searchField
              fullWidthTriggerButton
              showCounterPill
              errorHandler={() => {}}
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

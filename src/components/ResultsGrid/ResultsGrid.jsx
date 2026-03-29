import React, { useState } from 'react';
import { Button, ButtonType } from '@geotab/zenith';
import { AUX_DIAGNOSTICS } from '../../api/diagnostics';
import { fmtHoursNum, fmtRelative, fmtDateTime } from '../../utils/formatters';
import { getActiveBaseline, getBaselineHistory } from '../../api/addinData';
import BaselineModify from '../BaselinePanel/BaselineModify';
import BaselineHistory from '../BaselinePanel/BaselineHistory';
import AssetLabelPanel from '../LabelSettings/AssetLabelPanel';
import BulkLabelPanel from '../LabelSettings/BulkLabelPanel';
import ConfirmModal from '../Modals/ConfirmModal';
import { saveBaseline } from '../../api/addinData';

export default function ResultsGrid({
  api, session,
  assetResults, deviceMap, deviceDataMap, allDeviceData,
  activeAux, selectedDeviceIds, allDeviceIds,
  loading, onDeviceDataChange,
}) {
  const [expandedAux, setExpandedAux] = useState(new Set(AUX_DIAGNOSTICS.map(d => d.key)));
  const [modifyingCell, setModifyingCell] = useState(null);   // { deviceId, auxKey }
  const [historyCell, setHistoryCell] = useState(null);        // { deviceId, auxKey }
  const [labelDevice, setLabelDevice] = useState(null);        // deviceId
  const [bulkPanel, setBulkPanel] = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [dashReadings, setDashReadings] = useState({});        // { `${deviceId}__${auxKey}`: value }

  const visibleAux = AUX_DIAGNOSTICS.filter(d => activeAux.includes(d.key));

  function toggleAuxExpand(key) {
    setExpandedAux(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function expandAll() { setExpandedAux(new Set(AUX_DIAGNOSTICS.map(d => d.key))); }
  function collapseAll() { setExpandedAux(new Set()); }

  function toggleRow(id) {
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    const allIds = assetResults.map(r => r.deviceId);
    const allSelected = allIds.every(id => selectedRows.has(id));
    setSelectedRows(allSelected ? new Set() : new Set(allIds));
  }

  function getDeviceLabel(deviceId, auxKey) {
    return deviceDataMap[deviceId]?.labels?.[auxKey] || '';
  }

  async function handleDashUpdate(deviceId, auxKey) {
    const key = `${deviceId}__${auxKey}`;
    const val = dashReadings[key];
    if (!val || isNaN(Number(val))) return;
    await saveBaseline(api, deviceId, auxKey, Number(val), 'Manual dash reading update (device offline)', session.userName, session.userId);
    setDashReadings(prev => ({ ...prev, [key]: '' }));
    onDeviceDataChange();
  }

  if (loading) {
    return <div style={{ padding: 24, color: '#6b7280', textAlign: 'center' }}>Loading AUX data...</div>;
  }

  if (!assetResults.length) {
    return <div style={{ padding: 24, color: '#6b7280', textAlign: 'center' }}>Select assets and a date range to view PTO AUX hours.</div>;
  }

  const selectedArr = [...selectedRows];

  return (
    <div>
      {/* Bulk bar */}
      {selectedRows.size > 0 && (
        <div className="bulk-bar">
          <span>{selectedRows.size} of {assetResults.length} visible selected</span>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              onChange={e => e.target.checked && setBulkPanel(true)}
              checked={false}
            />
            Select entire fleet ({allDeviceIds.length} assets)
          </label>
          <div className="bulk-bar-spacer" />
          <Button type={ButtonType.Secondary} onClick={() => setBulkPanel(true)}>⚙ Edit Labels</Button>
          <Button type={ButtonType.Secondary} onClick={() => setSelectedRows(new Set())}>✕ Clear</Button>
        </div>
      )}

      {/* Bulk label panel */}
      {bulkPanel && (
        <div style={{ marginBottom: 12 }}>
          <BulkLabelPanel
            api={api}
            selectedDeviceIds={selectedArr}
            allDeviceIds={allDeviceIds}
            allDeviceData={allDeviceData}
            deviceMap={deviceMap}
            session={session}
            onDone={() => { setBulkPanel(false); setSelectedRows(new Set()); onDeviceDataChange(); }}
            onCancel={() => setBulkPanel(false)}
          />
        </div>
      )}

      {/* Results header */}
      <div className="results-header">
        <div className="results-title">{assetResults.length} asset{assetResults.length > 1 ? 's' : ''}</div>
        <div className="expand-collapse-btns">
          <button className="small-btn" onClick={expandAll}>Expand All</button>
          <button className="small-btn" onClick={collapseAll}>Collapse All</button>
        </div>
      </div>

      {/* Table */}
      <table className="results-table">
        <thead>
          <tr>
            <th style={{ width: 32 }}>
              <input
                type="checkbox"
                checked={assetResults.length > 0 && assetResults.every(r => selectedRows.has(r.deviceId))}
                onChange={toggleAllVisible}
              />
            </th>
            <th>Asset</th>
            {visibleAux.map(({ key, label }) => {
              const expanded = expandedAux.has(key);
              return expanded ? (
                <React.Fragment key={key}>
                  <th className="aux-group-header" colSpan={3}>
                    <span className="aux-header-toggle" onClick={() => toggleAuxExpand(key)}>
                      <span className="toggle-icon">▼</span> {label}
                    </span>
                  </th>
                </React.Fragment>
              ) : (
                <th key={key} className="aux-group-header">
                  <span className="aux-header-toggle" onClick={() => toggleAuxExpand(key)}>
                    <span className="toggle-icon">►</span> {label}
                  </span>
                </th>
              );
            })}
            <th>Communication</th>
          </tr>
          <tr>
            <th /><th />
            {visibleAux.map(({ key }) =>
              expandedAux.has(key) ? (
                <React.Fragment key={key}>
                  <th className="sub-header">Duration (hrs)</th>
                  <th className="sub-header">Baseline (hrs)</th>
                  <th className="sub-header">Total (hrs)</th>
                </React.Fragment>
              ) : (
                <th key={key} className="sub-header">Total (hrs)</th>
              )
            )}
            <th />
          </tr>
        </thead>

        <tbody>
          {assetResults.map(r => {
            const device = deviceMap[r.deviceId] || {};
            const devData = deviceDataMap[r.deviceId] || {};
            const isOnline = r.isDeviceCommunicating;

            return (
              <React.Fragment key={r.deviceId}>
                <tr>
                  <td>
                    <input type="checkbox" checked={selectedRows.has(r.deviceId)} onChange={() => toggleRow(r.deviceId)} />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{device.name || r.deviceId}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{device.serialNumber}</div>
                    <button className="icon-btn" title="Edit labels" onClick={() => setLabelDevice(r.deviceId)}>⚙</button>
                  </td>

                  {visibleAux.map(({ key, label }) => {
                    const duration = r.hours?.[key] ?? null;
                    const baseline = getActiveBaseline(devData, key);
                    const total = duration !== null ? baseline + duration : null;
                    const customLabel = getDeviceLabel(r.deviceId, key);
                    const displayLabel = customLabel ? `${label} — ${customLabel}` : label;
                    const isExpanded = expandedAux.has(key);
                    const isModifying = modifyingCell?.deviceId === r.deviceId && modifyingCell?.auxKey === key;
                    const isHistory = historyCell?.deviceId === r.deviceId && historyCell?.auxKey === key;

                    if (!isExpanded) {
                      return (
                        <td key={key} className="total-cell" style={{ textAlign: 'center' }}>
                          {total !== null ? fmtHoursNum(total) : '—'}
                          {customLabel && <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{customLabel}</div>}
                        </td>
                      );
                    }

                    return (
                      <React.Fragment key={key}>
                        <td style={{ textAlign: 'center' }}>
                          {duration !== null ? fmtHoursNum(duration) : '—'}
                          {customLabel && <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{customLabel}</div>}
                        </td>
                        <td style={{ textAlign: 'center', minWidth: 140 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                            <span>{fmtHoursNum(baseline)}</span>
                            <button className="icon-btn" title="Modify baseline" onClick={() => setModifyingCell(isModifying ? null : { deviceId: r.deviceId, auxKey: key })}>✏</button>
                            <button className="icon-btn" title="View history" onClick={() => setHistoryCell(isHistory ? null : { deviceId: r.deviceId, auxKey: key })}>↩</button>
                          </div>

                          {isModifying && (
                            <BaselineModify
                              api={api}
                              deviceId={r.deviceId}
                              auxKey={key}
                              auxLabel={displayLabel}
                              currentValue={baseline}
                              session={session}
                              onSaved={() => { setModifyingCell(null); onDeviceDataChange(); }}
                              onCancel={() => setModifyingCell(null)}
                            />
                          )}
                          {isHistory && (
                            <BaselineHistory
                              history={getBaselineHistory(devData, key)}
                              auxLabel={displayLabel}
                            />
                          )}
                        </td>
                        <td className="total-cell" style={{ textAlign: 'center' }}>
                          {total !== null ? fmtHoursNum(total) : '—'}
                        </td>
                      </React.Fragment>
                    );
                  })}

                  {/* Communication */}
                  <td>
                    <div className="comm-cell">
                      <div className="comm-status">
                        <span className={`comm-dot ${isOnline ? 'online' : 'offline'}`} />
                        <span>{isOnline ? 'Live' : 'Offline'}</span>
                      </div>
                      <div className="comm-last-seen">
                        {r.lastCommunication ? (isOnline ? fmtRelative(r.lastCommunication) : `Last: ${fmtDate(r.lastCommunication)}`) : '—'}
                      </div>

                      {!isOnline && (
                        <div className="dash-reading">
                          <div className="dash-reading-label">Dash reading — update baseline:</div>
                          {visibleAux.filter(({ key }) => expandedAux.has(key)).map(({ key, label }) => {
                            const customLabel = getDeviceLabel(r.deviceId, key);
                            const ck = `${r.deviceId}__${key}`;
                            return (
                              <div key={key} className="dash-reading-row">
                                <span style={{ fontSize: 11, width: 48 }}>{customLabel || label}</span>
                                <input
                                  type="number"
                                  placeholder="hrs"
                                  value={dashReadings[ck] || ''}
                                  onChange={e => setDashReadings(prev => ({ ...prev, [ck]: e.target.value }))}
                                />
                                <button className="small-btn" onClick={() => handleDashUpdate(r.deviceId, key)}>Update</button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>

                {/* Label panel inline */}
                {labelDevice === r.deviceId && (
                  <tr>
                    <td colSpan={2 + visibleAux.length * 3 + 1} style={{ padding: '8px 12px', background: '#f8faff' }}>
                      <AssetLabelPanel
                        api={api}
                        deviceId={r.deviceId}
                        deviceName={device.name}
                        currentLabels={devData.labels || {}}
                        onSaved={() => { setLabelDevice(null); onDeviceDataChange(); }}
                        onCancel={() => setLabelDevice(null)}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

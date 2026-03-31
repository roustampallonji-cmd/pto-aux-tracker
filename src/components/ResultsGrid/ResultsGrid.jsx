import React, { useState } from 'react';
import { Button, ButtonType } from '@geotab/zenith';
import { AUX_DIAGNOSTICS } from '../../api/diagnostics';
import { fmtHoursNum, fmtRelative, fmtSmartDateTime } from '../../utils/formatters';
import { getActiveBaseline, getBaselineHistory, saveDeviceLabels } from '../../api/firebase';
import BaselineModify from '../BaselinePanel/BaselineModify';
import BaselineHistory from '../BaselinePanel/BaselineHistory';
import BulkLabelPanel from '../LabelSettings/BulkLabelPanel';
import ConfirmModal from '../Modals/ConfirmModal';
import CorrectionConfirmModal from '../Modals/CorrectionConfirmModal';
import { saveBaseline } from '../../api/firebase';

const SKIP_KEY = 'pto_aux_correction_skip_v1';
function getSkipCount() { return parseInt(localStorage.getItem(SKIP_KEY) || '0', 10); }
function setSkipCount(n) { localStorage.setItem(SKIP_KEY, String(n)); }

export default function ResultsGrid({
  api, session,
  assetResults, deviceMap, deviceDataMap, allDeviceData,
  activeAux, selectedDeviceIds, allDeviceIds,
  loading, onDeviceDataChange,
}) {
  const [expandedAux, setExpandedAux] = useState(new Set(AUX_DIAGNOSTICS.map(d => d.key)));
  const [modifyingCell, setModifyingCell] = useState(null);   // { deviceId, auxKey }
  const [historyCell, setHistoryCell] = useState(null);        // { deviceId, auxKey }
  const [bulkPanel, setBulkPanel] = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [dashReadings, setDashReadings] = useState({});        // { `${deviceId}__${auxKey}`: value }
  const [meterReadings, setMeterReadings] = useState({});      // { `${deviceId}__${auxKey}`: value }
  const [correctionConfirm, setCorrectionConfirm] = useState(null); // { deviceId, auxKey, offset, meterReading, currentTotal, newBaseline }
  const [editingLabel, setEditingLabel] = useState(null);      // { deviceId, auxKey }
  const [editLabelValue, setEditLabelValue] = useState('');

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

  function startLabelEdit(deviceId, auxKey, currentLabel) {
    setEditingLabel({ deviceId, auxKey });
    setEditLabelValue(currentLabel || '');
  }

  async function commitLabelEdit(deviceId, auxKey) {
    try {
      await saveDeviceLabels(api, deviceId, { [auxKey]: editLabelValue });
      onDeviceDataChange();
    } catch (e) {
      console.error('[Labels] save failed:', e);
    } finally {
      // Only close this cell if no other cell was opened in the meantime
      setEditingLabel(prev =>
        prev?.deviceId === deviceId && prev?.auxKey === auxKey ? null : prev
      );
    }
  }

  function cancelLabelEdit() { setEditingLabel(null); }

  async function doApplyCorrection(deviceId, auxKey, newBaseline, offset, meterReading, currentTotal) {
    const comment = `Meter correction: physical read ${meterReading.toFixed(2)} hrs, calculated ${currentTotal.toFixed(2)} hrs, offset ${offset >= 0 ? '+' : ''}${offset.toFixed(2)} hrs`;
    await saveBaseline(api, deviceId, auxKey, newBaseline, comment, session?.displayName || session?.userName || '', session?.userId || '');
    setMeterReadings(prev => { const n = { ...prev }; delete n[`${deviceId}__${auxKey}`]; return n; });
    setCorrectionConfirm(null);
    onDeviceDataChange();
  }

  function handleApplyCorrection(deviceId, auxKey, newBaseline, offset, meterReading, currentTotal) {
    const skipCount = getSkipCount();
    if (skipCount > 0) {
      setSkipCount(skipCount - 1);
      doApplyCorrection(deviceId, auxKey, newBaseline, offset, meterReading, currentTotal);
    } else {
      setCorrectionConfirm({ deviceId, auxKey, newBaseline, offset, meterReading, currentTotal });
    }
  }

  async function handleDashUpdate(deviceId, auxKey) {
    const key = `${deviceId}__${auxKey}`;
    const val = dashReadings[key];
    if (!val || isNaN(Number(val))) return;
    await saveBaseline(api, deviceId, auxKey, Number(val), 'Manual dash reading update (device offline)', session?.displayName || session?.userName || '', session?.userId || '');
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

      {/* Correction confirm modal */}
      {correctionConfirm && (
        <CorrectionConfirmModal
          meterReading={correctionConfirm.meterReading}
          currentTotal={correctionConfirm.currentTotal}
          offset={correctionConfirm.offset}
          newBaseline={correctionConfirm.newBaseline}
          onConfirm={(dontAsk) => {
            if (dontAsk) setSkipCount(10);
            doApplyCorrection(
              correctionConfirm.deviceId,
              correctionConfirm.auxKey,
              correctionConfirm.newBaseline,
              correctionConfirm.offset,
              correctionConfirm.meterReading,
              correctionConfirm.currentTotal
            );
          }}
          onCancel={() => setCorrectionConfirm(null)}
        />
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
      <div className="results-table-wrap">
      <table className="results-table">
        <thead>
          <tr>
            <th style={{ width: 32 }} className="sticky-left-0">
              <input
                type="checkbox"
                checked={assetResults.length > 0 && assetResults.every(r => selectedRows.has(r.deviceId))}
                onChange={toggleAllVisible}
              />
            </th>
            <th className="sticky-left-1">Asset</th>
            {visibleAux.map(({ key, label }) => {
              const expanded = expandedAux.has(key);
              return expanded ? (
                <React.Fragment key={key}>
                  <th className="aux-group-header" colSpan={5}>
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
            <th className="sticky-right">Communication</th>
          </tr>
          <tr>
            <th className="sticky-left-0" /><th className="sticky-left-1" />
            {visibleAux.map(({ key }) =>
              expandedAux.has(key) ? (
                <React.Fragment key={key}>
                  <th className="sub-header">Duration (hrs)</th>
                  <th className="sub-header">Baseline (hrs)</th>
                  <th className="sub-header">Total (hrs)</th>
                  <th className="sub-header">Meter Reading (hrs)</th>
                  <th className="sub-header">Offset (hrs)</th>
                </React.Fragment>
              ) : (
                <th key={key} className="sub-header">Total (hrs)</th>
              )
            )}
            <th className="sticky-right" />
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
                  <td className="sticky-left-0">
                    <input type="checkbox" checked={selectedRows.has(r.deviceId)} onChange={() => toggleRow(r.deviceId)} />
                  </td>
                  <td className="sticky-left-1">
                    <div style={{ fontWeight: 600 }}>{device.name || r.deviceId}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{device.serialNumber}</div>
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
                    const isEditingLabel = editingLabel?.deviceId === r.deviceId && editingLabel?.auxKey === key;

                    const inlineLabelEl = isEditingLabel ? (
                      <input
                        autoFocus
                        value={editLabelValue}
                        onChange={e => setEditLabelValue(e.target.value)}
                        onBlur={() => commitLabelEdit(r.deviceId, key)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitLabelEdit(r.deviceId, key);
                          if (e.key === 'Escape') cancelLabelEdit();
                        }}
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: 10, width: '80%', border: '1px solid #3b82f6', borderRadius: 3, padding: '1px 4px', marginTop: 2 }}
                      />
                    ) : (
                      <div
                        style={{ fontSize: 10, color: customLabel ? '#1f4e79' : '#c0c4cc', marginTop: 2, cursor: 'text', userSelect: 'none' }}
                        onClick={() => startLabelEdit(r.deviceId, key, customLabel)}
                        title="Click to rename"
                      >
                        {customLabel || 'label…'}
                      </div>
                    );

                    if (!isExpanded) {
                      return (
                        <td key={key} className="total-cell" style={{ textAlign: 'center' }}>
                          {total !== null ? fmtHoursNum(total) : '—'}
                          {inlineLabelEl}
                        </td>
                      );
                    }

                    const mrKey = `${r.deviceId}__${key}`;
                    const mrVal = meterReadings[mrKey] || '';
                    const mrNum = parseFloat(mrVal);
                    const hasValidMr = mrVal !== '' && !isNaN(mrNum) && total !== null;
                    const offset = hasValidMr ? mrNum - total : null;
                    const newBaseline = hasValidMr ? baseline + offset : null;
                    const offsetColor = offset === null ? '' : offset > 0 ? '#16a34a' : offset < 0 ? '#d97706' : '#9ca3af';

                    return (
                      <React.Fragment key={key}>
                        <td style={{ textAlign: 'center' }}>
                          {duration !== null ? fmtHoursNum(duration) : '—'}
                          {inlineLabelEl}
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
                        <td style={{ textAlign: 'center', minWidth: 110 }}>
                          <input
                            className="meter-reading-input"
                            type="number"
                            placeholder="Enter hrs"
                            value={mrVal}
                            onChange={e => setMeterReadings(prev => ({ ...prev, [mrKey]: e.target.value }))}
                            disabled={total === null}
                          />
                        </td>
                        <td style={{ textAlign: 'center', minWidth: 110 }}>
                          {offset !== null && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontWeight: 700, fontSize: 12, color: offsetColor }}>
                                {offset >= 0 ? '+' : ''}{offset.toFixed(2)}
                              </span>
                              {offset !== 0 && (
                                <button
                                  className="small-btn"
                                  style={{ fontSize: 10, padding: '2px 8px', background: '#1f4e79', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                  onClick={() => handleApplyCorrection(r.deviceId, key, newBaseline, offset, mrNum, total)}
                                >
                                  Apply
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </React.Fragment>
                    );
                  })}

                  {/* Communication */}
                  <td className="sticky-right">
                    <div className="comm-cell">
                      <div className="comm-status">
                        <span className={`comm-dot ${isOnline ? 'online' : 'offline'}`} />
                        <span>{isOnline ? 'Live' : 'Offline'}</span>
                      </div>
                      <div className="comm-last-seen">
                        {r.lastCommunication ? fmtSmartDateTime(r.lastCommunication) : '—'}
                      </div>
                      {!isOnline && r.lastCommunication && (
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>
                          {fmtRelative(r.lastCommunication)}
                        </div>
                      )}
                      {r.address && r.latitude !== null && (
                        <a
                          href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 10, color: '#3b82f6', textDecoration: 'none', marginTop: 2, display: 'block', lineHeight: 1.3 }}
                          title="Open in Google Maps"
                        >
                          📍 {r.address}
                        </a>
                      )}

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

              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

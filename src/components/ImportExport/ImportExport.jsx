import React, { useRef, useState, useCallback } from 'react';
import { exportToExcel } from '../../utils/exportExcel';
import { generateTemplate, parseTemplate } from '../../utils/templateExcel';
import { saveBaseline, saveDeviceLabels, loadAllDeviceData } from '../../api/firebase';
import { AUX_KEYS } from '../../api/diagnostics';
import ValidationModal from '../Modals/ValidationModal';
import SuccessModal from '../Modals/SuccessModal';

export default function ImportExport({
  api, session,
  assetResults, allAssetResults,
  deviceMap, deviceDataMap, allDeviceData,
  dateRange, selectedDeviceIds, allDeviceIds,
  activeAux,
  onImportComplete,
}) {
  const fileRef = useRef();
  const [templateMode, setTemplateMode] = useState('selected');
  const [validation, setValidation] = useState(null);
  const [success, setSuccess] = useState(null);
  const [exportToast, setExportToast] = useState(null);  // { msg }
  const [dragging, setDragging] = useState(false);

  const noAssets = selectedDeviceIds.length === 0;
  const exportCount = assetResults.length;
  const allCount = allAssetResults.length;
  const templateCount = templateMode === 'all' ? allDeviceIds.length : selectedDeviceIds.length;
  const auxCount = activeAux?.length ?? AUX_KEYS.length;

  function showToast(msg) {
    setExportToast({ msg });
    setTimeout(() => setExportToast(null), 3500);
  }

  function handleExportView() {
    if (noAssets) return;
    exportToExcel(assetResults, deviceMap, deviceDataMap, dateRange, 'view');
    showToast('Current view exported successfully');
  }

  function handleExportAll() {
    if (noAssets) return;
    exportToExcel(allAssetResults, deviceMap, deviceDataMap, dateRange, 'all');
    showToast('All assets exported successfully');
  }

  function handleGenerateTemplate() {
    if (noAssets) return;
    const devices = templateMode === 'all'
      ? allDeviceIds.map(id => deviceMap[id]).filter(Boolean)
      : selectedDeviceIds.map(id => deviceMap[id]).filter(Boolean);
    generateTemplate(devices, deviceDataMap);
    showToast(`Template generated for ${templateCount} assets`);
  }

  async function processFile(file) {
    if (!file) return;
    try {
      const { valid, errors } = await parseTemplate(file);
      const unknownDevices = valid.filter(r => !deviceMap[r.deviceId]).map(r => r.deviceId);
      const cleanValid = valid.filter(r => deviceMap[r.deviceId]);
      setValidation({ valid: cleanValid, errors, unknownDevices });
    } catch (err) {
      alert('Failed to read template: ' + err.message);
    }
  }

  function handleFileInput(e) {
    const file = e.target.files[0];
    fileRef.current.value = '';
    processFile(file);
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.xlsx')) processFile(file);
    else alert('Please drop an .xlsx file');
  }, [deviceMap]);

  async function handleApplyImport(validRows) {
    setValidation(null);
    let applied = 0;
    for (const row of validRows) {
      if (row.newLabel !== null)
        await saveDeviceLabels(api, row.deviceId, { [row.auxKey]: row.newLabel });
      if (row.newHrs !== null)
        await saveBaseline(api, row.deviceId, row.auxKey, row.newHrs, row.comment,
          session?.displayName || session?.userName || '', session?.userId || '');
      applied++;
    }
    await onImportComplete();
    setSuccess({ lines: [`${applied} update${applied > 1 ? 's' : ''} applied successfully.`] });
  }

  return (
    <>
      {validation && (
        <ValidationModal
          valid={validation.valid}
          errors={validation.errors}
          unknownDevices={validation.unknownDevices}
          user={session}
          onApply={handleApplyImport}
          onCancel={() => setValidation(null)}
        />
      )}
      {success && (
        <SuccessModal
          title="Import Complete"
          lines={success.lines}
          user={{ name: session?.displayName || session?.userName }}
          onClose={() => setSuccess(null)}
        />
      )}

      <div className="actions-panel">
        <div className="actions-panel-header">Data &amp; Actions</div>

        {exportToast && (
          <div className="actions-toast">✅ {exportToast.msg}</div>
        )}

        <div className="actions-sections">

          {/* ── EXPORT ── */}
          <div className="actions-section">
            <div className="actions-section-label">Export</div>
            <div className="actions-section-cards">

              <div className="action-card">
                <div className="action-card-icon">↓</div>
                <div className="action-card-title">Export: Current View</div>
                <div className="action-card-desc">
                  Downloads an Excel file of assets currently visible in the grid — filtered by your date range, AUX columns, and communication status.
                </div>
                {noAssets && <div className="action-card-hint">Select assets first</div>}
                <button
                  className={`action-card-btn${noAssets ? ' action-card-btn--disabled' : ''}`}
                  onClick={handleExportView}
                  disabled={noAssets}
                >
                  ↓ Export{!noAssets ? ` (${exportCount})` : ''}
                </button>
              </div>

              <div className="action-card">
                <div className="action-card-icon">↓</div>
                <div className="action-card-title">Export: All Assets</div>
                <div className="action-card-desc">
                  Downloads an Excel file for all selected assets, regardless of the communication status filter applied to the grid.
                </div>
                {noAssets && <div className="action-card-hint">Select assets first</div>}
                <button
                  className={`action-card-btn${noAssets ? ' action-card-btn--disabled' : ''}`}
                  onClick={handleExportAll}
                  disabled={noAssets}
                >
                  ↓ Export{!noAssets ? ` (${allCount})` : ''}
                </button>
              </div>

            </div>
          </div>

          <div className="actions-divider" />

          {/* ── BASELINE IMPORT ── */}
          <div className="actions-section">
            <div className="actions-section-label">Baseline Import</div>
            <div className="actions-section-cards">

              <div className="action-card">
                <div className="action-card-icon">↓</div>
                <div className="action-card-title">Generate Template</div>
                <div className="action-card-desc">
                  Creates a blank Excel template pre-filled with your asset list and AUX columns. Fill in baseline hours and labels, then upload to apply in bulk.
                </div>
                <select
                  value={templateMode}
                  onChange={e => setTemplateMode(e.target.value)}
                  className="action-card-select"
                >
                  <option value="selected">Selected ({selectedDeviceIds.length} assets)</option>
                  <option value="all">Entire Fleet ({allDeviceIds.length} assets)</option>
                </select>
                {!noAssets && (
                  <div className="action-card-scope">{templateCount} assets · {auxCount} AUX columns</div>
                )}
                {noAssets && <div className="action-card-hint">Select assets first</div>}
                <button
                  className={`action-card-btn${noAssets ? ' action-card-btn--disabled' : ''}`}
                  onClick={handleGenerateTemplate}
                  disabled={noAssets}
                >
                  ↓ Generate{!noAssets ? ` (${templateCount})` : ''}
                </button>
              </div>

              <div className="action-card">
                <div className="action-card-icon">↑</div>
                <div className="action-card-title">Upload Template</div>
                <div className="action-card-desc">
                  Import a completed template to apply labels and baseline hours to multiple assets at once. Validates each row before saving.
                </div>
                <div
                  className={`action-drop-zone${dragging ? ' action-drop-zone--over' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current.click()}
                >
                  <span className="action-drop-icon">↑</span>
                  <span className="action-drop-text">
                    {dragging ? 'Drop to upload' : 'Drop .xlsx here'}
                  </span>
                  <span className="action-drop-sub">or click to browse</span>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx"
                  style={{ display: 'none' }}
                  onChange={handleFileInput}
                />
              </div>

            </div>
          </div>

        </div>
      </div>
    </>
  );
}

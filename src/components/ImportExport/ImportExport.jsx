import React, { useRef, useState } from 'react';
import { Button, ButtonType } from '@geotab/zenith';
import { exportToExcel } from '../../utils/exportExcel';
import { generateTemplate, parseTemplate } from '../../utils/templateExcel';
import { saveBaseline, saveDeviceLabels, loadAllDeviceData } from '../../api/firebase';
import ValidationModal from '../Modals/ValidationModal';
import SuccessModal from '../Modals/SuccessModal';

export default function ImportExport({
  api, session,
  assetResults, allAssetResults,
  deviceMap, deviceDataMap, allDeviceData,
  dateRange, selectedDeviceIds, allDeviceIds,
  onImportComplete,
}) {
  const fileRef = useRef();
  const [templateMode, setTemplateMode] = useState('selected'); // 'selected' | 'all'
  const [validation, setValidation] = useState(null);
  const [success, setSuccess] = useState(null);

  function handleExportView() {
    exportToExcel(assetResults, deviceMap, deviceDataMap, dateRange, 'view');
  }

  function handleExportAll() {
    exportToExcel(allAssetResults, deviceMap, deviceDataMap, dateRange, 'all');
  }

  function handleGenerateTemplate() {
    const devices = templateMode === 'all'
      ? allDeviceIds.map(id => deviceMap[id]).filter(Boolean)
      : selectedDeviceIds.map(id => deviceMap[id]).filter(Boolean);
    generateTemplate(devices, deviceDataMap);
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    fileRef.current.value = '';

    try {
      const { valid, errors } = await parseTemplate(file);
      const unknownDevices = valid.filter(r => !deviceMap[r.deviceId]).map(r => r.deviceId);
      const cleanValid = valid.filter(r => deviceMap[r.deviceId]);
      setValidation({ valid: cleanValid, errors, unknownDevices });
    } catch (err) {
      alert('Failed to read template: ' + err.message);
    }
  }

  async function handleApplyImport(validRows) {
    setValidation(null);
    let applied = 0;

    for (const row of validRows) {
      if (row.newLabel !== null) {
        await saveDeviceLabels(api, row.deviceId, { [row.auxKey]: row.newLabel });
      }
      if (row.newHrs !== null) {
        await saveBaseline(api, row.deviceId, row.auxKey, row.newHrs, row.comment, session?.displayName || session?.userName || '', session?.userId || '');
      }
      applied++;
    }

    await onImportComplete();
    setSuccess({
      lines: [`${applied} update${applied > 1 ? 's' : ''} applied successfully.`],
    });
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
        <div className="actions-cards">

          <div className="action-card">
            <div className="action-card-icon">↓</div>
            <div className="action-card-title">Export: Current View</div>
            <div className="action-card-desc">Downloads an Excel file of assets currently visible in the grid — filtered by your date range, AUX columns, and communication status.</div>
            <Button type={ButtonType.Secondary} onClick={handleExportView}>↓ Export</Button>
          </div>

          <div className="action-card">
            <div className="action-card-icon">↓</div>
            <div className="action-card-title">Export: All Assets</div>
            <div className="action-card-desc">Downloads an Excel file for all selected assets, regardless of the communication status filter applied to the grid.</div>
            <Button type={ButtonType.Secondary} onClick={handleExportAll}>↓ Export</Button>
          </div>

          <div className="action-card">
            <div className="action-card-icon">↓</div>
            <div className="action-card-title">Generate Template</div>
            <div className="action-card-desc">Creates a blank Excel template pre-filled with your asset list and AUX columns. Fill in baseline hours and labels, then upload to apply in bulk.</div>
            <select
              value={templateMode}
              onChange={e => setTemplateMode(e.target.value)}
              className="action-card-select"
            >
              <option value="selected">Selected ({selectedDeviceIds.length} assets)</option>
              <option value="all">Entire Fleet ({allDeviceIds.length} assets)</option>
            </select>
            <Button type={ButtonType.Secondary} onClick={handleGenerateTemplate}>↓ Generate</Button>
          </div>

          <div className="action-card">
            <div className="action-card-icon">↑</div>
            <div className="action-card-title">Upload Template</div>
            <div className="action-card-desc">Import a completed template to apply labels and baseline hours to multiple assets at once. Validates each row before saving.</div>
            <Button type={ButtonType.Secondary} onClick={() => fileRef.current.click()}>↑ Upload</Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </div>

        </div>

        {!selectedDeviceIds.length && (
          <div className="actions-empty-hint">
            Select assets and a date range above to load the results grid below.
          </div>
        )}
      </div>
    </>
  );
}

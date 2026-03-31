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

      <div className="ie-bar">
        <div className="ie-group">
          <span className="ie-group-label">Export</span>
          <Button type={ButtonType.Secondary} onClick={handleExportView}>↓ Current View</Button>
          <Button type={ButtonType.Secondary} onClick={handleExportAll}>↓ All Assets</Button>
        </div>

        <div className="ie-group">
          <span className="ie-group-label">Baseline Import</span>
          <select
            value={templateMode}
            onChange={e => setTemplateMode(e.target.value)}
            style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }}
          >
            <option value="selected">Selected ({selectedDeviceIds.length} assets)</option>
            <option value="all">Entire Fleet ({allDeviceIds.length} assets)</option>
          </select>
          <Button type={ButtonType.Secondary} onClick={handleGenerateTemplate}>↓ Generate Template</Button>
          <Button type={ButtonType.Secondary} onClick={() => fileRef.current.click()}>↑ Upload Template</Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
        </div>
      </div>
    </>
  );
}

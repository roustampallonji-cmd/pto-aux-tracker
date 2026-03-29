import React, { useState } from 'react';
import { Button, ButtonType } from '@geotab/zenith';
import { AUX_DIAGNOSTICS } from '../../api/diagnostics';
import { bulkSaveLabels } from '../../api/addinData';
import ConfirmModal from '../Modals/ConfirmModal';

export default function BulkLabelPanel({ api, selectedDeviceIds, allDeviceIds, allDeviceData, deviceMap, session, onDone, onCancel }) {
  const [labels, setLabels] = useState({});
  const [applyFlags, setApplyFlags] = useState({});  // which AUX keys to apply
  const [useEntireFleet, setUseEntireFleet] = useState(false);
  const [showFleetConfirm, setShowFleetConfirm] = useState(false);
  const [fleetConfirmed, setFleetConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  const targetIds = fleetConfirmed ? allDeviceIds : selectedDeviceIds;
  const targetLabel = fleetConfirmed
    ? `entire fleet (${allDeviceIds.length} assets)`
    : `${selectedDeviceIds.length} selected asset${selectedDeviceIds.length > 1 ? 's' : ''}`;

  function setLabel(key, val) { setLabels(p => ({ ...p, [key]: val })); }
  function toggleApply(key) { setApplyFlags(p => ({ ...p, [key]: !p[key] })); }

  function handleFleetCheck(checked) {
    if (checked) setShowFleetConfirm(true);
    else { setUseEntireFleet(false); setFleetConfirmed(false); }
  }

  function confirmFleet() {
    setShowFleetConfirm(false);
    setUseEntireFleet(true);
    setFleetConfirmed(true);
  }

  async function handleApply() {
    const toApply = {};
    for (const { key } of AUX_DIAGNOSTICS) {
      if (applyFlags[key] && labels[key] !== undefined && labels[key] !== '') {
        toApply[key] = labels[key];
      }
    }
    if (!Object.keys(toApply).length) return;
    setSaving(true);
    try {
      await bulkSaveLabels(api, targetIds, toApply, allDeviceData);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {showFleetConfirm && (
        <ConfirmModal
          icon="⚠️"
          title="Select Entire Fleet?"
          body={`This will expand your selection to all ${allDeviceIds.length} assets in the database. You will still review changes before anything is saved.`}
          confirmLabel="Yes, Select All"
          onConfirm={confirmFleet}
          onCancel={() => setShowFleetConfirm(false)}
        />
      )}

      <div style={{ padding: 16, background: '#fff', borderRadius: 8, border: '1px solid #e0e3e8', minWidth: 380 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1f4e79', marginBottom: 12 }}>
          Bulk Edit Labels — {targetLabel}
        </div>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, marginBottom: 12, color: '#6b7280', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={useEntireFleet}
            onChange={e => handleFleetCheck(e.target.checked)}
          />
          Select entire fleet ({allDeviceIds.length} assets)
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {AUX_DIAGNOSTICS.map(({ key, label }) => (
            <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={!!applyFlags[key]}
                onChange={() => toggleApply(key)}
                title={`Apply ${label} label to ${targetLabel}`}
              />
              <span style={{ width: 56, fontSize: 12, fontWeight: 600 }}>{label}</span>
              <input
                type="text"
                placeholder={`Label for ${label}`}
                value={labels[key] || ''}
                onChange={e => setLabel(key, e.target.value)}
                style={{ flex: 1, padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12 }}
                disabled={!applyFlags[key]}
              />
              {applyFlags[key] && (
                <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>
                  → {targetIds.length} assets
                </span>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <Button type={ButtonType.Secondary} onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button type={ButtonType.Primary} onClick={handleApply} disabled={saving}>
            {saving ? 'Applying...' : 'Apply Changes'}
          </Button>
        </div>
      </div>
    </>
  );
}

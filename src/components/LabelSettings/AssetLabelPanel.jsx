import React, { useState } from 'react';
import { Button, ButtonType } from '@geotab/zenith';
import { AUX_DIAGNOSTICS } from '../../api/diagnostics';
import { saveDeviceLabels } from '../../api/addinData';

export default function AssetLabelPanel({ api, deviceId, deviceName, currentLabels, onSaved, onCancel }) {
  const [labels, setLabels] = useState({ ...currentLabels });
  const [saving, setSaving] = useState(false);

  function setLabel(key, val) {
    setLabels(prev => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveDeviceLabels(api, deviceId, labels);
      onSaved(labels);
    } catch {
      // silent fail — parent can handle
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#1f4e79', marginBottom: 8 }}>
        AUX Labels — {deviceName}
      </div>
      <div className="label-panel">
        {AUX_DIAGNOSTICS.map(({ key, label }) => (
          <div key={key} className="label-field">
            <label>{label}</label>
            <input
              type="text"
              placeholder={`e.g. PTO, Blower...`}
              value={labels[key] || ''}
              onChange={e => setLabel(key, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="flex-row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
        <Button type={ButtonType.Secondary} onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type={ButtonType.Primary} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Labels'}
        </Button>
      </div>
    </div>
  );
}

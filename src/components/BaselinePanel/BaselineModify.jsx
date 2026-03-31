import React, { useState } from 'react';
import { Button, ButtonType } from '@geotab/zenith';
import { saveBaseline } from '../../api/firebase';

export default function BaselineModify({ api, deviceId, auxKey, auxLabel, currentValue, session, onSaved, onCancel }) {
  const [value, setValue] = useState(currentValue || '');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!comment.trim()) { setError('Comment is required.'); return; }
    if (value === '' || isNaN(Number(value))) { setError('Enter a valid number.'); return; }
    setSaving(true);
    try {
      const displayName = session?.displayName || session?.userName || '';
      await saveBaseline(api, deviceId, auxKey, Number(value), comment.trim(), displayName, session?.userId || '');
      onSaved({ auxKey, value: Number(value), comment, user: displayName });
    } catch (e) {
      const msg = e?.message || (typeof e === 'string' ? e : JSON.stringify(e));
      setError(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="baseline-panel">
      <div className="baseline-panel-title">Modify Baseline — {auxLabel}</div>

      <div>
        <label style={{ fontSize: 11, color: '#6b7280' }}>New Baseline (hrs)</label>
        <input
          type="number"
          value={value}
          min={0}
          step={0.01}
          onChange={e => { setValue(e.target.value); setError(''); }}
          placeholder="e.g. 5100"
        />
      </div>

      <div>
        <label style={{ fontSize: 11, color: '#6b7280' }}>Comment <span style={{ color: '#dc2626' }}>*</span></label>
        <textarea
          value={comment}
          onChange={e => { setComment(e.target.value); setError(''); }}
          placeholder="Reason for this change..."
        />
      </div>

      <div className="baseline-panel-user">
        Saved by: <strong>{session?.displayName || session?.userName || '—'}</strong> (auto from session)
      </div>

      {error && <div style={{ color: '#dc2626', fontSize: 12 }}>{error}</div>}

      <div className="baseline-panel-actions">
        <Button type={ButtonType.Secondary} onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type={ButtonType.Primary} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Baseline'}
        </Button>
      </div>
    </div>
  );
}

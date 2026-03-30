import React, { useState } from 'react';
import { Button, ButtonType } from '@geotab/zenith';

export default function CorrectionConfirmModal({ meterReading, currentTotal, offset, newBaseline, onConfirm, onCancel }) {
  const [dontAsk, setDontAsk] = useState(false);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-icon">✏️</div>
        <div className="modal-title">Apply Meter Reading Correction?</div>
        <div className="modal-body">
          <div className="correction-row">
            <span>Physical reading</span>
            <span>{meterReading.toFixed(2)} hrs</span>
          </div>
          <div className="correction-row">
            <span>Calculated total</span>
            <span>{currentTotal.toFixed(2)} hrs</span>
          </div>
          <div className="correction-row" style={{ fontWeight: 700, color: offset >= 0 ? '#16a34a' : '#d97706' }}>
            <span>Offset</span>
            <span>{offset >= 0 ? '+' : ''}{offset.toFixed(2)} hrs</span>
          </div>
          <div className="correction-row correction-row-total">
            <span>New baseline will be</span>
            <span>{newBaseline.toFixed(2)} hrs</span>
          </div>
        </div>
        <label className="correction-dont-ask">
          <input type="checkbox" checked={dontAsk} onChange={e => setDontAsk(e.target.checked)} />
          Don't ask again for the next 10 changes
        </label>
        <div className="modal-actions">
          <Button type={ButtonType.Secondary} onClick={onCancel}>Cancel</Button>
          <Button type={ButtonType.Primary} onClick={() => onConfirm(dontAsk)}>Apply</Button>
        </div>
      </div>
    </div>
  );
}

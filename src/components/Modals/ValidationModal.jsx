import React from 'react';
import { Button, ButtonType } from '@geotab/zenith';

export default function ValidationModal({ valid, errors, unknownDevices, onApply, onCancel, user }) {
  const totalRows = valid.length + errors.length + unknownDevices.length;
  const canApply = valid.length > 0;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-icon">📋</div>
        <div className="modal-title">Template Upload Summary</div>

        <div className="validation-summary">
          <div>{totalRows} rows detected</div>
          {valid.length > 0 && (
            <div className="validation-ok">✅ {valid.length} rows ready to apply</div>
          )}
          {errors.length > 0 && (
            <div className="validation-error">
              ⚠ {errors.length} rows missing Comment (will be skipped)
            </div>
          )}
          {unknownDevices.length > 0 && (
            <div className="validation-warn">
              ⚠ {unknownDevices.length} unknown device{unknownDevices.length > 1 ? 's' : ''} (will be skipped): {unknownDevices.join(', ')}
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
            Uploaded by: {user?.userName || 'Unknown'}
          </div>
        </div>

        {!canApply && (
          <div className="modal-body" style={{ color: '#dc2626' }}>
            No valid rows to apply. Please fix the template and re-upload.
          </div>
        )}

        <div className="modal-actions">
          <Button type={ButtonType.Secondary} onClick={onCancel}>Cancel</Button>
          {canApply && (
            <Button type={ButtonType.Primary} onClick={() => onApply(valid)}>
              Apply {valid.length} Valid Row{valid.length > 1 ? 's' : ''}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

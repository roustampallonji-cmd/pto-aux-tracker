import React from 'react';
import { Button, ButtonType } from '@geotab/zenith';

export default function ConfirmModal({ icon = '⚠️', title, body, onConfirm, onCancel, confirmLabel = 'Confirm', cancelLabel = 'Cancel' }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon">{icon}</div>
        <div className="modal-title">{title}</div>
        <div className="modal-body">{body}</div>
        <div className="modal-actions">
          <Button type={ButtonType.Secondary} onClick={onCancel}>{cancelLabel}</Button>
          <Button type={ButtonType.Primary} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

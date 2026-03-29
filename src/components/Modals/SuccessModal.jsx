import React from 'react';
import { Button, ButtonType } from '@geotab/zenith';
import { fmtDateTime } from '../../utils/formatters';

export default function SuccessModal({ title, lines = [], user, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-icon">✅</div>
        <div className="modal-title">{title}</div>
        <div className="modal-body">
          {lines.map((l, i) => <div key={i}>{l}</div>)}
          {user && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>
              <div>Updated by: <strong>{user.name}</strong></div>
              <div>{fmtDateTime(new Date())}</div>
            </div>
          )}
        </div>
        <div className="modal-actions">
          <Button type={ButtonType.Primary} onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

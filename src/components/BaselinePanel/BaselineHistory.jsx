import React from 'react';
import { fmtDateTime, fmtHoursNum } from '../../utils/formatters';

export default function BaselineHistory({ history, auxLabel }) {
  if (!history.length) {
    return <div className="text-muted" style={{ padding: '6px 0' }}>No history yet.</div>;
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>
        {auxLabel} — Baseline History
      </div>
      <table className="history-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>User</th>
            <th>Value (hrs)</th>
            <th>Comment</th>
          </tr>
        </thead>
        <tbody>
          {[...history].reverse().map((entry, i) => (
            <tr key={i}>
              <td>{fmtDateTime(entry.timestamp)}</td>
              <td>{entry.user}</td>
              <td><strong>{fmtHoursNum(entry.value)}</strong></td>
              <td style={{ fontStyle: 'italic', color: '#4b5563' }}>"{entry.comment}"</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

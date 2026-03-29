import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { AUX_DIAGNOSTICS } from '../../api/diagnostics';
import { fmtDate } from '../../utils/formatters';

const CHART_COLORS = [
  '#1f4e79', '#2e75b6', '#70ad47', '#ed7d31', '#a9d18e',
  '#5a9fd4', '#f4b942', '#c00000', '#00b050', '#7030a0',
];

const GRANULARITY_OPTIONS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

function getAuxLabel(auxKey, deviceData, fallback) {
  return deviceData?.labels?.[auxKey] || fallback;
}

function buildBarData(assetResults, activeAux, deviceDataMap, deviceMap) {
  return assetResults.map(r => {
    const row = { name: deviceMap[r.deviceId]?.name || r.deviceId };
    activeAux.forEach(auxKey => {
      const diag = AUX_DIAGNOSTICS.find(d => d.key === auxKey);
      const label = getAuxLabel(auxKey, deviceDataMap[r.deviceId], diag?.label || auxKey);
      const total = (r.baselines?.[auxKey] || 0) + (r.hours?.[auxKey] || 0);
      row[`${r.deviceId}__${auxKey}__${label}`] = +total.toFixed(2);
    });
    return row;
  });
}

export default function ChartView({ assetResults, activeAux, deviceDataMap, deviceMap, dateRange, visible, onToggle }) {
  const [chartType, setChartType] = useState('bar');
  const [granularity, setGranularity] = useState('daily');

  // Build bar data
  const barData = useMemo(() =>
    buildBarData(assetResults, activeAux, deviceDataMap, deviceMap),
    [assetResults, activeAux, deviceDataMap, deviceMap]
  );

  // Bar series: one bar per device per AUX
  const barSeries = useMemo(() => {
    const series = [];
    let colorIdx = 0;
    assetResults.forEach(r => {
      activeAux.forEach(auxKey => {
        const diag = AUX_DIAGNOSTICS.find(d => d.key === auxKey);
        const label = getAuxLabel(auxKey, deviceDataMap[r.deviceId], diag?.label || auxKey);
        const deviceName = deviceMap[r.deviceId]?.name || r.deviceId;
        series.push({
          dataKey: `${r.deviceId}__${auxKey}__${label}`,
          name: `${deviceName} · ${label}`,
          color: CHART_COLORS[colorIdx++ % CHART_COLORS.length],
        });
      });
    });
    return series;
  }, [assetResults, activeAux, deviceDataMap, deviceMap]);

  return (
    <div className="chart-section">
      <div className="chart-header">
        <span className="chart-title">📊 AUX Hours Chart</span>
        <button className="small-btn" onClick={onToggle}>
          {visible ? '▼ Hide Chart' : '► Show Chart'}
        </button>
      </div>

      {visible && (
        <>
          <div className="chart-controls">
            <div className="chart-control-group">
              <span className="chart-control-label">View</span>
              <button className={`preset-btn ${chartType === 'bar' ? 'active' : ''}`} onClick={() => setChartType('bar')}>Bar</button>
              <button className={`preset-btn ${chartType === 'line' ? 'active' : ''}`} onClick={() => setChartType('line')}>Line</button>
            </div>
            <div className="chart-control-group">
              <span className="chart-control-label">Granularity</span>
              {GRANULARITY_OPTIONS.map(g => (
                <button
                  key={g.key}
                  className={`preset-btn ${granularity === g.key ? 'active' : ''}`}
                  onClick={() => setGranularity(g.key)}
                >{g.label}</button>
              ))}
            </div>
          </div>

          <div className="chart-body">
            {assetResults.length === 0 ? (
              <div className="text-muted">Select assets to view chart.</div>
            ) : chartType === 'bar' ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={barData} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} unit=" h" />
                  <Tooltip
                    formatter={(val, name) => [`${val.toFixed(2)} h`, name]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  {barSeries.map(s => (
                    <Bar key={s.dataKey} dataKey={s.dataKey} name={s.name} fill={s.color} radius={[3, 3, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted" style={{ padding: 24 }}>
                Line chart shows trend over time. For date-range queries, select a multi-day range and choose Daily or Weekly granularity to see the breakdown.
                <br /><br />
                <em>(Line chart requires time-series data from the StatusData API — coming in next release.)</em>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

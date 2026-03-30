import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AUX_DIAGNOSTICS, AUX_KEYS } from './api/diagnostics';
import { fetchFleetAuxHours } from './api/statusData';
import { fetchDeviceStatuses } from './api/deviceStatus';
import { fetchDevices, fetchGroups } from './api/devices';
import { initStorage, loadAllDeviceData, getActiveBaseline } from './api/addinData';
import { getSession } from './api/session';
import { getPresetRange } from './utils/formatters';
import FilterPane from './components/FilterPane/FilterPane';
import ResultsGrid from './components/ResultsGrid/ResultsGrid';
import ChartView from './components/ChartView/ChartView';
import ImportExport from './components/ImportExport/ImportExport';
import UserPicker from './components/UserPicker/UserPicker';
import AuditLog from './components/AuditLog/AuditLog';
import './styles/app.css';

export default function App({ api, state }) {
  // ── Data ──────────────────────────────────────────────────────────────
  const [devices, setDevices] = useState([]);
  const [groups, setGroups] = useState([]);
  const [session, setSession] = useState(null);
  const [deviceDataMap, setDeviceDataMap] = useState({});

  // ── Filter state ──────────────────────────────────────────────────────
  const [selectedDeviceIds, setSelectedDeviceIds] = useState([]);
  const [dateRange, setDateRange] = useState(getPresetRange('thisMonth'));
  const [activeAux, setActiveAux] = useState(AUX_KEYS);
  const [statusFilter, setStatusFilter] = useState('all');

  // ── Results state ─────────────────────────────────────────────────────
  const [auxHours, setAuxHours] = useState({});       // { deviceId: { AUX1: hrs, ... } }
  const [commStatus, setCommStatus] = useState({});   // { deviceId: { isDeviceCommunicating, lastCommunication } }
  const [loading, setLoading] = useState(false);

  // ── UI state ──────────────────────────────────────────────────────────
  const [chartVisible, setChartVisible] = useState(true);
  const [auditVisible, setAuditVisible] = useState(true);

  // ── Init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    initStorage(api).then(() =>
      Promise.all([
        fetchDevices(api).then(setDevices),
        fetchGroups(api).then(setGroups),
        getSession(api, state).then(setSession),
        loadAllDeviceData(api).then(setDeviceDataMap),
      ])
    );
  }, []);

  // ── Reload device data (after saves) ─────────────────────────────────
  const reloadDeviceData = useCallback(async () => {
    const data = await loadAllDeviceData(api);
    setDeviceDataMap(data);
  }, [api]);

  // ── Live-fetch when selection or date range changes ───────────────────
  useEffect(() => {
    if (!selectedDeviceIds.length) return;
    setLoading(true);

    Promise.all([
      fetchFleetAuxHours(api, selectedDeviceIds, dateRange.from, dateRange.to),
      fetchDeviceStatuses(api, selectedDeviceIds),
    ]).then(([hours, comm]) => {
      setAuxHours(hours);
      setCommStatus(comm);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [selectedDeviceIds, dateRange]);

  // ── Active AUX channels (union of channels with any data across selected assets) ──
  const activeAuxSet = useMemo(() => {
    const s = new Set();
    Object.values(auxHours).forEach(deviceHours => {
      Object.entries(deviceHours).forEach(([k, v]) => {
        if (v !== null && v > 0) s.add(k);
      });
    });
    return s;
  }, [auxHours]);

  // ── Assemble asset results ────────────────────────────────────────────
  const allAssetResults = useMemo(() =>
    selectedDeviceIds.map(id => ({
      deviceId: id,
      hours: auxHours[id] || {},
      isDeviceCommunicating: commStatus[id]?.isDeviceCommunicating ?? null,
      lastCommunication: commStatus[id]?.lastCommunication ?? null,
      baselines: Object.fromEntries(
        AUX_KEYS.map(k => [k, getActiveBaseline(deviceDataMap[id], k)])
      ),
    })),
    [selectedDeviceIds, auxHours, commStatus, deviceDataMap]
  );

  // ── Apply status filter ───────────────────────────────────────────────
  const assetResults = useMemo(() => {
    if (statusFilter === 'all') return allAssetResults;
    return allAssetResults.filter(r =>
      statusFilter === 'communicating'
        ? r.isDeviceCommunicating === true
        : r.isDeviceCommunicating === false
    );
  }, [allAssetResults, statusFilter]);

  const deviceMap = useMemo(() =>
    Object.fromEntries(devices.map(d => [d.id, d])),
    [devices]
  );

  const allDeviceIds = devices.map(d => d.id);

  return (
    <div className="pto-root">
      <div style={{ marginBottom: 12 }}>
        <span className="zen-heading-4" style={{ color: '#1f4e79', fontWeight: 700, fontSize: 20 }}>
          PTO AUX Hours Tracker
        </span>
      </div>

      <UserPicker api={api} session={session} onSessionChange={setSession} />

      <FilterPane
        devices={devices}
        groups={groups}
        selectedDeviceIds={selectedDeviceIds}
        onSelectionChange={setSelectedDeviceIds}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        activeAux={activeAux}
        onAuxChange={setActiveAux}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        activeAuxSet={activeAuxSet}
      />

      <ImportExport
        api={api}
        session={session}
        assetResults={assetResults}
        allAssetResults={allAssetResults}
        deviceMap={deviceMap}
        deviceDataMap={deviceDataMap}
        allDeviceData={deviceDataMap}
        dateRange={dateRange}
        selectedDeviceIds={selectedDeviceIds}
        allDeviceIds={allDeviceIds}
        onImportComplete={reloadDeviceData}
      />

      <ResultsGrid
        api={api}
        session={session}
        assetResults={assetResults}
        deviceMap={deviceMap}
        deviceDataMap={deviceDataMap}
        allDeviceData={deviceDataMap}
        activeAux={activeAux}
        selectedDeviceIds={selectedDeviceIds}
        allDeviceIds={allDeviceIds}
        loading={loading}
        onDeviceDataChange={reloadDeviceData}
      />

      <ChartView
        assetResults={assetResults}
        activeAux={activeAux}
        deviceDataMap={deviceDataMap}
        deviceMap={deviceMap}
        dateRange={dateRange}
        visible={chartVisible}
        onToggle={() => setChartVisible(v => !v)}
      />

      <AuditLog
        deviceDataMap={deviceDataMap}
        deviceMap={deviceMap}
        visible={auditVisible}
        onToggle={() => setAuditVisible(v => !v)}
      />
    </div>
  );
}

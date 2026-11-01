import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Box, Thermometer, Zap, Cpu, Brain, TestTube, BookOpen,
  Wifi, WifiOff, RefreshCw, Activity
} from 'lucide-react';
import { api } from './lib/api';
import type { HealthResponse, SystemInfoResponse } from './types/api';

import Dashboard from './pages/Dashboard';
import GeometryViewer from './pages/GeometryViewer';
import ThermalAnalysis from './pages/ThermalAnalysis';
import PerformanceLab from './pages/PerformanceLab';
import HardwareIntegration from './pages/HardwareIntegration';
import NeuralNetworkLab from './pages/NeuralNetworkLab';
import TestResults from './pages/TestResults';
import Documentation from './pages/Documentation';

type Page = 'dashboard' | 'geometry' | 'thermal' | 'performance' | 'hardware' | 'neural' | 'tests' | 'docs';

const NAV_ITEMS: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard',   label: 'Overview',           icon: LayoutDashboard },
  { id: 'geometry',    label: 'Geometry Viewer',     icon: Box },
  { id: 'thermal',     label: 'Thermal Analysis',    icon: Thermometer },
  { id: 'performance', label: 'Performance Lab',     icon: Zap },
  { id: 'hardware',    label: 'Hardware Integration',icon: Cpu },
  { id: 'neural',      label: 'Neural Network Lab',  icon: Brain },
  { id: 'tests',       label: 'Test Results',        icon: TestTube },
  { id: 'docs',        label: 'Documentation',       icon: BookOpen },
];

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [sysInfo, setSysInfo] = useState<SystemInfoResponse | null>(null);
  const [backendUp, setBackendUp] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkBackend = useCallback(async () => {
    setChecking(true);
    try {
      const h = await api.health();
      setHealth(h);
      setBackendUp(true);
      const si = await api.systemInfo();
      setSysInfo(si);
    } catch {
      setBackendUp(false);
      setHealth(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkBackend();
    const interval = setInterval(checkBackend, 15000);
    return () => clearInterval(interval);
  }, [checkBackend]);

  const PageComponent = {
    dashboard:   <Dashboard backendUp={backendUp} health={health} sysInfo={sysInfo} onNavigate={setPage} />,
    geometry:    <GeometryViewer backendUp={backendUp} />,
    thermal:     <ThermalAnalysis backendUp={backendUp} />,
    performance: <PerformanceLab backendUp={backendUp} sysInfo={sysInfo} />,
    hardware:    <HardwareIntegration backendUp={backendUp} />,
    neural:      <NeuralNetworkLab backendUp={backendUp} />,
    tests:       <TestResults />,
    docs:        <Documentation />,
  }[page];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top Nav */}
      <nav className="topnav">
        <div className="topnav-brand">
          <div className="logo-icon">⚙</div>
          <span>Unified Engineering Workbench</span>
        </div>
        <div className="topnav-divider" />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pass Science Works R&D 2026–2027</span>
        <div className="topnav-spacer" />

        {/* Backend status */}
        <div className={`status-pill ${backendUp ? 'connected' : 'disconnected'}`}>
          {backendUp ? <Wifi size={11} /> : <WifiOff size={11} />}
          <span className={`status-dot ${backendUp ? 'pulse' : ''}`} />
          {checking ? 'Checking…' : backendUp ? `Backend · ${health?.backend ?? 'C++'}` : 'Backend offline'}
        </div>

        {sysInfo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
            <Activity size={11} />
            {sysInfo.cpu_logical_cores} cores · {sysInfo.os_name}
          </div>
        )}

        <button className="btn btn-secondary btn-sm" onClick={checkBackend} title="Refresh connection">
          <RefreshCw size={12} />
        </button>
      </nav>

      {/* Body */}
      <div className="app-layout" style={{ flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-section-label">Modules</div>
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? 'active' : ''}`}
              onClick={() => setPage(id)}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </aside>

        {/* Main */}
        <main className="main-content">
          {!backendUp && !checking && (
            <div className="alert alert-warning" style={{ margin: '16px 24px 0', borderRadius: 6 }}>
              <WifiOff size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>Backend offline.</strong> Start the C++ server:{' '}
                <code className="mono" style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 6px', borderRadius: 3 }}>
                  ./build/workbench_server
                </code>
              </div>
            </div>
          )}
          <div className="page-container">
            {PageComponent}
          </div>
        </main>
      </div>
    </div>
  );
}

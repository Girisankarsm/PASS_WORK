import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  Home, Box, Thermometer, Zap, Cpu, Share2, CheckSquare, BookOpen
} from 'lucide-react';
import { api } from './lib/api';
import type { HealthResponse, SystemInfoResponse } from './types/api';

// Code-splitting with lazy loading for instant initial load and small bundle
const Dashboard = lazy(() => import('./pages/Dashboard'));
const GeometryViewer = lazy(() => import('./pages/GeometryViewer'));
const ThermalAnalysis = lazy(() => import('./pages/ThermalAnalysis'));
const PerformanceLab = lazy(() => import('./pages/PerformanceLab'));
const HardwareIntegration = lazy(() => import('./pages/HardwareIntegration'));
const NeuralNetworkLab = lazy(() => import('./pages/NeuralNetworkLab'));
const TestResults = lazy(() => import('./pages/TestResults'));
const Documentation = lazy(() => import('./pages/Documentation'));

export type Page = 'dashboard' | 'geometry' | 'thermal' | 'performance' | 'hardware' | 'neural' | 'tests' | 'docs';

// Sidebar Logo Icon: 3D Isometric Blue Cube
function SidebarCubeLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 4L34 12V28L20 36L6 28V12L20 4Z"
        stroke="#2583FF"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 20L34 12"
        stroke="#2583FF"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 20V36"
        stroke="#2583FF"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 20L6 12"
        stroke="#2583FF"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const NAV_ITEMS = [
  { id: 'dashboard' as Page,   label: 'Overview',          icon: Home },
  { id: 'geometry' as Page,    label: 'Geometry',          icon: Box },
  { id: 'thermal' as Page,     label: 'Thermal Analysis',   icon: Thermometer },
  { id: 'performance' as Page, label: 'Performance',        icon: Zap },
  { id: 'hardware' as Page,    label: 'Hardware',           icon: Cpu },
  { id: 'neural' as Page,      label: 'Neural Network',     icon: Share2 },
  { id: 'tests' as Page,       label: 'Tests',              icon: CheckSquare },
  { id: 'docs' as Page,        label: 'Documentation',      icon: BookOpen },
];

export default function App() {
  const [page, setPage] = useState<Page>(() => {
    const raw = window.location.hash.replace(/^#\/?/, '') as Page;
    return NAV_ITEMS.some((n) => n.id === raw) ? raw : 'dashboard';
  });
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [sysInfo, setSysInfo] = useState<SystemInfoResponse | null>(null);
  const [backendUp, setBackendUp] = useState(false);

  const navigateTo = useCallback((p: Page) => {
    setPage(p);
    window.location.hash = p === 'dashboard' ? '' : p;
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const raw = window.location.hash.replace(/^#\/?/, '') as Page;
      if (NAV_ITEMS.some((n) => n.id === raw)) {
        setPage(raw);
      } else if (!raw) {
        setPage('dashboard');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const checkBackend = useCallback(async () => {
    try {
      const h = await api.health();
      setHealth(h);
      setBackendUp(true);
      const si = await api.systemInfo();
      setSysInfo(si);
    } catch {
      setBackendUp(false);
      setHealth(null);
    }
  }, []);

  useEffect(() => {
    checkBackend();
    const interval = setInterval(checkBackend, 10000);
    return () => clearInterval(interval);
  }, [checkBackend]);

  return (
    <div className="app-container">
      {/* Sidebar Navigation matching reference image */}
      <aside className="sidebar">
        {/* Branding */}
        <div className="sidebar-header">
          <div className="sidebar-logo-icon">
            <SidebarCubeLogo size={32} />
          </div>
          <div className="sidebar-title-group">
            <span className="sidebar-title-main">Engineering</span>
            <span className="sidebar-title-sub">Workbench</span>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = page === id;
            return (
              <button
                key={id}
                className={`nav-link ${isActive ? 'active' : ''}`}
                onClick={() => navigateTo(id)}
              >
                <Icon size={18} className="nav-icon" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: Real Backend Status */}
        <div className="sidebar-footer">
          <div className="status-badge">
            <span className={`status-indicator-dot ${backendUp ? 'online' : 'offline'}`} />
            <span style={{ color: backendUp ? 'var(--text-main)' : 'var(--error)' }}>
              {backendUp ? 'Backend Connected' : 'Backend Disconnected'}
            </span>
          </div>
          <span className="status-address">localhost:8080</span>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="main-wrapper">
        <Suspense
          fallback={
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-muted)',
              fontSize: '14px',
              gap: '8px'
            }}>
              <span>Loading workspace module…</span>
            </div>
          }
        >
          {page === 'dashboard' && (
            <Dashboard
              backendUp={backendUp}
              health={health}
              sysInfo={sysInfo}
              onNavigate={navigateTo}
            />
          )}

          {page !== 'dashboard' && (
            <div className="page-content">
              {page === 'geometry' && <GeometryViewer backendUp={backendUp} />}
              {page === 'thermal' && <ThermalAnalysis backendUp={backendUp} />}
              {page === 'performance' && <PerformanceLab backendUp={backendUp} sysInfo={sysInfo} />}
              {page === 'hardware' && <HardwareIntegration backendUp={backendUp} />}
              {page === 'neural' && <NeuralNetworkLab backendUp={backendUp} />}
              {page === 'tests' && <TestResults />}
              {page === 'docs' && <Documentation />}
            </div>
          )}
        </Suspense>
      </main>
    </div>
  );
}

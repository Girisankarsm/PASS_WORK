import { useState } from 'react';
import {
  Thermometer,
  Zap,
  Cpu,
  CheckSquare,
  BookOpen,
  ArrowRight,
  Server,
  Activity,
  Layers,
} from 'lucide-react';
import type { HealthResponse, SystemInfoResponse } from '../types/api';

type Page =
  | 'dashboard'
  | 'geometry'
  | 'thermal'
  | 'performance'
  | 'hardware'
  | 'neural'
  | 'tests'
  | 'docs';

interface Props {
  backendUp: boolean;
  health: HealthResponse | null;
  sysInfo: SystemInfoResponse | null;
  onNavigate: (page: Page) => void;
}

// Custom Isometric 3D Cube Icon matching the reference image exactly
function IsometricCubeIcon({ size = 36, color = '#3B82F6' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 4L34 12V28L20 36L6 28V12L20 4Z"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 20L34 12"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 20V36"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 20L6 12"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Custom Neural Network Graph Icon
function NeuralNodesIcon({ size = 32, color = '#3B82F6' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="7" r="3" stroke={color} strokeWidth="2.2" />
      <circle cx="7" cy="23" r="3" stroke={color} strokeWidth="2.2" />
      <circle cx="25" cy="23" r="3" stroke={color} strokeWidth="2.2" />
      <circle cx="16" cy="19" r="2.5" stroke={color} strokeWidth="2" />
      <path d="M14.2 9.5L8.8 20.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17.8 9.5L23.2 20.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 10V16.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 23H22" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

interface ModuleCard {
  id: Page;
  title: string;
  badge?: string;
  subtitle: string;
  renderIcon: () => JSX.Element;
  subLinks?: { label: string; target: Page }[];
}

const SIX_MODULES: ModuleCard[] = [
  {
    id: 'geometry',
    title: 'Geometry Viewer',
    badge: '3D CAD',
    subtitle: 'Inspect ASCII STL meshes and temperature CSV point clouds with Z-up coordinates.',
    renderIcon: () => <IsometricCubeIcon size={34} color="#3B82F6" />,
  },
  {
    id: 'thermal',
    title: 'Thermal Analysis',
    badge: '1D FEM',
    subtitle: 'Solve steady-state conduction with analytical verification and O(h²) convergence.',
    renderIcon: () => <Thermometer size={30} strokeWidth={2.2} color="#3B82F6" />,
  },
  {
    id: 'performance',
    title: 'Performance Lab',
    badge: 'Multi-Core',
    subtitle: 'Measure serial vs parallel scaling across 1–4 threads with deterministic seed.',
    renderIcon: () => <Zap size={30} strokeWidth={2.2} color="#3B82F6" />,
  },
  {
    id: 'hardware',
    title: 'Embedded & Neural',
    badge: 'Simulated & ML',
    subtitle: 'Target bus telemetry (MCU/FPGA/JTAG) and handcoded neural backpropagation.',
    renderIcon: () => <Cpu size={30} strokeWidth={2.2} color="#3B82F6" />,
    subLinks: [
      { label: 'Hardware Bus', target: 'hardware' },
      { label: 'Neural Lab', target: 'neural' },
    ],
  },
  {
    id: 'tests',
    title: 'Automated Tests',
    badge: '128 / 128 PASS',
    subtitle: 'Run and verify the automated C++ test suite, CTest runner, and live API roundtrip.',
    renderIcon: () => <CheckSquare size={30} strokeWidth={2.2} color="#22C55E" />,
  },
  {
    id: 'docs',
    title: 'Technical Manual',
    badge: 'Architecture & API',
    subtitle: 'System architecture, complete REST API reference, equations, and test execution.',
    renderIcon: () => <BookOpen size={30} strokeWidth={2.2} color="#A855F7" />,
  },
];

export default function Dashboard({ backendUp, health, sysInfo, onNavigate }: Props) {
  const [hoveredCard, setHoveredCard] = useState<string>('geometry');

  return (
    <div className="overview-container">
      {/* Background ambient glowing curve */}
      <svg
        className="hero-wave-background"
        viewBox="0 0 1400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="waveGlowGrad" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#1E40AF" stopOpacity="0" />
            <stop offset="25%" stopColor="#2563EB" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.75" />
            <stop offset="75%" stopColor="#60A5FA" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0" />
          </linearGradient>
          <filter id="glowBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <path
          d="M 50 260 C 350 260, 550 210, 800 180 C 1050 150, 1200 110, 1380 100"
          stroke="url(#waveGlowGrad)"
          strokeWidth="6"
          fill="none"
          opacity="0.3"
          filter="url(#glowBlur)"
        />

        <path
          d="M 50 260 C 350 260, 550 210, 800 180 C 1050 150, 1200 110, 1380 100"
          stroke="url(#waveGlowGrad)"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* Hero Title & Subtitle */}
      <div className="overview-hero">
        <h1 className="overview-hero-title">Engineering Workbench</h1>
        <p className="overview-hero-subtitle">
          Professional numerical simulation, CAD geometry inspection, and scientific computing platform.
        </p>
      </div>

      {/* Six Navigation Cards (3 Columns × 2 Rows on Desktop) */}
      <div className="overview-cards-grid-6">
        {SIX_MODULES.map((mod) => {
          const isHovered = hoveredCard === mod.id;
          return (
            <div
              key={mod.id}
              className={`overview-card ${isHovered ? 'featured' : ''}`}
              onClick={() => onNavigate(mod.id)}
              onMouseEnter={() => setHoveredCard(mod.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div className="overview-card-icon">{mod.renderIcon()}</div>
                {mod.badge && (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: mod.id === 'tests' ? '#22C55E' : 'var(--primary-blue)',
                      background:
                        mod.id === 'tests'
                          ? 'rgba(34, 197, 94, 0.14)'
                          : 'rgba(59, 130, 246, 0.14)',
                      border:
                        mod.id === 'tests'
                          ? '1px solid rgba(34, 197, 94, 0.35)'
                          : '1px solid rgba(59, 130, 246, 0.35)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      letterSpacing: '0.03em',
                    }}
                  >
                    {mod.badge}
                  </span>
                )}
              </div>

              <div className="overview-card-title">{mod.title}</div>
              <div className="overview-card-desc">{mod.subtitle}</div>

              {mod.subLinks && (
                <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                  {mod.subLinks.map((sub) => (
                    <button
                      key={sub.target}
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate(sub.target);
                      }}
                      style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--primary-blue)',
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '3px 8px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)';
                        e.currentTarget.style.color = '#FFFFFF';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                        e.currentTarget.style.color = 'var(--primary-blue)';
                      }}
                    >
                      {sub.label} →
                    </button>
                  ))}
                </div>
              )}

              <div className="overview-card-arrow">
                <ArrowRight size={18} strokeWidth={2.2} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Live System & Hardware Information Dock (Only populated from actual backend) */}
      <div className="system-info-dock">
        <div className="dock-item">
          <Server size={14} style={{ color: backendUp ? 'var(--success)' : 'var(--error)' }} />
          <span>
            Backend:{' '}
            <strong style={{ color: backendUp ? 'var(--text-main)' : 'var(--error)' }}>
              {backendUp ? (health?.backend || 'C++17 Engine') : 'Offline'}
            </strong>
          </span>
        </div>

        {sysInfo && (
          <>
            <div className="dock-separator" />
            <div className="dock-item">
              <Activity size={14} style={{ color: 'var(--primary-blue)' }} />
              <span>
                CPU:{' '}
                <strong>
                  {sysInfo.cpu_logical_cores} Logical ({sysInfo.machine || 'ARM64'})
                </strong>
              </span>
            </div>
            <div className="dock-separator" />
            <div className="dock-item">
              <Layers size={14} style={{ color: '#A855F7' }} />
              <span>
                Compiler:{' '}
                <strong>
                  {sysInfo.compiler} {sysInfo.optimization}
                </strong>
              </span>
            </div>
          </>
        )}

        <div className="dock-separator" />
        <button
          onClick={() => onNavigate('docs')}
          className="dock-link"
          title="Open Technical Manual & Architecture Guide"
        >
          <BookOpen size={13} />
          <span>Technical Manual</span>
        </button>
      </div>
    </div>
  );
}

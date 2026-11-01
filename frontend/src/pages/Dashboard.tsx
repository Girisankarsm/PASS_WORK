import { useState, useEffect } from 'react';
import { Box, Thermometer, Zap, Cpu, Brain, Activity, Server, Clock } from 'lucide-react';
import type { HealthResponse, SystemInfoResponse } from '../types/api';

type Page = 'dashboard' | 'geometry' | 'thermal' | 'performance' | 'hardware' | 'neural' | 'tests' | 'docs';

interface Props {
  backendUp: boolean;
  health: HealthResponse | null;
  sysInfo: SystemInfoResponse | null;
  onNavigate: (page: Page) => void;
}

const MODULE_CARDS = [
  { id: 'geometry',    icon: Box,         title: 'Geometry Viewer',     desc: 'Parse ASCII STL files and visualize temperature CSV data in 3D',  color: '#2f81f7' },
  { id: 'thermal',     icon: Thermometer, title: 'Thermal FEA',         desc: '1D steady-state FEM solver with analytical verification',         color: '#f97316' },
  { id: 'performance', icon: Zap,         title: 'Performance Lab',     desc: 'Serial vs parallel benchmarking with speedup and efficiency',     color: '#a855f7' },
  { id: 'hardware',    icon: Cpu,         title: 'Hardware Integration', desc: 'MCU, FPGA, and JTAG mock device adapters with telemetry',        color: '#22c55e' },
  { id: 'neural',      icon: Brain,       title: 'Neural Network Lab',  desc: 'Handcoded backpropagation with gradient check and loss tracking', color: '#ec4899' },
];

export default function Dashboard({ backendUp, health, sysInfo, onNavigate }: Props) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Engineering Workbench</h1>
        <p className="page-subtitle">
          Professional simulation and analysis platform — Pass Science Works R&D Internship 2026–2027
        </p>
      </div>

      {/* System status row */}
      <div className="grid-4 section">
        <div className="stat-card">
          <div className="stat-label">Backend</div>
          <div className="stat-value" style={{ fontSize: 16, marginTop: 8 }}>
            {backendUp
              ? <span style={{ color: 'var(--success)' }}>● Connected</span>
              : <span style={{ color: 'var(--error)' }}>● Offline</span>}
          </div>
          {health && <div className="stat-change" style={{ color: 'var(--text-muted)', marginTop: 4 }}>{health.backend}</div>}
        </div>

        <div className="stat-card">
          <div className="stat-label">CPU Cores</div>
          <div className="stat-value">
            {sysInfo ? sysInfo.cpu_logical_cores : '—'}
            <span className="stat-unit"> logical</span>
          </div>
          {sysInfo && <div className="stat-change" style={{ color: 'var(--text-muted)' }}>{sysInfo.machine}</div>}
        </div>

        <div className="stat-card">
          <div className="stat-label">Platform</div>
          <div className="stat-value" style={{ fontSize: 14, marginTop: 6 }}>
            {sysInfo ? `${sysInfo.os_name} ${sysInfo.os_release.split('.')[0]}` : '—'}
          </div>
          {sysInfo && <div className="stat-change" style={{ color: 'var(--text-muted)' }}>{sysInfo.cpp_standard}</div>}
        </div>

        <div className="stat-card">
          <div className="stat-label">Local Time</div>
          <div className="stat-value" style={{ fontSize: 16, marginTop: 6 }}>
            {now.toLocaleTimeString()}
          </div>
          <div className="stat-change" style={{ color: 'var(--text-muted)' }}>{now.toLocaleDateString()}</div>
        </div>
      </div>

      {/* Backend info */}
      {backendUp && (
        <div className="card section">
          <div className="card-header">
            <div className="card-title"><Server size={14} /> Backend Information</div>
          </div>
          <div className="grid-3" style={{ gap: 12 }}>
            {[
              { label: 'Version',    value: health?.version ?? '—' },
              { label: 'Compiler',   value: sysInfo?.compiler ?? '—' },
              { label: 'C++ Std',    value: sysInfo?.cpp_standard ?? '—' },
              { label: 'Build Type', value: sysInfo?.build_type ?? '—' },
              { label: 'Opt Flags',  value: sysInfo?.optimization ?? '—' },
              { label: 'OS',         value: sysInfo ? `${sysInfo.os_name} ${sysInfo.os_release}` : '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span className="stat-label">{label}</span>
                <span className="mono" style={{ color: 'var(--text-primary)', fontSize: 12 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Module cards */}
      <div className="section">
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>
          <Activity size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
          Engineering Modules
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {MODULE_CARDS.map(({ id, icon: Icon, title, desc, color }) => (
            <button
              key={id}
              className="card"
              onClick={() => onNavigate(id as Page)}
              style={{ textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.15s', border: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 6,
                  background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{title}</div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{desc}</p>
            </button>
          ))}
          {/* Quick stats */}
          <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
            <div className="card-title" style={{ marginBottom: 12 }}>
              <Clock size={14} /> System Summary
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              {[
                { label: 'FEM Meshes Supported', value: '10, 20, 40, 80 elements' },
                { label: 'Max Parallel Workers', value: `${sysInfo?.cpu_logical_cores ?? 4} (hardware limit)` },
                { label: 'Hardware Devices (Mock)', value: 'MCU, FPGA, JTAG' },
                { label: 'NN Parameters',          value: 'w, b, v, c (4 params)' },
                { label: 'Backend Protocol',       value: 'HTTP/1.1 JSON REST' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ color: 'var(--text-secondary)', textAlign: 'right' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

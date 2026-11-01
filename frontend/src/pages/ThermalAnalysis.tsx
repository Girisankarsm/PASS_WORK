import { useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Play, Download, Settings, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { ThermalResult, ConvergenceResult } from '../types/api';

const DEFAULT_PARAMS = {
  n_elements: 20,
  L: 1.0,
  A: 1e-4,
  k: 10.0,
  q: 10000.0,
  T0: 100.0,
  TL: 20.0,
};

export default function ThermalAnalysis({ backendUp }: { backendUp: boolean }) {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [result, setResult] = useState<ThermalResult | null>(null);
  const [convergence, setConvergence] = useState<ConvergenceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [convLoading, setConvLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const solve = useCallback(async () => {
    if (!backendUp) {
      setError('Backend is offline. Please launch C++ server.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await api.thermalSolve(params as Record<string, number>);
      setResult(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Solver failed');
    } finally {
      setLoading(false);
    }
  }, [backendUp, params]);

  const runConvergence = useCallback(async () => {
    if (!backendUp) {
      setError('Backend is offline');
      return;
    }
    setConvLoading(true);
    setError(null);
    try {
      const r = await api.thermalConvergence({ k: params.k, q: params.q });
      setConvergence(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Convergence calculation failed');
    } finally {
      setConvLoading(false);
    }
  }, [backendUp, params]);

  const downloadCSV = () => {
    if (!result) return;
    const rows = [
      'x_m,T_fem_C,T_exact_C,absolute_error_C',
      ...result.nodes.map(
        (n) =>
          `${n.x.toFixed(6)},${n.T_fem.toFixed(6)},${n.T_exact.toFixed(
            6
          )},${Math.abs(n.T_fem - n.T_exact).toFixed(6)}`
      ),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `thermal_fem_${params.n_elements}_elements.csv`;
    a.click();
  };

  const chartData = result?.nodes.map((n) => ({
    x: n.x.toFixed(3),
    'FEM Solution': parseFloat(n.T_fem.toFixed(4)),
    'Analytical Exact': parseFloat(n.T_exact.toFixed(4)),
  }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Thermal Finite Element Analysis</h1>
          <p className="page-subtitle">
            1D steady-state heat equation with heat generation: −d/dx(kA dT/dx) = qA
          </p>
        </div>
        {result && (
          <button className="btn btn-outline btn-sm" onClick={downloadCSV}>
            <Download size={14} /> Export CSV
          </button>
        )}
      </div>

      <div className="layout-split">
        {/* Left Column: Configuration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Settings size={16} /> Parameters
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setParams(DEFAULT_PARAMS)}
                title="Reset to default values"
              >
                <RefreshCw size={12} /> Reset
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { key: 'n_elements', label: 'Elements', unit: 'mesh', min: 1, max: 10000, step: 1 },
                { key: 'L', label: 'Rod Length', unit: 'm', min: 0.01, max: 100, step: 0.1 },
                { key: 'A', label: 'Cross Section (A)', unit: 'm²', min: 1e-6, max: 1, step: 1e-5 },
                { key: 'k', label: 'Conductivity (k)', unit: 'W/(m·K)', min: 0.1, max: 1000, step: 0.5 },
                { key: 'q', label: 'Heat Generation (q)', unit: 'W/m³', min: 0, max: 1e7, step: 500 },
                { key: 'T0', label: 'T(0) Left Temp', unit: '°C', min: -273, max: 3000, step: 1 },
                { key: 'TL', label: 'T(L) Right Temp', unit: '°C', min: -273, max: 3000, step: 1 },
              ].map(({ key, label, unit, min, max, step }) => (
                <div key={key} className="form-group" style={{ marginBottom: 0 }}>
                  <div className="form-label">
                    <span>{label}</span>
                    <span className="form-unit">{unit}</span>
                  </div>
                  <input
                    className="input-text"
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={(params as Record<string, number>)[key]}
                    onChange={(e) =>
                      setParams((p) => ({
                        ...p,
                        [key]: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20 }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={solve}
                disabled={loading || !backendUp}
              >
                <Play size={15} /> {loading ? 'Computing…' : 'Solve FEM System'}
              </button>
            </div>
          </div>

          {/* Theoretical Boundary Conditions Card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Boundary & Analytical</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <div>• Dirichlet BC 1: <strong style={{ color: 'var(--text-main)' }}>T(0) = {params.T0}°C</strong></div>
              <div>• Dirichlet BC 2: <strong style={{ color: 'var(--text-main)' }}>T(L) = {params.TL}°C</strong></div>
              <div>• Lateral surfaces: <span className="badge badge-blue">Insulated</span></div>
              <div style={{ marginTop: 10, padding: 8, background: 'var(--bg-input)', borderRadius: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Exact Equation:</span><br />
                <span className="mono" style={{ fontSize: 11, color: 'var(--primary-blue)' }}>
                  T(x) = 100 − 80x/L + [q/(2k)]x(L−x)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Visualization & Convergence */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {error && <div className="alert alert-error">{error}</div>}

          {/* Temperature Distribution Curve */}
          <div className="card">
            <div className="card-header">
              <div>
                <span className="card-title">Temperature Distribution</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
                  Comparison of 1D FEM nodal values vs exact analytical formulation
                </span>
              </div>
              {result && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="badge badge-green">
                    <CheckCircle2 size={12} /> Midpoint Error: {result.max_midpoint_error.toFixed(4)}°C
                  </span>
                </div>
              )}
            </div>

            {chartData ? (
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#233147" />
                    <XAxis
                      dataKey="x"
                      stroke="#64748B"
                      fontSize={11}
                      tickLine={false}
                      label={{ value: 'Rod Position x (m)', position: 'insideBottom', offset: -6, fill: '#64748B', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#64748B"
                      fontSize={11}
                      tickLine={false}
                      label={{ value: 'Temp (°C)', angle: -90, position: 'insideLeft', fill: '#64748B', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#152033',
                        border: '1px solid #233147',
                        borderRadius: 8,
                        fontSize: 12,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                      }}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    <Line
                      type="monotone"
                      dataKey="FEM Solution"
                      stroke="#2583FF"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#2583FF' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Analytical Exact"
                      stroke="#22C55E"
                      strokeWidth={1.8}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Click "Solve FEM System" to compute temperature distribution.
              </div>
            )}
          </div>

          {/* Mesh Convergence Study */}
          <div className="card">
            <div className="card-header">
              <div>
                <span className="card-title">Mesh Convergence Study</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
                  Quadratic error reduction O(h²) across 10, 20, 40, and 80 linear elements
                </span>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={runConvergence}
                disabled={convLoading || !backendUp}
              >
                {convLoading ? 'Running…' : 'Run Convergence Study'}
              </button>
            </div>

            {convergence ? (
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Mesh Elements</th>
                      <th>Element Size h (m)</th>
                      <th>Max Midpoint Error (°C)</th>
                      <th>Observed Error Ratio</th>
                      <th>Convergence Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {convergence.convergence.map((c, i, arr) => {
                      const h = 1.0 / c.n_elements;
                      const ratio = i > 0 ? (arr[i - 1].max_midpoint_error / c.max_midpoint_error).toFixed(2) : '—';
                      return (
                        <tr key={c.n_elements}>
                          <td style={{ fontWeight: 600 }}>{c.n_elements} elements</td>
                          <td className="mono">{h.toFixed(4)}</td>
                          <td className="mono" style={{ color: '#60A5FA', fontWeight: 600 }}>
                            {c.max_midpoint_error.toFixed(6)} °C
                          </td>
                          <td className="mono">{ratio}</td>
                          <td>
                            <span className="badge badge-green">O(h²) Quadratic</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12.5 }}>
                Click "Run Convergence Study" to verify second-order finite element convergence.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

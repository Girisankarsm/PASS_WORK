import { useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import { Play, Download, Settings, TrendingDown } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { ThermalResult, ConvergenceResult } from '../types/api';

const DEFAULT_PARAMS = { n_elements: 20, L: 1.0, A: 1e-4, k: 10.0, q: 10000.0, T0: 100.0, TL: 20.0 };

export default function ThermalAnalysis({ backendUp }: { backendUp: boolean }) {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [result, setResult]     = useState<ThermalResult | null>(null);
  const [convergence, setConvergence] = useState<ConvergenceResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [convLoading, setConvLoading] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const solve = useCallback(async () => {
    if (!backendUp) { setError('Backend offline'); return; }
    setLoading(true); setError(null);
    try {
      const r = await api.thermalSolve(params as Record<string, number>);
      setResult(r);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Solver error'); }
    finally { setLoading(false); }
  }, [backendUp, params]);

  const runConvergence = useCallback(async () => {
    if (!backendUp) { setError('Backend offline'); return; }
    setConvLoading(true); setError(null);
    try {
      const r = await api.thermalConvergence({ k: params.k, q: params.q });
      setConvergence(r);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Convergence error'); }
    finally { setConvLoading(false); }
  }, [backendUp, params]);

  const downloadCSV = () => {
    if (!result) return;
    const rows = ['x_m,T_fem_C,T_exact_C',
      ...result.nodes.map(n => `${n.x.toFixed(6)},${n.T_fem.toFixed(6)},${n.T_exact.toFixed(6)}`)];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `thermal_results_${params.n_elements}elem.csv`; a.click();
  };

  const chartData = result?.nodes.map(n => ({
    x: n.x.toFixed(3), T_FEM: parseFloat(n.T_fem.toFixed(4)), T_Exact: parseFloat(n.T_exact.toFixed(4)),
  }));

  const convData = convergence?.convergence.map(c => ({
    n: c.n_elements, error: c.max_midpoint_error,
    h2: convergence.convergence[0]
      ? convergence.convergence[0].max_midpoint_error * (convergence.convergence[0].n_elements / c.n_elements) ** 2
      : 0,
  }));

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Thermal Finite Element Analysis</h1>
        <p className="page-subtitle">
          1D steady-state FEM solver · Governing eq: −d/dx(kA dT/dx) = qA
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
        {/* Config panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}><Settings size={14} /> Solver Configuration</div>
            {[
              { key: 'n_elements', label: 'Elements',  unit: '',       min: 1,    max: 10000, step: 1 },
              { key: 'L',         label: 'Length',     unit: 'm',      min: 0.01, max: 100,   step: 0.01 },
              { key: 'A',         label: 'Area (A)',   unit: 'm²',     min: 1e-6, max: 1,     step: 1e-6 },
              { key: 'k',         label: 'Conductivity (k)', unit: 'W/(m·K)', min: 0.01, max: 1000, step: 0.1 },
              { key: 'q',         label: 'Heat Gen (q)', unit: 'W/m³', min: 0,    max: 1e7,   step: 100 },
              { key: 'T0',        label: 'T(0)',        unit: '°C',    min: -300, max: 3000,  step: 1 },
              { key: 'TL',        label: 'T(L)',        unit: '°C',    min: -300, max: 3000,  step: 1 },
            ].map(({ key, label, unit, min, max, step }) => (
              <div className="form-group" key={key} style={{ marginBottom: 10 }}>
                <label className="form-label">{label} {unit && <span style={{ color: 'var(--text-muted)' }}>[{unit}]</span>}</label>
                <input className="form-input" type="number" min={min} max={max} step={step}
                  value={(params as Record<string, number>)[key]}
                  onChange={e => setParams(p => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn btn-primary w-full" onClick={solve} disabled={loading || !backendUp}>
                {loading ? <><div className="spinner" /> Solving…</> : <><Play size={13} /> Solve</>}
              </button>
              <button className="btn btn-secondary" onClick={() => setParams(DEFAULT_PARAMS)} title="Reset params">↺</button>
            </div>
          </div>

          {/* BCs */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 8 }}>Boundary Conditions</div>
            <div className="alert alert-info" style={{ marginBottom: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 11 }}>
                T(x=0) = <strong>{params.T0} °C</strong><br />
                T(x=L) = <strong>{params.TL} °C</strong><br />
                Lateral surfaces: insulated
              </div>
            </div>
            <div className="info-text">Analytical solution:<br />
              T(x) = T₀ − (T₀−TL)x/L + [q/(2k)]x(L−x)
            </div>
          </div>

          {result && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 8 }}>Results</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <div><span className="form-label">Elements</span> <span style={{ fontWeight: 600 }}>{result.n_elements}</span></div>
                <div><span className="form-label">Nodes</span> <span>{result.nodes.length}</span></div>
                <div><span className="form-label">Max Midpoint Error</span>
                  <span style={{ color: result.max_midpoint_error < 0.01 ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                    {' '}{result.max_midpoint_error.toExponential(3)} °C
                  </span>
                </div>
                <div><span className="form-label">T_max (FEM)</span>
                  <span>{Math.max(...result.nodes.map(n=>n.T_fem)).toFixed(4)} °C</span></div>
              </div>
              <button className="btn btn-secondary btn-sm w-full" style={{ marginTop: 12 }} onClick={downloadCSV}>
                <Download size={11} /> Download CSV
              </button>
            </div>
          )}
        </div>

        {/* Charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && <div className="alert alert-error">{error}</div>}

          {/* Temperature profile */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Temperature Distribution</div>
              <span className="badge badge-blue">FEM vs Analytical</span>
            </div>
            {result ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="x" label={{ value: 'x (m)', position: 'insideBottom', offset: -3, fill: 'var(--text-muted)', fontSize: 11 }}
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis label={{ value: 'T (°C)', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 11 }}
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 11 }}
                    formatter={(v: number, name: string) => [`${v.toFixed(4)} °C`, name]} />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
                  <Line type="monotone" dataKey="T_FEM"   stroke="#2f81f7" strokeWidth={2} dot={false} name="FEM" />
                  <Line type="monotone" dataKey="T_Exact" stroke="#3fb950" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="Analytical" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                Configure parameters and click Solve
              </div>
            )}
          </div>

          {/* Convergence */}
          <div className="card">
            <div className="card-header">
              <div className="card-title"><TrendingDown size={14} /> Mesh Convergence Study</div>
              <button className="btn btn-secondary btn-sm" onClick={runConvergence} disabled={convLoading || !backendUp}>
                {convLoading ? <><div className="spinner" /> Running…</> : 'Run Study (10, 20, 40, 80 elements)'}
              </button>
            </div>
            {convergence ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={convData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="n" label={{ value: 'Elements', position: 'insideBottom', offset: -3, fill: 'var(--text-muted)', fontSize: 11 }}
                      tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                    <YAxis scale="log" domain={['auto', 'auto']}
                      label={{ value: 'Max Error (°C)', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 11 }}
                      tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={(v: number) => v.toExponential(0)} />
                    <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 11 }}
                      formatter={(v: number) => [v.toExponential(4), '']} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="error" stroke="#f97316" strokeWidth={2} dot name="FEM Error" />
                    <Line type="monotone" dataKey="h2" stroke="#8b949e" strokeWidth={1} strokeDasharray="4 2" dot={false} name="O(h²) ref" />
                  </LineChart>
                </ResponsiveContainer>
                <table className="data-table" style={{ marginTop: 8 }}>
                  <thead><tr><th>Elements</th><th>Max Midpt Error (°C)</th><th>Ratio to prev</th></tr></thead>
                  <tbody>
                    {convergence.convergence.map((c, i) => (
                      <tr key={c.n_elements}>
                        <td>{c.n_elements}</td>
                        <td>{c.max_midpoint_error.toExponential(4)}</td>
                        <td>{i > 0 ? (convergence.convergence[i-1].max_midpoint_error / c.max_midpoint_error).toFixed(2) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                Click "Run Study" to see convergence for 10, 20, 40, and 80 elements
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

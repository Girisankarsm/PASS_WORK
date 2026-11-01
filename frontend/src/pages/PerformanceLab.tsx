import { useState, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Play, Zap, Clock } from 'lucide-react';
import { api, pollJob, ApiError } from '../lib/api';
import type { BenchmarkResult, SystemInfoResponse } from '../types/api';

export default function PerformanceLab({ backendUp, sysInfo }: { backendUp: boolean; sysInfo: SystemInfoResponse | null }) {
  const [nCases, setNCases] = useState(50);
  const [nElem,  setNElem]  = useState(40);
  const [loading, setLoading]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult]     = useState<BenchmarkResult | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const runBenchmark = useCallback(async () => {
    if (!backendUp) { setError('Backend offline'); return; }
    setLoading(true); setError(null); setProgress(0); setResult(null);
    try {
      const { job_id } = await api.benchmark(nCases, nElem);
      const job = await pollJob(job_id, setProgress, 500, 120000);
      if (job.result) setResult(job.result as unknown as BenchmarkResult);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Benchmark error'); }
    finally { setLoading(false); }
  }, [backendUp, nCases, nElem]);

  const allRuns = result ? [
    { workers: 1, median_ms: result.serial.median_ms, speedup: 1.0, efficiency: 1.0 },
    ...result.parallel.map(p => ({ workers: p.worker_count, median_ms: p.median_ms, speedup: p.speedup ?? 1, efficiency: p.efficiency ?? 1 })),
  ] : [];

  const repData = result
    ? result.serial.rep_times_ms.map((t, i) => ({
        rep: i + 1,
        serial: parseFloat(t.toFixed(2)),
        ...Object.fromEntries(result.parallel.map(p => [`${p.worker_count}w`, parseFloat((p.rep_times_ms[i] ?? 0).toFixed(2))])),
      }))
    : [];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Performance Lab</h1>
        <p className="page-subtitle">Serial vs CPU-parallel thermal solves · fixed seed · 5 reps · warm-up run</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16 }}>
        {/* Config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}><Zap size={14} /> Benchmark Config</div>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label">Cases (N)</label>
              <input className="form-input" type="number" min={1} max={500} value={nCases} onChange={e=>setNCases(+e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Elements per case</label>
              <input className="form-input" type="number" min={1} max={1000} value={nElem} onChange={e=>setNElem(+e.target.value)} />
            </div>
            <button className="btn btn-primary w-full" onClick={runBenchmark} disabled={loading || !backendUp}>
              {loading ? <><div className="spinner" /> Running…</> : <><Play size={13} /> Run Benchmark</>}
            </button>
            {loading && (
              <div style={{ marginTop: 10 }}>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{progress}%</div>
              </div>
            )}
          </div>

          {/* System info */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 8 }}>System</div>
            <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sysInfo && <>
                <div><span className="form-label">Logical CPUs</span><div style={{ fontWeight: 600 }}>{sysInfo.cpu_logical_cores}</div></div>
                <div><span className="form-label">Compiler</span><div className="mono">{sysInfo.compiler}</div></div>
                <div><span className="form-label">Optimization</span><div className="mono">{sysInfo.optimization}</div></div>
              </>}
              <div><span className="form-label">Workload Seed</span><div className="mono">42 (fixed)</div></div>
              <div><span className="form-label">Warm-up</span><div>1 run before 5 measured</div></div>
            </div>
          </div>

          {result && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 8 }}><Clock size={14} /> Agreement Check</div>
              <div className={`alert ${result.agreement_passed ? 'alert-success' : 'alert-error'}`}>
                {result.agreement_passed ? '✓ PASS' : '✗ FAIL'}<br />
                Max error: {result.max_agreement_error.toExponential(3)} °C<br />
                Threshold: 1e-8 °C
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && <div className="alert alert-error">{error}</div>}

          {result ? (
            <>
              {/* Summary table */}
              <div className="card">
                <div className="card-title" style={{ marginBottom: 12 }}>Benchmark Results</div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Workers</th><th>Median (ms)</th>
                      {result.serial.rep_times_ms.map((_,i) => <th key={i}>Rep {i+1} (ms)</th>)}
                      <th>Speedup</th><th>Efficiency</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>1 (serial)</td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{result.serial.median_ms.toFixed(2)}</td>
                      {result.serial.rep_times_ms.map((t,i) => <td key={i}>{t.toFixed(2)}</td>)}
                      <td>1.00×</td><td>100%</td>
                    </tr>
                    {result.parallel.map(p => (
                      <tr key={p.worker_count}>
                        <td>{p.worker_count}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.median_ms.toFixed(2)}</td>
                        {p.rep_times_ms.map((t,i) => <td key={i}>{t.toFixed(2)}</td>)}
                        <td style={{ color: (p.speedup??1) >= 1 ? 'var(--success)' : 'var(--error)' }}>{(p.speedup??1).toFixed(2)}×</td>
                        <td>{((p.efficiency??1)*100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="info-text" style={{ marginTop: 8 }}>
                  {result.n_cases} cases × {result.n_elem} elements · {result.n_reps} reps · seed=42 · {result.compiler}
                </div>
              </div>

              {/* Charts row */}
              <div className="grid-2">
                {/* Median time per worker */}
                <div className="card">
                  <div className="card-title" style={{ marginBottom: 8 }}>Execution Time (ms)</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={allRuns} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="workers" label={{ value: 'Workers', position: 'insideBottom', offset: -3, fill: 'var(--text-muted)', fontSize: 10 }} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: 11 }}
                        formatter={(v: number) => [`${v.toFixed(2)} ms`]} />
                      <Bar dataKey="median_ms" fill="#2f81f7" name="Median time" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Speedup + efficiency */}
                <div className="card">
                  <div className="card-title" style={{ marginBottom: 8 }}>Speedup & Efficiency</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={allRuns} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="workers" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: 11 }}
                        formatter={(v: number, n: string) => [n === 'speedup' ? `${v.toFixed(2)}×` : `${(v*100).toFixed(0)}%`, n]} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line type="monotone" dataKey="speedup" stroke="#3fb950" strokeWidth={2} dot name="Speedup" />
                      <Line type="monotone" dataKey="efficiency" stroke="#f97316" strokeWidth={2} dot name="Efficiency" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Per-rep times */}
              {repData.length > 0 && (
                <div className="card">
                  <div className="card-title" style={{ marginBottom: 8 }}>Per-Repetition Times (ms)</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={repData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="rep" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: 11 }}
                        formatter={(v: number) => [`${v.toFixed(2)} ms`]} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line type="monotone" dataKey="serial" stroke="#2f81f7" strokeWidth={2} dot name="1 worker (serial)" />
                      {result.parallel.map((p, i) => (
                        <Line key={p.worker_count} type="monotone" dataKey={`${p.worker_count}w`}
                          stroke={['#3fb950','#f97316','#ec4899'][i] ?? '#8b949e'} strokeWidth={1.5} dot name={`${p.worker_count} workers`} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          ) : (
            <div className="card" style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: 'var(--text-muted)' }}>
              <Zap size={32} style={{ opacity: 0.2 }} />
              <div style={{ fontSize: 12 }}>Configure and run benchmark to see results</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

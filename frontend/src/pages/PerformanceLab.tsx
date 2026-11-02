import { useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Play, Zap, CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';
import { api, pollJob, ApiError } from '../lib/api';
import { useChartColors } from '../lib/theme';
import type { BenchmarkResult, SystemInfoResponse } from '../types/api';


export default function PerformanceLab({
  backendUp,
  sysInfo,
}: {
  backendUp: boolean;
  sysInfo: SystemInfoResponse | null;
}) {
  const [nCases, setNCases] = useState(50);
  const [nElem, setNElem] = useState(40);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ch = useChartColors();


  const runBenchmark = useCallback(async () => {
    if (!backendUp) {
      setError('Backend is offline. Please launch C++ server.');
      return;
    }
    setLoading(true);
    setError(null);
    setProgress(0);
    setResult(null);
    try {
      const { job_id } = await api.benchmark(nCases, nElem);
      const job = await pollJob(job_id, setProgress, 400, 120000);
      if (job.result) setResult(job.result as unknown as BenchmarkResult);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Benchmark execution failed');
    } finally {
      setLoading(false);
    }
  }, [backendUp, nCases, nElem]);

  const allRuns = result
    ? [
        {
          workers: '1 (Serial)',
          median_ms: parseFloat(result.serial.median_ms.toFixed(2)),
          speedup: 1.0,
          efficiency: 100,
        },
        ...result.parallel.map((p) => ({
          workers: `${p.worker_count} Cores`,
          median_ms: parseFloat(p.median_ms.toFixed(2)),
          speedup: parseFloat((p.speedup ?? 1).toFixed(2)),
          efficiency: Math.round((p.efficiency ?? 1) * 100),
        })),
      ]
    : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Performance Lab</h1>
          <p className="page-subtitle">
            Serial vs multi-threaded CPU parallel thermal solver · 5 measured repetitions · warm-up run · deterministic seed
          </p>
        </div>
      </div>

      <div className="layout-split">
        {/* Left Column: Configuration & Specs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Config Card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Zap size={16} /> Benchmark Setup
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div className="form-label">
                  <span>Independent Problem Cases</span>
                  <span className="form-unit">batches</span>
                </div>
                <input
                  className="input-text"
                  type="number"
                  min={1}
                  max={500}
                  value={nCases}
                  onChange={(e) => setNCases(+e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <div className="form-label">
                  <span>Mesh Elements per Case</span>
                  <span className="form-unit">elements</span>
                </div>
                <input
                  className="input-text"
                  type="number"
                  min={1}
                  max={1000}
                  value={nElem}
                  onChange={(e) => setNElem(+e.target.value)}
                />
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                <div>• Seed: <span className="mono">42 (Deterministic)</span></div>
                <div>• Protocol: 1 warm-up + 5 repetitions</div>
                <div>• Agreement target: <span className="mono">&le; 1e-8 °C</span></div>
              </div>

              <div style={{ marginTop: 12 }}>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={runBenchmark}
                  disabled={loading || !backendUp}
                >
                  <Play size={15} /> {loading ? `Benchmarking (${progress}%)…` : 'Run Benchmark'}
                </button>
              </div>

              {loading && (
                <div style={{ marginTop: 8 }}>
                  <div
                    style={{
                      height: 6,
                      background: 'var(--bg-input)',
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${progress}%`,
                        height: '100%',
                        background: 'var(--primary-blue)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* System Specs */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Cpu size={16} /> Compute Environment
              </span>
            </div>
            <div style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sysInfo && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="form-label">Logical Cores</span>
                    <span style={{ fontWeight: 600 }}>{sysInfo.cpu_logical_cores} Cores</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="form-label">Platform</span>
                    <span className="mono">{sysInfo.machine} ({sysInfo.os_name})</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="form-label">Compiler</span>
                    <span className="mono">{sysInfo.compiler}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="form-label">Optimization</span>
                    <span className="mono">{sysInfo.optimization}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Results & Charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {error && <div className="alert alert-error">{error}</div>}

          {/* Top Summary Stat Cards */}
          {result && (
            <div className="grid-3" style={{ gap: 14 }}>
              <div className="card" style={{ padding: '16px 20px' }}>
                <div className="form-label">Serial Baseline (1 Worker)</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-main)', marginTop: 4 }}>
                  {result.serial.median_ms.toFixed(2)}{' '}
                  <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)' }}>ms</span>
                </div>
              </div>

              <div className="card" style={{ padding: '16px 20px' }}>
                <div className="form-label">Peak Speedup</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary-blue)', marginTop: 4 }}>
                  {Math.max(...result.parallel.map((p) => p.speedup ?? 1)).toFixed(2)}×
                </div>
              </div>

              <div className="card" style={{ padding: '16px 20px' }}>
                <div className="form-label">Numerical Agreement</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span className="badge badge-green">
                    <CheckCircle2 size={12} /> {result.max_agreement_error.toExponential(2)} °C
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Threshold: 1e-8 °C
                </div>
              </div>
            </div>
          )}

          {/* Results Table */}
          {result && (
            <div className="card">
              <div className="card-header">
                <div>
                  <span className="card-title">Measured Repetitions & Speedup</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
                    5 measured repetitions after cache warm-up run (ms)
                  </span>
                </div>
              </div>

              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Configuration</th>
                      <th>Median Time</th>
                      <th>Rep 1</th>
                      <th>Rep 2</th>
                      <th>Rep 3</th>
                      <th>Rep 4</th>
                      <th>Rep 5</th>
                      <th>Speedup</th>
                      <th>Efficiency</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 600 }}>1 Worker (Serial)</td>
                      <td className="mono" style={{ fontWeight: 700 }}>{result.serial.median_ms.toFixed(2)} ms</td>
                      {result.serial.rep_times_ms.map((t, i) => (
                        <td key={i} className="mono">{t.toFixed(2)}</td>
                      ))}
                      <td className="mono">1.00×</td>
                      <td className="mono">100%</td>
                    </tr>
                    {result.parallel.map((p) => (
                      <tr key={p.worker_count}>
                        <td style={{ fontWeight: 600 }}>{p.worker_count} Workers (Parallel)</td>
                        <td className="mono" style={{ fontWeight: 700, color: 'var(--primary-blue)' }}>
                          {p.median_ms.toFixed(2)} ms
                        </td>
                        {p.rep_times_ms.map((t, i) => (
                          <td key={i} className="mono">{t.toFixed(2)}</td>
                        ))}
                        <td className="mono" style={{ color: '#4ADE80', fontWeight: 600 }}>
                          {(p.speedup ?? 1).toFixed(2)}×
                        </td>
                        <td className="mono">{Math.round((p.efficiency ?? 1) * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Charts Row */}
          {result ? (
            <div className="layout-equal">
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Execution Time vs Workers</span>
                </div>
                <div style={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={allRuns} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={ch.grid} />
                      <XAxis dataKey="workers" stroke={ch.axis} fontSize={11} tickLine={false} />
                      <YAxis stroke={ch.axis} fontSize={11} tickLine={false} unit=" ms" />
                      <Tooltip
                        contentStyle={{
                          background: ch.tooltipBg,
                          border: `1px solid ${ch.tooltipBorder}`,
                          borderRadius: 6,
                          fontSize: 12,
                          color: 'var(--text-main)',
                        }}
                      />
                      <Bar dataKey="median_ms" fill={ch.primary} name="Median (ms)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Speedup Curve (T₁ / Tₚ)</span>
                </div>
                <div style={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={allRuns} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={ch.grid} />
                      <XAxis dataKey="workers" stroke={ch.axis} fontSize={11} tickLine={false} />
                      <YAxis stroke={ch.axis} fontSize={11} tickLine={false} unit="×" />
                      <Tooltip
                        contentStyle={{
                          background: ch.tooltipBg,
                          border: `1px solid ${ch.tooltipBorder}`,
                          borderRadius: 6,
                          fontSize: 12,
                          color: 'var(--text-main)',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="speedup"
                        stroke="#22C55E"
                        strokeWidth={2.2}
                        dot={{ r: 3.5, fill: '#22C55E' }}
                        name="Speedup"
                      />

                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              Configure batch parameters and click "Run Benchmark" to execute timed multi-core benchmarks.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

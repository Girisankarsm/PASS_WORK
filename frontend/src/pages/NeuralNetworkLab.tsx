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
import { Play, Brain, CheckCircle2, XCircle, Download } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { NeuralTrainResult } from '../types/api';

export default function NeuralNetworkLab({ backendUp }: { backendUp: boolean }) {
  const [nSteps, setNSteps] = useState(100);
  const [lr, setLr] = useState(0.1);
  const [result, setResult] = useState<NeuralTrainResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const train = useCallback(async () => {
    if (!backendUp) {
      setError('Backend is offline. Please launch C++ server.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await api.neuralTrain(nSteps, lr);
      setResult(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Training failed');
    } finally {
      setLoading(false);
    }
  }, [backendUp, nSteps, lr]);

  const downloadCSV = () => {
    if (!result) return;
    const rows = [
      'step,loss,w,b,v,c,dJ_dw,dJ_db,dJ_dv,dJ_dc',
      ...result.history.map(
        (s) =>
          `${s.step},${s.loss},${s.w},${s.b},${s.v},${s.c},${s.dJ_dw},${s.dJ_db},${s.dJ_dv},${s.dJ_dc}`
      ),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'neural_network_training_history.csv';
    a.click();
  };

  const lossData = result?.history.map((s) => ({
    step: s.step,
    Loss: parseFloat(s.loss.toFixed(6)),
  }));

  const paramsData = result
    ? [
        result.history[0],
        ...result.history.filter(
          (_, i) => (i + 1) % Math.max(1, Math.floor(result.history.length / 25)) === 0
        ),
      ].map((s) => ({
        step: s.step,
        w: parseFloat(s.w.toFixed(4)),
        b: parseFloat(s.b.toFixed(4)),
        v: parseFloat(s.v.toFixed(4)),
        c: parseFloat(s.c.toFixed(4)),
      }))
    : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Neural Network Lab</h1>
          <p className="page-subtitle">
            Single-sample regression · Handcoded backpropagation without autograd · Central FD gradient check · x=1.0, y=2.0
          </p>
        </div>
        {result && (
          <button className="btn btn-outline btn-sm" onClick={downloadCSV}>
            <Download size={14} /> Export Training CSV
          </button>
        )}
      </div>

      <div className="layout-split">
        {/* Left Column: Config & Architecture */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Training Setup Card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Brain size={16} /> Training Setup
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <div className="form-label">
                  <span>Optimization Steps</span>
                  <span className="form-unit">iterations</span>
                </div>
                <input
                  className="input-text"
                  type="number"
                  min={1}
                  max={5000}
                  value={nSteps}
                  onChange={(e) => setNSteps(+e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <div className="form-label">
                  <span>Learning Rate (η)</span>
                  <span className="form-unit">step size</span>
                </div>
                <input
                  className="input-text"
                  type="number"
                  step="0.01"
                  min={0.001}
                  max={2.0}
                  value={lr}
                  onChange={(e) => setLr(+e.target.value)}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={train}
                  disabled={loading || !backendUp}
                >
                  <Play size={15} /> {loading ? 'Optimizing…' : 'Train Network'}
                </button>
              </div>
            </div>
          </div>

          {/* Mathematical Architecture Card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Network Formulation</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <div>• Target Pair: <strong style={{ color: 'var(--text-main)' }}>x = 1.0, y = 2.0</strong></div>
              <div>• Hidden: <span className="mono">h = tanh(w·x + b)</span></div>
              <div>• Prediction: <span className="mono">ŷ = v·h + c</span></div>
              <div>• Objective: <span className="mono">J = 0.5(ŷ − y)²</span></div>
              <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-input)', borderRadius: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Initial Weights:</span><br />
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--primary-blue)' }}>
                  w=0.5, b=0.0, v=1.0, c=0.0
                </span>
              </div>
            </div>
          </div>

          {/* Verification Badge */}
          {result && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Gradient Check</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {result.grad_check_passed ? (
                    <span className="badge badge-green">
                      <CheckCircle2 size={12} /> VERIFIED PASS
                    </span>
                  ) : (
                    <span className="badge badge-red">
                      <XCircle size={12} /> FAILED
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Max finite-diff discrepancy: <strong className="mono">{result.grad_check_max_error.toExponential(2)}</strong><br />
                  Tolerance threshold: &le; 1e-5 (Central FD ε=1e-6)
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Charts & Parameter Evolution */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {error && <div className="alert alert-error">{error}</div>}

          {/* Loss Curve */}
          <div className="card">
            <div className="card-header">
              <div>
                <span className="card-title">Training Loss Trajectory</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
                  Quadratic error J = 0.5(ŷ − y)² over {nSteps} gradient descent iterations
                </span>
              </div>
              {result && (
                <span className="badge badge-blue">
                  Final Loss: {result.history[result.history.length - 1].loss.toExponential(4)}
                </span>
              )}
            </div>

            {lossData ? (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lossData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#233147" />
                    <XAxis
                      dataKey="step"
                      stroke="#64748B"
                      fontSize={11}
                      tickLine={false}
                      label={{ value: 'Training Step', position: 'insideBottom', offset: -4, fill: '#64748B', fontSize: 11 }}
                    />
                    <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: '#152033',
                        border: '1px solid #233147',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Loss"
                      stroke="#2583FF"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Click "Train Network" to run forward pass, analytical backprop, and optimization.
              </div>
            )}
          </div>

          {/* Parameter Evolution */}
          {result && (
            <div className="card">
              <div className="card-header">
                <div>
                  <span className="card-title">Parameter Evolution (w, b, v, c)</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
                    Simultaneous weight and bias adaptation
                  </span>
                </div>
              </div>

              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={paramsData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#233147" />
                    <XAxis dataKey="step" stroke="#64748B" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: '#152033',
                        border: '1px solid #233147',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend verticalAlign="top" height={32} iconType="circle" />
                    <Line type="monotone" dataKey="w" stroke="#3B82F6" strokeWidth={2} dot={false} name="Weight w" />
                    <Line type="monotone" dataKey="b" stroke="#A855F7" strokeWidth={2} dot={false} name="Bias b" />
                    <Line type="monotone" dataKey="v" stroke="#22C55E" strokeWidth={2} dot={false} name="Weight v" />
                    <Line type="monotone" dataKey="c" stroke="#F59E0B" strokeWidth={2} dot={false} name="Bias c" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

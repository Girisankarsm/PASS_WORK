import { useState, useCallback, useEffect } from 'react';
import { Cpu, Wifi, WifiOff, Activity, AlertTriangle, RefreshCw } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { DeviceInfo, TelemetryResult } from '../types/api';

const DEVICES = ['mcu', 'fpga', 'jtag'] as const;
type DeviceKey = typeof DEVICES[number];

const DEVICE_LABELS: Record<DeviceKey, { name: string; type: string; color: string }> = {
  mcu:  { name: 'STM32F446RE Nucleo', type: 'Microcontroller', color: '#2f81f7' },
  fpga: { name: 'Xilinx Artix-7',    type: 'FPGA',            color: '#a855f7' },
  jtag: { name: 'Segger J-Link EDU', type: 'JTAG Adapter',    color: '#f97316' },
};

export default function HardwareIntegration({ backendUp }: { backendUp: boolean }) {
  const [devices, setDevices]     = useState<DeviceInfo[]>([]);
  const [telemetry, setTelemetry] = useState<Record<string, TelemetryResult>>({});
  const [loading, setLoading]     = useState<Record<string, boolean>>({});
  const [error, setError]         = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    if (!backendUp) return;
    try { const r = await api.hwDevices(); setDevices(r.devices); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Failed to load devices'); }
  }, [backendUp]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const connect = useCallback(async (device: string, simulateFailure = false) => {
    setLoading(l => ({ ...l, [device]: true })); setError(null);
    try {
      await api.hwConnect(device, simulateFailure);
      await fetchDevices();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Connect error'); }
    finally { setLoading(l => ({ ...l, [device]: false })); }
  }, [fetchDevices]);

  const disconnect = useCallback(async (device: string) => {
    setLoading(l => ({ ...l, [device]: true })); setError(null);
    try { await api.hwDisconnect(device); await fetchDevices(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Disconnect error'); }
    finally { setLoading(l => ({ ...l, [device]: false })); }
  }, [fetchDevices]);

  const getTelemetry = useCallback(async (device: string) => {
    setLoading(l => ({ ...l, [`tel_${device}`]: true }));
    try {
      const t = await api.hwTelemetry(device);
      setTelemetry(prev => ({ ...prev, [device]: t }));
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Telemetry error'); }
    finally { setLoading(l => ({ ...l, [`tel_${device}`]: false })); }
  }, []);

  const getDevice = (id: string) => devices.find(d => d.id.toLowerCase().includes(id));

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Hardware Integration</h1>
        <p className="page-subtitle">
          Mock device adapters — MCU, FPGA, JTAG · All behavior is{' '}
          <span className="badge badge-yellow">SIMULATED</span> · No physical hardware tested
        </p>
      </div>

      {/* Architecture diagram */}
      <div className="card section">
        <div className="card-title" style={{ marginBottom: 12 }}>System Architecture [SIMULATED]</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', gap: 0, alignItems: 'center', fontSize: 11 }}>
          {[
            { label: 'Host PC', color: '#2f81f7', sub: 'USB 2.0 FS' },
            null,
            { label: 'J-Link EDU (JTAG)', color: '#f97316', sub: 'SWD / JTAG' },
            null,
            { label: 'STM32F446\nNucleo', color: '#3fb950', sub: '3.3V VCC / GND' },
          ].map((item, i) =>
            item ? (
              <div key={i} style={{ textAlign: 'center', padding: '12px 8px', background: `${item.color}15`, border: `1px solid ${item.color}40`, borderRadius: 6 }}>
                <div style={{ fontWeight: 600, color: item.color, whiteSpace: 'pre' }}>{item.label}</div>
                <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>{item.sub}</div>
              </div>
            ) : (
              <div key={i} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '0 4px' }}>⟵⟶</div>
            )
          )}
        </div>

        {/* Pin table */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)' }}>INTERFACE / PIN-VOLTAGE TABLE [SIMULATED]</div>
          <table className="data-table">
            <thead>
              <tr><th>Signal</th><th>Pin</th><th>Direction</th><th>Voltage Domain</th><th>Owner</th><th>Note</th></tr>
            </thead>
            <tbody>
              {[
                ['SWDIO', 'PA13', 'Bidir', '3.3V', 'J-Link', 'Level-shift if host 5V'],
                ['SWDCLK', 'PA14', 'Output (JLink)', '3.3V', 'J-Link', 'Max 4 MHz in mock'],
                ['nSRST', 'NRST', 'Output (JLink)', '3.3V', 'J-Link', 'Active-low reset'],
                ['VCC (JTAG)', 'VCC sense', 'Input (JLink)', '3.3V', 'Target (MCU)', 'Detect target voltage'],
                ['GND', 'GND', 'Reference', '0V', 'Common', 'Required; star topology'],
                ['SWO', 'PB3', 'Output (MCU)', '3.3V', 'MCU', 'Optional trace output'],
                ['FPGA TDI', 'T8', 'Input (FPGA)', '1.8V via VCCO', 'J-Link', 'Level-shift required'],
                ['FPGA TDO', 'R8', 'Output (FPGA)', '1.8V', 'FPGA', 'Level-shift required'],
                ['FPGA TCK', 'R3', 'Input (FPGA)', '1.8V', 'J-Link', '—'],
                ['FPGA TMS', 'T4', 'Input (FPGA)', '1.8V', 'J-Link', '—'],
              ].map(row => (
                <tr key={row[0]}>
                  {row.map((cell, i) => <td key={i}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Device cards */}
      <div className="grid-3 section">
        {DEVICES.map(id => {
          const dev = getDevice(id);
          const meta = DEVICE_LABELS[id];
          const connected = dev?.status === 'connected';
          const isErr = dev?.status === 'error';
          const isLoading = !!loading[id];
          const tel = telemetry[id];

          return (
            <div className="device-card" key={id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className={`device-status-indicator ${connected ? 'connected' : isErr ? 'error' : 'disconnected'}`} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: meta.color }}>{meta.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{meta.type}</div>
                </div>
                <span className="badge badge-yellow" style={{ fontSize: 10 }}>SIMULATED</span>
              </div>

              {/* Status */}
              <div className={`alert ${connected ? 'alert-success' : isErr ? 'alert-error' : 'alert-info'}`}
                style={{ padding: '6px 10px', fontSize: 11 }}>
                {connected ? <Wifi size={11} /> : isErr ? <AlertTriangle size={11} /> : <WifiOff size={11} />}
                <span style={{ textTransform: 'capitalize' }}>{dev?.status ?? 'unknown'}</span>
                {dev?.last_error && <span style={{ opacity: 0.8 }}> — {dev.last_error.substring(0, 60)}</span>}
              </div>

              {/* Device details */}
              {dev && (
                <div style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>Part: </span>{dev.part_number}</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>FW: </span><span className="mono">{dev.firmware}</span></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Interfaces: </span>{dev.interfaces.join(', ')}</div>
                  <div style={{ marginTop: 4 }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Capabilities:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {dev.capabilities.slice(0, 4).map(c => (
                        <span key={c.name} className="badge badge-blue" style={{ fontSize: 10 }} title={c.desc}>{c.name}</span>
                      ))}
                      {dev.capabilities.length > 4 && <span className="badge" style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{dev.capabilities.length - 4}</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Telemetry */}
              {tel && connected && (
                <div style={{ background: 'var(--bg-primary)', borderRadius: 4, padding: 10, fontSize: 11 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                    <Activity size={10} style={{ display: 'inline', marginRight: 4 }} />Telemetry
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                    {[
                      { label: 'Voltage', value: `${tel.voltage_V.toFixed(3)} V` },
                      { label: 'Current', value: `${tel.current_mA.toFixed(1)} mA` },
                      { label: 'Temp',    value: `${tel.temperature_C.toFixed(1)} °C` },
                      { label: 'Uptime',  value: `${(tel.uptime_ms/1000).toFixed(1)}s` },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div style={{ color: 'var(--text-muted)' }}>{label}</div>
                        <div className="mono" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  {Object.entries(tel.extra).slice(0, 3).map(([k, v]) => (
                    <div key={k} style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                      {k}: <span className="mono" style={{ color: 'var(--text-secondary)' }}>{typeof v === 'number' ? v.toFixed(3) : v}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {!connected ? (
                  <>
                    <button className="btn btn-primary btn-sm" onClick={() => connect(id, false)} disabled={isLoading}>
                      {isLoading ? <div className="spinner" /> : <Wifi size={11} />} Connect
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => connect(id, true)} disabled={isLoading} title="Simulate connection failure">
                      Simulate Failure
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-secondary btn-sm" onClick={() => getTelemetry(id)} disabled={!!loading[`tel_${id}`]}>
                      {loading[`tel_${id}`] ? <div className="spinner" /> : <Activity size={11} />} Telemetry
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => disconnect(id)} disabled={isLoading}>
                      <WifiOff size={11} /> Disconnect
                    </button>
                  </>
                )}
                <button className="btn btn-secondary btn-sm" onClick={fetchDevices} title="Refresh">
                  <RefreshCw size={11} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="alert alert-warning" style={{ fontSize: 11 }}>
        <AlertTriangle size={12} style={{ flexShrink: 0 }} />
        <div>All device behavior is <strong>simulated in software</strong>. No physical hardware was connected or tested.
        Telemetry values include simulated Gaussian noise. Connection failures are injected artificially for testing recovery.</div>
      </div>
    </div>
  );
}

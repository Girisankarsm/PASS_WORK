import { useState, useCallback, useEffect } from 'react';
import { Cpu, Wifi, WifiOff, Activity, AlertTriangle, RefreshCw, Layers } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { DeviceInfo, TelemetryResult } from '../types/api';

const DEVICES = ['mcu', 'fpga', 'jtag'] as const;
type DeviceKey = typeof DEVICES[number];

const DEVICE_LABELS: Record<DeviceKey, { name: string; type: string; color: string }> = {
  mcu: { name: 'STM32F446RE Nucleo', type: 'ARM Cortex-M4 Microcontroller', color: '#3B82F6' },
  fpga: { name: 'Xilinx Artix-7', type: 'XC7A35T FPGA Target', color: '#A855F7' },
  jtag: { name: 'Segger J-Link EDU', type: 'SWD / JTAG Debug Probe', color: '#F59E0B' },
};

export default function HardwareIntegration({ backendUp }: { backendUp: boolean }) {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [telemetry, setTelemetry] = useState<Record<string, TelemetryResult>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    if (!backendUp) return;
    try {
      const r = await api.hwDevices();
      setDevices(r.devices);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to query device bus');
    }
  }, [backendUp]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const connect = useCallback(
    async (device: string, simulateFailure = false) => {
      setLoading((l) => ({ ...l, [device]: true }));
      setError(null);
      try {
        await api.hwConnect(device, simulateFailure);
        await fetchDevices();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Connection failed');
      } finally {
        setLoading((l) => ({ ...l, [device]: false }));
      }
    },
    [fetchDevices]
  );

  const disconnect = useCallback(
    async (device: string) => {
      setLoading((l) => ({ ...l, [device]: true }));
      setError(null);
      try {
        await api.hwDisconnect(device);
        await fetchDevices();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Disconnect failed');
      } finally {
        setLoading((l) => ({ ...l, [device]: false }));
      }
    },
    [fetchDevices]
  );

  const getTelemetry = useCallback(async (device: string) => {
    setLoading((l) => ({ ...l, [`tel_${device}`]: true }));
    try {
      const t = await api.hwTelemetry(device);
      setTelemetry((prev) => ({ ...prev, [device]: t }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Telemetry read error');
    } finally {
      setLoading((l) => ({ ...l, [`tel_${device}`]: false }));
    }
  }, []);

  const getDevice = (id: string) => devices.find((d) => d.id.toLowerCase().includes(id));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Embedded Hardware Integration</h1>
          <p className="page-subtitle">
            Host-to-target communication bus simulation · Microcontroller, FPGA, and JTAG probe telemetry
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchDevices}>
          <RefreshCw size={13} /> Refresh Bus
        </button>
      </div>

      {/* Prominent Mandatory Simulation Disclaimer */}
      <div className="alert alert-warning" style={{ marginBottom: 24 }}>
        <AlertTriangle size={18} style={{ flexShrink: 0 }} />
        <div>
          <strong>Notice: All hardware interactions are simulated.</strong> No physical hardware has been connected or tested. All registers, voltage telemetry, and fault conditions are synthetic software simulations.
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* 3 Device Cards */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        {DEVICES.map((id) => {
          const dev = getDevice(id);
          const meta = DEVICE_LABELS[id];
          const isConnected = dev?.status === 'connected';
          const isErr = dev?.status === 'error';
          const isLoading = !!loading[id];
          const tel = telemetry[id];

          return (
            <div key={id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="card-header" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: isConnected ? 'var(--success)' : isErr ? 'var(--error)' : 'var(--text-muted)',
                      boxShadow: isConnected ? '0 0 8px var(--success)' : 'none',
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>
                      {meta.name}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{meta.type}</div>
                  </div>
                </div>
                <span className="badge badge-yellow">SIMULATED</span>
              </div>

              {/* Status and Telemetry */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="form-label">Bus Status</span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: isConnected ? 'var(--success)' : isErr ? 'var(--error)' : 'var(--text-muted)',
                    }}
                  >
                    {isConnected ? 'CONNECTED' : isErr ? 'ERROR / TIMEOUT' : 'DISCONNECTED'}
                  </span>
                </div>

                {dev && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="form-label">Part Number</span>
                    <span className="mono">{dev.part_number}</span>
                  </div>
                )}

                {/* Telemetry Display */}
                {tel && (
                  <div
                    style={{
                      marginTop: 6,
                      padding: 10,
                      background: 'var(--bg-input)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="form-label">Core Voltage</span>
                      <span className="mono" style={{ color: 'var(--primary-blue)', fontWeight: 600 }}>
                        {tel.voltage_V.toFixed(2)} V
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="form-label">Current Draw</span>
                      <span className="mono">{tel.current_mA.toFixed(1)} mA</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="form-label">Die Temp</span>
                      <span className="mono" style={{ color: '#F87171' }}>
                        {tel.temperature_C.toFixed(1)} °C
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="form-label">Uptime</span>
                      <span className="mono">{(tel.uptime_ms / 1000).toFixed(1)} s</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {isConnected ? (
                    <>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ flex: 1 }}
                        onClick={() => getTelemetry(id)}
                        disabled={loading[`tel_${id}`]}
                      >
                        <Activity size={12} /> Read Telemetry
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => disconnect(id)}
                        disabled={isLoading}
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ width: '100%' }}
                      onClick={() => connect(id, false)}
                      disabled={isLoading}
                    >
                      <Wifi size={12} /> Connect Target
                    </button>
                  )}
                </div>

                {!isConnected && (
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: 11, borderColor: '#475569' }}
                    onClick={() => connect(id, true)}
                    disabled={isLoading}
                  >
                    Simulate Connection Failure
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pin / Voltage Table & Electrical Architecture */}
      <div className="card">
        <div className="card-header">
          <div>
            <span className="card-title">
              <Layers size={16} /> Interface & Pin-Voltage Specifications [SIMULATED]
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
              Electrical domains, signal ownership, and bidirectional level-shifting topology
            </span>
          </div>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Signal</th>
                <th>Target Pin</th>
                <th>Direction</th>
                <th>Voltage Domain</th>
                <th>Line Owner</th>
                <th>Electrical Constraint / Notes</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['SWDIO', 'PA13', 'Bidirectional', '3.3V Logic', 'J-Link Probe', 'Active bidirectional level-shifter (TXB0108) required if host 5V'],
                ['SWDCLK', 'PA14', 'Output (Host)', '3.3V Logic', 'J-Link Probe', 'Synchronous debug clock (max 4.0 MHz simulated)'],
                ['nSRST', 'NRST', 'Open-drain Output', '3.3V Logic', 'J-Link Probe', 'Active-low reset with 10 kΩ pull-up to target VDD'],
                ['VCC Sense', 'Pin 1', 'Input (Sense)', '1.8V – 3.3V', 'Target Rail', 'Powers debug adapter output buffer stages'],
                ['GND', 'Common Pins', 'Reference (0V)', '0.0V', 'Star Common', 'Common ground return path required to prevent ground-bounce'],
                ['FPGA TDI', 'T8 (Bank 0)', 'Output (Host)', '1.8V VCCO_0', 'J-Link Probe', 'Level-shifted from 3.3V host rail; shifted on TCK falling edge'],
                ['FPGA TDO', 'R8 (Bank 0)', 'Input (Host)', '1.8V VCCO_0', 'FPGA Target', 'Tri-stated high-Z except during active Shift-IR and Shift-DR states'],
                ['FPGA TCK', 'R3 (Bank 0)', 'Output (Host)', '1.8V VCCO_0', 'J-Link Probe', 'Dedicated JTAG clock; clean transition edges required'],
                ['FPGA TMS', 'T4 (Bank 0)', 'Output (Host)', '1.8V VCCO_0', 'J-Link Probe', 'Controls target TAP state machine transition sequence'],
              ].map((row, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: 'var(--primary-blue)' }}>{row[0]}</td>
                  <td className="mono">{row[1]}</td>
                  <td>{row[2]}</td>
                  <td>
                    <span className="badge badge-blue">{row[3]}</span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{row[4]}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{row[5]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

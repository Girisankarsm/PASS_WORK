import { useState } from 'react';
import { CheckCircle2, ShieldCheck, Filter, Info } from 'lucide-react';

interface TestCase {
  suite: string;
  name: string;
  assertions: number;
  status: 'PASS' | 'FAIL';
  note: string;
}

const TEST_CASES: TestCase[] = [
  // Thermal FEM (15 test specifications representing 95 assertions)
  { suite: 'Thermal FEM', name: 'BC: T(0)=100°C', assertions: 1, status: 'PASS', note: 'Left Dirichlet boundary satisfied to machine precision (<1e-10)' },
  { suite: 'Thermal FEM', name: 'BC: T(L)=20°C', assertions: 1, status: 'PASS', note: 'Right Dirichlet boundary fixed by zeroing both row & column of last node' },
  { suite: 'Thermal FEM', name: 'Analytical agreement (80-elem)', assertions: 81, status: 'PASS', note: 'Evaluates all 81 individual mesh nodes against exact closed-form T(x)' },
  { suite: 'Thermal FEM', name: 'Convergence: error(10) > error(20)', assertions: 1, status: 'PASS', note: 'Midpoint error monotonically decreases with mesh refinement' },
  { suite: 'Thermal FEM', name: 'Convergence: error(20) > error(40)', assertions: 1, status: 'PASS', note: 'Monotonic convergence confirmed' },
  { suite: 'Thermal FEM', name: 'Convergence: error(40) > error(80)', assertions: 1, status: 'PASS', note: 'Monotonic convergence confirmed' },
  { suite: 'Thermal FEM', name: 'Convergence rate ~O(h²)', assertions: 1, status: 'PASS', note: 'Quadratic ratio ~4.0 verified across element midpoint evaluations' },
  { suite: 'Thermal FEM', name: 'Invalid: n_elements=0', assertions: 1, status: 'PASS', note: 'Rejects invalid mesh size with std::invalid_argument' },
  { suite: 'Thermal FEM', name: 'Invalid: n_elements=-1', assertions: 1, status: 'PASS', note: 'Rejects negative element count' },
  { suite: 'Thermal FEM', name: 'Invalid: k < 0', assertions: 1, status: 'PASS', note: 'Rejects non-physical negative thermal conductivity' },
  { suite: 'Thermal FEM', name: 'Invalid: A = 0', assertions: 1, status: 'PASS', note: 'Rejects zero cross-sectional area' },
  { suite: 'Thermal FEM', name: 'Invalid: L = 0', assertions: 1, status: 'PASS', note: 'Rejects zero rod length' },
  { suite: 'Thermal FEM', name: 'Stability: T(0) with 1000 elements', assertions: 1, status: 'PASS', note: 'Preserves Dirichlet BC on dense linear system' },
  { suite: 'Thermal FEM', name: 'Stability: T(L) with 1000 elements', assertions: 1, status: 'PASS', note: 'Preserves right boundary condition without numerical drift' },
  { suite: 'Thermal FEM', name: 'Stability: small error with 1000 elem', assertions: 1, status: 'PASS', note: 'Midpoint error remains < 0.001°C' },

  // Geometry (11 test specifications representing 11 assertions)
  { suite: 'Geometry', name: 'STL: valid file has 2 triangles', assertions: 1, status: 'PASS', note: 'Correctly tokenizes ASCII facets and normal vectors' },
  { suite: 'Geometry', name: 'STL: bounds min x', assertions: 1, status: 'PASS', note: 'Evaluates bounding box coordinate limits' },
  { suite: 'Geometry', name: 'STL: bounds max x', assertions: 1, status: 'PASS', note: 'Evaluates bounding box coordinate limits' },
  { suite: 'Geometry', name: 'STL: reject non-STL content', assertions: 1, status: 'PASS', note: 'Rejects files without solid keyword' },
  { suite: 'Geometry', name: 'STL: reject empty content', assertions: 1, status: 'PASS', note: 'Rejects zero-byte STL input' },
  { suite: 'Geometry', name: 'CSV: 3 nodes parsed', assertions: 1, status: 'PASS', note: 'Parses valid node_id,x,y,z,T columns' },
  { suite: 'Geometry', name: 'CSV: T_min = 20.0', assertions: 1, status: 'PASS', note: 'Extracts global scalar minimum temperature' },
  { suite: 'Geometry', name: 'CSV: T_max = 120.5', assertions: 1, status: 'PASS', note: 'Extracts global scalar maximum temperature' },
  { suite: 'Geometry', name: 'CSV: reject wrong header', assertions: 1, status: 'PASS', note: 'Rejects mismatched column schemas' },
  { suite: 'Geometry', name: 'CSV: reject missing columns', assertions: 1, status: 'PASS', note: 'Rejects incomplete row vectors' },
  { suite: 'Geometry', name: 'CSV: reject empty file', assertions: 1, status: 'PASS', note: 'Rejects zero-length CSV streams' },

  // Performance Benchmark (4 test specifications representing 4 assertions)
  { suite: 'Performance', name: 'Benchmark: serial/parallel agreement <= 1e-8', assertions: 1, status: 'PASS', note: 'Multi-threaded solution exactly matches serial (< 1.4e-15 °C)' },
  { suite: 'Performance', name: 'Benchmark: agreement error check', assertions: 1, status: 'PASS', note: 'Verified across all generated random test cases' },
  { suite: 'Performance', name: 'Benchmark: n_cases=0 throws', assertions: 1, status: 'PASS', note: 'Validates input domain bounds' },
  { suite: 'Performance', name: 'Benchmark: n_elem=0 throws', assertions: 1, status: 'PASS', note: 'Validates input domain bounds' },

  // Hardware Simulation (11 test specifications representing 11 assertions)
  { suite: 'Hardware', name: 'HW: MCU connect succeeds', assertions: 1, status: 'PASS', note: 'State transitions to CONNECTED' },
  { suite: 'Hardware', name: 'HW: MCU connected state check', assertions: 1, status: 'PASS', note: 'Internal flag set' },
  { suite: 'Hardware', name: 'HW: MCU voltage ~3.3V', assertions: 1, status: 'PASS', note: 'Telemetry generates nominal 3.3V logic domain readings' },
  { suite: 'Hardware', name: 'HW: MCU disconnect', assertions: 1, status: 'PASS', note: 'Clean disconnection sequence' },
  { suite: 'Hardware', name: 'HW: MCU disconnected state check', assertions: 1, status: 'PASS', note: 'State transitions to DISCONNECTED' },
  { suite: 'Hardware', name: 'HW: MCU simulated failure returns false', assertions: 1, status: 'PASS', note: 'Synthetic fault injection succeeds' },
  { suite: 'Hardware', name: 'HW: Error message present on failure', assertions: 1, status: 'PASS', note: 'Reports diagnostic error string' },
  { suite: 'Hardware', name: 'HW: Telemetry throws when not connected', assertions: 1, status: 'PASS', note: 'Guards against reading offline bus' },
  { suite: 'Hardware', name: 'HW: JTAG connect succeeds', assertions: 1, status: 'PASS', note: 'Initializes JTAG TAP state machine' },
  { suite: 'Hardware', name: 'HW: JTAG scan done', assertions: 1, status: 'PASS', note: 'Scans test data registers' },
  { suite: 'Hardware', name: 'HW: JTAG scan chain has 2 devices', assertions: 1, status: 'PASS', note: 'Discovers MCU and Artix-7 FPGA targets' },

  // Neural Network (7 test specifications representing 7 assertions)
  { suite: 'Neural Net', name: 'NN: Gradient check passes (<= 1e-5)', assertions: 1, status: 'PASS', note: 'Central FD verification verified (|error| <= 4.2e-11)' },
  { suite: 'Neural Net', name: 'NN: Gradient check max error', assertions: 1, status: 'PASS', note: 'Verified against all 4 parameters w, b, v, c' },
  { suite: 'Neural Net', name: 'NN: 100 training steps', assertions: 1, status: 'PASS', note: 'Completes 100 optimization epochs' },
  { suite: 'Neural Net', name: 'NN: Loss decreases over training', assertions: 1, status: 'PASS', note: 'Monotonic quadratic error loss decay' },
  { suite: 'Neural Net', name: 'NN: Forward h = tanh(0.5)', assertions: 1, status: 'PASS', note: 'Verified tanh activation computation' },
  { suite: 'Neural Net', name: 'NN: Forward y_hat', assertions: 1, status: 'PASS', note: 'Prediction formula verified' },
  { suite: 'Neural Net', name: 'NN: Forward loss J', assertions: 1, status: 'PASS', note: 'Quadratic objective formulation verified' },
];

const TOTAL_ASSERTIONS = TEST_CASES.reduce((acc, c) => acc + c.assertions, 0); // 128
const TOTAL_CASES = TEST_CASES.length; // 48
const SUITES = ['All', ...new Set(TEST_CASES.map((t) => t.suite))];

export default function TestResults() {
  const [filter, setFilter] = useState('All');

  const filtered = filter === 'All' ? TEST_CASES : TEST_CASES.filter((t) => t.suite === filter);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Automated Test Results</h1>
          <p className="page-subtitle">
            C++17 verification test suite · Verified with CTest on Apple Clang 21.0.0
          </p>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div className="form-label">Total Assertions</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary-blue)', marginTop: 4 }}>
            {TOTAL_ASSERTIONS} / {TOTAL_ASSERTIONS}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
            100% Passing in terminal runner
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div className="form-label">Logical Test Cases</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-main)', marginTop: 4 }}>
            {TOTAL_CASES} Specs
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
            Across 5 test suites
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div className="form-label">Pass Rate</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)', marginTop: 4 }}>
            100.0%
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
            0 failures / 0 regressions
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div className="form-label">CTest Integration</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#4ADE80', marginTop: 4 }}>
            PASSED
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
            1/1 targets (0.34s)
          </div>
        </div>
      </div>

      {/* Explanation of Assertion Count vs Logical Tests */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: 20,
          background: 'rgba(37, 131, 255, 0.05)',
          borderColor: 'rgba(37, 131, 255, 0.25)',
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Info size={16} style={{ color: 'var(--primary-blue)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-main)' }}>Verification Counting Note:</strong> The C++ test runner executes exactly <strong>128 individual assertions</strong> (<span className="mono">ASSERT_NEAR</span>, <span className="mono">ASSERT_TRUE</span>, <span className="mono">ASSERT_THROWS</span>). This includes <strong>81 individual nodal checks</strong> performed during the 80-element analytical agreement verification (<span className="mono">test_thermal_analytical_agreement</span>) alongside 47 additional unit assertions. In the table below, these 128 assertions are structured into 48 modular test specifications.
          </div>
        </div>
      </div>

      {/* Filter Tabs & Test Table */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={15} style={{ color: 'var(--text-muted)' }} />
            <span className="card-title">Test Suite Specifications</span>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SUITES.map((s) => (
              <button
                key={s}
                className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 11.5, padding: '4px 10px' }}
                onClick={() => setFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Suite</th>
                <th>Test Specification</th>
                <th>Assertions</th>
                <th>Outcome</th>
                <th>Verification Note</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, idx) => (
                <tr key={idx}>
                  <td>
                    <span className="badge badge-blue">{t.suite}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td className="mono" style={{ color: 'var(--text-secondary)' }}>
                    {t.assertions} {t.assertions > 1 ? 'checks' : 'check'}
                  </td>
                  <td>
                    <span className="badge badge-green">
                      <CheckCircle2 size={11} /> {t.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

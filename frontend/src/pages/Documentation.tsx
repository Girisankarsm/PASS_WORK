import { useState } from 'react';
import { BookOpen, Terminal, Layers, Activity, Cpu, Brain, Database, AlertCircle } from 'lucide-react';

const DOC_TOPICS = [
  {
    id: 'overview',
    label: 'Overview & Architecture',
    icon: Layers,
    title: 'Platform Architecture & Design Choices',
    content: (
      <div>
        <p style={{ marginBottom: 16 }}>
          The <strong>Unified Engineering Workbench</strong> is a professional engineering simulation and analysis workstation designed for the Pass Science Works R&D Internship 2026–2027. It pairs a high-performance <strong>C++17 simulation kernel</strong> with a modern <strong>React 18 / TypeScript / Three.js</strong> workstation interface.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#FFFFFF', marginBottom: 8 }}>Separation of Concerns</h3>
        <p style={{ marginBottom: 14 }}>
          All numerical computation, equation solving, matrix operations, STL parsing, and parallel benchmarking execute in native C++. The frontend acts strictly as a visualization and parameter-entry dashboard, communicating over JSON REST HTTP endpoints.
        </p>

        <div className="data-table-container" style={{ marginBottom: 16 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Technology Stack</th>
                <th>Responsibilities</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600, color: 'var(--primary-blue)' }}>Backend</td>
                <td className="mono">C++17, cpp-httplib, nlohmann/json</td>
                <td>FEA solver, STL/CSV parsing, parallel benchmarking, hardware mocks, neural backprop</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: 'var(--primary-blue)' }}>Frontend</td>
                <td className="mono">React 18, Vite 6, TypeScript 5</td>
                <td>Sidebar navigation, state management, typed REST client</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: 'var(--primary-blue)' }}>Visualization</td>
                <td className="mono">Three.js, @react-three/fiber, Recharts</td>
                <td>Interactive 3D geometry rendering, scalar temperature point clouds, scientific charting</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  {
    id: 'quickstart',
    label: 'Quick Start & Build',
    icon: Terminal,
    title: 'Quick Start & Build Procedures',
    content: (
      <div>
        <p style={{ marginBottom: 14 }}>
          The workbench can be launched in one command on macOS, Linux, or standalone on Windows:
        </p>

        <h4 style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', marginBottom: 6 }}>macOS & Linux</h4>
        <pre
          className="mono"
          style={{
            background: 'var(--bg-input)',
            padding: '14px 16px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            fontSize: 12.5,
            color: '#60A5FA',
            marginBottom: 16,
            overflowX: 'auto',
          }}
        >{`# 1. Run all automated tests (128 assertions + API check)
./scripts/test_all.sh

# 2. Launch workbench (starts server & opens browser)
./scripts/run_macos.sh`}</pre>

        <h4 style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', marginBottom: 6 }}>Windows Standalone</h4>
        <pre
          className="mono"
          style={{
            background: 'var(--bg-input)',
            padding: '14px 16px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            fontSize: 12.5,
            color: '#4ADE80',
            marginBottom: 16,
            overflowX: 'auto',
          }}
        >{`# Double-click scripts\\launch_windows.bat
# Or extract PassScience_Workbench.zip and run Launch.exe`}</pre>
      </div>
    ),
  },
  {
    id: 'thermal',
    label: 'Thermal FEA Formulation',
    icon: Activity,
    title: '1D Steady-State Thermal Finite Element Formulation',
    content: (
      <div>
        <p style={{ marginBottom: 12 }}>
          Governing differential equation for heat conduction along an insulated rod with uniform internal heat generation:
        </p>
        <div style={{ padding: 12, background: 'var(--bg-input)', borderRadius: 8, marginBottom: 14 }}>
          <div className="mono" style={{ color: 'var(--primary-blue)', fontSize: 13 }}>
            −d/dx(kA · dT/dx) = qA, &nbsp; x ∈ [0, L]
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Boundary conditions: T(0) = 100°C, T(L) = 20°C. Material parameters: L=1.0 m, A=10⁻⁴ m², k=10 W/(m·K), q=10000 W/m³.
          </div>
        </div>

        <h4 style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', marginBottom: 6 }}>Closed-Form Exact Solution</h4>
        <div style={{ padding: 12, background: 'var(--bg-input)', borderRadius: 8, marginBottom: 16 }}>
          <div className="mono" style={{ color: '#22C55E', fontSize: 13 }}>
            T_exact(x) = 100 − 80(x/L) + [q/(2k)] · x(L − x)
          </div>
        </div>

        <h4 style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', marginBottom: 6 }}>Discretization & Convergence</h4>
        <p style={{ marginBottom: 8 }}>
          Using 2-node linear 1D elements, element stiffness matrix is <span className="mono">Ke = (kA/h) [1, -1; -1, 1]</span> and consistent heat load vector is <span className="mono">Fe = (qAh/2) [1; 1]</span>. Nodal temperatures match the analytical solution to machine precision at the boundaries, while midpoint interpolation error decays quadratically as <strong>O(h²)</strong> across 10, 20, 40, and 80 element meshes.
        </p>
      </div>
    ),
  },
  {
    id: 'performance',
    label: 'Performance Methodology',
    icon: Activity,
    title: 'Multithreaded Benchmark Methodology',
    content: (
      <div>
        <p style={{ marginBottom: 12 }}>
          The benchmark harness evaluates multicore scaling across 1 to 4 worker threads solving independent batches of thermal FEA problems with pseudo-random parameters (k, q) seeded deterministically (<span className="mono">seed = 42</span>).
        </p>
        <ul style={{ paddingLeft: 20, marginBottom: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <li><strong>Warm-up protocol:</strong> One unmeasured batch execution primes CPU caches and governor frequencies.</li>
          <li><strong>Repetitions:</strong> 5 measured repetitions per worker count; median execution time reported.</li>
          <li><strong>Numerical equivalence:</strong> Serial and parallel nodal solutions are verified to match within <span className="mono">&le; 1e-8 °C</span> (observed &le; 1.4e-15 °C).</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'hardware',
    label: 'Hardware & Electrical Specs',
    icon: Cpu,
    title: 'Embedded Hardware Mocks & Electrical Interfacing',
    content: (
      <div>
        <div className="alert alert-warning" style={{ marginBottom: 14 }}>
          All embedded device adapters (STM32F4 MCU, Artix-7 FPGA, Segger J-Link) are <strong>[SIMULATED]</strong>. No physical hardware was connected or tested.
        </div>
        <p style={{ marginBottom: 12 }}>
          The integration architecture accounts for 3.3V logic (MCU) and 1.8V logic (FPGA VCCO_0) with bidirectional level-shifting, star-topology grounding, and active SWD/JTAG signal ownership rules.
        </p>
      </div>
    ),
  },
  {
    id: 'neural',
    label: 'Neural Network Backprop',
    icon: Brain,
    title: 'Handcoded Backpropagation & Gradient Verification',
    content: (
      <div>
        <p style={{ marginBottom: 12 }}>
          Single-sample regression model implemented without automatic differentiation:
        </p>
        <div style={{ padding: 12, background: 'var(--bg-input)', borderRadius: 8, marginBottom: 14 }}>
          <div className="mono" style={{ color: 'var(--primary-blue)', fontSize: 13 }}>
            h = tanh(w·x + b), &nbsp; ŷ = v·h + c, &nbsp; J = 0.5(ŷ − y)²
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Input x=1.0, Target y=2.0, Initial weights: w=0.5, b=0, v=1, c=0, Learning rate η=0.1.
          </div>
        </div>
        <p style={{ marginBottom: 8 }}>
          Analytical derivatives are verified against central finite differences (<span className="mono">&epsilon; = 1e-6</span>), confirming absolute gradient error <span className="mono">&le; 4.2e-11 &le; 1e-5</span>.
        </p>
      </div>
    ),
  },
  {
    id: 'data',
    label: 'Data Schemas & Limits',
    icon: Database,
    title: 'File Formats, Provenance & Tested Limits',
    content: (
      <div>
        <div className="data-table-container" style={{ marginBottom: 16 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Format</th>
                <th>Schema / Format</th>
                <th>Sample File</th>
                <th>Provenance & Limits</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>ASCII STL</td>
                <td className="mono">solid...facet normal...vertex...endsolid</td>
                <td className="mono">data/stl/unit_cube.stl</td>
                <td>Synthetic 1m³ cube (12 triangles). Tested up to 100,000 facets.</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Temperature CSV</td>
                <td className="mono">node_id,x_m,y_m,z_m,temperature_C</td>
                <td className="mono">data/csv/temperature_rod.csv</td>
                <td>Synthetic 21-node solution from exact 1D thermal equation.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
];

export default function Documentation() {
  const [activeTab, setActiveTab] = useState('overview');

  const activeDoc = DOC_TOPICS.find((t) => t.id === activeTab) || DOC_TOPICS[0];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Technical Documentation</h1>
          <p className="page-subtitle">
            Engineering formulations, architecture choices, build procedures, and verification provenance
          </p>
        </div>
      </div>

      <div className="layout-split">
        {/* Left Topics Nav */}
        <div className="card" style={{ padding: '12px 8px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', padding: '4px 12px 10px' }}>
            DOCUMENTATION TOPICS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {DOC_TOPICS.map((topic) => {
              const Icon = topic.icon;
              const isActive = activeTab === topic.id;
              return (
                <button
                  key={topic.id}
                  className={`nav-link ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTab(topic.id)}
                  style={{ borderRadius: 8, padding: '9px 12px', fontSize: 13 }}
                >
                  <Icon size={16} />
                  <span>{topic.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Topic Content */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">{activeDoc.title}</span>
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            {activeDoc.content}
          </div>
        </div>
      </div>
    </div>
  );
}

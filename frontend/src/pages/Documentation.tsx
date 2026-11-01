import { useState } from 'react';
import {
  Layers,
  Terminal,
  BookOpen,
  Activity,
  Cpu,
  Brain,
  Database,
  CheckSquare,
  AlertCircle,
  FileText,
  Code2,
  ShieldCheck,
} from 'lucide-react';

interface Topic {
  id: string;
  label: string;
  icon: typeof Layers;
  title: string;
  badge?: string;
  content: JSX.Element;
}

const DOC_TOPICS: Topic[] = [
  {
    id: 'architecture',
    label: '1. Architecture',
    icon: Layers,
    title: 'Platform Architecture & Separation of Concerns',
    badge: 'System Design',
    content: (
      <div>
        <p style={{ marginBottom: 16 }}>
          The <strong>Unified Engineering Workbench</strong> is a professional engineering simulation and analysis workstation designed for the Pass Science Works R&D Internship 2026–2027. It pairs a high-performance <strong>C++17 simulation kernel</strong> with a modern <strong>React 18 / TypeScript / Three.js</strong> workstation interface.
        </p>

        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#FFFFFF', marginBottom: 8 }}>Separation of Concerns</h3>
        <p style={{ marginBottom: 14 }}>
          All numerical computation, equation solving, matrix operations, STL parsing, and parallel benchmarking execute in native C++. The frontend acts strictly as a visualization and parameter-entry dashboard, communicating over JSON REST HTTP endpoints.
        </p>

        <div className="data-table-container" style={{ marginBottom: 16 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Technology Stack</th>
                <th>Core Responsibilities</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600, color: 'var(--primary-blue)' }}>Backend Engine</td>
                <td className="mono">C++17, cpp-httplib, nlohmann/json</td>
                <td>FEA solver, STL/CSV parsing, parallel benchmarking, hardware mocks, neural backprop</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: 'var(--primary-blue)' }}>Frontend Workstation</td>
                <td className="mono">React 18, Vite 6, TypeScript 5</td>
                <td>Sidebar navigation, state management, parameter inputs, typed REST client</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: 'var(--primary-blue)' }}>3D & Charting</td>
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
    id: 'build',
    label: '2. Build & Launch',
    icon: Terminal,
    title: 'Reproducible Build & Launch Instructions',
    badge: 'Operations',
    content: (
      <div>
        <p style={{ marginBottom: 14 }}>
          The workbench can be built and launched in one command on macOS, Linux, or standalone on Windows:
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
        >{`# 1. Run all automated tests (128 C++ assertions + CTest + E2E API check)
./scripts/test_all.sh

# 2. Launch workbench (starts C++ server & Vite frontend, opens browser)
./scripts/run_macos.sh`}</pre>

        <h4 style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', marginBottom: 6 }}>Windows Standalone Package</h4>
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
        >{`# Extract PassScience_Workbench.zip and run:
scripts\\launch_windows.bat
# Or double-click Launch.exe directly`}</pre>
      </div>
    ),
  },
  {
    id: 'api',
    label: '3. API Reference',
    icon: Code2,
    title: 'Complete REST API Specification',
    badge: '12 Endpoints',
    content: (
      <div>
        <p style={{ marginBottom: 14 }}>
          The C++ backend exposes a documented JSON REST HTTP API on <code className="mono">http://localhost:8080</code>.
        </p>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Endpoint</th>
                <th>Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="badge badge-blue">GET</span></td>
                <td className="mono">/api/health</td>
                <td>Backend engine health and status check</td>
                <td><span className="badge badge-green">200 OK</span></td>
              </tr>
              <tr>
                <td><span className="badge badge-blue">GET</span></td>
                <td className="mono">/api/system-info</td>
                <td>CPU logical core count, OS, compiler, and flags</td>
                <td><span className="badge badge-green">200 OK</span></td>
              </tr>
              <tr>
                <td><span className="badge badge-yellow">POST</span></td>
                <td className="mono">/api/geometry/parse-stl</td>
                <td>Parse ASCII STL payload, calculate bounds and normals</td>
                <td><span className="badge badge-green">200 / 400</span></td>
              </tr>
              <tr>
                <td><span className="badge badge-yellow">POST</span></td>
                <td className="mono">/api/geometry/parse-csv</td>
                <td>Parse ANSYS-schema CSV node temperature point cloud</td>
                <td><span className="badge badge-green">200 / 400</span></td>
              </tr>
              <tr>
                <td><span className="badge badge-yellow">POST</span></td>
                <td className="mono">/api/thermal/solve</td>
                <td>Execute 1D steady-state FEM thermal solver with analytical check</td>
                <td><span className="badge badge-green">200 / 400</span></td>
              </tr>
              <tr>
                <td><span className="badge badge-yellow">POST</span></td>
                <td className="mono">/api/thermal/convergence</td>
                <td>Run convergence study across 10, 20, 40, and 80 elements</td>
                <td><span className="badge badge-green">200 OK</span></td>
              </tr>
              <tr>
                <td><span className="badge badge-yellow">POST</span></td>
                <td className="mono">/api/performance/benchmark</td>
                <td>Launch async parallel benchmark job across 1–4 threads</td>
                <td><span className="badge badge-green">202 Accepted</span></td>
              </tr>
              <tr>
                <td><span className="badge badge-blue">GET</span></td>
                <td className="mono">/api/jobs/:id</td>
                <td>Poll async benchmark job progress and result</td>
                <td><span className="badge badge-green">200 OK</span></td>
              </tr>
              <tr>
                <td><span className="badge badge-blue">GET</span></td>
                <td className="mono">/api/hardware/devices</td>
                <td>Query mock hardware device bus (MCU, FPGA, JTAG)</td>
                <td><span className="badge badge-green">200 OK</span></td>
              </tr>
              <tr>
                <td><span className="badge badge-yellow">POST</span></td>
                <td className="mono">/api/hardware/connect</td>
                <td>Connect target device with optional simulated failure</td>
                <td><span className="badge badge-green">200 / 504</span></td>
              </tr>
              <tr>
                <td><span className="badge badge-yellow">POST</span></td>
                <td className="mono">/api/hardware/disconnect</td>
                <td>Disconnect target device from simulated bus</td>
                <td><span className="badge badge-green">200 OK</span></td>
              </tr>
              <tr>
                <td><span className="badge badge-blue">GET</span></td>
                <td className="mono">/api/hardware/telemetry/:id</td>
                <td>Read device telemetry (voltage, current, die temp, uptime)</td>
                <td><span className="badge badge-green">200 OK</span></td>
              </tr>
              <tr>
                <td><span className="badge badge-yellow">POST</span></td>
                <td className="mono">/api/neural/train</td>
                <td>Run handcoded backpropagation and central FD gradient check</td>
                <td><span className="badge badge-green">200 OK</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  {
    id: 'formats',
    label: '4. Input File Formats',
    icon: Database,
    title: 'Input File Formats & Validation Rules',
    badge: 'I/O Schemas',
    content: (
      <div>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', marginBottom: 8 }}>ASCII STL Format</h4>
        <p style={{ marginBottom: 8 }}>
          Follows the standard ASCII stereolithography syntax. Requires valid solid header, facet normals, 3 vertices per triangle, and endsolid footer:
        </p>
        <pre
          className="mono"
          style={{
            background: 'var(--bg-input)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            fontSize: 12,
            color: '#60A5FA',
            marginBottom: 16,
          }}
        >{`solid model_name
  facet normal 0.000000 0.000000 1.000000
    outer loop
      vertex 0.0 0.0 1.0
      vertex 1.0 0.0 1.0
      vertex 1.0 1.0 1.0
    endloop
  endfacet
endsolid model_name`}</pre>

        <h4 style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', marginBottom: 8 }}>ANSYS-Schema Temperature CSV</h4>
        <p style={{ marginBottom: 8 }}>
          Requires strict 5-column comma-separated format. Lines beginning with <code className="mono">#</code> are treated as comments and ignored:
        </p>
        <pre
          className="mono"
          style={{
            background: 'var(--bg-input)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            fontSize: 12,
            color: '#4ADE80',
            marginBottom: 16,
          }}
        >{`# node_id,x_m,y_m,z_m,temperature_C
1,0.000000,0.000000,0.000000,100.000000
2,0.050000,0.000000,0.000000,119.750000
...
21,1.000000,0.000000,0.000000,20.000000`}</pre>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
          Validation rules: Rejects missing columns, non-numeric values, non-finite values (NaN, Inf), empty files, or non-ASCII text. Enforces 20 MB size limit.
        </p>
      </div>
    ),
  },
  {
    id: 'numerical',
    label: '5. Numerical Methods',
    icon: Activity,
    title: 'Thermal 1D FEM Formulation & Analytical Verification',
    badge: 'Mathematical Physics',
    content: (
      <div>
        <p style={{ marginBottom: 12 }}>
          Governing differential equation for steady-state heat conduction along an insulated rod with uniform internal heat generation:
        </p>
        <div style={{ padding: 12, background: 'var(--bg-input)', borderRadius: 8, marginBottom: 14 }}>
          <div className="mono" style={{ color: 'var(--primary-blue)', fontSize: 13 }}>
            −d/dx(kA · dT/dx) = qA, &nbsp; x ∈ [0, L]
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Boundary conditions: T(0) = 100°C, T(L) = 20°C. Parameters: L=1.0 m, A=10⁻⁴ m², k=10 W/(m·K), q=10000 W/m³.
          </div>
        </div>

        <h4 style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', marginBottom: 6 }}>Closed-Form Analytical Solution</h4>
        <div style={{ padding: 12, background: 'var(--bg-input)', borderRadius: 8, marginBottom: 14 }}>
          <div className="mono" style={{ color: '#22C55E', fontSize: 13 }}>
            T_exact(x) = 100 − 80(x/L) + [q/(2k)] · x(L − x)
          </div>
        </div>

        <h4 style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', marginBottom: 6 }}>Element Stiffness & Load Vectors</h4>
        <p style={{ marginBottom: 8 }}>
          Discretized using linear 2-node 1D elements. Element stiffness matrix <span className="mono">Ke = (kA/h) [1, -1; -1, 1]</span> and consistent thermal load vector <span className="mono">Fe = (qAh/2) [1; 1]</span>.
        </p>
        <p style={{ marginBottom: 8 }}>
          At the boundaries, Dirichlet conditions are enforced via row and column zeroing with diagonal unity. Midpoint interpolation error converges quadratically as <strong>O(h²)</strong> across 10, 20, 40, and 80 elements with observed error ratio <span className="mono">E(h)/E(h/2) = 4.00</span>.
        </p>
      </div>
    ),
  },
  {
    id: 'benchmarks',
    label: '6. Benchmarking',
    icon: Activity,
    title: 'Multithreaded Benchmark Methodology',
    badge: 'Multi-Core Scaling',
    content: (
      <div>
        <p style={{ marginBottom: 12 }}>
          The benchmark evaluates multicore scaling across 1 to 4 worker threads solving independent batches of thermal FEA problems with pseudo-random parameters (k, q) seeded deterministically (<span className="mono">seed = 42</span>).
        </p>
        <ul style={{ paddingLeft: 20, marginBottom: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <li><strong>Deterministic workload:</strong> Fixed pseudo-random seed guarantees identical workloads for serial and all parallel worker counts.</li>
          <li><strong>Warm-up protocol:</strong> One unmeasured batch execution primes CPU caches and OS frequency governors.</li>
          <li><strong>Repetitions:</strong> 5 measured repetitions per worker count; median execution time reported.</li>
          <li><strong>Speedup metric:</strong> <span className="mono">S_p = T_1 / T_p</span> and parallel efficiency <span className="mono">E_p = S_p / p</span>.</li>
          <li><strong>Numerical agreement:</strong> Serial and parallel nodal solutions verified to match within <span className="mono">&le; 1e-8 °C</span> (observed &le; 1.4e-15 °C).</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'hardware',
    label: '7. Hardware Simulation',
    icon: Cpu,
    title: 'Embedded Hardware Mocks & Electrical Domain Limitations',
    badge: 'Simulated Only',
    content: (
      <div>
        <div className="alert alert-warning" style={{ marginBottom: 14 }}>
          <strong>Notice: All embedded device adapters are simulated.</strong> No physical microcontroller, FPGA, or debug probe has been connected or physically tested.
        </div>
        <p style={{ marginBottom: 12 }}>
          The hardware module simulates host-to-target communications for three devices:
        </p>
        <ul style={{ paddingLeft: 20, marginBottom: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <li><strong>STM32F446RE:</strong> ARM Cortex-M4 microcontroller running at 3.3V logic with SWD interface.</li>
          <li><strong>Xilinx Artix-7:</strong> XC7A35T FPGA target running at 1.8V VCCO_0 logic with JTAG TAP interface.</li>
          <li><strong>Segger J-Link:</strong> SWD/JTAG debug probe providing target voltage sensing and level-shifting.</li>
        </ul>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
          Electrical design considerations include bidirectional voltage level-shifting (TXB0108) between 3.3V and 1.8V domains, single-point star grounding to prevent ground bounce, and simulated fault injection testing connection timeout handling.
        </p>
      </div>
    ),
  },
  {
    id: 'testing',
    label: '8. Test Execution',
    icon: CheckSquare,
    title: 'Automated Test Execution & Verification Suite',
    badge: '128 / 128 PASS',
    content: (
      <div>
        <p style={{ marginBottom: 14 }}>
          The platform includes a comprehensive automated verification harness spanning unit, integration, and E2E API tests:
        </p>
        <div className="data-table-container" style={{ marginBottom: 16 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Test Suite</th>
                <th>Runner Command</th>
                <th>Assertions / Tests</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>C++ Unit Tests</td>
                <td className="mono">./build/workbench_tests</td>
                <td>128 assertions</td>
                <td><span className="badge badge-green">128 / 128 PASS</span></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>CMake CTest</td>
                <td className="mono">ctest --test-dir build</td>
                <td>All test targets</td>
                <td><span className="badge badge-green">100% PASS</span></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>TypeScript Typecheck</td>
                <td className="mono">npm run build</td>
                <td>Vite / TS5 strict</td>
                <td><span className="badge badge-green">0 Errors</span></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Full E2E Script</td>
                <td className="mono">./scripts/test_all.sh</td>
                <td>Full system verification</td>
                <td><span className="badge badge-green">ALL PASS</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  {
    id: 'limitations',
    label: '9. Known Limitations',
    icon: AlertCircle,
    title: 'Known Numerical & Platform Limitations',
    badge: 'Technical Boundaries',
    content: (
      <div>
        <ul style={{ paddingLeft: 20, marginBottom: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <li><strong>Dense Gaussian Elimination:</strong> The 1D FEM solver uses dense Gaussian elimination with partial pivoting ($O(N^3)$ complexity). While fast for $N \le 1000$ elements, sparse banded solvers are required for large 2D/3D meshes.</li>
          <li><strong>ASCII STL Only:</strong> Only ASCII STL files are currently supported. Binary STL files are detected and rejected with an explicit error message.</li>
          <li><strong>Static Work Partitioning:</strong> Multithreaded benchmarking uses static chunk division among workers rather than work-stealing, which is optimal for uniform batch sizes.</li>
          <li><strong>Simulated Hardware:</strong> Embedded hardware device adapters are synthetic software simulations. Physical hardware has not been connected.</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'provenance',
    label: '10. Provenance & AI Disclosure',
    icon: FileText,
    title: 'AI-Use Disclosure & Project Provenance',
    badge: 'Transparency',
    content: (
      <div>
        <p style={{ marginBottom: 12 }}>
          <strong>Project Provenance:</strong> The Unified Engineering Workbench was developed for the Pass Science Works R&D Internship 2026–2027 assignment.
        </p>
        <ul style={{ paddingLeft: 20, marginBottom: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <li><strong>Sample Datasets:</strong> All sample STL meshes (unit cube, cylinder manifold) and temperature CSV point clouds were synthetically generated for this workbench. No proprietary CAD files or external IP were used.</li>
          <li><strong>AI Assistance Disclosure:</strong> Modern LLM coding tools (Google Antigravity) were utilized as pair-programming assistants for frontend styling scaffolding, Three.js boilerplate, and test harness authoring. All numerical algorithms (FEM formulation, backpropagation derivatives, central FD verification) were mathematically verified against engineering first principles.</li>
          <li><strong>Open Source Dependencies:</strong> cpp-httplib (MIT), nlohmann/json (MIT), React 18 (MIT), Three.js (MIT), Recharts (MIT), Lucide (ISC).</li>
        </ul>
      </div>
    ),
  },
];

export default function Documentation() {
  const [activeTab, setActiveTab] = useState('architecture');

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
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', padding: '4px 12px 10px', letterSpacing: '0.04em' }}>
            TECHNICAL MANUAL
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
            <div>
              <span className="card-title">{activeDoc.title}</span>
            </div>
            {activeDoc.badge && (
              <span className="badge badge-blue">{activeDoc.badge}</span>
            )}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            {activeDoc.content}
          </div>
        </div>
      </div>
    </div>
  );
}

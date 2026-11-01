import { BookOpen, FileText, Code, Terminal } from 'lucide-react';

const SECTIONS = [
  {
    title: 'Project Overview',
    icon: BookOpen,
    content: `The Unified Engineering Workbench is a professional engineering simulation platform combining a C++17 backend with a React/TypeScript frontend. It implements real numerical computation for thermal FEA, parallel performance benchmarking, hardware mock adapters, and neural network backpropagation.`,
  },
  {
    title: 'Architecture',
    icon: Code,
    content: `**Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + Three.js (React Three Fiber) + Recharts\n**Backend**: C++17 with cpp-httplib (v0.16.0) and nlohmann/json (v3.11.3)\n**Build**: CMake 4.3.3 with FetchContent for dependencies\n**Testing**: CTest with custom C++ test runner (128 tests)`,
  },
  {
    title: 'Thermal FEA Formulation',
    icon: FileText,
    content: `**Governing equation**: −d/dx(kA dT/dx) = qA\n**Domain**: x ∈ [0, L], L=1m, A=1e−4 m², k=10 W/(m·K), q=10000 W/m³\n**BCs**: T(0)=100°C (Dirichlet), T(L)=20°C (Dirichlet)\n**Element**: Two-node linear (C0), constant properties\n**Assembly**: Direct stiffness, Gaussian elimination with partial pivoting\n**BC application**: Direct substitution (zeroing row AND column)\n**Analytical**: T(x)=100−80x/L+[q/(2k)]x(L−x)\n**Convergence**: O(h²) verified for meshes of 10, 20, 40, 80 elements`,
  },
  {
    title: 'Performance Benchmarking',
    icon: FileText,
    content: `**Workload**: N independent thermal solves, fixed seed=42, varied k∈[1,50] W/(m·K) and q∈[1000,50000] W/m³\n**Parallel**: Static partition of cases across 1–4 worker threads\n**Timing**: 1 warm-up + 5 measured repetitions; median reported\n**Agreement**: Max |T_serial − T_parallel| ≤ 1e−8°C verified\n**Limitation**: On 1-CPU systems, parallel overhead may cause slowdown`,
  },
  {
    title: 'Neural Network Backpropagation',
    icon: FileText,
    content: `**Model**: h=tanh(wx+b), ŷ=vh+c, J=½(ŷ−y)²\n**Sample**: x=1, y=2; initial w=0.5, b=0, v=1, c=0\n**Gradients**: Analytical chain rule — dJ/dc=(ŷ−y), dJ/dv=(ŷ−y)h, dJ/db=(ŷ−y)v(1−h²), dJ/dw=dJ/db·x\n**Gradient check**: Central finite differences, ε=1e−6, tolerance 1e−5\n**Update**: Simultaneous gradient descent, η=0.1`,
  },
  {
    title: 'File Formats & Data',
    icon: FileText,
    content: `**ASCII STL**: "solid…facet normal…vertex…endfacet…endsolid" — validated header, finite coordinates, ≥1 triangle\n**Temperature CSV**: node_id,x_m,y_m,z_m,temperature_C — exact header match, finite values required\n**Sample data**: unit_cube.stl (12 triangles, 1×1×1m) and temperature_rod.csv (21 nodes, 1D rod analytical solution)\n**Provenance**: Synthetic, self-generated. NOT real ANSYS exports.\n**Max size tested**: 20MB STL`,
  },
];

const BUILD_COMMANDS = `# Prerequisites: Xcode CLT, CMake ≥ 3.20, Node ≥ 18

# macOS — Backend
mkdir build && cmake -B build -DCMAKE_BUILD_TYPE=RelWithDebInfo
cmake --build build --parallel 10

# Run tests
./build/workbench_tests

# Run backend server (port 8080)
./build/workbench_server

# Frontend
cd frontend
npm install
npm run dev   # http://localhost:5173`;

export default function Documentation() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Documentation</h1>
        <p className="page-subtitle">Architecture, formulations, file formats, and build instructions</p>
      </div>

      {/* Build instructions */}
      <div className="card section">
        <div className="card-title" style={{ marginBottom: 12 }}>
          <Terminal size={14} /> Quick Start
        </div>
        <pre className="mono" style={{
          background: 'var(--bg-primary)', padding: 16, borderRadius: 4,
          fontSize: 12, lineHeight: 1.7, overflowX: 'auto', color: 'var(--text-secondary)'
        }}>
          {BUILD_COMMANDS}
        </pre>
      </div>

      {/* Sections */}
      {SECTIONS.map(({ title, icon: Icon, content }) => (
        <div className="card section" key={title}>
          <div className="card-title" style={{ marginBottom: 12 }}>
            <Icon size={14} /> {title}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
            {content.split('\n').map((line, i) => {
              // Bold **text**
              const parts = line.split(/(\*\*[^*]+\*\*)/g);
              return (
                <div key={i} style={{ marginBottom: 4 }}>
                  {parts.map((part, j) =>
                    part.startsWith('**') && part.endsWith('**')
                      ? <strong key={j} style={{ color: 'var(--text-primary)' }}>{part.slice(2, -2)}</strong>
                      : <span key={j}>{part}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Known limitations */}
      <div className="card section">
        <div className="card-title" style={{ marginBottom: 12 }}>Known Limitations</div>
        <ul style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: 20 }}>
          <li>FEM solver uses dense matrix storage — not suitable for {'>'} 10000 elements</li>
          <li>Parallel benchmark uses static partitioning only — no work-stealing</li>
          <li>Binary STL format is not supported (ASCII only)</li>
          <li>Windows executable not pre-built (CMake + MSVC build required on Windows)</li>
          <li>Hardware devices are entirely simulated — no physical boards tested</li>
          <li>CORS is configured for http://localhost:5173 only</li>
          <li>No authentication or user session management</li>
          <li>Handwritten backprop appendix requires physical scan/photo by candidate</li>
        </ul>
      </div>

      {/* Dependency versions */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 12 }}>Dependency Versions</div>
        <table className="data-table">
          <thead><tr><th>Package</th><th>Version</th><th>License</th><th>Purpose</th></tr></thead>
          <tbody>
            {[
              ['cpp-httplib',    'v0.16.0',  'MIT',     'C++ HTTP server'],
              ['nlohmann/json',  'v3.11.3',  'MIT',     'C++ JSON serialization'],
              ['React',          '18.3.1',   'MIT',     'UI framework'],
              ['Vite',           '6.0.1',    'MIT',     'Frontend build tool'],
              ['Three.js',       '0.170.0',  'MIT',     '3D rendering'],
              ['@react-three/fiber', '8.17', 'MIT',     'React + Three.js'],
              ['@react-three/drei',  '9.117', 'MIT',    '3D helpers'],
              ['Recharts',       '2.13.3',   'MIT',     'Charts'],
              ['Lucide React',   '0.468.0',  'ISC',     'Icons'],
              ['TypeScript',     '5.6.3',    'Apache-2','Type system'],
              ['Tailwind CSS',   '3.4.16',   'MIT',     'CSS utilities'],
            ].map(row => (
              <tr key={row[0]}>
                {row.map((cell, i) => <td key={i}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

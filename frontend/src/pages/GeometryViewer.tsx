import { useState, useRef, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import { Upload, Eye, Download, RefreshCw, Info } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { STLResult, CSVResult, TempNode } from '../types/api';

// ── STL Mesh renderer ─────────────────────────────────────────────────────────
function STLMesh({ result }: { result: STLResult }) {
  const geomRef = useRef<THREE.BufferGeometry>(null!);

  useEffect(() => {
    const positions: number[] = [];
    const normals: number[] = [];
    for (const t of result.triangles) {
      for (const v of [t.v0, t.v1, t.v2]) { positions.push(...v); normals.push(...t.n); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('normal',   new THREE.Float32BufferAttribute(normals, 3));
    if (geomRef.current) {
      geomRef.current.copy(g);
      geomRef.current.computeBoundingBox();
    }
  }, [result]);

  return (
    <mesh>
      <bufferGeometry ref={geomRef} />
      <meshStandardMaterial color="#4a9eff" wireframe={false} roughness={0.4} metalness={0.2} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ── Temperature point cloud ──────────────────────────────────────────────────
function TempPointCloud({ data, selectedId, onSelect }: {
  data: CSVResult;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const meshRef = useRef<THREE.Points>(null!);

  const { positions, colors } = (() => {
    const pos: number[] = [], col: number[] = [];
    const tMin = data.T_min, tMax = data.T_max, tRange = tMax - tMin || 1;
    for (const n of data.nodes) {
      pos.push(n.x, n.y, n.z);
      const t = (n.T - tMin) / tRange;
      const r = t, g = 1 - Math.abs(2 * t - 1), b = 1 - t;
      col.push(r, g, b);
    }
    return { positions: pos, colors: col };
  })();

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  return (
    <points ref={meshRef} geometry={geom}>
      <pointsMaterial size={0.04} vertexColors sizeAttenuation />
    </points>
  );
}

// ── Camera auto-fit ──────────────────────────────────────────────────────────
function AutoCamera({ bounds }: { bounds: [[number,number,number],[number,number,number]] }) {
  const { camera } = useThree();
  useEffect(() => {
    const [mn, mx] = bounds;
    const cx = (mn[0]+mx[0])/2, cy = (mn[1]+mx[1])/2, cz = (mn[2]+mx[2])/2;
    const d = Math.max(mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]) * 1.5 + 0.1;
    camera.position.set(cx + d, cy + d*0.5, cz + d);
    camera.lookAt(cx, cy, cz);
  }, [bounds, camera]);
  return null;
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function GeometryViewer({ backendUp }: { backendUp: boolean }) {
  const [stlResult, setStlResult]   = useState<STLResult | null>(null);
  const [csvResult, setCsvResult]   = useState<CSVResult | null>(null);
  const [mode, setMode]             = useState<'stl' | 'csv'>('stl');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<TempNode | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!backendUp) { setError('Backend offline'); return; }
    const text = await file.text();
    setLoading(true); setError(null);
    try {
      if (file.name.endsWith('.stl') || file.name.endsWith('.STL')) {
        const r = await api.parseSTL(text);
        setStlResult(r); setCsvResult(null); setMode('stl');
      } else if (file.name.endsWith('.csv')) {
        const r = await api.parseCSV(text);
        setCsvResult(r); setStlResult(null); setMode('csv');
      } else {
        setError('Unsupported file type. Use .stl or .csv');
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Parse error');
    } finally {
      setLoading(false);
    }
  }, [backendUp]);

  const loadSample = useCallback(async (type: 'stl' | 'csv') => {
    if (!backendUp) { setError('Backend offline'); return; }
    setLoading(true); setError(null);
    try {
      const url = type === 'stl' ? '/sample_cube.stl' : '/sample_temp.csv';
      // Use built-in synthetic data
      const stlContent = `solid unit_cube
  facet normal 0 0 -1\n    outer loop\n      vertex 0 0 0\n      vertex 1 0 0\n      vertex 1 1 0\n    endloop\n  endfacet
  facet normal 0 0 -1\n    outer loop\n      vertex 0 0 0\n      vertex 1 1 0\n      vertex 0 1 0\n    endloop\n  endfacet
  facet normal 0 0 1\n    outer loop\n      vertex 0 0 1\n      vertex 1 1 1\n      vertex 1 0 1\n    endloop\n  endfacet
  facet normal 0 0 1\n    outer loop\n      vertex 0 0 1\n      vertex 0 1 1\n      vertex 1 1 1\n    endloop\n  endfacet
  facet normal 0 -1 0\n    outer loop\n      vertex 0 0 0\n      vertex 0 0 1\n      vertex 1 0 1\n    endloop\n  endfacet
  facet normal 0 -1 0\n    outer loop\n      vertex 0 0 0\n      vertex 1 0 1\n      vertex 1 0 0\n    endloop\n  endfacet
  facet normal 0 1 0\n    outer loop\n      vertex 0 1 0\n      vertex 1 1 0\n      vertex 1 1 1\n    endloop\n  endfacet
  facet normal 0 1 0\n    outer loop\n      vertex 0 1 0\n      vertex 1 1 1\n      vertex 0 1 1\n    endloop\n  endfacet
  facet normal -1 0 0\n    outer loop\n      vertex 0 0 0\n      vertex 0 1 0\n      vertex 0 1 1\n    endloop\n  endfacet
  facet normal -1 0 0\n    outer loop\n      vertex 0 0 0\n      vertex 0 1 1\n      vertex 0 0 1\n    endloop\n  endfacet
  facet normal 1 0 0\n    outer loop\n      vertex 1 0 0\n      vertex 1 0 1\n      vertex 1 1 1\n    endloop\n  endfacet
  facet normal 1 0 0\n    outer loop\n      vertex 1 0 0\n      vertex 1 1 1\n      vertex 1 1 0\n    endloop\n  endfacet
endsolid unit_cube`;
      const csvContent = `node_id,x_m,y_m,z_m,temperature_C
1,0.0,0.0,0.0,100.0\n2,0.1,0.0,0.0,96.2\n3,0.2,0.0,0.0,92.5\n4,0.3,0.0,0.0,88.9\n5,0.4,0.0,0.0,85.4\n6,0.5,0.0,0.0,65.8\n7,0.6,0.0,0.0,59.8\n8,0.7,0.0,0.0,54.2\n9,0.8,0.0,0.0,48.8\n10,0.9,0.0,0.0,43.8\n11,1.0,0.0,0.0,20.0`;
      if (type === 'stl') {
        const r = await api.parseSTL(stlContent);
        setStlResult(r); setCsvResult(null); setMode('stl');
      } else {
        const r = await api.parseCSV(csvContent);
        setCsvResult(r); setStlResult(null); setMode('csv');
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Sample load error');
    } finally { setLoading(false); }
  }, [backendUp]);

  const stlBounds: [[number,number,number],[number,number,number]] = stlResult
    ? [stlResult.bounds.min, stlResult.bounds.max]
    : [[-1,-1,-1],[1,1,1]];

  const csvBounds: [[number,number,number],[number,number,number]] = csvResult
    ? (() => {
        const xs = csvResult.nodes.map(n=>n.x), ys = csvResult.nodes.map(n=>n.y), zs = csvResult.nodes.map(n=>n.z);
        return [[Math.min(...xs),Math.min(...ys),Math.min(...zs)],[Math.max(...xs),Math.max(...ys),Math.max(...zs)]];
      })()
    : [[-1,-1,-1],[1,1,1]];

  const downloadCSV = () => {
    if (!csvResult) return;
    const rows = ['node_id,x_m,y_m,z_m,temperature_C',
      ...csvResult.nodes.map(n => `${n.id},${n.x},${n.y},${n.z},${n.T}`)];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'temperature_data.csv'; a.click();
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Geometry Viewer</h1>
        <p className="page-subtitle">Import ASCII STL geometry or temperature CSV for interactive 3D visualization</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, height: 'calc(100vh - 220px)' }}>
        {/* Left panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
          {/* Upload */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}><Upload size={14} /> Import File</div>
            <label className="upload-zone" style={{ display: 'block', marginBottom: 12 }}>
              <input ref={fileRef} type="file" accept=".stl,.csv"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📂</div>
                Drop or click to upload<br />
                <span style={{ color: 'var(--text-muted)' }}>.stl (ASCII) or .csv</span>
              </div>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm w-full" onClick={() => loadSample('stl')} disabled={loading}>
                Sample STL
              </button>
              <button className="btn btn-secondary btn-sm w-full" onClick={() => loadSample('csv')} disabled={loading}>
                Sample CSV
              </button>
            </div>
          </div>

          {error && <div className="alert alert-error"><span>{error}</span></div>}
          {loading && (
            <div className="alert alert-info">
              <div className="spinner" />
              <span>Parsing file…</span>
            </div>
          )}

          {/* STL info */}
          {stlResult && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}><Info size={14} /> STL Model</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                <div><span className="form-label">Name</span><div className="mono">{stlResult.name || '(unnamed)'}</div></div>
                <div><span className="form-label">Triangles</span><div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{stlResult.triangle_count.toLocaleString()}</div></div>
                <div><span className="form-label">Bounds Min</span><div className="mono">[{stlResult.bounds.min.map(v=>v.toFixed(3)).join(', ')}]</div></div>
                <div><span className="form-label">Bounds Max</span><div className="mono">[{stlResult.bounds.max.map(v=>v.toFixed(3)).join(', ')}]</div></div>
                <div><span className="form-label">Center</span><div className="mono">[{stlResult.bounds.center.map(v=>v.toFixed(3)).join(', ')}]</div></div>
              </div>
            </div>
          )}

          {/* CSV info */}
          {csvResult && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>
                <Info size={14} /> Temperature Data
                <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={downloadCSV}>
                  <Download size={11} /> CSV
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                <div><span className="form-label">Nodes</span><div style={{ fontWeight: 600 }}>{csvResult.node_count}</div></div>
                <div><span className="form-label">T_min</span><div style={{ color: '#60a5fa' }}>{csvResult.T_min.toFixed(2)} °C</div></div>
                <div><span className="form-label">T_max</span><div style={{ color: '#f87171' }}>{csvResult.T_max.toFixed(2)} °C</div></div>
                <div className="temp-legend">
                  <span style={{ color: 'var(--text-muted)' }}>{csvResult.T_min.toFixed(0)}°C</span>
                  <div className="temp-gradient" />
                  <span style={{ color: 'var(--text-muted)' }}>{csvResult.T_max.toFixed(0)}°C</span>
                </div>
              </div>
              {selectedNode && (
                <div style={{ marginTop: 12, padding: 10, background: 'var(--bg-primary)', borderRadius: 4, fontSize: 11 }}>
                  <div className="form-label">Selected Node #{selectedNode.id}</div>
                  <div className="mono" style={{ marginTop: 4, color: 'var(--text-secondary)' }}>
                    x={selectedNode.x.toFixed(3)} y={selectedNode.y.toFixed(3)} z={selectedNode.z.toFixed(3)}<br/>
                    T = <span style={{ color: '#f87171' }}>{selectedNode.T.toFixed(2)} °C</span>
                  </div>
                </div>
              )}
              {/* Table */}
              <div style={{ marginTop: 12, maxHeight: 200, overflow: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>ID</th><th>x (m)</th><th>T (°C)</th></tr></thead>
                  <tbody>
                    {csvResult.nodes.slice(0, 20).map(n => (
                      <tr key={n.id} onClick={() => setSelectedNode(n)} style={{ cursor: 'pointer' }}>
                        <td>{n.id}</td><td>{n.x.toFixed(3)}</td>
                        <td style={{ color: `hsl(${(1-(n.T-csvResult.T_min)/(csvResult.T_max-csvResult.T_min||1))*240},80%,60%)` }}>
                          {n.T.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!stlResult && !csvResult && !loading && (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
              <Eye size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <div style={{ fontSize: 12 }}>No file loaded.<br/>Upload an STL or CSV file to begin.</div>
            </div>
          )}
        </div>

        {/* 3D Canvas */}
        <div className="canvas-container">
          <Canvas camera={{ position: [2, 1.5, 2], fov: 45 }} style={{ background: 'var(--bg-primary)' }}>
            <ambientLight intensity={0.4} />
            <directionalLight position={[5, 5, 5]} intensity={0.8} />
            <directionalLight position={[-3, -3, -3]} intensity={0.2} />

            {stlResult && <STLMesh result={stlResult} />}
            {stlResult && <AutoCamera bounds={stlBounds} />}
            {csvResult && <TempPointCloud data={csvResult} selectedId={selectedNode?.id ?? null} onSelect={id => setSelectedNode(csvResult.nodes.find(n=>n.id===id) ?? null)} />}
            {csvResult && <AutoCamera bounds={csvBounds} />}

            <OrbitControls makeDefault />
            <axesHelper args={[0.5]} />
            <gridHelper args={[4, 20, '#21262d', '#21262d']} />
            <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
              <GizmoViewport axisColors={['#f87171', '#4ade80', '#60a5fa']} labelColor="white" />
            </GizmoHelper>
          </Canvas>

          {/* Canvas toolbar */}
          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary btn-sm" title="Reset view" onClick={() => window.location.reload()}>
              <RefreshCw size={11} />
            </button>
          </div>

          {/* Status bar */}
          {!stlResult && !csvResult && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', pointerEvents: 'none'
            }}>
              <Eye size={40} style={{ margin: '0 auto 8px', opacity: 0.2 }} />
              <div>Load a file to view geometry</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

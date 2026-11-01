import { useState, useRef, useCallback, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import { Upload, Eye, Download, RotateCcw, Info, CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { STLResult, CSVResult, TempNode } from '../types/api';

// ── STL Mesh renderer ─────────────────────────────────────────────────────────
function STLMesh({ result, wireframe }: { result: STLResult; wireframe: boolean }) {
  const geomRef = useRef<THREE.BufferGeometry>(null!);

  useEffect(() => {
    const positions: number[] = [];
    const normals: number[] = [];
    for (const t of result.triangles) {
      for (const v of [t.v0, t.v1, t.v2]) {
        positions.push(...v);
        normals.push(...t.n);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    if (geomRef.current) {
      geomRef.current.copy(g);
      geomRef.current.computeBoundingBox();
    }
  }, [result]);

  return (
    <mesh>
      <bufferGeometry ref={geomRef} />
      <meshStandardMaterial
        color="#3B82F6"
        wireframe={wireframe}
        roughness={0.3}
        metalness={0.2}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ── Temperature point cloud ──────────────────────────────────────────────────
function TempPointCloud({
  data,
  selectedId,
  onSelect,
}: {
  data: CSVResult;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const { positions, colors } = (() => {
    const pos: number[] = [],
      col: number[] = [];
    const tMin = data.T_min,
      tMax = data.T_max,
      tRange = tMax - tMin || 1;
    for (const n of data.nodes) {
      pos.push(n.x, n.y, n.z);
      const t = (n.T - tMin) / tRange;
      const r = t,
        g = 1 - Math.abs(2 * t - 1),
        b = 1 - t;
      col.push(r, g, b);
    }
    return { positions: pos, colors: col };
  })();

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  return (
    <points
      onClick={(e) => {
        e.stopPropagation();
        if (e.index !== undefined && data.nodes[e.index]) {
          onSelect(data.nodes[e.index].id);
        }
      }}
    >
      <bufferGeometry attach="geometry" {...geom} />
      <pointsMaterial
        size={0.06}
        vertexColors
        sizeAttenuation
        transparent
        opacity={0.95}
      />
    </points>
  );
}

function AutoCamera({
  bounds,
}: {
  bounds: [[number, number, number], [number, number, number]];
}) {
  const { camera } = useThree();
  useEffect(() => {
    const [min, max] = bounds;
    const center = [
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      (min[2] + max[2]) / 2,
    ];
    const size = Math.max(
      max[0] - min[0],
      max[1] - min[1],
      max[2] - min[2],
      0.5
    );
    const dist = size * 2.2;
    camera.position.set(
      center[0] + dist * 0.7,
      center[1] + dist * 0.5,
      center[2] + dist * 0.7
    );
    camera.lookAt(center[0], center[1], center[2]);
  }, [bounds, camera]);
  return null;
}

export default function GeometryViewer({ backendUp }: { backendUp: boolean }) {
  const [stlResult, setStlResult] = useState<STLResult | null>(null);
  const [csvResult, setCsvResult] = useState<CSVResult | null>(null);
  const [activeMode, setActiveMode] = useState<'none' | 'stl' | 'csv'>('none');
  const [selectedNode, setSelectedNode] = useState<TempNode | null>(null);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraKey, setCameraKey] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setLoading(true);
      const isSTL = file.name.toLowerCase().endsWith('.stl');
      const isCSV = file.name.toLowerCase().endsWith('.csv');

      if (!isSTL && !isCSV) {
        setError('Only .stl (ASCII) and .csv files are supported');
        setLoading(false);
        return;
      }

      try {
        const text = await file.text();
        if (isSTL) {
          const r = await api.parseSTL(text);
          setStlResult(r);
          setCsvResult(null);
          setActiveMode('stl');
        } else {
          const r = await api.parseCSV(text);
          setCsvResult(r);
          setStlResult(null);
          setActiveMode('csv');
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to parse file');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadSample = useCallback(
    async (type: 'stl' | 'csv') => {
      setError(null);
      setLoading(true);
      try {
        if (type === 'stl') {
          const sampleStl = `solid unit_cube
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 1 1 0
      vertex 1 0 0
    endloop
  endfacet
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 0 1 0
      vertex 1 1 0
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 1
      vertex 1 1 1
      vertex 1 0 1
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 1
      vertex 0 1 1
      vertex 1 1 1
    endloop
  endfacet
  facet normal 0 -1 0
    outer loop
      vertex 0 0 0
      vertex 0 0 1
      vertex 1 0 1
    endloop
  endfacet
  facet normal 0 -1 0
    outer loop
      vertex 0 0 0
      vertex 1 0 1
      vertex 1 0 0
    endloop
  endfacet
  facet normal 0 1 0
    outer loop
      vertex 0 1 0
      vertex 1 1 0
      vertex 1 1 1
    endloop
  endfacet
  facet normal 0 1 0
    outer loop
      vertex 0 1 0
      vertex 1 1 1
      vertex 0 1 1
    endloop
  endfacet
  facet normal -1 0 0
    outer loop
      vertex 0 0 0
      vertex 0 1 0
      vertex 0 1 1
    endloop
  endfacet
  facet normal -1 0 0
    outer loop
      vertex 0 0 0
      vertex 0 1 1
      vertex 0 0 1
    endloop
  endfacet
  facet normal 1 0 0
    outer loop
      vertex 1 0 0
      vertex 1 0 1
      vertex 1 1 1
    endloop
  endfacet
  facet normal 1 0 0
    outer loop
      vertex 1 0 0
      vertex 1 1 1
      vertex 1 1 0
    endloop
  endfacet
endsolid unit_cube`;
          const r = await api.parseSTL(sampleStl);
          setStlResult(r);
          setCsvResult(null);
          setActiveMode('stl');
        } else {
          const sampleCsv = `# Temperature field on synthetic 1D rod
node_id,x_m,y_m,z_m,temperature_C
1,0.000,0.0,0.0,100.000
2,0.100,0.0,0.0,92.550
3,0.200,0.0,0.0,85.400
4,0.300,0.0,0.0,78.550
5,0.400,0.0,0.0,72.000
6,0.500,0.0,0.0,65.750
7,0.600,0.0,0.0,59.800
8,0.700,0.0,0.0,54.150
9,0.800,0.0,0.0,48.800
10,0.900,0.0,0.0,43.750
11,1.000,0.0,0.0,20.000`;
          const r = await api.parseCSV(sampleCsv);
          setCsvResult(r);
          setStlResult(null);
          setActiveMode('csv');
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Sample load failed');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const stlBounds: [[number, number, number], [number, number, number]] =
    stlResult
      ? [stlResult.bounds.min, stlResult.bounds.max]
      : [
          [-1, -1, -1],
          [1, 1, 1],
        ];

  const csvBounds: [[number, number, number], [number, number, number]] =
    csvResult
      ? (() => {
          const xs = csvResult.nodes.map((n) => n.x),
            ys = csvResult.nodes.map((n) => n.y),
            zs = csvResult.nodes.map((n) => n.z);
          return [
            [Math.min(...xs), Math.min(...ys), Math.min(...zs)],
            [Math.max(...xs), Math.max(...ys), Math.max(...zs)],
          ];
        })()
      : [
          [-1, -1, -1],
          [1, 1, 1],
        ];

  const downloadCSV = () => {
    if (!csvResult) return;
    const rows = [
      'node_id,x_m,y_m,z_m,temperature_C',
      ...csvResult.nodes.map(
        (n) => `${n.id},${n.x},${n.y},${n.z},${n.T}`
      ),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'temperature_data.csv';
    a.click();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Geometry Viewer</h1>
          <p className="page-subtitle">
            Parse ASCII STL geometry and visualize scalar temperature point clouds in 3D
          </p>
        </div>
      </div>

      <div className="layout-split">
        {/* Left Control Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* File Upload Card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Upload size={16} /> Import File
              </span>
            </div>

            <div
              style={{
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius)',
                padding: '28px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                marginBottom: 16,
                background: 'rgba(255, 255, 255, 0.01)',
                transition: 'border-color 0.2s',
              }}
              onClick={() => fileRef.current?.click()}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = 'var(--primary-blue)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = 'var(--border)')
              }
            >
              <input
                ref={fileRef}
                type="file"
                accept=".stl,.csv"
                style={{ display: 'none' }}
                onChange={(e) =>
                  e.target.files?.[0] && handleFile(e.target.files[0])
                }
              />
              <Upload
                size={28}
                style={{
                  margin: '0 auto 10px',
                  color: 'var(--primary-blue)',
                  opacity: 0.8,
                }}
              />
              <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>
                Choose file or drag & drop
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Supports ASCII .stl and .csv
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => loadSample('stl')}
                disabled={loading}
              >
                Sample STL
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => loadSample('csv')}
                disabled={loading}
              >
                Sample CSV
              </button>
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {loading && (
            <div className="alert alert-warning">
              Processing geometric data in C++ backend…
            </div>
          )}

          {/* Model Metrics */}
          {stlResult && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <Info size={16} /> STL Mesh Details
                </span>
                <span className="badge badge-blue">3D Solid</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <div>
                  <span className="form-label">Model Name</span>
                  <span className="mono" style={{ color: 'var(--text-main)' }}>
                    {stlResult.name || 'unit_cube'}
                  </span>
                </div>
                <div>
                  <span className="form-label">Triangle Facets</span>
                  <span style={{ fontWeight: 600, color: 'var(--primary-blue)' }}>
                    {stlResult.triangle_count.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="form-label">Bounding Box</span>
                  <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Min: [{stlResult.bounds.min.map((v) => v.toFixed(2)).join(', ')}]<br />
                    Max: [{stlResult.bounds.max.map((v) => v.toFixed(2)).join(', ')}]
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CSV Temperature Metrics */}
          {csvResult && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <Info size={16} /> Temperature Field
                </span>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={downloadCSV}
                  title="Export parsed CSV"
                >
                  <Download size={13} /> Export
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="form-label">Node Count</span>
                  <span style={{ fontWeight: 600 }}>{csvResult.node_count} nodes</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="form-label">Min / Max Temp</span>
                  <span className="mono" style={{ color: 'var(--text-main)' }}>
                    {csvResult.T_min.toFixed(1)}°C — {csvResult.T_max.toFixed(1)}°C
                  </span>
                </div>

                {/* Colormap Legend */}
                <div style={{ marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>{csvResult.T_min.toFixed(0)}°C</span>
                    <span>Colormap</span>
                    <span>{csvResult.T_max.toFixed(0)}°C</span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 4,
                      background: 'linear-gradient(90deg, #3B82F6 0%, #10B981 50%, #EF4444 100%)',
                    }}
                  />
                </div>

                {selectedNode && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 10,
                      background: 'var(--bg-input)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 12,
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--primary-blue)', marginBottom: 4 }}>
                      Selected Node #{selectedNode.id}
                    </div>
                    <div className="mono" style={{ color: 'var(--text-secondary)' }}>
                      Coords: ({selectedNode.x.toFixed(3)}, {selectedNode.y.toFixed(3)}, {selectedNode.z.toFixed(3)})<br />
                      Temperature: <strong style={{ color: '#F87171' }}>{selectedNode.T.toFixed(2)} °C</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right 3D Viewport Panel */}
        <div
          className="card"
          style={{
            height: '620px',
            padding: 0,
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Viewport Top Overlay Controls */}
          <div
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              zIndex: 10,
              display: 'flex',
              gap: 8,
            }}
          >
            {stlResult && (
              <button
                className={`btn btn-sm ${wireframe ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setWireframe(!wireframe)}
              >
                Wireframe
              </button>
            )}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setCameraKey((k) => k + 1)}
              title="Reset 3D camera"
            >
              <RotateCcw size={13} /> Reset View
            </button>
          </div>

          {/* 3D Canvas */}
          <Canvas
            key={cameraKey}
            camera={{ position: [2.5, 2, 2.5], fov: 45 }}
            style={{ background: '#090E18', width: '100%', height: '100%' }}
          >
            <ambientLight intensity={0.5} />
            <directionalLight position={[6, 8, 6]} intensity={0.8} />
            <directionalLight position={[-4, -4, -4]} intensity={0.25} />

            {stlResult && <STLMesh result={stlResult} wireframe={wireframe} />}
            {stlResult && <AutoCamera bounds={stlBounds} />}

            {csvResult && (
              <TempPointCloud
                data={csvResult}
                selectedId={selectedNode?.id ?? null}
                onSelect={(id) =>
                  setSelectedNode(
                    csvResult.nodes.find((n) => n.id === id) ?? null
                  )
                }
              />
            )}
            {csvResult && <AutoCamera bounds={csvBounds} />}

            <OrbitControls makeDefault />
            <axesHelper args={[0.6]} />
            <gridHelper args={[4, 20, '#1E293B', '#1E293B']} />

            <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
              <GizmoViewport
                axisColors={['#EF4444', '#10B981', '#3B82F6']}
                labelColor="white"
              />
            </GizmoHelper>
          </Canvas>

          {/* Empty state overlay */}
          {!stlResult && !csvResult && !loading && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            >
              <Eye size={42} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                No 3D Model or Point Cloud Loaded
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Upload an ASCII STL file or temperature CSV to visualize
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

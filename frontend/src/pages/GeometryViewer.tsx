import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import {
  Upload,
  Eye,
  Download,
  RotateCcw,
  Info,
  Box,
  Layers,
  Thermometer,
  AlertTriangle,
  X,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { STLResult, CSVResult, TempNode } from '../types/api';
import {
  SAMPLE_CUBE_STL,
  SAMPLE_CYLINDER_STL,
  SAMPLE_ROD_CSV,
} from '../lib/sampleData';

// ── Temperature Colormap (Continuous 5-Stop Gradient) ────────────────────────
// 0.00: Deep Blue  (#1D4ED8)
// 0.25: Cyan       (#06B6D4)
// 0.50: Emerald    (#10B981)
// 0.75: Amber      (#F59E0B)
// 1.00: Crimson    (#EF4444)
function getTemperatureRgb(tNorm: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, tNorm));
  if (t <= 0.25) {
    const u = t / 0.25;
    return [
      (29 + (6 - 29) * u) / 255,
      (78 + (182 - 78) * u) / 255,
      (216 + (212 - 216) * u) / 255,
    ];
  } else if (t <= 0.5) {
    const u = (t - 0.25) / 0.25;
    return [
      (6 + (16 - 6) * u) / 255,
      (182 + (185 - 182) * u) / 255,
      (212 + (129 - 212) * u) / 255,
    ];
  } else if (t <= 0.75) {
    const u = (t - 0.5) / 0.25;
    return [
      (16 + (245 - 16) * u) / 255,
      (185 + (158 - 185) * u) / 255,
      (129 + (11 - 129) * u) / 255,
    ];
  } else {
    const u = (t - 0.75) / 0.25;
    return [
      (245 + (239 - 245) * u) / 255,
      (158 + (68 - 158) * u) / 255,
      (11 + (68 - 11) * u) / 255,
    ];
  }
}

// ── STL Mesh Component ───────────────────────────────────────────────────────
// Constructs clean geometry centered at (0, 0, 0) with recomputed normals.
// Toggling wireframe does NOT recreate geometry or reset camera.
function STLMesh({
  result,
  wireframe,
  onRadiusCalculated,
}: {
  result: STLResult;
  wireframe: boolean;
  onRadiusCalculated: (radius: number) => void;
}) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    for (const t of result.triangles) {
      for (const v of [t.v0, t.v1, t.v2]) {
        positions.push(...v);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    // Center geometry so the model bounding box center sits at (0, 0, 0)
    g.center();

    // Recompute surface normals for crisp, accurate lighting across all facets
    g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();

    const r = g.boundingSphere?.radius && g.boundingSphere.radius > 0
      ? g.boundingSphere.radius
      : 1.0;
    onRadiusCalculated(r);

    return g;
  }, [result, onRadiusCalculated]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={wireframe ? '#38BDF8' : '#93C5FD'}
        wireframe={wireframe}
        roughness={0.4}
        metalness={0.15}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ── Temperature Point Cloud Component ───────────────────────────────────────
function TempPointCloud({
  data,
  selectedId,
  onSelect,
  onRadiusCalculated,
}: {
  data: CSVResult;
  selectedId: number | null;
  onSelect: (node: TempNode | null) => void;
  onRadiusCalculated: (radius: number) => void;
}) {
  const { geometry, centerOffset, radius, selectedPos } = useMemo(() => {
    const xs = data.nodes.map((n) => n.x);
    const ys = data.nodes.map((n) => n.y);
    const zs = data.nodes.map((n) => n.z);

    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const spanZ = maxZ - minZ;
    const maxSpan = Math.max(spanX, spanY, spanZ, 0.001);
    const rad = Math.max(maxSpan * 0.75, 0.5);
    onRadiusCalculated(rad);

    const pos: number[] = [];
    const colors: number[] = [];
    const tMin = data.T_min;
    const tMax = data.T_max;
    const tRange = tMax - tMin || 1;

    let selP: [number, number, number] | null = null;

    for (const n of data.nodes) {
      const px = n.x - cx;
      const py = n.y - cy;
      const pz = n.z - cz;
      pos.push(px, py, pz);

      const tNorm = (n.T - tMin) / tRange;
      const [r, g, b] = getTemperatureRgb(tNorm);
      colors.push(r, g, b);

      if (selectedId !== null && n.id === selectedId) {
        selP = [px, py, pz];
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.computeBoundingSphere();

    return {
      geometry: geom,
      centerOffset: [cx, cy, cz] as [number, number, number],
      radius: rad,
      selectedPos: selP,
    };
  }, [data, selectedId, onRadiusCalculated]);

  const pointSize = Math.max(0.04 * radius, 0.05);

  return (
    <group>
      <points
        geometry={geometry}
        onClick={(e) => {
          e.stopPropagation();
          if (e.index !== undefined && data.nodes[e.index]) {
            onSelect(data.nodes[e.index]);
          }
        }}
      >
        <pointsMaterial
          size={pointSize}
          vertexColors
          sizeAttenuation
          transparent
          opacity={0.95}
        />
      </points>

      {/* Selected point highlight indicator */}
      {selectedPos && (
        <group position={selectedPos}>
          <mesh>
            <sphereGeometry args={[pointSize * 0.9, 16, 16]} />
            <meshBasicMaterial color="#FBBF24" wireframe />
          </mesh>
          <mesh>
            <ringGeometry args={[pointSize * 1.2, pointSize * 1.5, 32]} />
            <meshBasicMaterial color="#FBBF24" side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// ── Smart Camera & OrbitControls Controller ─────────────────────────────────
// Fits camera based on bounding radius with generous padding.
// Recalculates on model load, window resize, or explicit Reset View.
// Toggling wireframe does NOT trigger this controller.
function CameraController({
  radius,
  fitTrigger,
  controlsRef,
}: {
  radius: number;
  fitTrigger: number;
  controlsRef: React.RefObject<OrbitControlsImpl>;
}) {
  const { camera, size } = useThree();

  useEffect(() => {
    if (!radius || radius <= 0) return;

    const r = Math.max(radius, 0.1);
    const aspect = size.width / Math.max(1, size.height);
    const fovV = 45; // degrees
    const fovVRad = (fovV * Math.PI) / 180;
    const fovHRad = 2 * Math.atan(Math.tan(fovVRad / 2) * aspect);
    const minFovHalf = Math.min(fovVRad, fovHRad) / 2;

    // Camera distance with 40% margin to prevent any clipping or edge proximity
    const fitDistance = (r / Math.sin(minFovHalf)) * 1.4;

    const persp = camera as THREE.PerspectiveCamera;
    persp.near = Math.max(0.001, fitDistance / 100);
    persp.far = Math.max(1000, fitDistance * 30);

    // Isometric-inspired view angle (normalized diagonal)
    const viewDir = new THREE.Vector3(1.15, 0.85, 1.15).normalize();
    persp.position.copy(viewDir.multiplyScalar(fitDistance));
    persp.lookAt(0, 0, 0);
    persp.updateProjectionMatrix();

    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [radius, fitTrigger, camera, size, controlsRef]);

  return null;
}

// ── Main GeometryViewer Page ─────────────────────────────────────────────────
export default function GeometryViewer({ backendUp }: { backendUp: boolean }) {
  const [stlResult, setStlResult] = useState<STLResult | null>(null);
  const [csvResult, setCsvResult] = useState<CSVResult | null>(null);
  const [activeMode, setActiveMode] = useState<'none' | 'stl' | 'csv'>('none');
  const [selectedNode, setSelectedNode] = useState<TempNode | null>(null);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Geometry dimensions and camera fit trigger
  const [modelRadius, setModelRadius] = useState<number>(1.0);
  const [fitTrigger, setFitTrigger] = useState<number>(0);

  const fileRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const handleRadiusCalculated = useCallback((r: number) => {
    setModelRadius(r);
  }, []);

  const triggerResetView = useCallback(() => {
    setFitTrigger((t) => t + 1);
  }, []);

  // Process File Upload
  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      const name = file.name.toLowerCase();
      const isSTL = name.endsWith('.stl');
      const isCSV = name.endsWith('.csv');

      if (!isSTL && !isCSV) {
        setError('Unsupported format. Please select an ASCII .stl or .csv file.');
        return;
      }

      if (file.size === 0) {
        setError('The selected file is empty (0 bytes).');
        return;
      }

      setLoading(true);

      try {
        const text = await file.text();
        const trimmed = text.trim();
        if (!trimmed) {
          throw new Error('File contains no readable text.');
        }

        if (isSTL) {
          if (!trimmed.includes('solid') || !trimmed.includes('vertex')) {
            throw new Error(
              'Malformed ASCII STL: file must contain "solid", "facet", and "vertex" definitions.'
            );
          }
          const r = await api.parseSTL(text);
          if (!r.triangles || r.triangles.length === 0) {
            throw new Error('STL file contains no valid triangles.');
          }
          setStlResult(r);
          setCsvResult(null);
          setActiveMode('stl');
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);
        } else {
          if (!trimmed.includes('node_id') || !trimmed.includes(',')) {
            throw new Error(
              'Malformed CSV: header must specify node_id,x_m,y_m,z_m,temperature_C'
            );
          }
          const r = await api.parseCSV(text);
          if (!r.nodes || r.nodes.length === 0) {
            throw new Error('CSV file contains no valid data rows.');
          }
          setCsvResult(r);
          setStlResult(null);
          setActiveMode('csv');
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);
        }
      } catch (e) {
        // Keep last successfully loaded model visible on error
        setError(
          e instanceof ApiError
            ? e.message
            : e instanceof Error
            ? e.message
            : 'Failed to parse file.'
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Load Built-in Engineering Samples
  const loadSample = useCallback(
    async (type: 'cube' | 'cylinder' | 'csv') => {
      setError(null);
      setLoading(true);

      try {
        if (type === 'cube') {
          const r = await api.parseSTL(SAMPLE_CUBE_STL);
          setStlResult(r);
          setCsvResult(null);
          setActiveMode('stl');
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);
        } else if (type === 'cylinder') {
          const r = await api.parseSTL(SAMPLE_CYLINDER_STL);
          setStlResult(r);
          setCsvResult(null);
          setActiveMode('stl');
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);
        } else {
          const r = await api.parseCSV(SAMPLE_ROD_CSV);
          setCsvResult(r);
          setStlResult(null);
          setActiveMode('csv');
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Sample loading failed');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Model bounding dimensions
  const stlDimensions = useMemo(() => {
    if (!stlResult) return null;
    const { min, max } = stlResult.bounds;
    return {
      dx: Math.abs(max[0] - min[0]),
      dy: Math.abs(max[1] - min[1]),
      dz: Math.abs(max[2] - min[2]),
    };
  }, [stlResult]);

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
    a.download = 'temperature_field_export.csv';
    a.click();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Geometry Viewer</h1>
          <p className="page-subtitle">
            Interactive 3D visualization for ASCII STL CAD models and continuous scalar temperature point clouds
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
                <Upload size={16} /> Import Geometry / Data
              </span>
            </div>

            <div
              style={{
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius)',
                padding: '26px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                marginBottom: 14,
                background: 'rgba(255, 255, 255, 0.015)',
                transition: 'all 0.2s ease',
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
                size={26}
                style={{
                  margin: '0 auto 8px',
                  color: 'var(--primary-blue)',
                  opacity: 0.85,
                }}
              />
              <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>
                Choose file or drag & drop
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                ASCII STL meshes or temperature CSV datasets
              </div>
            </div>

            {/* Quick Sample Load Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                Preloaded Datasets
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => loadSample('cube')}
                  disabled={loading}
                  title="Unit Cube (12 triangles)"
                >
                  <Box size={13} /> Sample Cube
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => loadSample('cylinder')}
                  disabled={loading}
                  title="Cylinder Manifold (96 triangles)"
                >
                  <Layers size={13} /> Complex STL
                </button>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => loadSample('csv')}
                disabled={loading}
                title="Synthetic 1D Rod with analytical heat solution"
                style={{ width: '100%' }}
              >
                <Thermometer size={13} /> Sample Temperature CSV
              </button>
            </div>
          </div>

          {/* Feedback alerts */}
          {error && (
            <div className="alert alert-error" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, fontSize: 12.5 }}>
                <strong>Import Notice:</strong> {error}
              </div>
              <button
                onClick={() => setError(null)}
                style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {loading && (
            <div className="alert alert-warning" style={{ fontSize: 12.5 }}>
              Processing dataset in C++ numerical engine…
            </div>
          )}

          {/* STL Mesh Details Card */}
          {stlResult && activeMode === 'stl' && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <Info size={16} /> STL Mesh Details
                </span>
                <span className="badge badge-blue">3D CAD Solid</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="form-label" style={{ margin: 0 }}>Model Name</span>
                  <span className="mono" style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                    {stlResult.name || 'unnamed_solid'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="form-label" style={{ margin: 0 }}>Triangle Facets</span>
                  <span style={{ fontWeight: 600, color: 'var(--primary-blue)' }}>
                    {stlResult.triangle_count.toLocaleString()}
                  </span>
                </div>
                {stlDimensions && (
                  <div>
                    <span className="form-label">Dimensions (L × W × H)</span>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--text-main)' }}>
                      {stlDimensions.dx.toFixed(2)} × {stlDimensions.dy.toFixed(2)} × {stlDimensions.dz.toFixed(2)}
                    </div>
                  </div>
                )}
                <div>
                  <span className="form-label">Original Bounds</span>
                  <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Min: [{stlResult.bounds.min.map((v) => v.toFixed(2)).join(', ')}]<br />
                    Max: [{stlResult.bounds.max.map((v) => v.toFixed(2)).join(', ')}]
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CSV Temperature Field Card */}
          {csvResult && activeMode === 'csv' && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <Thermometer size={16} /> Temperature Field
                </span>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={downloadCSV}
                  title="Export parsed CSV dataset"
                >
                  <Download size={13} /> Export
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="form-label" style={{ margin: 0 }}>Point Count</span>
                  <span style={{ fontWeight: 600 }}>{csvResult.node_count} nodes</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="form-label" style={{ margin: 0 }}>Temperature Range</span>
                  <span className="mono" style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                    {csvResult.T_min.toFixed(1)}°C — {csvResult.T_max.toFixed(1)}°C
                  </span>
                </div>

                {/* Continuous Colormap Legend */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>
                    <span>{csvResult.T_min.toFixed(1)}°C (Cold)</span>
                    <span>Colormap Scale</span>
                    <span style={{ color: '#F87171' }}>{csvResult.T_max.toFixed(1)}°C (Hot)</span>
                  </div>
                  <div
                    style={{
                      height: 10,
                      borderRadius: 5,
                      background: 'linear-gradient(90deg, #1D4ED8 0%, #06B6D4 25%, #10B981 50%, #F59E0B 75%, #EF4444 100%)',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Selected Node Details */}
                {selectedNode ? (
                  <div
                    style={{
                      padding: 12,
                      background: 'var(--bg-input)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 12.5,
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, color: 'var(--primary-blue)' }}>
                        Node #{selectedNode.id}
                      </span>
                      <button
                        onClick={() => setSelectedNode(null)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                        title="Clear selection"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <div className="mono" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      Coordinates (m):<br />
                      &nbsp;&nbsp;x = {selectedNode.x.toFixed(4)}<br />
                      &nbsp;&nbsp;y = {selectedNode.y.toFixed(4)}<br />
                      &nbsp;&nbsp;z = {selectedNode.z.toFixed(4)}<br />
                      Temperature: <strong style={{ color: '#F87171', fontSize: 13.5 }}>{selectedNode.T.toFixed(2)} °C</strong>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '6px 0' }}>
                    Click any point in the 3D viewport to inspect node properties
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
              top: 14,
              right: 14,
              zIndex: 10,
              display: 'flex',
              gap: 8,
            }}
          >
            {stlResult && activeMode === 'stl' && (
              <button
                className={`btn btn-sm ${wireframe ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setWireframe(!wireframe)}
                title="Toggle between solid shaded CAD view and triangle mesh wireframe"
              >
                <Layers size={13} /> {wireframe ? 'Solid View' : 'Wireframe'}
              </button>
            )}
            <button
              className="btn btn-secondary btn-sm"
              onClick={triggerResetView}
              title="Reset camera orientation and fit model to viewport"
            >
              <RotateCcw size={13} /> Reset View
            </button>
          </div>

          {/* 3D Canvas */}
          <Canvas
            camera={{ position: [3, 2.2, 3], fov: 45 }}
            style={{ background: '#090E18', width: '100%', height: '100%' }}
            onPointerMissed={() => setSelectedNode(null)}
          >
            {/* Studio 3-Point Lighting for clean facet definition */}
            <ambientLight intensity={0.65} />
            <directionalLight position={[10, 15, 10]} intensity={0.9} />
            <directionalLight position={[-10, 8, -10]} intensity={0.45} />
            <directionalLight position={[0, -10, 6]} intensity={0.25} />

            {/* STL Solid / Wireframe Mesh */}
            {stlResult && activeMode === 'stl' && (
              <STLMesh
                result={stlResult}
                wireframe={wireframe}
                onRadiusCalculated={handleRadiusCalculated}
              />
            )}

            {/* Scalar Temperature Point Cloud */}
            {csvResult && activeMode === 'csv' && (
              <TempPointCloud
                data={csvResult}
                selectedId={selectedNode?.id ?? null}
                onSelect={(n) => setSelectedNode(n)}
                onRadiusCalculated={handleRadiusCalculated}
              />
            )}

            {/* Adaptive Camera Controller (Runs only on model switch, resize, or reset) */}
            <CameraController
              radius={modelRadius}
              fitTrigger={fitTrigger}
              controlsRef={controlsRef}
            />

            {/* OrbitControls revolving around model origin (0, 0, 0) */}
            <OrbitControls
              ref={controlsRef}
              makeDefault
              enableDamping
              dampingFactor={0.08}
              target={[0, 0, 0]}
            />

            {/* Ground grid floor anchored below the model */}
            <gridHelper
              args={[
                Math.max(2, Math.ceil(modelRadius * 2.5)),
                20,
                '#233147',
                '#152033',
              ]}
              position={[0, -modelRadius, 0]}
            />

            {/* XYZ Coordinate Axis Indicator */}
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
              <Eye size={44} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
                No 3D Model or Point Cloud Loaded
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Upload an ASCII STL file or temperature CSV, or load a sample dataset
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport, Html } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
  Grid,
  Sparkles,
  MousePointer,
  CheckCircle2,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { STLResult, CSVResult, TempNode } from '../types/api';
import {
  SAMPLE_CUBE_STL,
  SAMPLE_CYLINDER_STL,
  SAMPLE_ROD_CSV,
  SAMPLE_IRREGULAR_BRACKET_STL,
  SAMPLE_LARGE_MANIFOLD_STL,
  MALFORMED_STL,
  MALFORMED_CSV,
} from '../lib/sampleData';

// Visualisation Modes
export type VisMode = 'solid' | 'faceted' | 'wireframe' | 'temperature';

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

// Convert normalized [0,1] t to CSS hex color for UI swatches
function getTemperatureCss(tNorm: number): string {
  const [r, g, b] = getTemperatureRgb(tNorm);
  const h = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

// ── STL Mesh Component ───────────────────────────────────────────────────────
// Converts parsed ASCII STL triangles into coherent Three.js geometry centered at (0, 0, 0).
// Preserves vertex positions and facet connectivity.
// Supports:
//  - Solid: Studio steel-blue CAD shading with creased normals for smooth curved surfaces
//  - Faceted: Flat facet shading with subtle triangular facet edge lines
//  - Wireframe: Clean triangle mesh lines without solid occlusion
function STLMesh({
  result,
  mode,
  onBoundsCalculated,
}: {
  result: STLResult;
  mode: VisMode;
  onBoundsCalculated: (radius: number, dimensions: { dx: number; dy: number; dz: number }) => void;
}) {
  const { smoothGeometry, facetedGeometry, wireGeometry, dimensions, radius } = useMemo(() => {
    const positions: number[] = [];
    for (const t of result.triangles) {
      for (const v of [t.v0, t.v1, t.v2]) {
        positions.push(...v);
      }
    }

    const baseGeom = new THREE.BufferGeometry();
    baseGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    // Calculate dimensions from original parsed vertices
    baseGeom.computeBoundingBox();
    const bb = baseGeom.boundingBox!;
    const dx = Math.abs(bb.max.x - bb.min.x);
    const dy = Math.abs(bb.max.y - bb.min.y);
    const dz = Math.abs(bb.max.z - bb.min.z);

    // Center geometry so model origin sits at (0, 0, 0)
    baseGeom.center();
    baseGeom.computeBoundingBox();
    baseGeom.computeBoundingSphere();

    const r = baseGeom.boundingSphere?.radius && baseGeom.boundingSphere.radius > 0
      ? baseGeom.boundingSphere.radius
      : Math.max(dx, dy, dz) * 0.7 || 1.0;

    // 1. Smooth CAD geometry: Creased normals preserve sharp edges > 35° while smoothing curves
    const smoothGeom = toCreasedNormals(baseGeom, THREE.MathUtils.degToRad(35));

    // 2. Faceted geometry: Explicit per-triangle flat normals
    const facetedGeom = baseGeom.clone();
    facetedGeom.computeVertexNormals();

    // 3. Wireframe geometry for facet outlines
    const wireGeom = new THREE.WireframeGeometry(baseGeom);

    return {
      smoothGeometry: smoothGeom,
      facetedGeometry: facetedGeom,
      wireGeometry: wireGeom,
      dimensions: { dx, dy, dz },
      radius: r,
    };
  }, [result]);

  useEffect(() => {
    onBoundsCalculated(radius, dimensions);
  }, [radius, dimensions, onBoundsCalculated]);

  return (
    <group>
      {/* Solid Mode: Clean CAD Steel-Blue Material with Smooth Curvature */}
      {mode === 'solid' && (
        <mesh geometry={smoothGeometry}>
          <meshStandardMaterial
            color="#3B82F6"
            roughness={0.35}
            metalness={0.25}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Faceted Mode: Flat Face Shading + Visible Triangular Edge Outlines */}
      {mode === 'faceted' && (
        <group>
          <mesh geometry={facetedGeometry}>
            <meshStandardMaterial
              color="#4785E8"
              roughness={0.4}
              metalness={0.2}
              flatShading={true}
              side={THREE.DoubleSide}
            />
          </mesh>
          <lineSegments geometry={wireGeometry}>
            <lineBasicMaterial
              color="#1E293B"
              transparent
              opacity={0.45}
              depthTest={true}
            />
          </lineSegments>
        </group>
      )}

      {/* Wireframe Mode: Triangular Mesh Edges Only */}
      {mode === 'wireframe' && (
        <mesh geometry={facetedGeometry}>
          <meshStandardMaterial
            color="#38BDF8"
            wireframe={true}
            roughness={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}

// ── Detect if dataset is 1D (all nodes collinear along one axis) ──────────────
function detect1D(nodes: TempNode[]): boolean {
  if (nodes.length < 2) return false;
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const zs = nodes.map((n) => n.z);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  const spanZ = Math.max(...zs) - Math.min(...zs);
  const maxSpan = Math.max(spanX, spanY, spanZ);
  if (maxSpan < 1e-10) return false;
  const secondSpan = [spanX, spanY, spanZ].sort((a, b) => b - a)[1];
  return secondSpan < maxSpan * 0.02;
}

// ── Temperature Point Cloud Component ───────────────────────────────────────
function TempPointCloud({
  data,
  selectedId,
  onSelect,
  onBoundsCalculated,
}: {
  data: CSVResult;
  selectedId: number | null;
  onSelect: (node: TempNode | null) => void;
  onBoundsCalculated: (radius: number, dimensions: { dx: number; dy: number; dz: number }) => void;
}) {
  const { geometry, lineGeometry, radius, selectedPos, dimensions, is1D } = useMemo(() => {
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

    const tMin = data.T_min;
    const tMax = data.T_max;
    const tRange = tMax - tMin || 1;

    // Sort by node id for stable connectivity line
    const sorted = [...data.nodes].sort((a, b) => a.id - b.id);

    const pos: number[] = [];
    const colors: number[] = [];
    let selP: [number, number, number] | null = null;

    for (const n of sorted) {
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

    // Line geometry for 1D spine
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute('position', new THREE.Float32BufferAttribute([...pos], 3));
    const lineIndices: number[] = [];
    for (let i = 0; i < sorted.length - 1; i++) lineIndices.push(i, i + 1);
    lineGeom.setIndex(lineIndices);

    return {
      geometry: geom,
      lineGeometry: lineGeom,
      radius: rad,
      selectedPos: selP,
      dimensions: { dx: spanX, dy: spanY, dz: spanZ },
      is1D: detect1D(data.nodes),
    };
  }, [data, selectedId]);

  useEffect(() => {
    onBoundsCalculated(radius, dimensions);
  }, [radius, dimensions, onBoundsCalculated]);

  // Larger, proportionally-scaled points — always clearly visible
  const pointSize = Math.max(radius * 0.045, 0.04);

  return (
    <group>
      {/* Connectivity spine for ordered 1D datasets */}
      {is1D && (
        <lineSegments geometry={lineGeometry}>
          <lineBasicMaterial color="#475569" transparent opacity={0.55} />
        </lineSegments>
      )}

      {/* Main colored point cloud */}
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
          opacity={0.97}
        />
      </points>

      {/* Selected node: compact filled gold sphere + subtle outer halo */}
      {selectedPos && (
        <group position={selectedPos}>
          <mesh>
            <sphereGeometry args={[pointSize * 1.1, 12, 12]} />
            <meshBasicMaterial color="#FBBF24" />
          </mesh>
          <mesh>
            <sphereGeometry args={[pointSize * 2.0, 16, 16]} />
            <meshBasicMaterial color="#FBBF24" transparent opacity={0.18} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// ── Consistent XYZ World Axis Helper with Readable Visual Labels ────────────
// X = Red, Y = Green, Z = Blue (Height)
function WorldAxes({ length }: { length: number }) {
  const l = Math.max(length, 0.6);
  return (
    <group>
      <axesHelper args={[l]} />
      {/* Readable axis tips positioned at positive extents */}
      <Html position={[l * 1.08, 0, 0]} center style={{ pointerEvents: 'none' }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: '#EF4444',
            background: 'rgba(22, 34, 56, 0.85)',
            padding: '1px 5px',
            borderRadius: 3,
            border: '1px solid rgba(239, 68, 68, 0.4)',
            letterSpacing: '0.04em',
          }}
        >
          +X
        </span>
      </Html>
      <Html position={[0, l * 1.08, 0]} center style={{ pointerEvents: 'none' }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: '#22C55E',
            background: 'rgba(22, 34, 56, 0.85)',
            padding: '1px 5px',
            borderRadius: 3,
            border: '1px solid rgba(34, 197, 94, 0.4)',
            letterSpacing: '0.04em',
          }}
        >
          +Y
        </span>
      </Html>
      <Html position={[0, 0, l * 1.08]} center style={{ pointerEvents: 'none' }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: '#3B82F6',
            background: 'rgba(22, 34, 56, 0.85)',
            padding: '1px 5px',
            borderRadius: 3,
            border: '1px solid rgba(59, 130, 246, 0.4)',
            letterSpacing: '0.04em',
          }}
        >
          +Z (Height)
        </span>
      </Html>
    </group>
  );
}

// ── Smart Camera & OrbitControls Controller (Z-Up Engineering Isometric) ────
// Sets camera.up = (0, 0, 1), fits camera to bounding sphere with comfortable padding.
// Re-centers and fits on initial load, model change, or explicit Reset View.
// Changing colour/shading mode preserves the current camera orientation and position.
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
    const fovV = 45; // vertical fov degrees
    const fovVRad = (fovV * Math.PI) / 180;
    const fovHRad = 2 * Math.atan(Math.tan(fovVRad / 2) * aspect);
    const minFovHalf = Math.min(fovVRad, fovHRad) / 2;

    // Camera distance with 35% margin to prevent any clipping or edge proximity
    const fitDistance = (r / Math.sin(minFovHalf)) * 1.35;

    const persp = camera as THREE.PerspectiveCamera;
    persp.up.set(0, 0, 1); // Z is vertical height in CAD world
    persp.near = Math.max(0.001, fitDistance / 200);
    persp.far = Math.max(2000, fitDistance * 50);

    // Engineering Isometric View Direction in Z-Up: (+X, -Y, +Z) looking at (0, 0, 0)
    const viewDir = new THREE.Vector3(1.1, -1.2, 0.95).normalize();
    persp.position.copy(viewDir.multiplyScalar(fitDistance));
    persp.lookAt(0, 0, 0);
    persp.updateProjectionMatrix();

    if (controlsRef.current) {
      controlsRef.current.object.up.set(0, 0, 1);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [radius, fitTrigger, camera, size, controlsRef]);

  return null;
}

// ── Professional Temperature Legend Panel (viewport overlay) ──────────────────
function TempLegend({
  tMin,
  tMax,
  selectedT,
  nodeCount,
}: {
  tMin: number;
  tMax: number;
  selectedT: number | null;
  nodeCount: number;
}) {
  const tRange = tMax - tMin || 1;
  const midLow = tMin + tRange * 0.25;
  const mid    = tMin + tRange * 0.5;
  const midHigh = tMin + tRange * 0.75;
  const markerPct = selectedT !== null ? ((selectedT - tMin) / tRange) * 100 : null;
  const mono: React.CSSProperties = { fontFamily: 'monospace', whiteSpace: 'nowrap' };

  return (
    <div
      style={{
        position: 'absolute', bottom: 14, right: 14, zIndex: 10,
        background: 'rgba(7, 12, 22, 0.90)',
        border: '1px solid rgba(51,65,85,0.7)',
        borderRadius: 8, padding: '10px 12px',
        backdropFilter: 'blur(10px)', minWidth: 168,
        boxShadow: '0 4px 20px rgba(0,0,0,0.55)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Thermometer size={12} style={{ color: '#F59E0B' }} />
        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#CBD5E1', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Temperature Field
        </span>
      </div>

      {/* Gradient bar + marker */}
      <div style={{ position: 'relative', marginBottom: 4 }}>
        <div style={{
          height: 14, borderRadius: 4,
          background: 'linear-gradient(90deg, #1D4ED8 0%, #06B6D4 25%, #10B981 50%, #F59E0B 75%, #EF4444 100%)',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
        }} />
        {markerPct !== null && (
          <div style={{
            position: 'absolute', top: -3,
            left: `${Math.min(Math.max(markerPct, 1), 99)}%`,
            transform: 'translateX(-50%)',
            width: 3, height: 20,
            background: '#FBBF24', borderRadius: 2,
            boxShadow: '0 0 6px rgba(251,191,36,0.9)',
          }} />
        )}
      </div>

      {/* Tick labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ ...mono, fontSize: 9.5, color: '#93C5FD' }}>{tMin.toFixed(1)}</span>
        <span style={{ ...mono, fontSize: 9.5, color: '#94A3B8' }}>{midLow.toFixed(1)}</span>
        <span style={{ ...mono, fontSize: 9.5, color: '#94A3B8' }}>{mid.toFixed(1)}</span>
        <span style={{ ...mono, fontSize: 9.5, color: '#94A3B8' }}>{midHigh.toFixed(1)}</span>
        <span style={{ ...mono, fontSize: 9.5, color: '#FCA5A5' }}>{tMax.toFixed(1)}</span>
      </div>
      <div style={{ textAlign: 'center', fontSize: 9, color: '#475569', marginBottom: 6 }}>°C</div>

      <div style={{ borderTop: '1px solid rgba(51,65,85,0.5)', marginBottom: 6 }} />

      {/* Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: '#64748B' }}>Nodes</span>
          <span style={{ ...mono, fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>{nodeCount}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: '#64748B' }}>Range</span>
          <span style={{ ...mono, fontSize: 10, color: '#94A3B8' }}>{(tMax - tMin).toFixed(1)} °C</span>
        </div>
        {selectedT !== null && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginTop: 2,
            padding: '3px 6px',
            background: 'rgba(251,191,36,0.08)', borderRadius: 4,
            border: '1px solid rgba(251,191,36,0.25)',
          }}>
            <span style={{ fontSize: 10, color: '#D97706' }}>Selected</span>
            <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: '#FBBF24' }}>
              {selectedT.toFixed(2)} °C
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main GeometryViewer Page ─────────────────────────────────────────────────
export default function GeometryViewer({ backendUp }: { backendUp: boolean }) {
  const [stlResult, setStlResult] = useState<STLResult | null>(null);
  const [csvResult, setCsvResult] = useState<CSVResult | null>(null);
  const [activeMode, setActiveMode] = useState<'none' | 'stl' | 'csv'>('none');
  const [visMode, setVisMode] = useState<VisMode>('solid');
  const [selectedNode, setSelectedNode] = useState<TempNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Model bounding dimensions and camera fit trigger
  const [modelRadius, setModelRadius] = useState<number>(1.0);
  const [modelDimensions, setModelDimensions] = useState<{ dx: number; dy: number; dz: number }>({
    dx: 1.0,
    dy: 1.0,
    dz: 1.0,
  });
  const [fitTrigger, setFitTrigger] = useState<number>(0);

  const fileRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const handleBoundsCalculated = useCallback(
    (radius: number, dimensions: { dx: number; dy: number; dz: number }) => {
      setModelRadius(radius);
      setModelDimensions(dimensions);
    },
    []
  );

  const triggerResetView = useCallback(() => {
    setFitTrigger((t) => t + 1);
  }, []);

  // Process File Upload
  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setNotice(null);

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
        setVisMode('solid');
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
        setVisMode('temperature');
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
  }, []);

  // Load Built-in Engineering Samples
  const loadSample = useCallback(
    async (type: 'cube' | 'cylinder' | 'bracket' | 'large' | 'csv' | 'bad_stl' | 'bad_csv') => {
      setError(null);
      setNotice(null);
      setLoading(true);

      try {
        if (type === 'cube') {
          const r = await api.parseSTL(SAMPLE_CUBE_STL);
          setStlResult(r);
          setCsvResult(null);
          setActiveMode('stl');
          setVisMode('solid');
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);
        } else if (type === 'cylinder') {
          const r = await api.parseSTL(SAMPLE_CYLINDER_STL);
          setStlResult(r);
          setCsvResult(null);
          setActiveMode('stl');
          setVisMode('solid');
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);
        } else if (type === 'bracket') {
          const r = await api.parseSTL(SAMPLE_IRREGULAR_BRACKET_STL);
          setStlResult(r);
          setCsvResult(null);
          setActiveMode('stl');
          setVisMode('solid');
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);
        } else if (type === 'large') {
          const r = await api.parseSTL(SAMPLE_LARGE_MANIFOLD_STL);
          setStlResult(r);
          setCsvResult(null);
          setActiveMode('stl');
          setVisMode('solid');
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);
        } else if (type === 'csv') {
          const r = await api.parseCSV(SAMPLE_ROD_CSV);
          setCsvResult(r);
          setStlResult(null);
          setActiveMode('csv');
          setVisMode('temperature');
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);
        } else if (type === 'bad_stl') {
          await api.parseSTL(MALFORMED_STL);
        } else if (type === 'bad_csv') {
          await api.parseCSV(MALFORMED_CSV);
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Sample loading failed');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const downloadCSV = () => {
    if (!csvResult) return;
    const rows = [
      'node_id,x_m,y_m,z_m,temperature_C',
      ...csvResult.nodes.map((n) => `${n.id},${n.x},${n.y},${n.z},${n.T}`),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'temperature_field_export.csv';
    a.click();
  };

  // Dimensions for Ground Grid floor placed beneath the model on XY plane
  const groundZ = -Math.max(modelDimensions.dz / 2, modelRadius * 0.5);
  const gridSize = Math.max(2, Math.ceil(modelRadius * 2.8));

  // CSS hex color of the selected node, used by the inspection panel swatch
  const selectedNodeColor = useMemo(() => {
    if (!selectedNode || !csvResult) return null;
    const tRange = csvResult.T_max - csvResult.T_min || 1;
    const tNorm = (selectedNode.T - csvResult.T_min) / tRange;
    return getTemperatureCss(tNorm);
  }, [selectedNode, csvResult]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Geometry Viewer</h1>
          <p className="page-subtitle">
            Interactive 3D CAD visualization with consistent Z-up world coordinates, multi-mode shading, and scalar temperature fields
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
                padding: '22px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                marginBottom: 14,
                background: 'rgba(255, 255, 255, 0.015)',
                transition: 'all 0.2s ease',
              }}
              onClick={() => fileRef.current?.click()}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary-blue)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".stl,.csv"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <Upload
                size={24}
                style={{
                  margin: '0 auto 6px',
                  color: 'var(--primary-blue)',
                  opacity: 0.85,
                }}
              />
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                Choose file or drag & drop
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                ASCII STL meshes (.stl) or temperature datasets (.csv)
              </div>
            </div>

            {/* Quick Sample Load Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: 2,
                }}
              >
                Preloaded Datasets
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => loadSample('cube')}
                  disabled={loading}
                  title="Unit Cube (12 triangles, 1m × 1m × 1m)"
                >
                  <Box size={13} /> Sample Cube
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => loadSample('cylinder')}
                  disabled={loading}
                  title="Curved Cylinder Manifold (96 triangles)"
                >
                  <Layers size={13} /> Cylinder
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => loadSample('bracket')}
                  disabled={loading}
                  title="Asymmetric L-bracket irregular geometry (20 triangles)"
                >
                  <Grid size={13} /> Irregular STL
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => loadSample('large')}
                  disabled={loading}
                  title="High-density manifold (440 triangles)"
                >
                  <Sparkles size={13} /> Large STL
                </button>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => loadSample('csv')}
                disabled={loading}
                title="Synthetic 1D Rod with analytical heat solution (21 nodes)"
                style={{ width: '100%' }}
              >
                <Thermometer size={13} /> Sample Temperature CSV
              </button>

              {/* Negative Test Buttons */}
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginTop: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Negative Test Validation
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => loadSample('bad_stl')}
                  disabled={loading}
                  title="Test rejection of incomplete/malformed STL"
                  style={{ fontSize: 11 }}
                >
                  <AlertTriangle size={12} /> Malformed STL
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => loadSample('bad_csv')}
                  disabled={loading}
                  title="Test rejection of corrupted CSV row values"
                  style={{ fontSize: 11 }}
                >
                  <AlertTriangle size={12} /> Malformed CSV
                </button>
              </div>
            </div>
          </div>

          {/* Feedback alerts */}
          {error && (
            <div className="alert alert-error" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, fontSize: 12.5 }}>
                <strong>Validation Notice:</strong> {error}
              </div>
              <button
                onClick={() => setError(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {notice && (
            <div
              className="alert"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                background: 'rgba(37, 99, 235, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: '#93C5FD',
              }}
            >
              <Info size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--primary-blue)' }} />
              <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.5 }}>
                <strong>Temperature View:</strong> {notice}
              </div>
              <button
                onClick={() => setNotice(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: 0,
                }}
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
                  <span className="form-label" style={{ margin: 0 }}>
                    Model Name
                  </span>
                  <span className="mono" style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                    {stlResult.name || 'unnamed_solid'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="form-label" style={{ margin: 0 }}>
                    Triangle Facets
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--primary-blue)' }}>
                    {stlResult.triangle_count.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="form-label">Dimensions (L × W × H)</span>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--text-main)' }}>
                    {modelDimensions.dx.toFixed(3)}m × {modelDimensions.dy.toFixed(3)}m ×{' '}
                    {modelDimensions.dz.toFixed(3)}m
                  </div>
                </div>
                <div>
                  <span className="form-label">Original Bounds (World Space)</span>
                  <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Min: [{stlResult.bounds.min.map((v) => v.toFixed(3)).join(', ')}]<br />
                    Max: [{stlResult.bounds.max.map((v) => v.toFixed(3)).join(', ')}]<br />
                    Center: [{stlResult.bounds.center.map((v) => v.toFixed(3)).join(', ')}]
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="form-label" style={{ margin: 0 }}>
                    Scalar Temperature Field
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.06)', padding: '2px 8px', borderRadius: 4 }}>
                    None (Geometry Only)
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', lineHeight: 1.5 }}>
                  💡 <strong>Why Temperature Mode is Disabled:</strong> Standard ASCII STL meshes contain 3D surface geometry only (vertices and facet normals). Per scientific integrity requirements, temperatures are never invented for pure STL meshes. To view the continuous temperature colormap, import an analytical/ANSYS temperature CSV or click <strong>Sample Temperature CSV</strong> above.
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  Centered at origin (0, 0, 0) for viewport viewing without modifying original coordinates.
                </div>
              </div>
            </div>
          )}

          {/* CSV Temperature Field Card – Professional Layout */}
          {csvResult && activeMode === 'csv' && (
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Thermometer size={16} style={{ color: '#F59E0B' }} />
                  Temperature Field
                </span>
                <button className="btn btn-outline btn-sm" onClick={downloadCSV} title="Export parsed CSV">
                  <Download size={13} /> Export
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>

                {/* Summary stat tiles */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: '#64748B', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nodes</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#E2E8F0', fontFamily: 'monospace' }}>{csvResult.node_count}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: '#64748B', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Range</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0', fontFamily: 'monospace' }}>{(csvResult.T_max - csvResult.T_min).toFixed(1)} °C</div>
                  </div>
                </div>

                {/* T min/max bounds */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#93C5FD', fontFamily: 'monospace', fontWeight: 600 }}>{csvResult.T_min.toFixed(2)} °C</span>
                  <span style={{ fontSize: 10, color: '#475569' }}>T_min → T_max</span>
                  <span style={{ fontSize: 11, color: '#FCA5A5', fontFamily: 'monospace', fontWeight: 600 }}>{csvResult.T_max.toFixed(2)} °C</span>
                </div>

                {/* Colormap bar with optional selected-node marker */}
                <div>
                  <div style={{ position: 'relative', marginBottom: 4 }}>
                    <div style={{
                      height: 12, borderRadius: 4,
                      background: 'linear-gradient(90deg, #1D4ED8 0%, #06B6D4 25%, #10B981 50%, #F59E0B 75%, #EF4444 100%)',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
                    }} />
                    {selectedNode && (() => {
                      const r = csvResult.T_max - csvResult.T_min || 1;
                      const pct = ((selectedNode.T - csvResult.T_min) / r) * 100;
                      return (
                        <div style={{
                          position: 'absolute', top: -2,
                          left: `${Math.min(Math.max(pct, 1), 99)}%`,
                          transform: 'translateX(-50%)',
                          width: 2, height: 16,
                          background: '#FBBF24', borderRadius: 1,
                          boxShadow: '0 0 4px rgba(251,191,36,0.8)',
                        }} />
                      );
                    })()}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#475569' }}>
                    <span>Cold</span><span>25%</span><span>50%</span><span>75%</span><span>Hot</span>
                  </div>
                </div>

                {/* Node inspection panel */}
                {selectedNode ? (
                  <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(71,85,105,0.6)', borderRadius: 8, overflow: 'hidden' }}>
                    {/* Header row */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '7px 10px',
                      borderBottom: '1px solid rgba(51,65,85,0.5)',
                      background: 'rgba(255,255,255,0.03)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 9, height: 9, borderRadius: '50%',
                          background: selectedNodeColor ?? '#FBBF24',
                          boxShadow: `0 0 5px ${selectedNodeColor ?? '#FBBF24'}`,
                          flexShrink: 0,
                        }} />
                        <span style={{ fontWeight: 700, fontSize: 11.5, color: '#CBD5E1', fontFamily: 'monospace' }}>
                          Node #{selectedNode.id}
                        </span>
                        <CheckCircle2 size={11} style={{ color: '#22C55E' }} />
                      </div>
                      <button
                        onClick={() => setSelectedNode(null)}
                        style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: 2, display: 'flex' }}
                        title="Clear selection"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    {/* Coordinate rows */}
                    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {([
                        { label: 'X', value: selectedNode.x, color: '#EF4444' },
                        { label: 'Y', value: selectedNode.y, color: '#10B981' },
                        { label: 'Z', value: selectedNode.z, color: '#3B82F6' },
                      ] as const).map(({ label, value, color }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 10.5, color, fontWeight: 700, fontFamily: 'monospace', width: 14 }}>{label}</span>
                          <span style={{ fontSize: 11.5, fontFamily: 'monospace', color: '#94A3B8' }}>{value.toFixed(4)}</span>
                          <span style={{ fontSize: 10, color: '#475569' }}>m</span>
                        </div>
                      ))}
                      {/* Temperature row */}
                      <div style={{ borderTop: '1px solid rgba(51,65,85,0.4)', paddingTop: 5, marginTop: 2 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 10.5, color: '#94A3B8' }}>Temperature</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{
                              width: 8, height: 8, borderRadius: '50%',
                              background: selectedNodeColor ?? '#FBBF24',
                              boxShadow: `0 0 4px ${selectedNodeColor ?? '#FBBF24'}`,
                            }} />
                            <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: '#F8FAFC' }}>
                              {selectedNode.T.toFixed(3)}
                            </span>
                            <span style={{ fontSize: 10, color: '#64748B' }}>°C</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px dashed rgba(51,65,85,0.5)',
                    borderRadius: 8, color: '#64748B', fontSize: 12,
                  }}>
                    <MousePointer size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
                    <span>Click any point in the viewport to inspect nodal properties</span>
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
            height: '640px',
            padding: 0,
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Viewport Top Overlay Controls: Visualisation Selector & Reset View */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(11, 18, 32, 0.85)',
              padding: '6px 8px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {/* Visualisation Mode Selector */}
            <div
              style={{
                display: 'inline-flex',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: 2,
                gap: 2,
              }}
            >
              {/* Solid Mode Button */}
              <button
                className={`btn btn-sm ${visMode === 'solid' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ height: 28, padding: '0 10px', fontSize: 12 }}
                onClick={() => setVisMode('solid')}
                disabled={activeMode !== 'stl'}
                title="Solid CAD: professional blue shading with smooth curvature on rounded surfaces"
              >
                <Box size={13} /> Solid
              </button>

              {/* Faceted Mode Button */}
              <button
                className={`btn btn-sm ${visMode === 'faceted' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ height: 28, padding: '0 10px', fontSize: 12 }}
                onClick={() => setVisMode('faceted')}
                disabled={activeMode !== 'stl'}
                title="Faceted CAD: visibly distinguish triangle facets with flat shading and subtle edge lines"
              >
                <Layers size={13} /> Faceted
              </button>

              {/* Wireframe Mode Button */}
              <button
                className={`btn btn-sm ${visMode === 'wireframe' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ height: 28, padding: '0 10px', fontSize: 12 }}
                onClick={() => setVisMode('wireframe')}
                disabled={activeMode !== 'stl'}
                title="Wireframe: display triangle mesh edges without solid surface occlusion"
              >
                <Grid size={13} /> Wireframe
              </button>

              {/* Temperature Mode Button */}
              <button
                className={`btn btn-sm ${visMode === 'temperature' ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  height: 28,
                  padding: '0 10px',
                  fontSize: 12,
                  opacity: activeMode === 'csv' ? 1 : 0.55,
                  cursor: 'pointer',
                }}
                onClick={() => {
                  if (activeMode === 'csv') {
                    setVisMode('temperature');
                    setNotice(null);
                  } else if (csvResult) {
                    setActiveMode('csv');
                    setVisMode('temperature');
                    setNotice(null);
                  } else {
                    setNotice(
                      `Temperature mode is unavailable for this STL mesh ("${stlResult?.name || 'STL model'}"). Standard ASCII STL files define boundary geometry only — no scalar temperatures. Click "Sample Temperature CSV" on the left to load the colormap view.`
                    );
                  }
                }}
                title={
                  activeMode === 'csv'
                    ? 'Temperature: continuous scalar field colormap'
                    : 'Temperature mode unavailable — no CSV data loaded'
                }
              >
                <Thermometer size={13} /> Temp
              </button>
            </div>

            {/* Reset View Button */}
            <button
              className="btn btn-secondary btn-sm"
              style={{ height: 28, padding: '0 10px', fontSize: 12 }}
              onClick={triggerResetView}
              title="Reset camera orientation to standard Z-up isometric view and frame geometry"
            >
              <RotateCcw size={13} /> Reset View
            </button>
          </div>

          {/* Coordinate System Legend / HUD Indicator (Bottom-Left) */}
          <div
            style={{
              position: 'absolute',
              bottom: 14,
              left: 14,
              zIndex: 10,
              background: 'rgba(22, 34, 56, 0.85)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backdropFilter: 'blur(8px)',
              pointerEvents: 'none',
            }}
          >
            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>World Axes:</span>
            <span style={{ color: '#EF4444', fontWeight: 600 }}>X</span>
            <span style={{ color: '#22C55E', fontWeight: 600 }}>Y</span>
            <span style={{ color: '#3B82F6', fontWeight: 600 }}>Z (Height)</span>
            <span style={{ color: 'var(--text-muted)', borderLeft: '1px solid var(--border)', paddingLeft: 6 }}>
              Grid: XY Ground Plane
            </span>
          </div>

          {/* 3D Canvas with Consistent Z-Up World Frame */}
          <Canvas
            camera={{ position: [3, -3, 2.5], fov: 45, up: [0, 0, 1] }}
            style={{ background: '#0B1120', width: '100%', height: '100%' }}
            onPointerMissed={() => setSelectedNode(null)}
          >
            {/* Studio 3-Point Lighting tuned for CAD contrast and curved highlight definition */}
            <ambientLight intensity={0.6} />
            <directionalLight position={[10, -10, 15]} intensity={0.9} />
            <directionalLight position={[-10, 10, 12]} intensity={0.45} />
            <directionalLight position={[0, 8, -10]} intensity={0.25} />

            {/* STL Solid / Faceted / Wireframe Mesh */}
            {stlResult && activeMode === 'stl' && (
              <STLMesh
                result={stlResult}
                mode={visMode}
                onBoundsCalculated={handleBoundsCalculated}
              />
            )}

            {/* Scalar Temperature Point Cloud */}
            {csvResult && activeMode === 'csv' && (
              <TempPointCloud
                data={csvResult}
                selectedId={selectedNode?.id ?? null}
                onSelect={(n) => setSelectedNode(n)}
                onBoundsCalculated={handleBoundsCalculated}
              />
            )}

            <CameraController
              radius={modelRadius}
              fitTrigger={fitTrigger}
              controlsRef={controlsRef}
            />

            <OrbitControls
              ref={controlsRef}
              makeDefault
              enableDamping
              dampingFactor={0.08}
              target={[0, 0, 0]}
            />

            <WorldAxes length={Math.max(1, modelRadius * 1.15)} />

            {/* Ground grid – XY plane at model base */}
            <gridHelper
              args={[gridSize, 20, '#1A2740', '#0F1C30']}
              rotation={[Math.PI / 2, 0, 0]}
              position={[0, 0, groundZ]}
            />

            <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
              <GizmoViewport
                axisColors={['#EF4444', '#10B981', '#3B82F6']}
                labelColor="white"
              />
            </GizmoHelper>
          </Canvas>

          {/* Floating Temperature Legend (only when CSV is active) */}
          {csvResult && activeMode === 'csv' && (
            <TempLegend
              tMin={csvResult.T_min}
              tMax={csvResult.T_max}
              selectedT={selectedNode?.T ?? null}
              nodeCount={csvResult.node_count}
            />
          )}

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
                Upload an ASCII STL file or temperature CSV, or click a preloaded dataset on the left
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

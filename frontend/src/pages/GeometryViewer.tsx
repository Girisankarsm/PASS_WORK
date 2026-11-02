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
  Sliders,
  FileText,
  FolderUp,
  Trash2,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useTheme } from '../lib/theme';
import type { STLResult, CSVResult, TempNode } from '../types/api';
import {
  classifyTemperatureDataset,
  buildStructuredGridMesh,
  mapTemperatureToSTL,
  getTemperatureRgb,
  getTemperatureCss,
} from '../lib/geometryClassification';
import {
  detectFileRole,
  parseNodesText,
  parseFacesText,
  combineNodesAndFaces,
  type MultiFileMeshResult,
  type FileItem,
  type FileRole,
} from '../lib/multiFileMesh';
import {
  SAMPLE_CUBE_STL,
  SAMPLE_CYLINDER_STL,
  SAMPLE_ROD_CSV,
  SAMPLE_CUBE_27_CSV,
  SAMPLE_PLATE_2D_CSV,
  SAMPLE_RECTILINEAR_GRID_CSV,
  SAMPLE_UNSTRUCTURED_CSV,
  SAMPLE_IRREGULAR_BRACKET_STL,
  SAMPLE_LARGE_MANIFOLD_STL,
  SAMPLE_CYLINDER_NODES_CSV,
  SAMPLE_CYLINDER_FACES_CSV,
  SAMPLE_QUAD_SHELL_NODES_CSV,
  SAMPLE_QUAD_SHELL_FACES_CSV,
  MALFORMED_STL,
  MALFORMED_CSV,
} from '../lib/sampleData';

// Visualisation Modes
export type VisMode = 'solid' | 'faceted' | 'wireframe' | 'temperature';
export type TempDisplayStyle = 'surface' | 'surface_nodes' | 'nodes_only' | 'wireframe';

// ── STL Mesh Component ───────────────────────────────────────────────────────
// Converts parsed ASCII STL triangles into coherent Three.js geometry centered at (0, 0, 0).
// Preserves vertex positions and facet connectivity.
// Supports:
//  - Solid: Studio steel-blue CAD shading with creased normals for smooth curved surfaces
//  - Faceted: Flat facet shading with subtle triangular facet edge lines
//  - Wireframe: Clean triangle mesh lines without solid occlusion
//  - Temperature: Continuous temperature-colored CAD mesh when CSV temperature field is mapped
function STLMesh({
  result,
  mode,
  mappedGeometry,
  mappedWireGeometry,
  onBoundsCalculated,
}: {
  result: STLResult;
  mode: VisMode;
  mappedGeometry?: THREE.BufferGeometry | null;
  mappedWireGeometry?: THREE.BufferGeometry | null;
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

    baseGeom.computeBoundingBox();
    const bb = baseGeom.boundingBox!;
    const dx = Math.abs(bb.max.x - bb.min.x);
    const dy = Math.abs(bb.max.y - bb.min.y);
    const dz = Math.abs(bb.max.z - bb.min.z);

    baseGeom.center();
    baseGeom.computeBoundingBox();
    baseGeom.computeBoundingSphere();

    const r =
      baseGeom.boundingSphere?.radius && baseGeom.boundingSphere.radius > 0
        ? baseGeom.boundingSphere.radius
        : Math.max(dx, dy, dz) * 0.7 || 1.0;

    const smoothGeom = toCreasedNormals(baseGeom, THREE.MathUtils.degToRad(35));
    const facetedGeom = baseGeom.clone();
    facetedGeom.computeVertexNormals();
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

      {/* Temperature Mapped Mode: Continuous temperature colors on CAD STL triangles */}
      {mode === 'temperature' && mappedGeometry && (
        <group>
          <mesh geometry={mappedGeometry}>
            <meshStandardMaterial
              vertexColors={true}
              roughness={0.3}
              metalness={0.15}
              side={THREE.DoubleSide}
            />
          </mesh>
          {mappedWireGeometry && (
            <lineSegments geometry={mappedWireGeometry}>
              <lineBasicMaterial
                color="#0F172A"
                transparent
                opacity={0.25}
                depthTest={true}
              />
            </lineSegments>
          )}
        </group>
      )}
    </group>
  );
}

// ── Scientific Temperature Field Visualizer ─────────────────────────────────
// Intelligently renders:
//  - 3D/2D Structured Grids: continuous boundary surface quads/triangles + optional nodes/wireframe
//  - 1D Collinear Beam: analytical continuity spine line + nodal markers
//  - Unstructured Point Cloud: faithful measurement points without fabricating false solid geometry
function ScientificTemperatureView({
  data,
  displayStyle,
  selectedId,
  onSelect,
  onBoundsCalculated,
}: {
  data: CSVResult;
  displayStyle: TempDisplayStyle;
  selectedId: number | null;
  onSelect: (node: TempNode | null) => void;
  onBoundsCalculated: (radius: number, dimensions: { dx: number; dy: number; dz: number }) => void;
}) {
  const classificationReport = useMemo(() => {
    return classifyTemperatureDataset(data.nodes);
  }, [data]);

  const {
    pointsGeometry,
    structuredMesh,
    lineGeometry,
    radius,
    selectedPos,
    dimensions,
    center,
  } = useMemo(() => {
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

    // Stable sort by id
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

    const pGeom = new THREE.BufferGeometry();
    pGeom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    pGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    pGeom.computeBoundingSphere();

    // Line geometry for 1D datasets
    const lGeom = new THREE.BufferGeometry();
    lGeom.setAttribute('position', new THREE.Float32BufferAttribute([...pos], 3));
    const lineIndices: number[] = [];
    for (let i = 0; i < sorted.length - 1; i++) lineIndices.push(i, i + 1);
    lGeom.setIndex(lineIndices);

    // Build structured mesh for 3D/2D grids
    let sMesh: { surfaceGeometry: THREE.BufferGeometry; wireGeometry: THREE.BufferGeometry } | null = null;
    if (
      classificationReport.gridInfo &&
      (classificationReport.type === 'structured_3d' || classificationReport.type === 'structured_2d')
    ) {
      sMesh = buildStructuredGridMesh({
        gridInfo: classificationReport.gridInfo,
        tMin,
        tMax,
        center: [cx, cy, cz],
      });
    }

    return {
      pointsGeometry: pGeom,
      structuredMesh: sMesh,
      lineGeometry: lGeom,
      radius: rad,
      selectedPos: selP,
      dimensions: { dx: spanX, dy: spanY, dz: spanZ },
      center: [cx, cy, cz] as [number, number, number],
    };
  }, [data, selectedId, classificationReport]);

  useEffect(() => {
    onBoundsCalculated(radius, dimensions);
  }, [radius, dimensions, onBoundsCalculated]);

  const pointSize = Math.max(radius * 0.045, 0.04);
  const is1D = classificationReport.type === 'structured_1d';
  const hasStructuredMesh = !!structuredMesh;

  return (
    <group>
      {/* 1. Continuous Surface for Structured 3D/2D Grids */}
      {hasStructuredMesh && (displayStyle === 'surface' || displayStyle === 'surface_nodes') && (
        <mesh geometry={structuredMesh.surfaceGeometry}>
          <meshStandardMaterial
            vertexColors={true}
            roughness={0.35}
            metalness={0.12}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* 2. Structured Cell Outlines (Wireframe / Grid style) */}
      {hasStructuredMesh && (displayStyle === 'wireframe' || displayStyle === 'surface') && (
        <lineSegments geometry={structuredMesh.wireGeometry}>
          <lineBasicMaterial
            color="#0F172A"
            transparent
            opacity={displayStyle === 'wireframe' ? 0.85 : 0.3}
          />
        </lineSegments>
      )}

      {/* 3. 1D Continuity Spine */}
      {is1D && (
        <lineSegments geometry={lineGeometry}>
          <lineBasicMaterial color="#38BDF8" transparent opacity={0.75} linewidth={2} />
        </lineSegments>
      )}

      {/* 4. Verified Measurement Points (Nodes) */}
      {(displayStyle === 'nodes_only' || displayStyle === 'surface_nodes' || !hasStructuredMesh) && (
        <points
          geometry={pointsGeometry}
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
            opacity={0.96}
          />
        </points>
      )}

      {/* 5. Selected Node Highlight Indicator */}
      {selectedPos && (
        <group position={selectedPos}>
          <mesh>
            <sphereGeometry args={[pointSize * 1.05, 16, 16]} />
            <meshBasicMaterial color="#FBBF24" />
          </mesh>
          <mesh>
            <sphereGeometry args={[pointSize * 1.85, 20, 20]} />
            <meshBasicMaterial color="#FBBF24" transparent opacity={0.22} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// ── Multi-File Connected Mesh View ──────────────────────────────────────────
function ConnectedMeshView({
  result,
  displayStyle,
  selectedId,
  onSelect,
  onBoundsCalculated,
}: {
  result: MultiFileMeshResult;
  displayStyle: TempDisplayStyle;
  selectedId: number | null;
  onSelect: (node: TempNode | null) => void;
  onBoundsCalculated: (radius: number, dimensions: { dx: number; dy: number; dz: number }) => void;
}) {
  const { radius, dimensions, pointsGeometry, selectedPos } = useMemo(() => {
    const { min, max, center } = result.bounds;
    const spanX = max[0] - min[0];
    const spanY = max[1] - min[1];
    const spanZ = max[2] - min[2];
    const maxSpan = Math.max(spanX, spanY, spanZ, 0.001);
    const rad = Math.max(maxSpan * 0.75, 0.5);

    const pos: number[] = [];
    const colors: number[] = [];
    let selP: [number, number, number] | null = null;
    const tRange = result.maxT - result.minT || 1.0;

    for (const n of result.nodes) {
      const px = n.x - center[0];
      const py = n.y - center[1];
      const pz = n.z - center[2];
      pos.push(px, py, pz);

      if (result.hasTemperature) {
        const tNorm = (n.T - result.minT) / tRange;
        const [r, g, b] = getTemperatureRgb(tNorm);
        colors.push(r, g, b);
      } else {
        colors.push(0.72, 0.77, 0.85);
      }

      if (selectedId !== null && n.id === selectedId) {
        selP = [px, py, pz];
      }
    }

    const pGeom = new THREE.BufferGeometry();
    pGeom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    pGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    return {
      radius: rad,
      dimensions: { dx: spanX, dy: spanY, dz: spanZ },
      pointsGeometry: pGeom,
      selectedPos: selP,
    };
  }, [result, selectedId]);

  useEffect(() => {
    onBoundsCalculated(radius, dimensions);
  }, [radius, dimensions, onBoundsCalculated]);

  const pointSize = Math.max(0.012, Math.min(0.06, radius * 0.025));

  return (
    <group>
      {/* 1. Surface Mesh */}
      {result.surfaceGeometry && (displayStyle === 'surface' || displayStyle === 'surface_nodes') && (
        <mesh geometry={result.surfaceGeometry}>
          <meshStandardMaterial
            vertexColors={result.hasTemperature}
            color={result.hasTemperature ? '#FFFFFF' : '#94A3B8'}
            roughness={0.35}
            metalness={0.15}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* 2. Wireframe Lines */}
      {result.wireGeometry && (displayStyle === 'wireframe' || displayStyle === 'surface_nodes') && (
        <lineSegments geometry={result.wireGeometry}>
          <lineBasicMaterial
            color={displayStyle === 'wireframe' ? '#60A5FA' : '#0F172A'}
            opacity={displayStyle === 'wireframe' ? 0.95 : 0.4}
            transparent
            depthTest={true}
          />
        </lineSegments>
      )}

      {/* 3. Node Points (when surface_nodes or nodes_only) */}
      {(displayStyle === 'surface_nodes' || displayStyle === 'nodes_only') && (
        <points
          geometry={pointsGeometry}
          onClick={(e) => {
            e.stopPropagation();
            if (e.index !== undefined && result.nodes[e.index]) {
              onSelect(result.nodes[e.index]);
            }
          }}
        >
          <pointsMaterial
            size={Math.max(6, Math.min(16, 240 / (radius * 15 + 10)))}
            sizeAttenuation={false}
            vertexColors={result.hasTemperature}
            color={result.hasTemperature ? '#FFFFFF' : '#94A3B8'}
            transparent
            opacity={0.92}
          />
        </points>
      )}

      {/* 4. Selection Highlight */}
      {selectedPos && (
        <group position={selectedPos}>
          <mesh>
            <sphereGeometry args={[pointSize * 1.1, 16, 16]} />
            <meshBasicMaterial color="#FBBF24" />
          </mesh>
          <mesh>
            <sphereGeometry args={[pointSize * 2.0, 20, 20]} />
            <meshBasicMaterial color="#FBBF24" transparent opacity={0.25} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// ── World Axes Helper ────────────────────────────────────────────────────────
function WorldAxes({ length }: { length: number }) {
  const l = Math.max(length, 0.6);
  return (
    <group>
      <axesHelper args={[l]} />
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
            background: 'var(--viewport-axis-label-bg)',
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

// ── Smart Camera & OrbitControls Controller (Z-Up Isometric) ────────────────
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
    const fovV = 45;
    const fovVRad = (fovV * Math.PI) / 180;
    const fovHRad = 2 * Math.atan(Math.tan(fovVRad / 2) * aspect);
    const minFovHalf = Math.min(fovVRad, fovHRad) / 2;

    const fitDistance = (r / Math.sin(minFovHalf)) * 1.35;

    const persp = camera as THREE.PerspectiveCamera;
    persp.up.set(0, 0, 1);
    persp.near = Math.max(0.001, fitDistance / 200);
    persp.far = Math.max(2000, fitDistance * 50);

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

// ── Professional Temperature Legend Panel ───────────────────────────────────
function TempLegend({
  tMin,
  tMax,
  selectedT,
  nodeCount,
  classificationTitle,
  badgeColor,
}: {
  tMin: number;
  tMax: number;
  selectedT: number | null;
  nodeCount: number;
  classificationTitle: string;
  badgeColor: string;
}) {
  const tRange = tMax - tMin || 1;
  const p20 = tMin + tRange * 0.2;
  const p40 = tMin + tRange * 0.4;
  const p60 = tMin + tRange * 0.6;
  const p80 = tMin + tRange * 0.8;
  const markerPct = selectedT !== null ? ((selectedT - tMin) / tRange) * 100 : null;
  const mono: React.CSSProperties = { fontFamily: 'monospace', whiteSpace: 'nowrap' };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 14,
        right: 14,
        zIndex: 10,
        background: 'rgba(7, 12, 22, 0.92)',
        border: '1px solid rgba(51, 65, 85, 0.75)',
        borderRadius: 8,
        padding: '10px 14px',
        backdropFilter: 'blur(10px)',
        minWidth: 190,
        boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
      }}
    >
      {/* Header with Classification badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Thermometer size={12} style={{ color: '#F59E0B' }} />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#CBD5E1', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Thermal Colormap
          </span>
        </div>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: 4,
            background: `${badgeColor}22`,
            border: `1px solid ${badgeColor}66`,
            color: badgeColor,
          }}
        >
          °C
        </span>
      </div>

      <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {classificationTitle}
      </div>

      {/* Continuous 6-stop gradient bar */}
      <div style={{ position: 'relative', marginBottom: 4 }}>
        <div
          style={{
            height: 14,
            borderRadius: 4,
            background: 'linear-gradient(90deg, #1D4ED8 0%, #06B6D4 20%, #10B981 40%, #FBBF24 60%, #F97316 80%, #EF4444 100%)',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
          }}
        />
        {markerPct !== null && (
          <div
            style={{
              position: 'absolute',
              top: -3,
              left: `${Math.min(Math.max(markerPct, 1), 99)}%`,
              transform: 'translateX(-50%)',
              width: 3,
              height: 20,
              background: '#FBBF24',
              borderRadius: 2,
              boxShadow: '0 0 6px rgba(251,191,36,0.95)',
            }}
          />
        )}
      </div>

      {/* Tick labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, fontSize: 9 }}>
        <span style={{ ...mono, color: '#93C5FD' }}>{tMin.toFixed(1)}</span>
        <span style={{ ...mono, color: '#94A3B8' }}>{p20.toFixed(1)}</span>
        <span style={{ ...mono, color: '#94A3B8' }}>{p40.toFixed(1)}</span>
        <span style={{ ...mono, color: '#94A3B8' }}>{p60.toFixed(1)}</span>
        <span style={{ ...mono, color: '#94A3B8' }}>{p80.toFixed(1)}</span>
        <span style={{ ...mono, color: '#FCA5A5' }}>{tMax.toFixed(1)}</span>
      </div>

      <div style={{ borderTop: '1px solid rgba(51,65,85,0.5)', margin: '6px 0' }} />

      {/* Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: '#64748B' }}>Nodes</span>
          <span style={{ ...mono, fontSize: 10, color: '#CBD5E1', fontWeight: 600 }}>{nodeCount}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: '#64748B' }}>Range</span>
          <span style={{ ...mono, fontSize: 10, color: '#CBD5E1' }}>{(tMax - tMin).toFixed(1)} °C</span>
        </div>
        {selectedT !== null && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 2,
              padding: '3px 6px',
              background: 'rgba(251,191,36,0.08)',
              borderRadius: 4,
              border: '1px solid rgba(251,191,36,0.25)',
            }}
          >
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
  const [multiMeshResult, setMultiMeshResult] = useState<MultiFileMeshResult | null>(null);
  const [activeMode, setActiveMode] = useState<'none' | 'stl' | 'csv' | 'stl_temp' | 'multi_mesh'>('none');
  const [visMode, setVisMode] = useState<VisMode>('solid');
  const [tempDisplayStyle, setTempDisplayStyle] = useState<TempDisplayStyle>('surface');
  const [selectedNode, setSelectedNode] = useState<TempNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { cssVar } = useTheme();

  // Multi-file import staging state
  const [importMode, setImportMode] = useState<'single' | 'multi'>('single');
  const [stagedFiles, setStagedFiles] = useState<FileItem[]>([]);
  const multiFileRef = useRef<HTMLInputElement>(null);

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

  // Multi-File Staging Handlers
  const addFilesToStaging = useCallback(async (files: FileList | File[]) => {
    setError(null);
    setNotice(null);
    const newItems: FileItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await file.text();
        const detected = detectFileRole(file.name, text);
        newItems.push({
          id: `${file.name}-${Date.now()}-${i}-${Math.random()}`,
          file,
          name: file.name,
          size: file.size,
          detectedRole: detected,
          assignedRole: detected !== 'unknown' ? detected : 'auto',
          text,
        });
      } catch (err: any) {
        newItems.push({
          id: `${file.name}-${Date.now()}-${i}-${Math.random()}`,
          file,
          name: file.name,
          size: file.size,
          detectedRole: 'unknown',
          assignedRole: 'auto',
          error: err.message || 'Failed to read file',
        });
      }
    }
    setStagedFiles((prev) => [...prev, ...newItems]);
    setImportMode('multi');
  }, []);

  const removeStagedFile = useCallback((id: string) => {
    setStagedFiles((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateFileRole = useCallback((id: string, role: FileRole) => {
    setStagedFiles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, assignedRole: role } : item))
    );
  }, []);

  const clearStagedFiles = useCallback(() => {
    setStagedFiles([]);
  }, []);

  const processMultiFileImport = useCallback(async () => {
    if (stagedFiles.length === 0) return;
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      let nodesItem: FileItem | undefined;
      let facesItem: FileItem | undefined;
      let stlItem: FileItem | undefined;

      for (const item of stagedFiles) {
        const role = item.assignedRole === 'auto' ? item.detectedRole : item.assignedRole;
        if (role === 'nodes' && !nodesItem) nodesItem = item;
        else if (role === 'faces' && !facesItem) facesItem = item;
        else if (role === 'stl' && !stlItem) stlItem = item;
      }

      // Case 1: STL + Nodes/Temperature CSV
      if (stlItem && nodesItem) {
        const stlText = stlItem.text || (await stlItem.file.text());
        const csvText = nodesItem.text || (await nodesItem.file.text());
        const stlRes = await api.parseSTL(stlText);
        const csvRes = await api.parseCSV(csvText);

        setStlResult(stlRes);
        setCsvResult(csvRes);
        setMultiMeshResult(null);

        const mapping = mapTemperatureToSTL({ stl: stlRes, csv: csvRes });
        if (mapping.success) {
          setActiveMode('stl_temp');
          setVisMode('temperature');
          setNotice(`Mapped ${csvRes.node_count} temperature nodes onto STL CAD mesh "${stlRes.name}".`);
        } else {
          setActiveMode('stl');
          setVisMode('solid');
          setNotice(`STL mesh loaded. Mapping note: ${mapping.errorMessage}`);
        }
        setSelectedNode(null);
        setFitTrigger((t) => t + 1);
        return;
      }

      // Case 2: Nodes CSV + Faces / Connectivity CSV
      if (nodesItem && facesItem) {
        const nodesText = nodesItem.text || (await nodesItem.file.text());
        const facesText = facesItem.text || (await facesItem.file.text());

        const nodesParsed = parseNodesText(nodesText);
        const facesParsed = parseFacesText(facesText);

        const combined = combineNodesAndFaces({
          nodesResult: nodesParsed,
          facesResult: facesParsed,
          meshName: `${nodesItem.name} + ${facesItem.name}`,
        });

        if (!combined.success) {
          throw new Error(combined.errors.join(' '));
        }

        setMultiMeshResult(combined);
        setActiveMode('multi_mesh');
        setTempDisplayStyle(combined.hasTemperature ? 'surface_nodes' : 'wireframe');
        setSelectedNode(null);
        setFitTrigger((t) => t + 1);

        let noticeMsg = `Successfully imported connected mesh (${combined.nodeCount} nodes, ${combined.triangleCount} triangles).`;
        if (combined.warnings.length > 0) {
          noticeMsg += ` Note: ${combined.warnings.join(' ')}`;
        }
        setNotice(noticeMsg);
        return;
      }

      // Validation feedback if roles are incomplete
      if (nodesItem && !facesItem) {
        throw new Error(
          `Node coordinates file "${nodesItem.name}" is staged, but no face connectivity file was selected. Please select or drag a faces/triangles CSV file (e.g. triangle_id,v1,v2,v3).`
        );
      }
      if (facesItem && !nodesItem) {
        throw new Error(
          `Face connectivity file "${facesItem.name}" is staged, but no node coordinates file was selected. Please select or drag a nodes CSV file (e.g. node_id,x_m,y_m,z_m,temperature_C).`
        );
      }

      throw new Error(
        'Please stage both a Node Coordinates file and a Face Connectivity file (or an STL mesh and temperature CSV).'
      );
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : err.message || 'Multi-file import failed.');
    } finally {
      setLoading(false);
    }
  }, [stagedFiles]);

  // Scientific classification of current CSV dataset
  const classificationReport = useMemo(() => {
    if (!csvResult) return null;
    return classifyTemperatureDataset(csvResult.nodes);
  }, [csvResult]);

  // Interpolated Temperature mapping on STL
  const stlTemperatureMapping = useMemo(() => {
    if (!stlResult || !csvResult) return null;
    return mapTemperatureToSTL({ stl: stlResult, csv: csvResult });
  }, [stlResult, csvResult]);

  // Adjust default display style based on dataset type
  useEffect(() => {
    if (!classificationReport) return;
    if (classificationReport.type === 'unstructured_cloud') {
      setTempDisplayStyle('nodes_only');
    } else if (classificationReport.type === 'structured_1d') {
      setTempDisplayStyle('surface_nodes');
    } else {
      setTempDisplayStyle('surface');
    }
  }, [classificationReport]);

  // Process File Upload
  const handleFile = useCallback(
    async (file: File) => {
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
          setActiveMode('stl');
          setVisMode('solid');
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);

          if (csvResult) {
            setNotice(
              `STL mesh "${r.name || 'model'}" loaded. Compatible temperature CSV is already loaded — switch to "Temp" mode to view mapped temperature field.`
            );
          }
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
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);

          if (stlResult) {
            // Check mapping compatibility
            const mappingCheck = mapTemperatureToSTL({ stl: stlResult, csv: r });
            if (mappingCheck.success) {
              setActiveMode('stl_temp');
              setVisMode('temperature');
              setNotice(
                `Temperature CSV (${r.node_count} nodes) mapped onto STL mesh "${stlResult.name}". Viewing mapped temperature colormap.`
              );
            } else {
              setActiveMode('csv');
              setNotice(
                `CSV loaded in point/grid mode. STL mapping notice: ${mappingCheck.errorMessage}`
              );
            }
          } else {
            setActiveMode('csv');
            setVisMode('temperature');
          }
        }
      } catch (e) {
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
    [stlResult, csvResult]
  );

  // Load Built-in Engineering Samples
  const loadSample = useCallback(
    async (
      type:
        | 'cube_stl'
        | 'cylinder_stl'
        | 'bracket_stl'
        | 'large_stl'
        | 'cube_27_csv'
        | 'rod_1d_csv'
        | 'plate_2d_csv'
        | 'rect_grid_csv'
        | 'unstructured_csv'
        | 'hybrid_cube_temp'
        | 'cylinder_multi_mesh'
        | 'quad_shell_multi_mesh'
        | 'bad_stl'
        | 'bad_csv'
    ) => {
      setError(null);
      setNotice(null);
      setLoading(true);

      try {
        if (type === 'cube_stl') {
          const r = await api.parseSTL(SAMPLE_CUBE_STL);
          setStlResult(r);
          setMultiMeshResult(null);
          setActiveMode('stl');
          setVisMode('solid');
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);
        } else if (type === 'cylinder_stl') {
          const r = await api.parseSTL(SAMPLE_CYLINDER_STL);
          setStlResult(r);
          setMultiMeshResult(null);
          setActiveMode('stl');
          setVisMode('solid');
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);
        } else if (type === 'bracket_stl') {
          const r = await api.parseSTL(SAMPLE_IRREGULAR_BRACKET_STL);
          setStlResult(r);
          setMultiMeshResult(null);
          setActiveMode('stl');
          setVisMode('solid');
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);
        } else if (type === 'large_stl') {
          const r = await api.parseSTL(SAMPLE_LARGE_MANIFOLD_STL);
          setStlResult(r);
          setMultiMeshResult(null);
          setActiveMode('stl');
          setVisMode('solid');
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);
        } else if (type === 'cube_27_csv') {
          const r = await api.parseCSV(SAMPLE_CUBE_27_CSV);
          setCsvResult(r);
          setMultiMeshResult(null);
          setActiveMode('csv');
          setVisMode('temperature');
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);
        } else if (type === 'rod_1d_csv') {
          const r = await api.parseCSV(SAMPLE_ROD_CSV);
          setCsvResult(r);
          setMultiMeshResult(null);
          setActiveMode('csv');
          setVisMode('temperature');
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);
        } else if (type === 'plate_2d_csv') {
          const r = await api.parseCSV(SAMPLE_PLATE_2D_CSV);
          setCsvResult(r);
          setMultiMeshResult(null);
          setActiveMode('csv');
          setVisMode('temperature');
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);
        } else if (type === 'rect_grid_csv') {
          const r = await api.parseCSV(SAMPLE_RECTILINEAR_GRID_CSV);
          setCsvResult(r);
          setMultiMeshResult(null);
          setActiveMode('csv');
          setVisMode('temperature');
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);
        } else if (type === 'unstructured_csv') {
          const r = await api.parseCSV(SAMPLE_UNSTRUCTURED_CSV);
          setCsvResult(r);
          setMultiMeshResult(null);
          setActiveMode('csv');
          setVisMode('temperature');
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);
        } else if (type === 'hybrid_cube_temp') {
          const rStl = await api.parseSTL(SAMPLE_CUBE_STL);
          const rCsv = await api.parseCSV(SAMPLE_CUBE_27_CSV);
          setStlResult(rStl);
          setCsvResult(rCsv);
          setMultiMeshResult(null);
          setActiveMode('stl_temp');
          setVisMode('temperature');
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);
          setNotice('Mapped 27-node 3D steady-state thermal field onto Unit Cube CAD mesh.');
        } else if (type === 'cylinder_multi_mesh') {
          const nodesRes = parseNodesText(SAMPLE_CYLINDER_NODES_CSV);
          const facesRes = parseFacesText(SAMPLE_CYLINDER_FACES_CSV);
          const combined = combineNodesAndFaces({
            nodesResult: nodesRes,
            facesResult: facesRes,
            meshName: 'Curved Cylinder Mesh (Multi-File)',
          });
          setMultiMeshResult(combined);
          setActiveMode('multi_mesh');
          setTempDisplayStyle('surface_nodes');
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);
          setNotice(
            'Loaded multi-file curved cylinder mesh with 82 nodes, 160 triangles, and continuous temperature field (25°C to 105°C).'
          );
        } else if (type === 'quad_shell_multi_mesh') {
          const nodesRes = parseNodesText(SAMPLE_QUAD_SHELL_NODES_CSV);
          const facesRes = parseFacesText(SAMPLE_QUAD_SHELL_FACES_CSV);
          const combined = combineNodesAndFaces({
            nodesResult: nodesRes,
            facesResult: facesRes,
            meshName: 'Aerodynamic Quad Shell (Multi-File)',
          });
          setMultiMeshResult(combined);
          setActiveMode('multi_mesh');
          setTempDisplayStyle('surface_nodes');
          setSelectedNode(null);
          setFitTrigger((t) => t + 1);
          setNotice(
            'Loaded multi-file aerodynamic shell mesh with 30 nodes and 20 quad elements decomposed into 40 surface triangles.'
          );
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

  // CSS hex color of the selected node
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
            Scientific 3D CAD visualization with intelligent structured grid extraction, scalar temperature colormapping, and STL mesh mapping
          </p>
        </div>
      </div>

      <div className="layout-split">
        {/* Left Control Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* File Upload Card */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">
                <Upload size={16} /> Import Geometry & Data
              </span>
              <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: 6, padding: 2 }}>
                <button
                  type="button"
                  style={{
                    border: 'none',
                    background: importMode === 'single' ? 'var(--primary-blue)' : 'transparent',
                    color: importMode === 'single' ? '#FFFFFF' : 'var(--text-muted)',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => setImportMode('single')}
                >
                  Single File
                </button>
                <button
                  type="button"
                  style={{
                    border: 'none',
                    background: importMode === 'multi' ? 'var(--primary-blue)' : 'transparent',
                    color: importMode === 'multi' ? '#FFFFFF' : 'var(--text-muted)',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  onClick={() => setImportMode('multi')}
                >
                  <FolderUp size={11} /> Multi-File
                </button>
              </div>
            </div>

            {importMode === 'single' ? (
              <div
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '18px 14px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  marginBottom: 14,
                  background: 'rgba(255, 255, 255, 0.015)',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = 'var(--primary-blue)';
                }}
                onDragLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = 'var(--border)';
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    if (e.dataTransfer.files.length > 1) {
                      addFilesToStaging(e.dataTransfer.files);
                    } else {
                      handleFile(e.dataTransfer.files[0]);
                    }
                  }
                }}
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
                  size={20}
                  style={{
                    margin: '0 auto 6px',
                    color: 'var(--primary-blue)',
                    opacity: 0.85,
                  }}
                />
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                  Import STL Mesh or Temperature CSV
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  Drag & drop single file, or switch to Multi-File for separate nodes & connectivity
                </div>
              </div>
            ) : (
              /* Multi-File Staging and Role Selector Area */
              <div style={{ marginBottom: 14 }}>
                <input
                  ref={multiFileRef}
                  type="file"
                  multiple
                  accept=".csv,.stl,.txt,.dat"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files && e.target.files.length > 0 && addFilesToStaging(e.target.files)}
                />
                <div
                  style={{
                    border: '2px dashed var(--primary-blue)',
                    borderRadius: 'var(--radius)',
                    padding: '14px 12px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: 'rgba(59, 130, 246, 0.04)',
                    marginBottom: 10,
                  }}
                  onClick={() => multiFileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      addFilesToStaging(e.dataTransfer.files);
                    }
                  }}
                >
                  <FolderUp size={20} style={{ margin: '0 auto 4px', color: '#60A5FA' }} />
                  <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text-main)' }}>
                    Select or Drop Multiple Files Together
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Select Nodes CSV + Faces/Connectivity CSV, or STL + Temperature CSV
                  </div>
                </div>

                {/* Staged Files List */}
                {stagedFiles.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>STAGED FILES ({stagedFiles.length})</span>
                      <button
                        type="button"
                        onClick={clearStagedFiles}
                        style={{ background: 'transparent', border: 'none', color: '#EF4444', fontSize: 10.5, cursor: 'pointer', padding: 0 }}
                      >
                        Clear All
                      </button>
                    </div>

                    {stagedFiles.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 8px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          fontSize: 11.5,
                        }}
                      >
                        <FileText size={14} style={{ color: 'var(--primary-blue)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>
                            {item.name}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            {(item.size / 1024).toFixed(1)} KB
                          </div>
                        </div>

                        {/* Role Selector Dropdown */}
                        <select
                          value={item.assignedRole}
                          onChange={(e) => updateFileRole(item.id, e.target.value as FileRole)}
                          style={{
                            background: 'rgba(15, 23, 42, 0.8)',
                            color: 'var(--text-main)',
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            padding: '3px 6px',
                            fontSize: 10.5,
                            outline: 'none',
                          }}
                        >
                          <option value="auto">Auto ({item.detectedRole})</option>
                          <option value="nodes">Nodes CSV (Coords & Temp)</option>
                          <option value="faces">Faces CSV (Connectivity)</option>
                          <option value="stl">STL CAD Mesh</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => removeStagedFile(item.id)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                          title="Remove file"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}

                    {/* Staging readiness validation badge */}
                    {(() => {
                      const hasNodes = stagedFiles.some((f) => (f.assignedRole === 'auto' ? f.detectedRole : f.assignedRole) === 'nodes');
                      const hasFaces = stagedFiles.some((f) => (f.assignedRole === 'auto' ? f.detectedRole : f.assignedRole) === 'faces');
                      const hasStl = stagedFiles.some((f) => (f.assignedRole === 'auto' ? f.detectedRole : f.assignedRole) === 'stl');

                      if (hasNodes && hasFaces) {
                        return (
                          <div style={{ fontSize: 11, color: '#10B981', display: 'flex', alignItems: 'center', gap: 5, padding: '4px 6px', background: 'rgba(16,185,129,0.08)', borderRadius: 4 }}>
                            <CheckCircle2 size={13} /> Ready: Nodes file & Faces connectivity file paired.
                          </div>
                        );
                      } else if (hasStl && hasNodes) {
                        return (
                          <div style={{ fontSize: 11, color: '#10B981', display: 'flex', alignItems: 'center', gap: 5, padding: '4px 6px', background: 'rgba(16,185,129,0.08)', borderRadius: 4 }}>
                            <CheckCircle2 size={13} /> Ready: STL CAD mesh & Temperature CSV paired.
                          </div>
                        );
                      } else {
                        return (
                          <div style={{ fontSize: 11, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 5, padding: '4px 6px', background: 'rgba(245,158,11,0.08)', borderRadius: 4 }}>
                            <AlertTriangle size={13} /> Add complementary file ({!hasNodes ? 'Nodes CSV' : !hasFaces ? 'Faces CSV' : 'file'}).
                          </div>
                        );
                      }
                    })()}

                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ flex: 1 }}
                        onClick={processMultiFileImport}
                        disabled={loading || stagedFiles.length < 2}
                      >
                        <Layers size={13} /> Import & Combine Mesh
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => multiFileRef.current?.click()}
                      >
                        Add Files…
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Sample Load Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* CAD STL Section */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                CAD Geometries (STL)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => loadSample('cube_stl')}
                  disabled={loading}
                  title="Unit Cube (12 triangles, 1m × 1m × 1m)"
                >
                  <Box size={13} /> Sample Cube
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => loadSample('cylinder_stl')}
                  disabled={loading}
                  title="Curved Cylinder Manifold (96 triangles)"
                >
                  <Layers size={13} /> Cylinder
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => loadSample('bracket_stl')}
                  disabled={loading}
                  title="Asymmetric L-bracket irregular geometry"
                >
                  <Grid size={13} /> Irregular STL
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => loadSample('large_stl')}
                  disabled={loading}
                  title="High-density manifold (440 triangles)"
                >
                  <Sparkles size={13} /> Large STL
                </button>
              </div>

              {/* Temperature Datasets Section */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 4 }}>
                Temperature Fields (CSV)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => loadSample('cube_27_csv')}
                  disabled={loading}
                  title="3D Structured Cube Grid (27 nodes: 3×3×3)"
                >
                  <Box size={13} /> 3D Cube (27 pts)
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => loadSample('rod_1d_csv')}
                  disabled={loading}
                  title="1D Collinear Analytical Rod (21 nodes)"
                >
                  <Sliders size={13} /> 1D Rod (21 pts)
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => loadSample('plate_2d_csv')}
                  disabled={loading}
                  title="2D Planar Structured Heat Plate (5×4 = 20 nodes)"
                >
                  <Grid size={13} /> 2D Plate (20 pts)
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => loadSample('rect_grid_csv')}
                  disabled={loading}
                  title="Non-Cubic Non-Uniform 3D Grid (4×3×2, -36°C)"
                >
                  <Box size={13} /> Rectilinear 3D
                </button>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => loadSample('unstructured_csv')}
                disabled={loading}
                title="Unstructured Point Cloud (14 scattered sensors without grid connectivity)"
                style={{ width: '100%' }}
              >
                <MousePointer size={13} /> Unstructured Cloud (14 pts)
              </button>

              {/* Hybrid CAD + Thermal Mapping */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 4 }}>
                CAD + Simulation Mapping
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => loadSample('hybrid_cube_temp')}
                disabled={loading}
                title="Map 27-node temperature field directly onto Unit Cube STL mesh"
                style={{ width: '100%', background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)' }}
              >
                <Thermometer size={13} /> Map Temp on Cube STL
              </button>

              {/* Multi-File Meshes (Nodes + Faces CSV) */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 4 }}>
                Multi-File Meshes (Nodes + Faces)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => loadSample('cylinder_multi_mesh')}
                  disabled={loading}
                  title="Multi-File Curved Cylinder: 82 nodes, 160 triangles (Nodes CSV + Faces CSV)"
                >
                  <Layers size={13} /> Cylinder Mesh
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => loadSample('quad_shell_multi_mesh')}
                  disabled={loading}
                  title="Aerodynamic Quad Shell: 30 nodes, 20 quad elements decomposed into 40 triangles"
                >
                  <Box size={13} /> Quad Shell
                </button>
              </div>

              {/* Negative Test Validation */}
              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Negative Tests
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
                style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
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
                <strong>Notice:</strong> {notice}
              </div>
              <button
                onClick={() => setNotice(null)}
                style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {loading && (
            <div className="alert alert-warning" style={{ fontSize: 12.5 }}>
              Processing dataset in numerical engine…
            </div>
          )}

          {/* Multi-File Connected Mesh Info Card */}
          {activeMode === 'multi_mesh' && multiMeshResult && (
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Layers size={16} style={{ color: '#10B981' }} />
                  Connected Mesh Model
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.5)',
                    color: '#34D399',
                  }}
                >
                  MULTI-FILE MESH
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5 }}>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {multiMeshResult.summary}
                </div>

                <div
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Nodes:</span>
                    <span className="mono" style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                      {multiMeshResult.nodeCount}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Elements / Faces:</span>
                    <span className="mono" style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                      {multiMeshResult.faceCount}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Surface Triangles:</span>
                    <span className="mono" style={{ color: '#38BDF8', fontWeight: 600 }}>
                      {multiMeshResult.triangleCount}
                    </span>
                  </div>
                  {multiMeshResult.hasTemperature ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Temperature Range:</span>
                      <span className="mono" style={{ color: '#93C5FD' }}>
                        {multiMeshResult.minT.toFixed(1)}°C → {multiMeshResult.maxT.toFixed(1)}°C
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Field Type:</span>
                      <span style={{ color: 'var(--text-secondary)' }}>Geometric Mesh (No temperature)</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Bounding Box:</span>
                    <span className="mono" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                      {modelDimensions.dx.toFixed(2)} × {modelDimensions.dy.toFixed(2)} × {modelDimensions.dz.toFixed(2)} m
                    </span>
                  </div>
                </div>

                {/* Warnings / Notices */}
                {multiMeshResult.warnings.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {multiMeshResult.warnings.map((w, idx) => (
                      <div key={idx} style={{ color: '#F59E0B', fontSize: 11.5, display: 'flex', gap: 6, alignItems: 'center' }}>
                        <AlertTriangle size={13} style={{ flexShrink: 0 }} /> {w}
                      </div>
                    ))}
                  </div>
                )}

                {/* Node inspection panel */}
                {selectedNode && (
                  <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(71,85,105,0.6)', borderRadius: 8, overflow: 'hidden' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '7px 10px',
                        borderBottom: '1px solid rgba(51,65,85,0.5)',
                        background: 'rgba(255,255,255,0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: '50%',
                            background: '#10B981',
                            boxShadow: '0 0 5px #10B981',
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: 12 }}>
                          Selected Node #{selectedNode.id}
                        </span>
                      </div>
                      <button
                        onClick={() => setSelectedNode(null)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                      >
                        <X size={12} />
                      </button>
                    </div>

                    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11.5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Coordinates (x, y, z):</span>
                        <span className="mono" style={{ color: 'var(--text-main)' }}>
                          [{selectedNode.x.toFixed(3)}, {selectedNode.y.toFixed(3)}, {selectedNode.z.toFixed(3)}] m
                        </span>
                      </div>
                      {multiMeshResult.hasTemperature && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Temperature:</span>
                          <span className="mono" style={{ color: '#FBBF24', fontWeight: 700 }}>
                            {selectedNode.T.toFixed(2)} °C
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Classification & Structure Info Card (When CSV or Hybrid is active) */}
          {csvResult && classificationReport && (
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Thermometer size={16} style={{ color: '#F59E0B' }} />
                  {activeMode === 'stl_temp' ? 'Mapped CAD Thermal Model' : 'Dataset Classification'}
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: `${classificationReport.badgeColor}22`,
                    border: `1px solid ${classificationReport.badgeColor}77`,
                    color: classificationReport.badgeColor,
                  }}
                >
                  {classificationReport.badgeLabel}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5 }}>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {classificationReport.description}
                </div>

                {/* Grid details if structured */}
                {classificationReport.gridInfo && (
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Grid Dimensions:</span>
                      <span className="mono" style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                        {classificationReport.gridInfo.dims.join(' × ')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Grid Spacing:</span>
                      <span style={{ color: 'var(--text-main)' }}>
                        {classificationReport.gridInfo.isUniformSpacing ? 'Uniform' : 'Non-Uniform'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Temperature Range:</span>
                      <span className="mono" style={{ color: '#93C5FD' }}>
                        {csvResult.T_min.toFixed(1)}°C → {csvResult.T_max.toFixed(1)}°C
                      </span>
                    </div>
                  </div>
                )}

                {/* Warning if any */}
                {classificationReport.warning && (
                  <div style={{ color: '#F59E0B', fontSize: 11.5, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <AlertTriangle size={13} /> {classificationReport.warning}
                  </div>
                )}

                {/* Node inspection panel */}
                {selectedNode ? (
                  <div style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(71,85,105,0.6)', borderRadius: 8, overflow: 'hidden' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '7px 10px',
                        borderBottom: '1px solid rgba(51,65,85,0.5)',
                        background: 'rgba(255,255,255,0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: '50%',
                            background: selectedNodeColor ?? '#FBBF24',
                            boxShadow: `0 0 5px ${selectedNodeColor ?? '#FBBF24'}`,
                            flexShrink: 0,
                          }}
                        />
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
                    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                      <div style={{ borderTop: '1px solid rgba(51,65,85,0.4)', paddingTop: 5, marginTop: 2 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 10.5, color: '#94A3B8' }}>Temperature</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: selectedNodeColor ?? '#FBBF24',
                                boxShadow: `0 0 4px ${selectedNodeColor ?? '#FBBF24'}`,
                              }}
                            />
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
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px dashed rgba(51,65,85,0.5)',
                      borderRadius: 6,
                      color: '#64748B',
                      fontSize: 11.5,
                    }}
                  >
                    <MousePointer size={13} style={{ flexShrink: 0, opacity: 0.6 }} />
                    <span>Click any node in viewport to inspect properties</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button className="btn btn-outline btn-sm" onClick={downloadCSV} style={{ flex: 1 }}>
                    <Download size={13} /> Export CSV
                  </button>
                  {stlResult && activeMode === 'csv' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setActiveMode('stl_temp');
                        setVisMode('temperature');
                      }}
                      style={{ flex: 1 }}
                    >
                      <Box size={13} /> Overlay STL
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STL Mesh Details Card */}
          {stlResult && (activeMode === 'stl' || activeMode === 'stl_temp') && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <Info size={16} /> STL Mesh Details
                </span>
                <span className="badge badge-blue">
                  {activeMode === 'stl_temp' ? 'CAD + Thermal' : '3D CAD Solid'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="form-label" style={{ margin: 0 }}>Model Name</span>
                  <span className="mono" style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                    {stlResult.name || 'unnamed_solid'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="form-label" style={{ margin: 0 }}>Triangles</span>
                  <span style={{ fontWeight: 600, color: 'var(--primary-blue)' }}>
                    {stlResult.triangle_count.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="form-label">Dimensions (L × W × H)</span>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--text-main)' }}>
                    {modelDimensions.dx.toFixed(3)}m × {modelDimensions.dy.toFixed(3)}m × {modelDimensions.dz.toFixed(3)}m
                  </div>
                </div>
                <div>
                  <span className="form-label">World Bounds</span>
                  <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Min: [{stlResult.bounds.min.map((v) => v.toFixed(3)).join(', ')}]<br />
                    Max: [{stlResult.bounds.max.map((v) => v.toFixed(3)).join(', ')}]
                  </div>
                </div>

                {activeMode === 'stl' && (
                  <div
                    style={{
                      fontSize: 11.5,
                      color: 'var(--text-secondary)',
                      background: 'rgba(59, 130, 246, 0.06)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 10px',
                      lineHeight: 1.5,
                    }}
                  >
                    💡 <strong>Thermal Simulation:</strong> Standard STL geometry contains triangles without scalar temperatures. Click <strong>Map Temp on Cube STL</strong> above to view continuous thermal simulation mapping.
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
            height: '660px',
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
              top: 12,
              right: 12,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(11, 18, 32, 0.88)',
              padding: '6px 8px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {/* Mode Selectors */}
            {(activeMode === 'stl' || activeMode === 'stl_temp') && (
              <div
                style={{
                  display: 'inline-flex',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: 2,
                  gap: 2,
                }}
              >
                <button
                  className={`btn btn-sm ${visMode === 'solid' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ height: 28, padding: '0 10px', fontSize: 12 }}
                  onClick={() => {
                    setVisMode('solid');
                    if (activeMode === 'stl_temp') setActiveMode('stl');
                  }}
                  title="Solid CAD: studio steel-blue shading with creased normals"
                >
                  <Box size={13} /> Solid
                </button>
                <button
                  className={`btn btn-sm ${visMode === 'faceted' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ height: 28, padding: '0 10px', fontSize: 12 }}
                  onClick={() => {
                    setVisMode('faceted');
                    if (activeMode === 'stl_temp') setActiveMode('stl');
                  }}
                  title="Faceted CAD: visible triangular facet edges"
                >
                  <Layers size={13} /> Faceted
                </button>
                <button
                  className={`btn btn-sm ${visMode === 'wireframe' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ height: 28, padding: '0 10px', fontSize: 12 }}
                  onClick={() => {
                    setVisMode('wireframe');
                    if (activeMode === 'stl_temp') setActiveMode('stl');
                  }}
                  title="Wireframe: triangle mesh outlines"
                >
                  <Grid size={13} /> Wireframe
                </button>
                <button
                  className={`btn btn-sm ${visMode === 'temperature' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ height: 28, padding: '0 10px', fontSize: 12 }}
                  onClick={() => {
                    if (csvResult && stlTemperatureMapping?.success) {
                      setActiveMode('stl_temp');
                      setVisMode('temperature');
                    } else if (csvResult) {
                      setActiveMode('csv');
                      setVisMode('temperature');
                    } else {
                      setNotice('No compatible temperature CSV is loaded. Click "Map Temp on Cube STL" to load a mapped thermal model.');
                    }
                  }}
                  title="Continuous temperature field mapped onto mesh"
                >
                  <Thermometer size={13} /> Temp
                </button>
              </div>
            )}

            {/* Display Style Selector for Temperature CSV mode */}
            {/* Display Style Selector for Temperature CSV mode and Multi-File Connected Mesh */}
            {(activeMode === 'csv' || activeMode === 'multi_mesh') && (
              <div
                style={{
                  display: 'inline-flex',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: 2,
                  gap: 2,
                }}
              >
                <button
                  className={`btn btn-sm ${tempDisplayStyle === 'surface' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ height: 28, padding: '0 9px', fontSize: 11.5 }}
                  onClick={() => setTempDisplayStyle('surface')}
                  title="Continuous solid surface"
                  disabled={activeMode === 'csv' && classificationReport?.type === 'unstructured_cloud'}
                >
                  <Box size={12} /> Surface
                </button>
                <button
                  className={`btn btn-sm ${tempDisplayStyle === 'surface_nodes' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ height: 28, padding: '0 9px', fontSize: 11.5 }}
                  onClick={() => setTempDisplayStyle('surface_nodes')}
                  title="Continuous surface with discrete node markers"
                  disabled={activeMode === 'csv' && classificationReport?.type === 'unstructured_cloud'}
                >
                  <Layers size={12} /> Surface + Nodes
                </button>
                <button
                  className={`btn btn-sm ${tempDisplayStyle === 'nodes_only' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ height: 28, padding: '0 9px', fontSize: 11.5 }}
                  onClick={() => setTempDisplayStyle('nodes_only')}
                  title="Node coordinate points only"
                >
                  <MousePointer size={12} /> Nodes
                </button>
                <button
                  className={`btn btn-sm ${tempDisplayStyle === 'wireframe' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ height: 28, padding: '0 9px', fontSize: 11.5 }}
                  onClick={() => setTempDisplayStyle('wireframe')}
                  title="Element connectivity mesh wireframe"
                  disabled={activeMode === 'csv' && classificationReport?.type === 'unstructured_cloud'}
                >
                  <Grid size={12} /> Wireframe
                </button>
              </div>
            )}

            {/* Reset View Button */}
            <button
              className="btn btn-secondary btn-sm"
              style={{ height: 28, padding: '0 10px', fontSize: 12 }}
              onClick={triggerResetView}
              title="Reset camera to standard Z-up isometric view"
            >
              <RotateCcw size={13} /> Reset View
            </button>
          </div>

          {/* Coordinate System Legend / HUD Indicator */}
          <div
            style={{
              position: 'absolute',
              bottom: 14,
              left: 14,
              zIndex: 10,
              background: 'var(--viewport-hud-bg)',
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
              Grid: XY Ground
            </span>
          </div>

          {/* 3D Canvas with Consistent Z-Up World Frame */}
          <Canvas
            camera={{ position: [3, -3, 2.5], fov: 45, up: [0, 0, 1] }}
            style={{ background: cssVar('--viewport-bg'), width: '100%', height: '100%' }}
            onPointerMissed={() => setSelectedNode(null)}
          >
            <ambientLight intensity={0.65} />
            <directionalLight position={[10, -10, 15]} intensity={0.9} />
            <directionalLight position={[-10, 10, 12]} intensity={0.45} />
            <directionalLight position={[0, 8, -10]} intensity={0.25} />

            {/* STL Mesh */}
            {stlResult && (activeMode === 'stl' || activeMode === 'stl_temp') && (
              <STLMesh
                result={stlResult}
                mode={visMode}
                mappedGeometry={activeMode === 'stl_temp' && visMode === 'temperature' ? stlTemperatureMapping?.geometry : null}
                mappedWireGeometry={activeMode === 'stl_temp' && visMode === 'temperature' ? stlTemperatureMapping?.wireGeometry : null}
                onBoundsCalculated={handleBoundsCalculated}
              />
            )}

            {/* Multi-File Connected Mesh */}
            {multiMeshResult && activeMode === 'multi_mesh' && (
              <ConnectedMeshView
                result={multiMeshResult}
                displayStyle={tempDisplayStyle}
                selectedId={selectedNode?.id ?? null}
                onSelect={(n) => setSelectedNode(n)}
                onBoundsCalculated={handleBoundsCalculated}
              />
            )}

            {/* Scientific Temperature View (CSV Mode) */}
            {csvResult && activeMode === 'csv' && (
              <ScientificTemperatureView
                data={csvResult}
                displayStyle={tempDisplayStyle}
                selectedId={selectedNode?.id ?? null}
                onSelect={(n) => setSelectedNode(n)}
                onBoundsCalculated={handleBoundsCalculated}
              />
            )}

            {/* In STL Temp Mode, also optionally show CSV points floating if selected */}
            {activeMode === 'stl_temp' && csvResult && (
              <ScientificTemperatureView
                data={csvResult}
                displayStyle="nodes_only"
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

            {/* Ground grid – XY plane beneath model */}
            <gridHelper
              args={[gridSize, 20, '#1A2848', '#0F1830']}
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

          {/* Floating Temperature Legend */}
          {((csvResult && (activeMode === 'csv' || (activeMode === 'stl_temp' && visMode === 'temperature'))) ||
            (activeMode === 'multi_mesh' && multiMeshResult && multiMeshResult.hasTemperature)) && (
            <TempLegend
              tMin={activeMode === 'multi_mesh' && multiMeshResult ? multiMeshResult.minT : csvResult!.T_min}
              tMax={activeMode === 'multi_mesh' && multiMeshResult ? multiMeshResult.maxT : csvResult!.T_max}
              selectedT={selectedNode?.T ?? null}
              nodeCount={activeMode === 'multi_mesh' && multiMeshResult ? multiMeshResult.nodeCount : csvResult!.node_count}
              classificationTitle={
                activeMode === 'multi_mesh' && multiMeshResult
                  ? `Connected Multi-File Mesh ("${multiMeshResult.name}")`
                  : activeMode === 'stl_temp'
                  ? `STL Mesh ("${stlResult?.name}") + Mapped Field`
                  : classificationReport?.title || 'Temperature Field'
              }
              badgeColor={activeMode === 'multi_mesh' ? '#10B981' : (classificationReport?.badgeColor || '#3B82F6')}
            />
          )}

          {/* Empty state overlay */}
          {!stlResult && !csvResult && !multiMeshResult && !loading && (
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

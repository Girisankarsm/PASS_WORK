/**
 * Geometry & Scientific Temperature Dataset Classification Engine
 *
 * Intelligently classifies imported 3D datasets into:
 *  1. 1D Structured Beam / Rod (nodes collinear along one primary axis)
 *  2. 2D Structured Planar Grid (Nx × Ny, rectilinear sheet)
 *  3. 3D Structured Rectilinear Volume (Nx × Ny × Nz, Nx, Ny, Nz >= 2)
 *  4. Unstructured Point Cloud (arbitrary point sets lacking tensor-product grid structure)
 *
 * Provides:
 *  - Dynamic grid level detection (Nx, Ny, Nz) with adaptive coordinate clustering
 *  - External boundary surface extraction for 3D/2D structured grids
 *  - Cell-based continuous bilinear/trilinear temperature interpolation
 *  - STL-to-Temperature inverse-distance mapping with bounding-box spatial validation
 */

import * as THREE from 'three';
import type { TempNode, CSVResult, STLResult } from '../types/api';

export type DatasetClassificationType =
  | 'structured_1d'
  | 'structured_2d'
  | 'structured_3d'
  | 'unstructured_cloud';

// Continuous 6-stop scientific temperature colormap:
// 0.00: Deep Blue   (#1D4ED8)
// 0.20: Cyan        (#06B6D4)
// 0.40: Emerald     (#10B981)
// 0.60: Amber/Gold  (#FBBF24)
// 0.80: Orange      (#F97316)
// 1.00: Crimson Red (#EF4444)
export function getTemperatureRgb(tNorm: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, isNaN(tNorm) ? 0.5 : tNorm));
  if (t <= 0.2) {
    const u = t / 0.2;
    return [
      (29 + (6 - 29) * u) / 255,
      (78 + (182 - 78) * u) / 255,
      (216 + (212 - 216) * u) / 255,
    ];
  } else if (t <= 0.4) {
    const u = (t - 0.2) / 0.2;
    return [
      (6 + (16 - 6) * u) / 255,
      (182 + (185 - 182) * u) / 255,
      (212 + (129 - 212) * u) / 255,
    ];
  } else if (t <= 0.6) {
    const u = (t - 0.4) / 0.2;
    return [
      (16 + (251 - 16) * u) / 255,
      (185 + (191 - 185) * u) / 255,
      (129 + (36 - 129) * u) / 255,
    ];
  } else if (t <= 0.8) {
    const u = (t - 0.6) / 0.2;
    return [
      (251 + (249 - 251) * u) / 255,
      (191 + (115 - 191) * u) / 255,
      (36 + (22 - 36) * u) / 255,
    ];
  } else {
    const u = (t - 0.8) / 0.2;
    return [
      (249 + (239 - 249) * u) / 255,
      (115 + (68 - 115) * u) / 255,
      (22 + (68 - 22) * u) / 255,
    ];
  }
}

export function getTemperatureCss(tNorm: number): string {
  const [r, g, b] = getTemperatureRgb(tNorm);
  const h = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export interface StructuredGridInfo {
  type: DatasetClassificationType;
  dims: [number, number, number]; // [Nx, Ny, Nz]
  uniqueX: number[];
  uniqueY: number[];
  uniqueZ: number[];
  isUniformSpacing: boolean;
  nodeCount: number;
  expectedCount: number;
  isComplete: boolean;
  description: string;
  hasDuplicates: boolean;
  duplicateCount: number;
  // 3D lookup: gridNodes[ix][iy][iz]
  gridNodes: (TempNode | null)[][][];
}

export interface ClassificationReport {
  type: DatasetClassificationType;
  title: string;
  badgeLabel: string;
  badgeColor: string;
  description: string;
  gridInfo?: StructuredGridInfo;
  warning?: string;
}

/**
 * Clusters floating point values that are within tolerance of each other.
 */
function clusterCoordinates(values: number[], tol: number): number[] {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const clusters: number[] = [];

  let currentCluster: number[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const val = sorted[i];
    const clusterMean = currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length;
    if (Math.abs(val - clusterMean) <= tol) {
      currentCluster.push(val);
    } else {
      clusters.push(clusterMean);
      currentCluster = [val];
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length);
  }
  return clusters;
}

/**
 * Checks whether steps between consecutive coordinates are uniformly spaced.
 */
function checkUniformSpacing(coords: number[], tol: number): boolean {
  if (coords.length <= 2) return true;
  const steps: number[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    steps.push(coords[i + 1] - coords[i]);
  }
  const meanStep = steps.reduce((a, b) => a + b, 0) / steps.length;
  if (Math.abs(meanStep) < 1e-12) return true;
  for (const s of steps) {
    if (Math.abs(s - meanStep) / Math.abs(meanStep) > 0.02 && Math.abs(s - meanStep) > tol) {
      return false;
    }
  }
  return true;
}

/**
 * Classifies an array of TempNodes.
 */
export function classifyTemperatureDataset(nodes: TempNode[]): ClassificationReport {
  if (!nodes || nodes.length === 0) {
    return {
      type: 'unstructured_cloud',
      title: 'Empty Dataset',
      badgeLabel: 'Empty',
      badgeColor: '#64748B',
      description: 'No temperature nodes provided.',
    };
  }

  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const zs = nodes.map((n) => n.z);

  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const spanZ = maxZ - minZ;
  const maxSpan = Math.max(spanX, spanY, spanZ, 0.001);

  // Adaptive coordinate clustering tolerance
  const coordTol = Math.max(maxSpan * 1e-4, 1e-6);

  const uniqueX = clusterCoordinates(xs, coordTol);
  const uniqueY = clusterCoordinates(ys, coordTol);
  const uniqueZ = clusterCoordinates(zs, coordTol);

  const Nx = uniqueX.length;
  const Ny = uniqueY.length;
  const Nz = uniqueZ.length;
  const expectedCount = Nx * Ny * Nz;

  // Check for duplicate node positions
  const posMap = new Map<string, number>();
  let duplicateCount = 0;
  for (const n of nodes) {
    const kx = Math.round((n.x - minX) / coordTol);
    const ky = Math.round((n.y - minY) / coordTol);
    const kz = Math.round((n.z - minZ) / coordTol);
    const key = `${kx},${ky},${kz}`;
    if (posMap.has(key)) {
      duplicateCount++;
    } else {
      posMap.set(key, n.id);
    }
  }

  // Attempt to build structured 3D grid index
  const gridNodes: (TempNode | null)[][][] = Array.from({ length: Nx }, () =>
    Array.from({ length: Ny }, () => Array.from({ length: Nz }, () => null))
  );

  let populatedCells = 0;
  for (const n of nodes) {
    let bestI = -1, bestDistX = Infinity;
    for (let i = 0; i < Nx; i++) {
      const d = Math.abs(n.x - uniqueX[i]);
      if (d < bestDistX) { bestDistX = d; bestI = i; }
    }
    let bestJ = -1, bestDistY = Infinity;
    for (let j = 0; j < Ny; j++) {
      const d = Math.abs(n.y - uniqueY[j]);
      if (d < bestDistY) { bestDistY = d; bestJ = j; }
    }
    let bestK = -1, bestDistZ = Infinity;
    for (let k = 0; k < Nz; k++) {
      const d = Math.abs(n.z - uniqueZ[k]);
      if (d < bestDistZ) { bestDistZ = d; bestK = k; }
    }

    if (bestDistX <= coordTol * 2 && bestDistY <= coordTol * 2 && bestDistZ <= coordTol * 2) {
      if (gridNodes[bestI][bestJ][bestK] === null) {
        populatedCells++;
      }
      gridNodes[bestI][bestJ][bestK] = n;
    }
  }

  const isCompleteGrid = populatedCells === expectedCount && nodes.length === expectedCount && duplicateCount === 0;
  const isUniform = checkUniformSpacing(uniqueX, coordTol) &&
                    checkUniformSpacing(uniqueY, coordTol) &&
                    checkUniformSpacing(uniqueZ, coordTol);

  const dims: [number, number, number] = [Nx, Ny, Nz];

  // 1D Collinear Beam / Rod: 2 dimensions have length 1, and 1 dimension has length >= 2
  const onesCount = [Nx, Ny, Nz].filter((d) => d === 1).length;

  if (isCompleteGrid && onesCount === 2) {
    const primaryAxis = Nx > 1 ? 'X' : Ny > 1 ? 'Y' : 'Z';
    const numNodes = Math.max(Nx, Ny, Nz);
    const gridInfo: StructuredGridInfo = {
      type: 'structured_1d',
      dims,
      uniqueX,
      uniqueY,
      uniqueZ,
      isUniformSpacing: isUniform,
      nodeCount: nodes.length,
      expectedCount,
      isComplete: true,
      description: `1D Collinear Dataset (${numNodes} nodes along ${primaryAxis}-axis, ${isUniform ? 'uniform' : 'non-uniform'} spacing)`,
      hasDuplicates: duplicateCount > 0,
      duplicateCount,
      gridNodes,
    };
    return {
      type: 'structured_1d',
      title: '1D Collinear Beam / Rod',
      badgeLabel: `1D Rod (${numNodes} pts)`,
      badgeColor: '#06B6D4',
      description: `Structured 1D array along the ${primaryAxis}-axis. Rendered with an analytical thermal continuity spine and exact nodal markers.`,
      gridInfo,
      warning: duplicateCount > 0 ? `Warning: Found ${duplicateCount} duplicate node coordinate(s).` : undefined,
    };
  }

  // 2D Planar Sheet: Exactly 1 dimension has length 1, other two >= 2
  if (isCompleteGrid && onesCount === 1) {
    const flatAxis = Nx === 1 ? 'X' : Ny === 1 ? 'Y' : 'Z';
    const activeDims = [Nx, Ny, Nz].filter((d) => d > 1);
    const gridInfo: StructuredGridInfo = {
      type: 'structured_2d',
      dims,
      uniqueX,
      uniqueY,
      uniqueZ,
      isUniformSpacing: isUniform,
      nodeCount: nodes.length,
      expectedCount,
      isComplete: true,
      description: `2D Planar Grid (${activeDims[0]} × ${activeDims[1]} nodes, normal to ${flatAxis}, ${isUniform ? 'uniform' : 'non-uniform'} spacing)`,
      hasDuplicates: duplicateCount > 0,
      duplicateCount,
      gridNodes,
    };
    return {
      type: 'structured_2d',
      title: '2D Structured Planar Grid',
      badgeLabel: `2D Grid (${activeDims[0]}×${activeDims[1]})`,
      badgeColor: '#10B981',
      description: `Complete 2D structured mesh in ${flatAxis}=constant plane. Rendered as continuous bilinear temperature-colored surface quads.`,
      gridInfo,
      warning: duplicateCount > 0 ? `Warning: Found ${duplicateCount} duplicate node coordinate(s).` : undefined,
    };
  }

  // 3D Rectilinear Volume: All 3 dimensions >= 2
  if (isCompleteGrid && Nx >= 2 && Ny >= 2 && Nz >= 2) {
    const isCube = Nx === Ny && Ny === Nz && Math.abs(spanX - spanY) < coordTol && Math.abs(spanY - spanZ) < coordTol;
    const gridInfo: StructuredGridInfo = {
      type: 'structured_3d',
      dims,
      uniqueX,
      uniqueY,
      uniqueZ,
      isUniformSpacing: isUniform,
      nodeCount: nodes.length,
      expectedCount,
      isComplete: true,
      description: `3D Rectilinear Grid (${Nx} × ${Ny} × ${Nz} = ${nodes.length} nodes, ${isCube ? 'cubic' : 'non-cubic'}, ${isUniform ? 'uniform' : 'non-uniform'} spacing)`,
      hasDuplicates: duplicateCount > 0,
      duplicateCount,
      gridNodes,
    };
    return {
      type: 'structured_3d',
      title: isCube ? '3D Structured Temperature Cube' : '3D Rectilinear Temperature Volume',
      badgeLabel: `3D Grid (${Nx}×${Ny}×${Nz})`,
      badgeColor: '#3B82F6',
      description: `Complete tensor-product volume grid (${Nx}×${Ny}×${Nz}=${nodes.length} nodes). External boundary faces extracted and shaded with continuous trilinear temperature colormap.`,
      gridInfo,
      warning: duplicateCount > 0 ? `Warning: Found ${duplicateCount} duplicate node coordinate(s).` : undefined,
    };
  }

  // Unstructured Point Cloud
  let reason = '';
  if (duplicateCount > 0) {
    reason = `Contains ${duplicateCount} duplicate spatial coordinate(s).`;
  } else if (nodes.length !== expectedCount) {
    reason = `Sparse grid (${nodes.length} nodes present vs ${expectedCount} expected for ${Nx}×${Ny}×${Nz} bounding tensor).`;
  } else {
    reason = `Irregular spatial distribution without constant grid coordinates.`;
  }

  return {
    type: 'unstructured_cloud',
    title: 'Unstructured Temperature Point Cloud',
    badgeLabel: `Point Cloud (${nodes.length} pts)`,
    badgeColor: '#F59E0B',
    description: `Original measured temperature nodes. Points do not form a regular tensor grid (${reason}). Displaying verified measured nodal temperatures without fabricating unverified solid faces.`,
    warning: duplicateCount > 0 ? `Warning: ${duplicateCount} duplicate node position(s) detected.` : undefined,
  };
}

/**
 * Builds continuous temperature-colored 3D Three.js BufferGeometry for structured grids.
 */
export function buildStructuredGridMesh({
  gridInfo,
  tMin,
  tMax,
  center,
}: {
  gridInfo: StructuredGridInfo;
  tMin: number;
  tMax: number;
  center: [number, number, number];
}): {
  surfaceGeometry: THREE.BufferGeometry;
  wireGeometry: THREE.BufferGeometry;
} {
  const { dims, gridNodes } = gridInfo;
  const [Nx, Ny, Nz] = dims;
  const [cx, cy, cz] = center;

  const tRange = tMax - tMin || 1;

  const positions: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];
  const wirePositions: number[] = [];

  const addVertex = (n: TempNode, norm: [number, number, number]) => {
    positions.push(n.x - cx, n.y - cy, n.z - cz);
    const tNorm = (n.T - tMin) / tRange;
    const [r, g, b] = getTemperatureRgb(tNorm);
    colors.push(r, g, b);
    normals.push(norm[0], norm[1], norm[2]);
  };

  const addQuad = (
    n00: TempNode,
    n10: TempNode,
    n11: TempNode,
    n01: TempNode,
    norm: [number, number, number]
  ) => {
    // Triangle 1: n00 -> n10 -> n11
    addVertex(n00, norm);
    addVertex(n10, norm);
    addVertex(n11, norm);

    // Triangle 2: n00 -> n11 -> n01
    addVertex(n00, norm);
    addVertex(n11, norm);
    addVertex(n01, norm);

    // Wireframe edges around the quad cell
    const p00: [number, number, number] = [n00.x - cx, n00.y - cy, n00.z - cz];
    const p10: [number, number, number] = [n10.x - cx, n10.y - cy, n10.z - cz];
    const p11: [number, number, number] = [n11.x - cx, n11.y - cy, n11.z - cz];
    const p01: [number, number, number] = [n01.x - cx, n01.y - cy, n01.z - cz];

    wirePositions.push(...p00, ...p10);
    wirePositions.push(...p10, ...p11);
    wirePositions.push(...p11, ...p01);
    wirePositions.push(...p01, ...p00);
  };

  if (gridInfo.type === 'structured_3d') {
    // 6 External boundary faces with outward normals

    // 1. Min X face (i = 0, outward normal [-1, 0, 0])
    for (let j = 0; j < Ny - 1; j++) {
      for (let k = 0; k < Nz - 1; k++) {
        const n00 = gridNodes[0][j][k];
        const n01 = gridNodes[0][j][k + 1];
        const n11 = gridNodes[0][j + 1][k + 1];
        const n10 = gridNodes[0][j + 1][k];
        if (n00 && n01 && n11 && n10) {
          addQuad(n00, n01, n11, n10, [-1, 0, 0]);
        }
      }
    }

    // 2. Max X face (i = Nx - 1, outward normal [+1, 0, 0])
    for (let j = 0; j < Ny - 1; j++) {
      for (let k = 0; k < Nz - 1; k++) {
        const n00 = gridNodes[Nx - 1][j][k];
        const n10 = gridNodes[Nx - 1][j + 1][k];
        const n11 = gridNodes[Nx - 1][j + 1][k + 1];
        const n01 = gridNodes[Nx - 1][j][k + 1];
        if (n00 && n10 && n11 && n01) {
          addQuad(n00, n10, n11, n01, [1, 0, 0]);
        }
      }
    }

    // 3. Min Y face (j = 0, outward normal [0, -1, 0])
    for (let i = 0; i < Nx - 1; i++) {
      for (let k = 0; k < Nz - 1; k++) {
        const n00 = gridNodes[i][0][k];
        const n10 = gridNodes[i + 1][0][k];
        const n11 = gridNodes[i + 1][0][k + 1];
        const n01 = gridNodes[i][0][k + 1];
        if (n00 && n10 && n11 && n01) {
          addQuad(n00, n10, n11, n01, [0, -1, 0]);
        }
      }
    }

    // 4. Max Y face (j = Ny - 1, outward normal [0, +1, 0])
    for (let i = 0; i < Nx - 1; i++) {
      for (let k = 0; k < Nz - 1; k++) {
        const n00 = gridNodes[i][Ny - 1][k];
        const n01 = gridNodes[i][Ny - 1][k + 1];
        const n11 = gridNodes[i + 1][Ny - 1][k + 1];
        const n10 = gridNodes[i + 1][Ny - 1][k];
        if (n00 && n01 && n11 && n10) {
          addQuad(n00, n01, n11, n10, [0, 1, 0]);
        }
      }
    }

    // 5. Min Z face (k = 0, outward normal [0, 0, -1])
    for (let i = 0; i < Nx - 1; i++) {
      for (let j = 0; j < Ny - 1; j++) {
        const n00 = gridNodes[i][j][0];
        const n01 = gridNodes[i][j + 1][0];
        const n11 = gridNodes[i + 1][j + 1][0];
        const n10 = gridNodes[i + 1][j][0];
        if (n00 && n01 && n11 && n10) {
          addQuad(n00, n01, n11, n10, [0, 0, -1]);
        }
      }
    }

    // 6. Max Z face (k = Nz - 1, outward normal [0, 0, +1])
    for (let i = 0; i < Nx - 1; i++) {
      for (let j = 0; j < Ny - 1; j++) {
        const n00 = gridNodes[i][j][Nz - 1];
        const n10 = gridNodes[i + 1][j][Nz - 1];
        const n11 = gridNodes[i + 1][j + 1][Nz - 1];
        const n01 = gridNodes[i][j + 1][Nz - 1];
        if (n00 && n10 && n11 && n01) {
          addQuad(n00, n10, n11, n01, [0, 0, 1]);
        }
      }
    }
  } else if (gridInfo.type === 'structured_2d') {
    // 2D Sheet across the two non-singular dimensions
    if (Nz === 1) {
      for (let i = 0; i < Nx - 1; i++) {
        for (let j = 0; j < Ny - 1; j++) {
          const n00 = gridNodes[i][j][0];
          const n10 = gridNodes[i + 1][j][0];
          const n11 = gridNodes[i + 1][j + 1][0];
          const n01 = gridNodes[i][j + 1][0];
          if (n00 && n10 && n11 && n01) {
            addQuad(n00, n10, n11, n01, [0, 0, 1]);
          }
        }
      }
    } else if (Ny === 1) {
      for (let i = 0; i < Nx - 1; i++) {
        for (let k = 0; k < Nz - 1; k++) {
          const n00 = gridNodes[i][0][k];
          const n10 = gridNodes[i + 1][0][k];
          const n11 = gridNodes[i + 1][0][k + 1];
          const n01 = gridNodes[i][0][k + 1];
          if (n00 && n10 && n11 && n01) {
            addQuad(n00, n10, n11, n01, [0, 1, 0]);
          }
        }
      }
    } else {
      for (let j = 0; j < Ny - 1; j++) {
        for (let k = 0; k < Nz - 1; k++) {
          const n00 = gridNodes[0][j][k];
          const n10 = gridNodes[0][j + 1][k];
          const n11 = gridNodes[0][j + 1][k + 1];
          const n01 = gridNodes[0][j][k + 1];
          if (n00 && n10 && n11 && n01) {
            addQuad(n00, n10, n11, n01, [1, 0, 0]);
          }
        }
      }
    }
  }

  const surfaceGeom = new THREE.BufferGeometry();
  surfaceGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  surfaceGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  surfaceGeom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  surfaceGeom.computeBoundingBox();
  surfaceGeom.computeBoundingSphere();

  const wireGeom = new THREE.BufferGeometry();
  wireGeom.setAttribute('position', new THREE.Float32BufferAttribute(wirePositions, 3));

  return { surfaceGeometry: surfaceGeom, wireGeometry: wireGeom };
}

/**
 * Validates spatial alignment and maps scalar temperatures from CSV dataset onto an STL triangle mesh.
 */
export function mapTemperatureToSTL({
  stl,
  csv,
}: {
  stl: STLResult;
  csv: CSVResult;
}): {
  success: boolean;
  geometry?: THREE.BufferGeometry;
  wireGeometry?: THREE.BufferGeometry;
  errorMessage?: string;
  warningMessage?: string;
  stats?: {
    triangleCount: number;
    vertexCount: number;
    mappedMinT: number;
    mappedMaxT: number;
    spatialOverlapRatio: number;
  };
} {
  if (!stl || !stl.triangles || stl.triangles.length === 0) {
    return { success: false, errorMessage: 'STL mesh contains no triangles.' };
  }
  if (!csv || !csv.nodes || csv.nodes.length === 0) {
    return { success: false, errorMessage: 'CSV dataset contains no temperature nodes.' };
  }

  // Calculate STL spatial bounds
  const stlMin = stl.bounds.min;
  const stlMax = stl.bounds.max;
  const stlDx = Math.abs(stlMax[0] - stlMin[0]) || 0.001;
  const stlDy = Math.abs(stlMax[1] - stlMin[1]) || 0.001;
  const stlDz = Math.abs(stlMax[2] - stlMin[2]) || 0.001;
  const stlMaxSpan = Math.max(stlDx, stlDy, stlDz);

  // Calculate CSV spatial bounds
  const xs = csv.nodes.map((n) => n.x);
  const ys = csv.nodes.map((n) => n.y);
  const zs = csv.nodes.map((n) => n.z);
  const csvMin = [Math.min(...xs), Math.min(...ys), Math.min(...zs)];
  const csvMax = [Math.max(...xs), Math.max(...ys), Math.max(...zs)];
  const csvDx = Math.abs(csvMax[0] - csvMin[0]) || 0.001;
  const csvDy = Math.abs(csvMax[1] - csvMin[1]) || 0.001;
  const csvDz = Math.abs(csvMax[2] - csvMin[2]) || 0.001;
  const csvMaxSpan = Math.max(csvDx, csvDy, csvDz);

  // 1. Dimensional / Unit Scale Validation
  const scaleRatio = stlMaxSpan / csvMaxSpan;
  if (scaleRatio > 15 || scaleRatio < 0.06) {
    const factor = scaleRatio > 1 ? scaleRatio.toFixed(1) : (1 / scaleRatio).toFixed(1);
    return {
      success: false,
      errorMessage: `Unit or dimension scale mismatch: STL model size (${stlMaxSpan.toFixed(3)}m) and CSV data span (${csvMaxSpan.toFixed(3)}m) differ by ~${factor}×. Verify units (meters vs mm) before mapping.`,
    };
  }

  // 2. Spatial Enclosure / Overlap Validation
  const intersectMin = [
    Math.max(stlMin[0], csvMin[0]),
    Math.max(stlMin[1], csvMin[1]),
    Math.max(stlMin[2], csvMin[2]),
  ];
  const intersectMax = [
    Math.min(stlMax[0], csvMax[0]),
    Math.min(stlMax[1], csvMax[1]),
    Math.min(stlMax[2], csvMax[2]),
  ];

  const margin = stlMaxSpan * 0.25; // allow 25% boundary margin
  const isDisjoint =
    stlMin[0] > csvMax[0] + margin || stlMax[0] < csvMin[0] - margin ||
    stlMin[1] > csvMax[1] + margin || stlMax[1] < csvMin[1] - margin ||
    stlMin[2] > csvMax[2] + margin || stlMax[2] < csvMin[2] - margin;

  if (isDisjoint) {
    return {
      success: false,
      errorMessage: `Spatial mismatch: STL bounding box [[${stlMin.map((v) => v.toFixed(2)).join(',')}], [${stlMax.map((v) => v.toFixed(2)).join(',')}]] and CSV points [[${csvMin.map((v) => v.toFixed(2)).join(',')}], [${csvMax.map((v) => v.toFixed(2)).join(',')}]] do not overlap. Mapping rejected to avoid fabricating false temperature fields.`,
    };
  }

  const overlapVol = Math.max(0, intersectMax[0] - intersectMin[0]) *
                     Math.max(0, intersectMax[1] - intersectMin[1]) *
                     Math.max(0, intersectMax[2] - intersectMin[2]);
  const stlVol = stlDx * stlDy * stlDz;
  const overlapRatio = stlVol > 0 ? Math.min(1.0, overlapVol / stlVol) : 1.0;

  // 3. Interpolate nodal temperatures onto every STL triangle vertex
  const positions: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];

  const tMin = csv.T_min;
  const tMax = csv.T_max;
  const tRange = tMax - tMin || 1;

  const stlCenter = stl.bounds.center;
  const [cx, cy, cz] = stlCenter;

  const kNeighbors = Math.min(6, csv.nodes.length);

  for (const tri of stl.triangles) {
    const fn = tri.n;
    for (const v of [tri.v0, tri.v1, tri.v2]) {
      const vx = v[0], vy = v[1], vz = v[2];
      positions.push(vx - cx, vy - cy, vz - cz);
      normals.push(fn[0], fn[1], fn[2]);

      // Calculate distance to all CSV nodes
      let exactMatchT: number | null = null;
      const dists: { distSq: number; T: number }[] = [];

      for (const n of csv.nodes) {
        const dx = vx - n.x;
        const dy = vy - n.y;
        const dz = vz - n.z;
        const dSq = dx * dx + dy * dy + dz * dz;
        if (dSq < 1e-12) {
          exactMatchT = n.T;
          break;
        }
        dists.push({ distSq: dSq, T: n.T });
      }

      let interpT = tMin;
      if (exactMatchT !== null) {
        interpT = exactMatchT;
      } else {
        dists.sort((a, b) => a.distSq - b.distSq);
        let weightSum = 0;
        let weightedValSum = 0;
        for (let i = 0; i < kNeighbors; i++) {
          const w = 1.0 / dists[i].distSq;
          weightSum += w;
          weightedValSum += w * dists[i].T;
        }
        interpT = weightSum > 0 ? weightedValSum / weightSum : tMin;
      }

      const tNorm = (interpT - tMin) / tRange;
      const [r, g, b] = getTemperatureRgb(tNorm);
      colors.push(r, g, b);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();

  const wireGeom = new THREE.WireframeGeometry(geom);

  let warningMessage: string | undefined;
  if (overlapRatio < 0.6) {
    warningMessage = `Partial coverage: Temperature CSV covers ~${Math.round(overlapRatio * 100)}% of the STL volume. Exterior vertices interpolated via inverse distance weighting.`;
  }

  return {
    success: true,
    geometry: geom,
    wireGeometry: wireGeom,
    warningMessage,
    stats: {
      triangleCount: stl.triangle_count,
      vertexCount: positions.length / 3,
      mappedMinT: tMin,
      mappedMaxT: tMax,
      spatialOverlapRatio: overlapRatio,
    },
  };
}

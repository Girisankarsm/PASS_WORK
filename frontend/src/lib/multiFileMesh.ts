import * as THREE from 'three';
import type { TempNode } from '../types/api';
import { getTemperatureRgb } from './geometryClassification';

export type FileRole = 'auto' | 'nodes' | 'faces' | 'stl';

export interface FileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  detectedRole: 'nodes' | 'faces' | 'stl' | 'unknown';
  assignedRole: FileRole;
  text?: string;
  error?: string;
}

export interface ParsedFace {
  id: string | number;
  v1: string | number;
  v2: string | number;
  v3: string | number;
  v4?: string | number; // optional quad
}

export interface NodesParseResult {
  success: boolean;
  nodes: TempNode[];
  nodeMap: Map<string, TempNode>;
  hasTemperature: boolean;
  minT: number;
  maxT: number;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
    center: [number, number, number];
  };
  errors: string[];
  warnings: string[];
}

export interface FacesParseResult {
  success: boolean;
  faces: ParsedFace[];
  elementCount: number;
  quadCount: number;
  triangleCount: number;
  errors: string[];
  warnings: string[];
}

export interface MultiFileMeshResult {
  success: boolean;
  name: string;
  nodeCount: number;
  faceCount: number;
  triangleCount: number;
  hasTemperature: boolean;
  minT: number;
  maxT: number;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
    center: [number, number, number];
  };
  nodes: TempNode[];
  surfaceGeometry?: THREE.BufferGeometry;
  wireGeometry?: THREE.BufferGeometry;
  errors: string[];
  warnings: string[];
  summary: string;
}

/**
 * Automatically detects the role of a file from its name and content snippet.
 */
export function detectFileRole(fileName: string, content: string): 'nodes' | 'faces' | 'stl' | 'unknown' {
  const lowerName = fileName.toLowerCase();
  const trimmed = content.trim();

  // 1. Check for STL
  if (lowerName.endsWith('.stl') || (trimmed.startsWith('solid') && trimmed.includes('facet'))) {
    return 'stl';
  }

  // 2. Parse first non-empty lines for CSV / Table analysis
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));

  if (lines.length === 0) return 'unknown';

  const firstLine = lines[0].toLowerCase();
  const delimiter = firstLine.includes(',') ? ',' : firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ' ';
  const tokens = firstLine
    .split(delimiter)
    .map((t) => t.trim().replace(/["']/g, '').replace(/[_\s-]/g, ''));

  // Check for node/coordinate columns
  const hasX = tokens.some((t) => ['x', 'xm', 'posx', 'xcoord'].includes(t));
  const hasY = tokens.some((t) => ['y', 'ym', 'posy', 'ycoord'].includes(t));
  const hasZ = tokens.some((t) => ['z', 'zm', 'posz', 'zcoord'].includes(t));
  const hasTemp = tokens.some((t) => ['temperature', 'temperaturec', 'temp', 'tempc', 't'].includes(t));
  const hasNodeId = tokens.some((t) => ['nodeid', 'node', 'nid', 'nodeno'].includes(t));

  // Check for face/triangle connectivity columns
  const hasV1 = tokens.some((t) => ['v1', 'n1', 'node1', 'p1', 'i1', 'vertex1'].includes(t));
  const hasV2 = tokens.some((t) => ['v2', 'n2', 'node2', 'p2', 'i2', 'vertex2'].includes(t));
  const hasV3 = tokens.some((t) => ['v3', 'n3', 'node3', 'p3', 'i3', 'vertex3'].includes(t));
  const hasFaceId = tokens.some((t) => ['triangleid', 'faceid', 'elementid', 'elemid', 'cellid', 'triid'].includes(t));

  if ((hasV1 && hasV2 && hasV3) || hasFaceId) {
    return 'faces';
  }

  if ((hasX && hasY && hasZ) || hasNodeId || hasTemp) {
    return 'nodes';
  }

  // Fallback heuristics from filename
  if (/face|tri|conn|elem|cell/i.test(lowerName)) return 'faces';
  if (/node|coord|point|temp/i.test(lowerName)) return 'nodes';

  // Fallback heuristics: check line data (integers vs floating coordinates)
  if (lines.length > 1) {
    const dataTokens = lines[1]
      .split(delimiter)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    const areAllIntegers = dataTokens.every((t) => /^-?\d+$/.test(t));
    if (areAllIntegers && (dataTokens.length === 3 || dataTokens.length === 4 || dataTokens.length === 5)) {
      return 'faces';
    }
  }

  return 'unknown';
}

/**
 * Parses Node coordinates and optional temperature attribute from CSV text.
 */
export function parseNodesText(text: string): NodesParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));

  if (lines.length === 0) {
    return {
      success: false,
      nodes: [],
      nodeMap: new Map(),
      hasTemperature: false,
      minT: 0,
      maxT: 0,
      bounds: { min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0] },
      errors: ['Nodes file is empty.'],
      warnings: [],
    };
  }

  const delimiter = lines[0].includes(',') ? ',' : lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : /\s+/;
  const headerTokens = lines[0].split(delimiter).map((t) => t.trim().toLowerCase().replace(/["']/g, ''));

  // Detect column mapping
  let idCol = -1;
  let xCol = -1;
  let yCol = -1;
  let zCol = -1;
  let tempCol = -1;

  for (let i = 0; i < headerTokens.length; i++) {
    const t = headerTokens[i].replace(/[_\s-]/g, '');
    if (['nodeid', 'id', 'node', 'nid', 'nodeno'].includes(t) && idCol === -1) idCol = i;
    else if (['xm', 'x', 'xcoord', 'posx'].includes(t) && xCol === -1) xCol = i;
    else if (['ym', 'y', 'ycoord', 'posy'].includes(t) && yCol === -1) yCol = i;
    else if (['zm', 'z', 'zcoord', 'posz'].includes(t) && zCol === -1) zCol = i;
    else if (['temperaturec', 'temperature', 'tempc', 'temp', 't', 'val', 'value'].includes(t) && tempCol === -1) tempCol = i;
  }

  let startRow = 1;
  // If no header matches, assume [id, x, y, z, temp?] or [x, y, z, temp?]
  if (xCol === -1 || yCol === -1 || zCol === -1) {
    const firstRowTokens = lines[0].split(delimiter).map((t) => t.trim());
    if (firstRowTokens.length >= 4 && !isNaN(Number(firstRowTokens[1])) && !isNaN(Number(firstRowTokens[2]))) {
      idCol = 0;
      xCol = 1;
      yCol = 2;
      zCol = 3;
      tempCol = firstRowTokens.length >= 5 ? 4 : -1;
      startRow = 0;
    } else if (firstRowTokens.length >= 3 && !isNaN(Number(firstRowTokens[0]))) {
      idCol = -1;
      xCol = 0;
      yCol = 1;
      zCol = 2;
      tempCol = firstRowTokens.length >= 4 ? 3 : -1;
      startRow = 0;
    } else {
      return {
        success: false,
        nodes: [],
        nodeMap: new Map(),
        hasTemperature: false,
        minT: 0,
        maxT: 0,
        bounds: { min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0] },
        errors: [`Could not identify X, Y, Z coordinates from header: "${lines[0]}"`],
        warnings: [],
      };
    }
  }

  const nodes: TempNode[] = [];
  const nodeMap = new Map<string, TempNode>();
  const seenIds = new Set<string>();
  let duplicateCount = 0;

  for (let lineIdx = startRow; lineIdx < lines.length; lineIdx++) {
    const rawTokens = lines[lineIdx].split(delimiter).map((t) => t.trim().replace(/["']/g, ''));
    if (rawTokens.length < 3) continue;

    const x = Number(rawTokens[xCol]);
    const y = Number(rawTokens[yCol]);
    const z = Number(rawTokens[zCol]);

    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      warnings.push(`Row ${lineIdx + 1}: Skipped row due to invalid coordinates (${rawTokens[xCol]}, ${rawTokens[yCol]}, ${rawTokens[zCol]})`);
      continue;
    }

    const rawId = idCol >= 0 && idCol < rawTokens.length ? rawTokens[idCol] : String(nodes.length + 1);
    const numId = Number(rawId);
    const id = !isNaN(numId) ? numId : nodes.length + 1;

    const idKey = String(rawId);
    if (seenIds.has(idKey)) {
      duplicateCount++;
      warnings.push(`Row ${lineIdx + 1}: Duplicate node ID "${idKey}" detected.`);
    }
    seenIds.add(idKey);

    let temp = 20.0;
    if (tempCol >= 0 && tempCol < rawTokens.length) {
      const parsedTemp = Number(rawTokens[tempCol]);
      if (!isNaN(parsedTemp)) {
        temp = parsedTemp;
      }
    }

    const node: TempNode = { id, x, y, z, T: temp };
    nodes.push(node);
    nodeMap.set(idKey, node);
    // Also index numeric ID if distinct
    if (!isNaN(numId)) {
      nodeMap.set(String(numId), node);
    }
  }

  if (nodes.length === 0) {
    errors.push('No valid node coordinate records could be parsed.');
    return {
      success: false,
      nodes: [],
      nodeMap: new Map(),
      hasTemperature: false,
      minT: 0,
      maxT: 0,
      bounds: { min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0] },
      errors,
      warnings,
    };
  }

  if (duplicateCount > 0) {
    warnings.unshift(`Detected ${duplicateCount} duplicate node ID(s). Latter values overwrote earlier ones in lookup table.`);
  }

  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const zs = nodes.map((n) => n.z);
  const ts = nodes.map((n) => n.T);

  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);

  const hasTemperature = tempCol >= 0;
  const minT = hasTemperature ? Math.min(...ts) : 0;
  const maxT = hasTemperature ? Math.max(...ts) : 0;

  return {
    success: true,
    nodes,
    nodeMap,
    hasTemperature,
    minT,
    maxT,
    bounds: {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
      center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
    },
    errors,
    warnings,
  };
}

/**
 * Parses Face / Element connectivity records from CSV text.
 */
export function parseFacesText(text: string): FacesParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));

  if (lines.length === 0) {
    return {
      success: false,
      faces: [],
      elementCount: 0,
      quadCount: 0,
      triangleCount: 0,
      errors: ['Faces / connectivity file is empty.'],
      warnings: [],
    };
  }

  const delimiter = lines[0].includes(',') ? ',' : lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : /\s+/;
  const headerTokens = lines[0].split(delimiter).map((t) => t.trim().toLowerCase().replace(/["']/g, ''));

  let faceIdCol = -1;
  let v1Col = -1;
  let v2Col = -1;
  let v3Col = -1;
  let v4Col = -1;

  for (let i = 0; i < headerTokens.length; i++) {
    const t = headerTokens[i].replace(/[_\s-]/g, '');
    if (['triangleid', 'faceid', 'elementid', 'elemid', 'cellid', 'id'].includes(t) && faceIdCol === -1) {
      faceIdCol = i;
    } else if (['v1', 'n1', 'node1', 'vertex1', 'p1', 'i1'].includes(t) && v1Col === -1) {
      v1Col = i;
    } else if (['v2', 'n2', 'node2', 'vertex2', 'p2', 'i2'].includes(t) && v2Col === -1) {
      v2Col = i;
    } else if (['v3', 'n3', 'node3', 'vertex3', 'p3', 'i3'].includes(t) && v3Col === -1) {
      v3Col = i;
    } else if (['v4', 'n4', 'node4', 'vertex4', 'p4', 'i4'].includes(t) && v4Col === -1) {
      v4Col = i;
    }
  }

  let startRow = 1;
  if (v1Col === -1 || v2Col === -1 || v3Col === -1) {
    // Check if first line contains numbers directly
    const firstRowTokens = lines[0].split(delimiter).map((t) => t.trim());
    if (firstRowTokens.length >= 4 && !isNaN(Number(firstRowTokens[0]))) {
      faceIdCol = 0;
      v1Col = 1;
      v2Col = 2;
      v3Col = 3;
      v4Col = firstRowTokens.length >= 5 ? 4 : -1;
      startRow = 0;
    } else if (firstRowTokens.length >= 3 && !isNaN(Number(firstRowTokens[0]))) {
      faceIdCol = -1;
      v1Col = 0;
      v2Col = 1;
      v3Col = 2;
      v4Col = firstRowTokens.length >= 4 ? 3 : -1;
      startRow = 0;
    } else {
      return {
        success: false,
        faces: [],
        elementCount: 0,
        quadCount: 0,
        triangleCount: 0,
        errors: [`Could not determine face vertex columns (v1, v2, v3) from header: "${lines[0]}"`],
        warnings: [],
      };
    }
  }

  const faces: ParsedFace[] = [];
  let quadCount = 0;
  let triangleCount = 0;

  for (let lineIdx = startRow; lineIdx < lines.length; lineIdx++) {
    const rawTokens = lines[lineIdx].split(delimiter).map((t) => t.trim().replace(/["']/g, ''));
    if (rawTokens.length < 3) continue;

    const v1 = rawTokens[v1Col];
    const v2 = rawTokens[v2Col];
    const v3 = rawTokens[v3Col];
    const v4 = v4Col >= 0 && v4Col < rawTokens.length && rawTokens[v4Col] !== '' ? rawTokens[v4Col] : undefined;

    if (!v1 || !v2 || !v3) continue;

    const faceId = faceIdCol >= 0 && faceIdCol < rawTokens.length ? rawTokens[faceIdCol] : faces.length + 1;

    if (v4 !== undefined) {
      quadCount++;
      triangleCount += 2; // quad splits into 2 triangles
    } else {
      triangleCount++;
    }

    faces.push({ id: faceId, v1, v2, v3, v4 });
  }

  if (faces.length === 0) {
    errors.push('No valid face or element connectivity records could be parsed.');
    return {
      success: false,
      faces: [],
      elementCount: 0,
      quadCount: 0,
      triangleCount: 0,
      errors,
      warnings,
    };
  }

  return {
    success: true,
    faces,
    elementCount: faces.length,
    quadCount,
    triangleCount,
    errors,
    warnings,
  };
}

/**
 * Combines parsed Nodes and Faces into a coherent 3D scientific mesh.
 */
export function combineNodesAndFaces({
  nodesResult,
  facesResult,
  meshName,
}: {
  nodesResult: NodesParseResult;
  facesResult: FacesParseResult;
  meshName: string;
}): MultiFileMeshResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!nodesResult.success) {
    return {
      success: false,
      name: meshName,
      nodeCount: 0,
      faceCount: 0,
      triangleCount: 0,
      hasTemperature: false,
      minT: 0,
      maxT: 0,
      bounds: { min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0] },
      nodes: [],
      errors: nodesResult.errors,
      warnings: nodesResult.warnings,
      summary: 'Failed to parse node coordinates.',
    };
  }

  if (!facesResult.success) {
    return {
      success: false,
      name: meshName,
      nodeCount: nodesResult.nodes.length,
      faceCount: 0,
      triangleCount: 0,
      hasTemperature: nodesResult.hasTemperature,
      minT: nodesResult.minT,
      maxT: nodesResult.maxT,
      bounds: nodesResult.bounds,
      nodes: nodesResult.nodes,
      errors: facesResult.errors,
      warnings: [...nodesResult.warnings, ...facesResult.warnings],
      summary: 'Failed to parse face connectivity.',
    };
  }

  const { nodeMap, nodes, bounds, hasTemperature, minT, maxT } = nodesResult;
  const [cx, cy, cz] = bounds.center;
  const tRange = maxT - minT || 1.0;

  const positions: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];
  const wirePositions: number[] = [];

  const missingNodeRefs = new Set<string>();
  let degenerateCount = 0;
  let validTriangles = 0;

  const addTriangle = (p1: TempNode, p2: TempNode, p3: TempNode, faceId: string | number) => {
    // 1. Check for degenerate coincident vertices
    const d12Sq = (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2;
    const d23Sq = (p2.x - p3.x) ** 2 + (p2.y - p3.y) ** 2 + (p2.z - p3.z) ** 2;
    const d31Sq = (p3.x - p1.x) ** 2 + (p3.y - p1.y) ** 2 + (p3.z - p1.z) ** 2;

    if (d12Sq < 1e-12 || d23Sq < 1e-12 || d31Sq < 1e-12) {
      degenerateCount++;
      return;
    }

    // 2. Normal vector via cross product
    const ax = p2.x - p1.x;
    const ay = p2.y - p1.y;
    const az = p2.z - p1.z;
    const bx = p3.x - p1.x;
    const by = p3.y - p1.y;
    const bz = p3.z - p1.z;

    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

    if (len < 1e-12) {
      // Degenerate collinear triangle
      degenerateCount++;
      return;
    }

    nx /= len;
    ny /= len;
    nz /= len;

    // 3. Add 3 vertices (centered around bounding box center for orbit controls stability)
    const triNodes = [p1, p2, p3];
    for (const n of triNodes) {
      positions.push(n.x - cx, n.y - cy, n.z - cz);
      normals.push(nx, ny, nz);

      if (hasTemperature) {
        const tNorm = (n.T - minT) / tRange;
        const [r, g, b] = getTemperatureRgb(tNorm);
        colors.push(r, g, b);
      } else {
        // Engineering neutral steel tint [0.72, 0.77, 0.85]
        colors.push(0.72, 0.77, 0.85);
      }
    }

    // 4. Wireframe lines along 3 edges
    wirePositions.push(
      p1.x - cx, p1.y - cy, p1.z - cz,  p2.x - cx, p2.y - cy, p2.z - cz,
      p2.x - cx, p2.y - cy, p2.z - cz,  p3.x - cx, p3.y - cy, p3.z - cz,
      p3.x - cx, p3.y - cy, p3.z - cz,  p1.x - cx, p1.y - cy, p1.z - cz
    );

    validTriangles++;
  };

  for (const face of facesResult.faces) {
    const k1 = String(face.v1).trim();
    const k2 = String(face.v2).trim();
    const k3 = String(face.v3).trim();

    const n1 = nodeMap.get(k1);
    const n2 = nodeMap.get(k2);
    const n3 = nodeMap.get(k3);

    if (!n1) missingNodeRefs.add(k1);
    if (!n2) missingNodeRefs.add(k2);
    if (!n3) missingNodeRefs.add(k3);

    if (!n1 || !n2 || !n3) {
      continue;
    }

    if (face.v4 !== undefined) {
      const k4 = String(face.v4).trim();
      const n4 = nodeMap.get(k4);
      if (!n4) {
        missingNodeRefs.add(k4);
        continue;
      }
      // Quad split into 2 triangles: (n1, n2, n3) and (n1, n3, n4)
      addTriangle(n1, n2, n3, face.id);
      addTriangle(n1, n3, n4, face.id);
    } else {
      addTriangle(n1, n2, n3, face.id);
    }
  }

  if (missingNodeRefs.size > 0) {
    const missingList = Array.from(missingNodeRefs).slice(0, 8).join(', ');
    const moreNotice = missingNodeRefs.size > 8 ? ` and ${missingNodeRefs.size - 8} more` : '';
    errors.push(
      `Face connectivity references ${missingNodeRefs.size} undefined node ID(s): [${missingList}${moreNotice}]. Faces referencing missing nodes were skipped.`
    );
  }

  if (degenerateCount > 0) {
    warnings.push(`Skipped ${degenerateCount} degenerate or zero-area triangle(s).`);
  }

  if (validTriangles === 0) {
    errors.push('No valid triangles could be constructed from the provided node coordinates and connectivity.');
    return {
      success: false,
      name: meshName,
      nodeCount: nodes.length,
      faceCount: facesResult.faces.length,
      triangleCount: 0,
      hasTemperature,
      minT,
      maxT,
      bounds,
      nodes,
      errors,
      warnings: [...nodesResult.warnings, ...facesResult.warnings, ...warnings],
      summary: 'Mesh construction failed: 0 valid triangles generated.',
    };
  }

  // Build Three.js BufferGeometries
  const surfaceGeometry = new THREE.BufferGeometry();
  surfaceGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  surfaceGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  surfaceGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const wireGeometry = new THREE.BufferGeometry();
  wireGeometry.setAttribute('position', new THREE.Float32BufferAttribute(wirePositions, 3));

  const summary = `Constructed ${validTriangles} connected triangles (${nodes.length} nodes, ${facesResult.elementCount} elements) ${
    hasTemperature ? `with temperature scale [${minT.toFixed(1)}°C to ${maxT.toFixed(1)}°C]` : 'with geometric shading'
  }.`;

  return {
    success: true,
    name: meshName,
    nodeCount: nodes.length,
    faceCount: facesResult.faces.length,
    triangleCount: validTriangles,
    hasTemperature,
    minT,
    maxT,
    bounds,
    nodes,
    surfaceGeometry,
    wireGeometry,
    errors,
    warnings: [...nodesResult.warnings, ...facesResult.warnings, ...warnings],
    summary,
  };
}

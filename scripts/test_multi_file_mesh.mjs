#!/usr/bin/env node
/**
 * Automated Verification for Multi-File Mesh Import, Role Identification,
 * Connectivity Resolution, Quad Splitting, and Diagnostics
 */

import assert from 'node:assert';

// ── Temperature Colormap ───────────────────────────────────────────────────
function getTemperatureRgb(tNorm) {
  const t = Math.max(0, Math.min(1, isNaN(tNorm) ? 0.5 : tNorm));
  if (t <= 0.2) {
    const u = t / 0.2;
    return [(29 + (6 - 29) * u) / 255, (78 + (182 - 78) * u) / 255, (216 + (212 - 216) * u) / 255];
  } else if (t <= 0.4) {
    const u = (t - 0.2) / 0.2;
    return [(6 + (16 - 6) * u) / 255, (182 + (185 - 182) * u) / 255, (212 + (129 - 212) * u) / 255];
  } else if (t <= 0.6) {
    const u = (t - 0.4) / 0.2;
    return [(16 + (251 - 16) * u) / 255, (185 + (191 - 185) * u) / 255, (129 + (36 - 129) * u) / 255];
  } else if (t <= 0.8) {
    const u = (t - 0.6) / 0.2;
    return [(251 + (249 - 251) * u) / 255, (191 + (115 - 191) * u) / 255, (36 + (22 - 36) * u) / 255];
  } else {
    const u = (t - 0.8) / 0.2;
    return [(249 + (239 - 249) * u) / 255, (115 + (68 - 115) * u) / 255, (22 + (68 - 22) * u) / 255];
  }
}

// ── Role Auto-Detection ────────────────────────────────────────────────────
function detectFileRole(fileName, content) {
  const lowerName = fileName.toLowerCase();
  const trimmed = content.trim();

  if (lowerName.endsWith('.stl') || (trimmed.startsWith('solid') && trimmed.includes('facet'))) {
    return 'stl';
  }

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

  const hasX = tokens.some((t) => ['x', 'xm', 'posx', 'xcoord'].includes(t));
  const hasY = tokens.some((t) => ['y', 'ym', 'posy', 'ycoord'].includes(t));
  const hasZ = tokens.some((t) => ['z', 'zm', 'posz', 'zcoord'].includes(t));
  const hasTemp = tokens.some((t) => ['temperature', 'temperaturec', 'temp', 'tempc', 't'].includes(t));
  const hasNodeId = tokens.some((t) => ['nodeid', 'node', 'nid', 'nodeno'].includes(t));

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

  if (/face|tri|conn|elem|cell/i.test(lowerName)) return 'faces';
  if (/node|coord|point|temp/i.test(lowerName)) return 'nodes';

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

// ── Nodes CSV Parsing ─────────────────────────────────────────────────────
function parseNodesText(text) {
  const errors = [];
  const warnings = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));

  if (lines.length === 0) {
    return { success: false, nodes: [], nodeMap: new Map(), hasTemperature: false, errors: ['Nodes file is empty.'], warnings: [] };
  }

  const delimiter = lines[0].includes(',') ? ',' : lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : /\s+/;
  const headerTokens = lines[0].split(delimiter).map((t) => t.trim().toLowerCase().replace(/["']/g, ''));

  let idCol = -1, xCol = -1, yCol = -1, zCol = -1, tempCol = -1;

  for (let i = 0; i < headerTokens.length; i++) {
    const t = headerTokens[i].replace(/[_\s-]/g, '');
    if (['nodeid', 'id', 'node', 'nid', 'nodeno'].includes(t) && idCol === -1) idCol = i;
    else if (['xm', 'x', 'xcoord', 'posx'].includes(t) && xCol === -1) xCol = i;
    else if (['ym', 'y', 'ycoord', 'posy'].includes(t) && yCol === -1) yCol = i;
    else if (['zm', 'z', 'zcoord', 'posz'].includes(t) && zCol === -1) zCol = i;
    else if (['temperaturec', 'temperature', 'tempc', 'temp', 't', 'val', 'value'].includes(t) && tempCol === -1) tempCol = i;
  }

  let startRow = 1;
  if (xCol === -1 || yCol === -1 || zCol === -1) {
    const firstRowTokens = lines[0].split(delimiter).map((t) => t.trim());
    if (firstRowTokens.length >= 4 && !isNaN(Number(firstRowTokens[1])) && !isNaN(Number(firstRowTokens[2]))) {
      idCol = 0; xCol = 1; yCol = 2; zCol = 3;
      tempCol = firstRowTokens.length >= 5 ? 4 : -1;
      startRow = 0;
    } else {
      return { success: false, nodes: [], nodeMap: new Map(), hasTemperature: false, errors: ['Header missing coordinates'], warnings: [] };
    }
  }

  const nodes = [];
  const nodeMap = new Map();
  const seenIds = new Set();
  let duplicateCount = 0;

  for (let lineIdx = startRow; lineIdx < lines.length; lineIdx++) {
    const rawTokens = lines[lineIdx].split(delimiter).map((t) => t.trim().replace(/["']/g, ''));
    if (rawTokens.length < 3) continue;

    const x = Number(rawTokens[xCol]);
    const y = Number(rawTokens[yCol]);
    const z = Number(rawTokens[zCol]);

    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      warnings.push(`Row ${lineIdx + 1}: Skipped row due to invalid coordinates`);
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
      if (!isNaN(parsedTemp)) temp = parsedTemp;
    }

    const node = { id, x, y, z, T: temp };
    nodes.push(node);
    nodeMap.set(idKey, node);
    if (!isNaN(numId)) nodeMap.set(String(numId), node);
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
    success: nodes.length > 0,
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

// ── Faces CSV Parsing ─────────────────────────────────────────────────────
function parseFacesText(text) {
  const errors = [];
  const warnings = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));

  if (lines.length === 0) {
    return { success: false, faces: [], elementCount: 0, quadCount: 0, triangleCount: 0, errors: ['Faces file empty'], warnings: [] };
  }

  const delimiter = lines[0].includes(',') ? ',' : lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : /\s+/;
  const headerTokens = lines[0].split(delimiter).map((t) => t.trim().toLowerCase().replace(/["']/g, ''));

  let faceIdCol = -1, v1Col = -1, v2Col = -1, v3Col = -1, v4Col = -1;

  for (let i = 0; i < headerTokens.length; i++) {
    const t = headerTokens[i].replace(/[_\s-]/g, '');
    if (['triangleid', 'faceid', 'elementid', 'elemid', 'cellid', 'id'].includes(t) && faceIdCol === -1) faceIdCol = i;
    else if (['v1', 'n1', 'node1', 'vertex1', 'p1', 'i1'].includes(t) && v1Col === -1) v1Col = i;
    else if (['v2', 'n2', 'node2', 'vertex2', 'p2', 'i2'].includes(t) && v2Col === -1) v2Col = i;
    else if (['v3', 'n3', 'node3', 'vertex3', 'p3', 'i3'].includes(t) && v3Col === -1) v3Col = i;
    else if (['v4', 'n4', 'node4', 'vertex4', 'p4', 'i4'].includes(t) && v4Col === -1) v4Col = i;
  }

  let startRow = 1;
  if (v1Col === -1 || v2Col === -1 || v3Col === -1) {
    const firstRowTokens = lines[0].split(delimiter).map((t) => t.trim());
    if (firstRowTokens.length >= 4 && !isNaN(Number(firstRowTokens[0]))) {
      faceIdCol = 0; v1Col = 1; v2Col = 2; v3Col = 3;
      v4Col = firstRowTokens.length >= 5 ? 4 : -1;
      startRow = 0;
    } else {
      return { success: false, faces: [], elementCount: 0, quadCount: 0, triangleCount: 0, errors: ['Header missing v1, v2, v3'], warnings: [] };
    }
  }

  const faces = [];
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
      triangleCount += 2;
    } else {
      triangleCount++;
    }

    faces.push({ id: faceId, v1, v2, v3, v4 });
  }

  return {
    success: faces.length > 0,
    faces,
    elementCount: faces.length,
    quadCount,
    triangleCount,
    errors,
    warnings,
  };
}

// ── Combine Nodes and Faces ────────────────────────────────────────────────
function combineNodesAndFaces({ nodesResult, facesResult, meshName }) {
  if (!nodesResult.success || !facesResult.success) {
    return { success: false, triangleCount: 0, errors: [...(nodesResult.errors || []), ...(facesResult.errors || [])], warnings: [] };
  }

  const { nodeMap, nodes, bounds, hasTemperature, minT, maxT } = nodesResult;
  const missingNodeRefs = new Set();
  let degenerateCount = 0;
  let validTriangles = 0;
  const triangleNormals = [];

  const addTriangle = (p1, p2, p3) => {
    const d12Sq = (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2;
    const d23Sq = (p2.x - p3.x) ** 2 + (p2.y - p3.y) ** 2 + (p2.z - p3.z) ** 2;
    const d31Sq = (p3.x - p1.x) ** 2 + (p3.y - p1.y) ** 2 + (p3.z - p1.z) ** 2;

    if (d12Sq < 1e-12 || d23Sq < 1e-12 || d31Sq < 1e-12) {
      degenerateCount++;
      return;
    }

    const ax = p2.x - p1.x, ay = p2.y - p1.y, az = p2.z - p1.z;
    const bx = p3.x - p1.x, by = p3.y - p1.y, bz = p3.z - p1.z;

    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

    if (len < 1e-12) {
      degenerateCount++;
      return;
    }

    triangleNormals.push([nx / len, ny / len, nz / len]);
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

    if (!n1 || !n2 || !n3) continue;

    if (face.v4 !== undefined) {
      const k4 = String(face.v4).trim();
      const n4 = nodeMap.get(k4);
      if (!n4) {
        missingNodeRefs.add(k4);
        continue;
      }
      addTriangle(n1, n2, n3);
      addTriangle(n1, n3, n4);
    } else {
      addTriangle(n1, n2, n3);
    }
  }

  const errors = [];
  const warnings = [...nodesResult.warnings, ...facesResult.warnings];

  if (missingNodeRefs.size > 0) {
    const missingList = Array.from(missingNodeRefs).slice(0, 8).join(', ');
    errors.push(`Face connectivity references ${missingNodeRefs.size} undefined node ID(s): [${missingList}].`);
  }

  if (degenerateCount > 0) {
    warnings.push(`Skipped ${degenerateCount} degenerate or zero-area triangle(s).`);
  }

  return {
    success: validTriangles > 0,
    name: meshName,
    nodeCount: nodes.length,
    faceCount: facesResult.faces.length,
    triangleCount: validTriangles,
    triangleNormals,
    hasTemperature,
    minT,
    maxT,
    bounds,
    errors,
    warnings,
  };
}

// ── Test Execution ─────────────────────────────────────────────────────────

console.log('=== Multi-File Mesh Import & Validation Test Suite ===\n');

let passCount = 0;
let failCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    ${err.message}`);
    failCount++;
  }
}

// Test Datasets
const CYLINDER_NODES = `node_id,x_m,y_m,z_m,temperature_C
1,0.5000,0.0000,0.0000,25.00
2,0.4619,0.1913,0.0000,32.65
3,0.3536,0.3536,0.0000,39.14
4,0.1913,0.4619,0.0000,43.48
5,0.0000,0.5000,0.0000,45.00
6,0.0000,0.0000,0.0000,25.00
7,0.0000,0.0000,1.0000,105.00
`;

const CYLINDER_FACES = `triangle_id,v1,v2,v3
1,6,2,1
2,6,3,2
3,6,4,3
4,6,5,4
`;

const QUAD_ELEMENTS = `element_id,v1,v2,v3,v4
1,1,2,4,3
2,3,4,6,5
`;

// 1. Role Auto-Detection
runTest('Role auto-detection identifies nodes CSV correctly', () => {
  const role = detectFileRole('nodes.csv', CYLINDER_NODES);
  assert.strictEqual(role, 'nodes');
});

runTest('Role auto-detection identifies faces CSV correctly', () => {
  const role = detectFileRole('connectivity.csv', CYLINDER_FACES);
  assert.strictEqual(role, 'faces');
});

runTest('Role auto-detection identifies quad elements CSV correctly', () => {
  const role = detectFileRole('elements.csv', QUAD_ELEMENTS);
  assert.strictEqual(role, 'faces');
});

runTest('Role auto-detection identifies STL mesh file correctly', () => {
  const role = detectFileRole('model.stl', 'solid test\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid test\n');
  assert.strictEqual(role, 'stl');
});

// 2. Nodes Parsing
runTest('parseNodesText parses 7 nodes with temperature range [25°C, 105°C]', () => {
  const res = parseNodesText(CYLINDER_NODES);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.nodes.length, 7);
  assert.strictEqual(res.hasTemperature, true);
  assert.strictEqual(res.minT, 25.0);
  assert.strictEqual(res.maxT, 105.0);
});

runTest('parseNodesText handles custom headers and detects duplicate IDs', () => {
  const dupCsv = 'id,x,y,z,T\n1,0,0,0,20\n2,1,0,0,30\n1,0,0,0,25\n';
  const res = parseNodesText(dupCsv);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.nodes.length, 3);
  assert.strictEqual(res.warnings.length > 0, true);
  assert.match(res.warnings[0], /duplicate/i);
});

// 3. Faces Parsing
runTest('parseFacesText parses 4 triangle elements', () => {
  const res = parseFacesText(CYLINDER_FACES);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.faces.length, 4);
  assert.strictEqual(res.triangleCount, 4);
  assert.strictEqual(res.quadCount, 0);
});

runTest('parseFacesText parses quad elements and calculates triangle split count', () => {
  const res = parseFacesText(QUAD_ELEMENTS);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.faces.length, 2);
  assert.strictEqual(res.quadCount, 2);
  assert.strictEqual(res.triangleCount, 4); // 2 quads * 2 = 4 triangles
});

// 4. Mesh Combination & Normal Computation
runTest('combineNodesAndFaces builds coherent surface mesh with non-zero normals', () => {
  const nodes = parseNodesText(CYLINDER_NODES);
  const faces = parseFacesText(CYLINDER_FACES);
  const combined = combineNodesAndFaces({
    nodesResult: nodes,
    facesResult: faces,
    meshName: 'Cylinder Test',
  });

  assert.strictEqual(combined.success, true);
  assert.strictEqual(combined.nodeCount, 7);
  assert.strictEqual(combined.triangleCount, 4);
  assert.strictEqual(combined.hasTemperature, true);
  assert.strictEqual(combined.triangleNormals.length, 4);
  // Verify unit normals
  for (const n of combined.triangleNormals) {
    const len = Math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2);
    assert.ok(Math.abs(len - 1.0) < 1e-6);
  }
});

runTest('combineNodesAndFaces decomposes quads into 4 triangles', () => {
  const quadNodes = `node_id,x,y,z,T
1,0,0,0,20
2,1,0,0,30
3,0,1,0,40
4,1,1,0,50
5,0,2,0,60
6,1,2,0,70
`;
  const nodes = parseNodesText(quadNodes);
  const faces = parseFacesText(QUAD_ELEMENTS);
  const combined = combineNodesAndFaces({
    nodesResult: nodes,
    facesResult: faces,
    meshName: 'Quad Shell Test',
  });

  assert.strictEqual(combined.success, true);
  assert.strictEqual(combined.nodeCount, 6);
  assert.strictEqual(combined.triangleCount, 4);
});

// 5. Validation & Error Diagnostics
runTest('combineNodesAndFaces reports clear error when faces reference missing node IDs', () => {
  const nodes = parseNodesText('node_id,x_m,y_m,z_m,temperature_C\n1,0,0,0,20\n2,1,0,0,20\n3,0,1,0,20\n');
  const brokenFaces = parseFacesText('triangle_id,v1,v2,v3\n1,1,2,3\n2,1,2,999\n'); // 999 does not exist
  const combined = combineNodesAndFaces({
    nodesResult: nodes,
    facesResult: brokenFaces,
    meshName: 'Missing Node Test',
  });

  assert.strictEqual(combined.triangleCount, 1);
  assert.strictEqual(combined.errors.length > 0, true);
  assert.match(combined.errors[0], /999/);
});

runTest('combineNodesAndFaces skips degenerate zero-area triangles and logs warnings', () => {
  const nodes = parseNodesText('node_id,x_m,y_m,z_m,temperature_C\n1,0,0,0,20\n2,1,0,0,20\n3,0,1,0,20\n');
  const degenFaces = parseFacesText('triangle_id,v1,v2,v3\n1,1,2,3\n2,1,1,2\n3,1,2,2\n'); // 2 & 3 have duplicate vertices
  const combined = combineNodesAndFaces({
    nodesResult: nodes,
    facesResult: degenFaces,
    meshName: 'Degenerate Test',
  });

  assert.strictEqual(combined.triangleCount, 1);
  assert.strictEqual(combined.warnings.some((w) => /degenerate/i.test(w)), true);
});

console.log('\n==========================================');
console.log(`TOTAL: ${passCount + failCount} tests | ${passCount} PASS | ${failCount} FAIL\n`);
if (failCount > 0) process.exit(1);

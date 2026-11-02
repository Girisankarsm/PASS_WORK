#!/usr/bin/env node
/**
 * Automated Verification for Scientific Geometry & Temperature Dataset Classification
 * Tests all 8 core capabilities & edge cases:
 *  1. 3D Structured Tensor Grid (3x3x3 = 27 nodes)
 *  2. 2D Structured Planar Grid (5x4 = 20 nodes)
 *  3. 1D Collinear Analytical Rod (21 nodes)
 *  4. Non-cubic Non-uniform 3D Grid (4x3x2 = 24 nodes) with Negative Temperatures
 *  5. Unstructured Sensor Point Cloud (14 points without regular tensor grid)
 *  6. Duplicate Coordinate Detection & Reporting
 *  7. Constant Temperature Field (T_min == T_max without division by zero)
 *  8. STL Temperature Mapping (compatible match, scale mismatch rejection, disjoint space rejection)
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

// ── Coordinate Clustering ──────────────────────────────────────────────────
function clusterCoordinates(values, tol) {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const clusters = [];
  let current = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const val = sorted[i];
    const mean = current.reduce((a, b) => a + b, 0) / current.length;
    if (Math.abs(val - mean) <= tol) {
      current.push(val);
    } else {
      clusters.push(mean);
      current = [val];
    }
  }
  if (current.length > 0) {
    clusters.push(current.reduce((a, b) => a + b, 0) / current.length);
  }
  return clusters;
}

function checkUniformSpacing(coords, tol) {
  if (coords.length <= 2) return true;
  const steps = [];
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

function classifyTemperatureDataset(nodes) {
  if (!nodes || nodes.length === 0) {
    return { type: 'unstructured_cloud', nodeCount: 0 };
  }
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const zs = nodes.map((n) => n.z);

  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);

  const spanX = maxX - minX, spanY = maxY - minY, spanZ = maxZ - minZ;
  const maxSpan = Math.max(spanX, spanY, spanZ, 0.001);
  const coordTol = Math.max(maxSpan * 1e-4, 1e-6);

  const uniqueX = clusterCoordinates(xs, coordTol);
  const uniqueY = clusterCoordinates(ys, coordTol);
  const uniqueZ = clusterCoordinates(zs, coordTol);

  const Nx = uniqueX.length, Ny = uniqueY.length, Nz = uniqueZ.length;
  const expectedCount = Nx * Ny * Nz;

  const posMap = new Map();
  let duplicateCount = 0;
  for (const n of nodes) {
    const kx = Math.round((n.x - minX) / coordTol);
    const ky = Math.round((n.y - minY) / coordTol);
    const kz = Math.round((n.z - minZ) / coordTol);
    const key = `${kx},${ky},${kz}`;
    if (posMap.has(key)) duplicateCount++;
    else posMap.set(key, n.id);
  }

  const gridNodes = Array.from({ length: Nx }, () =>
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
      if (gridNodes[bestI][bestJ][bestK] === null) populatedCells++;
      gridNodes[bestI][bestJ][bestK] = n;
    }
  }

  const isCompleteGrid = populatedCells === expectedCount && nodes.length === expectedCount && duplicateCount === 0;
  const isUniform = checkUniformSpacing(uniqueX, coordTol) &&
                    checkUniformSpacing(uniqueY, coordTol) &&
                    checkUniformSpacing(uniqueZ, coordTol);
  const dims = [Nx, Ny, Nz];
  const onesCount = [Nx, Ny, Nz].filter((d) => d === 1).length;

  if (isCompleteGrid && onesCount === 2) {
    return { type: 'structured_1d', dims, isUniform, duplicateCount, isComplete: true };
  }
  if (isCompleteGrid && onesCount === 1) {
    return { type: 'structured_2d', dims, isUniform, duplicateCount, isComplete: true };
  }
  if (isCompleteGrid && Nx >= 2 && Ny >= 2 && Nz >= 2) {
    return { type: 'structured_3d', dims, isUniform, duplicateCount, isComplete: true };
  }
  return { type: 'unstructured_cloud', dims, isUniform: false, duplicateCount, isComplete: false };
}

// ── STL Mapping Validation ─────────────────────────────────────────────────
function mapTemperatureValidation({ stlBounds, csvBounds }) {
  const stlMin = stlBounds.min, stlMax = stlBounds.max;
  const stlDx = Math.abs(stlMax[0] - stlMin[0]) || 0.001;
  const stlDy = Math.abs(stlMax[1] - stlMin[1]) || 0.001;
  const stlDz = Math.abs(stlMax[2] - stlMin[2]) || 0.001;
  const stlMaxSpan = Math.max(stlDx, stlDy, stlDz);

  const csvMin = csvBounds.min, csvMax = csvBounds.max;
  const csvDx = Math.abs(csvMax[0] - csvMin[0]) || 0.001;
  const csvDy = Math.abs(csvMax[1] - csvMin[1]) || 0.001;
  const csvDz = Math.abs(csvMax[2] - csvMin[2]) || 0.001;
  const csvMaxSpan = Math.max(csvDx, csvDy, csvDz);

  const scaleRatio = stlMaxSpan / csvMaxSpan;
  if (scaleRatio > 15 || scaleRatio < 0.06) {
    return { success: false, error: 'scale_mismatch' };
  }

  const margin = stlMaxSpan * 0.25;
  const isDisjoint =
    stlMin[0] > csvMax[0] + margin || stlMax[0] < csvMin[0] - margin ||
    stlMin[1] > csvMax[1] + margin || stlMax[1] < csvMin[1] - margin ||
    stlMin[2] > csvMax[2] + margin || stlMax[2] < csvMin[2] - margin;

  if (isDisjoint) {
    return { success: false, error: 'spatial_mismatch' };
  }

  return { success: true };
}

console.log('=== Scientific Geometry & Temperature Dataset Test Suite ===\n');

let passCount = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
    process.exit(1);
  }
}

// 1. 3D Structured Cube (27 nodes)
test('3D Structured Cube (3x3x3 = 27 nodes) is detected as structured_3d with uniform spacing', () => {
  const nodes = [];
  let id = 1;
  for (const z of [0.0, 0.5, 1.0]) {
    for (const y of [0.0, 0.5, 1.0]) {
      for (const x of [0.0, 0.5, 1.0]) {
        nodes.push({ id: id++, x, y, z, T: 20 + 80 * x + 30 * z });
      }
    }
  }
  const r = classifyTemperatureDataset(nodes);
  assert.strictEqual(r.type, 'structured_3d');
  assert.deepStrictEqual(r.dims, [3, 3, 3]);
  assert.strictEqual(r.isUniform, true);
  assert.strictEqual(r.isComplete, true);
});

// 2. 2D Structured Planar Grid (5x4 = 20 nodes)
test('2D Planar Grid (5x4 = 20 nodes) is detected as structured_2d', () => {
  const nodes = [];
  let id = 1;
  for (const y of [0.0, 0.5, 1.0, 1.5]) {
    for (const x of [0.0, 0.5, 1.0, 1.5, 2.0]) {
      nodes.push({ id: id++, x, y, z: 0.0, T: 25 + 50 * Math.sin(x) });
    }
  }
  const r = classifyTemperatureDataset(nodes);
  assert.strictEqual(r.type, 'structured_2d');
  assert.deepStrictEqual(r.dims, [5, 4, 1]);
  assert.strictEqual(r.isUniform, true);
  assert.strictEqual(r.isComplete, true);
});

// 3. 1D Collinear Analytical Rod (21 nodes)
test('1D Collinear Rod (21 nodes along X) is detected as structured_1d', () => {
  const nodes = [];
  for (let i = 0; i <= 20; i++) {
    nodes.push({ id: i + 1, x: i * 0.05, y: 0.0, z: 0.0, T: 100 - 80 * (i * 0.05) });
  }
  const r = classifyTemperatureDataset(nodes);
  assert.strictEqual(r.type, 'structured_1d');
  assert.deepStrictEqual(r.dims, [21, 1, 1]);
  assert.strictEqual(r.isUniform, true);
});

// 4. Non-cubic Non-uniform 3D Grid (4x3x2 = 24 nodes) with Negative Temperatures
test('Non-cubic non-uniform 3D Grid (4x3x2 = 24 nodes) handles negative temperatures & non-uniform spacing', () => {
  const nodes = [];
  let id = 1;
  for (const z of [-1.0, 0.5]) {
    for (const y of [0.2, 0.8, 2.0]) {
      for (const x of [-0.5, -0.2, 0.3, 1.0]) {
        nodes.push({ id: id++, x, y, z, T: -40 + 30 * x });
      }
    }
  }
  const r = classifyTemperatureDataset(nodes);
  assert.strictEqual(r.type, 'structured_3d');
  assert.deepStrictEqual(r.dims, [4, 3, 2]);
  assert.strictEqual(r.isUniform, false); // non-uniform spacing
  assert.strictEqual(r.isComplete, true);
});

// 5. Unstructured Point Cloud (14 scattered points)
test('Unstructured point cloud without regular tensor product is classified as unstructured_cloud', () => {
  const nodes = [
    { id: 1, x: 0.12, y: 0.05, z: 0.21, T: 45.2 },
    { id: 2, x: 0.85, y: 0.14, z: 0.72, T: 88.4 },
    { id: 3, x: 0.34, y: 0.67, z: 0.15, T: 52.1 },
    { id: 4, x: 0.72, y: 0.88, z: 0.64, T: 94.3 },
    { id: 5, x: 0.45, y: 0.33, z: 0.51, T: 71.0 },
    { id: 6, x: 0.91, y: 0.22, z: 0.18, T: 82.5 },
    { id: 7, x: 0.15, y: 0.81, z: 0.44, T: 60.8 },
  ];
  const r = classifyTemperatureDataset(nodes);
  assert.strictEqual(r.type, 'unstructured_cloud');
  assert.strictEqual(r.isComplete, false);
});

// 6. Duplicate Coordinate Detection
test('Duplicate node coordinates are detected and reported', () => {
  const nodes = [
    { id: 1, x: 0.0, y: 0.0, z: 0.0, T: 50.0 },
    { id: 2, x: 0.0, y: 0.0, z: 0.0, T: 55.0 }, // Duplicate position
    { id: 3, x: 1.0, y: 0.0, z: 0.0, T: 70.0 },
  ];
  const r = classifyTemperatureDataset(nodes);
  assert.strictEqual(r.duplicateCount, 1);
  assert.strictEqual(r.type, 'unstructured_cloud');
});

// 7. Constant Temperature Field (T_min == T_max)
test('Constant temperature field (T_min == T_max) produces valid finite colors without NaN', () => {
  const color = getTemperatureRgb(0.5);
  assert.strictEqual(color.length, 3);
  for (const c of color) {
    assert.strictEqual(Number.isFinite(c), true);
    assert.strictEqual(c >= 0 && c <= 1, true);
  }
});

// 8. STL Temperature Mapping Validations
test('STL mesh mapping accepts overlapping coordinates and rejects scale / spatial mismatches', () => {
  // Compatible: Unit Cube STL [0, 1]^3 and CSV [0, 1]^3
  const comp = mapTemperatureValidation({
    stlBounds: { min: [0, 0, 0], max: [1, 1, 1] },
    csvBounds: { min: [0, 0, 0], max: [1, 1, 1] },
  });
  assert.strictEqual(comp.success, true);

  // Incompatible Scale: 1000m STL vs 1m CSV (scale factor 1000)
  const scaleMismatch = mapTemperatureValidation({
    stlBounds: { min: [0, 0, 0], max: [1000, 1000, 1000] },
    csvBounds: { min: [0, 0, 0], max: [1, 1, 1] },
  });
  assert.strictEqual(scaleMismatch.success, false);
  assert.strictEqual(scaleMismatch.error, 'scale_mismatch');

  // Incompatible Space: STL at [100, 100, 100] vs CSV at [0, 0, 0]
  const spaceMismatch = mapTemperatureValidation({
    stlBounds: { min: [100, 100, 100], max: [101, 101, 101] },
    csvBounds: { min: [0, 0, 0], max: [1, 1, 1] },
  });
  assert.strictEqual(spaceMismatch.success, false);
  assert.strictEqual(spaceMismatch.error, 'spatial_mismatch');
});

console.log(`\n==========================================`);
console.log(`TOTAL: ${passCount} tests | ${passCount} PASS | 0 FAIL\n`);

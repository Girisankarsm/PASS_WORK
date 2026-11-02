# AI-Use Disclosure & Verification Statement
**Pass Science Works R&D Internship 2026–2027**  
**Candidate**: RA2311003012331

---

## 1. Tools and Models Utilized

| Tool / Model | Role |
|:---|:---|
| **Google Antigravity Agentic IDE** | Integrated coding environment managing multi-file edits, terminal execution, and diff application |
| **Google Gemini 2.5 Flash** | Primary model: rapid C++ boilerplate, React component scaffolding, and documentation structuring |
| **Anthropic Claude Sonnet 3.7** | Secondary model: cross-validation of gradient derivations, test suite design, edge-case hardening |

**Primary AI Use Cases**: Rapid boilerplate generation, Three.js canvas setup, CSS color token styling, HTTP route skeleton, and documentation drafting.

---

## 2. Representative Prompts & Actual Outputs

### Example 1: C++ Thermal FEA Element Assembly
- **Prompt issued**: *"Implement 1D steady-state heat conduction finite element method in C++17. Use 2-node linear elements with length h. Assemble element stiffness matrix (kA/h)*[[1,-1],[-1,1]] and element load vector (qAh/2)*[1,1] into a global system. Apply Dirichlet boundary conditions T(0)=T0 and T(L)=TL. Solve with Gaussian elimination."*
- **Model Output**: Produced a C++ function assembling the global stiffness matrix and load vector correctly, then applying BCs by zeroing only the **column** of the boundary node in K and adjusting the right-hand side.
- **Defect Identified by Candidate**: The partial BC enforcement left the off-diagonal row entry K[n][n-1] = -kA/h non-zero. During Gaussian elimination, this corrupted the last nodal equation, giving T(L) ≈ 20.73°C instead of the prescribed 20.0°C. This was caught by the automated test `[BC: T(L)=20°C]` which failed.
- **Candidate Correction Applied**: Explicitly added a row zeroing loop `for(int j=0; j<n+1; j++) K[n][j] = 0.0;` followed by `K[n][n] = 1.0; F[n] = T_L;`. Re-ran tests → PASS.

### Example 2: React Three.js Geometry Viewer
- **Prompt issued**: *"Create a React component using Three.js (via @react-three/fiber) that parses an array of triangles from a C++ API response and renders them as a BufferGeometry Mesh with orbit controls."*
- **Model Output**: Produced a basic `<Canvas>` component with `<Mesh>` and `<OrbitControls>`. The geometry was built directly from raw triangle vertex data without computing normals or centering the geometry.
- **Defects Identified by Candidate**:
  1. No bounding-box centering: large models rendered off-center with the camera pointed at origin.
  2. No auto-camera fitting: small models were too far away; large models clipped the near plane.
  3. Vertex normals were absent, causing flat shading artifacts.
- **Candidate Corrections Applied**:
  - Added bounding box computation and geometry centering via `geometry.translate(-cx, -cy, -cz)`.
  - Added smart camera distance calculation: `camera.position.z = boundingRadius * 1.8`.
  - Added `geometry.computeVertexNormals()` after triangle upload for smooth shading.

### Example 3: Multithreaded Benchmark Design
- **Prompt issued**: *"Write a C++17 function that runs a batch of 1D FEA thermal problems in parallel using std::thread. Use a fixed seed=42 for reproducibility. Generate n_cases problems with random k and q. Divide them across p threads using static partitioning. Run 1 warm-up batch, then 5 measured repetitions. Report median time, speedup, and efficiency."*
- **Model Output**: Generated a `run_benchmark` function that created threads and partitioned correctly, but generated the random problem set **inside** each thread, not from a shared pre-generated vector.
- **Defect Identified by Candidate**: Serial and parallel runs generated different random sequences because each thread called the RNG independently. The "numerical agreement" check therefore compared unrelated problems, producing meaningless ΔT values.
- **Candidate Correction Applied**: Moved random problem generation to a single pre-run phase: `std::vector<CaseParams> cases = generate_cases(n_cases, seed);`. Passed `cases` as a const reference to worker threads. Numerical agreement then dropped to ≤ 1.4×10⁻¹⁵ °C (floating-point round-off only).

---

## 3. Unsuitable AI Suggestions Identified & Corrected

### Unsuitable Suggestion 1: Incomplete Dirichlet Boundary Condition (Critical)
- **Context**: Thermal FEA solver boundary condition enforcement.
- **AI Suggestion**: Zero only the column of the boundary row in K; adjust F[i] -= K[i][n]*T_L for interior rows.
- **Identified Defect**: Row n of K still had K[n][n-1] = -kA/h. Gaussian elimination corrupted T(L), giving 20.73°C.
- **How Caught**: Automated unit test `[BC: T(L)=20°C]` failed with assertion: `|T[n] - 20.0| < 1e-10`.
- **Correction**: Zero entire row n, set K[n][n]=1.0, F[n]=T_L. All tests pass.

### Unsuitable Suggestion 2: CSV Header Comment Handling (Data Integrity)
- **Context**: ANSYS-schema temperature CSV parser.
- **AI Suggestion**: Read first line directly as column header without skipping comments.
- **Identified Defect**: Datasets with `#` metadata preamble (e.g., `temperature_rod.csv`) caused HTTP 400 errors in production because the first non-blank line was `# Synthetic 1D FEM solution`, not the header row.
- **How Caught**: Manually testing the parser with actual sample data files.
- **Correction**: Added a pre-header loop: `while(getline(ss, line)) { if(!line.empty() && line[0]!='#') break; }`. Tested with all 9 CSV datasets.

### Unsuitable Suggestion 3: Random Seed Sharing in Parallel Benchmark (Correctness)
- **Context**: Serial/parallel benchmark numerical agreement check.
- **AI Suggestion**: Seed RNG inside each thread function.
- **Identified Defect**: Threads generated independent random sequences; serial and parallel solved different problems. Agreement check was meaningless.
- **How Caught**: Inspected the generated problem vectors from serial and parallel runs — they differed.
- **Correction**: Generate all cases once before threading, share as `const std::vector<CaseParams>&`.

---

## 4. Challenge Test: AI Hallucination on Analytical Gradient

**Test performed**: Prompted the AI: *"Verify the analytical gradient ∂J/∂w = (ŷ-y)·v·(1-h²)·x using the chain rule for J = 0.5(ŷ-y)², ŷ = vh+c, h = tanh(wx+b)."*

**Model Response**: The model derived the correct expression but made an arithmetic error in the numerical evaluation step, computing h² = tanh²(0.5) = 0.2135... as 0.2158... (approximately 1% error).

**Outcome**: The finite-difference gradient check in `tests/test_main.cpp` confirmed the analytical gradient was correct via the C++ implementation. The model's arithmetic error was identified as an AI hallucination in manual calculation, not in the code. The automated test `[NN: Gradient check passes (max error <= 1e-5)]` passed with actual error = 3.8×10⁻¹¹.

---

## 5. Verification Evidence & Quality Assurance

| Verification Type | Method | Result |
|:---|:---|:---|
| FEA boundary conditions | Automated test `BC: T(L)=20°C` | PASS — error < 10⁻¹⁰ °C |
| O(h²) convergence | Error ratio table (10/20/40/80 elem) | Ratio = 4.000 exact |
| Gradient correctness | Central FD check ε=10⁻⁶ | max error 3.8×10⁻¹¹ ≪ 10⁻⁵ |
| Parallel agreement | ΔT serial vs 4-thread | ≤ 1.4×10⁻¹⁵ °C |
| Full test suite | `./build/workbench_tests` | 128/128 PASS |
| TypeScript | `npx tsc --noEmit` | 0 errors |
| Production build | `npm run build` | 2790 modules, 0 errors |

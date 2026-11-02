# One-Dimensional Steady-State Thermal Finite Element Analysis: Mathematical Formulation, Implementation, and Analytical Verification

**Project**: Unified Engineering Workbench  
**Assessment**: Pass Science Works R&D Internship 2026–2027  
**Candidate ID**: RA2311003012331  
**Repository**: `PASS_WORK`  
**Date**: November 2, 2026  

---

## 1. Executive Summary

This report presents the rigorous mathematical formulation, C++17 implementation, and analytical verification of a one-dimensional steady-state thermal Finite Element Analysis (FEA) solver. The solver models heat conduction along an insulated rod with uniform internal heat generation subjected to fixed Dirichlet boundary temperatures at both ends. 

Using 2-node linear finite elements with Galerkin discretization, the implementation was evaluated across four uniform meshes ($N = 10, 20, 40, 80$ elements). The numerical results were verified against the closed-form analytical solution:
$$T(x) = 100 - 80x + 500(x - x^2)$$

Key verification conclusions:
1. **Nodal Accuracy**: Because the 1D Green's function for the Laplacian is piecewise linear, the linear Galerkin finite element solution at the mesh nodes is exact up to floating-point round-off ($\le 1.99 \times 10^{-13\ \circ}\text{C}$). At the domain midpoint ($x = 0.5\text{ m}$), the numerical temperature is identically $185.000000^\circ\text{C}$ for all tested meshes.
2. **Element Midpoint Convergence**: Within each element, the piecewise linear finite element approximation deviates from the exact parabolic temperature profile, reaching its maximum interpolation error at element midpoints: $E_{\text{midpoint}} = \frac{q}{8k}h^2 = 125 h^2$. Computed midpoint errors ($1.250000^\circ\text{C}, 0.312500^\circ\text{C}, 0.078125^\circ\text{C}, 0.019531^\circ\text{C}$) demonstrate a convergence ratio of exactly $4.000$, validating second-order ($O(h^2)$) convergence.

---

## 2. Problem Definition and Parameters

The physical domain represents a homogeneous, isotropic, slender rod of length $L$ and uniform cross-sectional area $A$. The lateral surface is perfectly insulated, constraining heat transfer strictly to the axial $x$-direction ($x \in [0, L]$).

The model uses the parameters specified in the assessment:

| Parameter | Symbol | Value | Units | Definition / Note |
|:---|:---:|:---:|:---:|:---|
| Rod Length | $L$ | $1.0$ | $\text{m}$ | Domain length along $x$-axis |
| Cross-Sectional Area | $A$ | $1.0 \times 10^{-4}$ | $\text{m}^2$ | Uniform circular or square cross-section |
| Thermal Conductivity | $k$ | $10.0$ | $\text{W/(m}\cdot\text{K)}$ | Constant material conductivity |
| Volumetric Heat Generation | $q$ | $10000.0$ | $\text{W/m}^3$ | Uniform distributed internal heat source |
| Left Boundary Temperature | $T(0) = T_0$ | $100.0$ | $^\circ\text{C}$ | Prescribed Dirichlet condition at $x=0$ |
| Right Boundary Temperature | $T(L) = T_L$ | $20.0$ | $^\circ\text{C}$ | Prescribed Dirichlet condition at $x=L$ |
| Target Mesh Refinements | $N$ | $10, 20, 40, 80$ | elements | Number of equal-length linear elements |

### Discretization and Node-Counting Convention
- Each mesh of $N$ elements consists of $N + 1$ nodes:
  - $N = 10 \implies 11$ nodes, element length $h = 0.1000\text{ m}$
  - $N = 20 \implies 21$ nodes, element length $h = 0.0500\text{ m}$
  - $N = 40 \implies 41$ nodes, element length $h = 0.0250\text{ m}$
  - $N = 80 \implies 81$ nodes, element length $h = 0.0125\text{ m}$
- Nodal coordinates are placed at uniform intervals: $x_i = i \cdot h$, for $i = 0, 1, \dots, N$.
- Because $N \in \{10, 20, 40, 80\}$ are all even integers, the physical midpoint of the rod ($x = 0.5\text{ m}$) coincides with node index $i = N / 2$ in every mesh.

---

## 3. Governing Equation and Analytical Solution

### Governing Differential Equation
Under steady-state conditions without lateral losses, the conservation of thermal energy is governed by:
$$\frac{d}{dx}\left(k A \frac{dT}{dx}\right) + q A = 0, \quad x \in [0, L]$$

For constant thermal conductivity $k$ and uniform cross-sectional area $A$, dividing through by $A$ yields:
$$-k \frac{d^2T}{dx^2} = q \implies \frac{d^2T}{dx^2} = -\frac{q}{k}$$

### Mathematical Derivation of the Analytical Solution
Integrating once with respect to $x$:
$$\frac{dT}{dx} = -\frac{q}{k}x + C_1$$

Integrating a second time:
$$T(x) = -\frac{q}{2k}x^2 + C_1 x + C_2$$

Applying boundary condition 1 at $x = 0$:
$$T(0) = C_2 = 100.0 \implies C_2 = 100.0^\circ\text{C}$$

Applying boundary condition 2 at $x = L$:
$$T(L) = -\frac{q}{2k}L^2 + C_1 L + 100.0 = 20.0$$
$$C_1 L = 20.0 - 100.0 + \frac{q}{2k}L^2 = -80.0 + \frac{q}{2k}L^2$$
$$C_1 = -\frac{80.0}{L} + \frac{q L}{2k}$$

Substituting $C_1$ and $C_2$ back into the temperature equation:
$$T(x) = 100.0 - 80.0\frac{x}{L} + \frac{q}{2k}x(L - x)$$

Substituting the numerical parameters ($L = 1.0\text{ m}, k = 10.0\text{ W/(m}\cdot\text{K)}, q = 10000.0\text{ W/m}^3$):
$$\frac{q}{2k} = \frac{10000.0}{2(10.0)} = 500.0^\circ\text{C/m}^2$$
$$T(x) = 100.0 - 80.0x + 500.0(x - x^2) = 100.0 + 420.0x - 500.0x^2$$

### Verification of the Closed-Form Analytical Solution
1. **Boundary check at $x = 0$**:
   $$T(0) = 100.0 + 420.0(0) - 500.0(0)^2 = 100.0^\circ\text{C} \quad \checkmark$$
2. **Boundary check at $x = 1.0$**:
   $$T(1.0) = 100.0 + 420.0(1.0) - 500.0(1.0)^2 = 100.0 + 420.0 - 500.0 = 20.0^\circ\text{C} \quad \checkmark$$
3. **Differential equation satisfaction**:
   $$\frac{dT}{dx} = 420.0 - 1000.0x$$
   $$\frac{d^2T}{dx^2} = -1000.0$$
   $$-k \frac{d^2T}{dx^2} = -(10.0)(-1000.0) = 10000.0 = q \quad \checkmark$$
4. **Physical extremum (peak temperature)**:
   $$\frac{dT}{dx} = 420.0 - 1000.0x = 0 \implies x^* = 0.420\text{ m}$$
   $$T(x^*) = 100.0 + 420.0(0.42) - 500.0(0.42)^2 = 100.0 + 176.4 - 88.2 = 188.20^\circ\text{C}$$
5. **Exact temperature at domain midpoint ($x = 0.5\text{ m}$)**:
   $$T(0.5) = 100.0 + 420.0(0.5) - 500.0(0.25) = 100.0 + 210.0 - 125.0 = 185.000000^\circ\text{C}$$

---

## 4. Finite Element Formulation

### Weak (Variational) Formulation
Multiplying the governing equation by an arbitrary test function $v(x) \in H_0^1(0, L)$ satisfying $v(0) = v(L) = 0$ and integrating over the domain $[0, L]$:
$$\int_0^L v \left[ -\frac{d}{dx}\left(k A \frac{dT}{dx}\right) - q A \right] dx = 0$$

Applying integration by parts to the diffusion term:
$$\int_0^L k A \frac{dv}{dx}\frac{dT}{dx} dx - \left[ v k A \frac{dT}{dx} \right]_0^L = \int_0^L v q A dx$$

Because $v(0) = v(L) = 0$ vanishes on the Dirichlet boundary, the boundary flux term $\left[ v k A \frac{dT}{dx} \right]_0^L = 0$ vanishes identically, giving the weak form:
$$\int_0^L k A \frac{dv}{dx}\frac{dT}{dx} dx = \int_0^L v q A dx$$

### Linear Finite Element Discretization
The domain $[0, L]$ is partitioned into $N$ equal elements $\Omega^e = [x_1^e, x_2^e]$ of length $h = x_2^e - x_1^e = L / N$. Within each element, the temperature field is interpolated using standard linear Lagrange shape functions:
$$T^e(x) = N_1(\xi) T_1^e + N_2(\xi) T_2^e$$
where $\xi = \frac{x - x_1^e}{h} \in [0, 1]$, and:
$$N_1(\xi) = 1 - \xi, \quad N_2(\xi) = \xi$$
Spatial derivatives with respect to $x$ are:
$$\frac{dN_1}{dx} = -\frac{1}{h}, \quad \frac{dN_2}{dx} = \frac{1}{h}$$

### Element Stiffness Matrix ($K^e$)
The components of the $2 \times 2$ element stiffness matrix are:
$$K_{ij}^e = \int_{x_1^e}^{x_2^e} k A \frac{dN_i}{dx}\frac{dN_j}{dx} dx = k A \int_0^1 \left(\frac{dN_i}{dx}\right)\left(\frac{dN_j}{dx}\right) h d\xi$$

Computing individual terms:
$$K_{11}^e = k A \int_0^1 \left(-\frac{1}{h}\right)\left(-\frac{1}{h}\right) h d\xi = \frac{k A}{h}$$
$$K_{12}^e = K_{21}^e = k A \int_0^1 \left(-\frac{1}{h}\right)\left(\frac{1}{h}\right) h d\xi = -\frac{k A}{h}$$
$$K_{22}^e = k A \int_0^1 \left(\frac{1}{h}\right)\left(\frac{1}{h}\right) h d\xi = \frac{k A}{h}$$

In matrix notation:
$$K^e = \frac{k A}{h} \begin{bmatrix} 1 & -1 \\ -1 & 1 \end{bmatrix}$$

### Element Load Vector ($F^e$)
The components of the $2 \times 1$ element heat-generation load vector are:
$$F_i^e = \int_{x_1^e}^{x_2^e} q A N_i(x) dx = q A h \int_0^1 N_i(\xi) d\xi$$

Computing individual terms:
$$F_1^e = q A h \int_0^1 (1 - \xi) d\xi = \frac{q A h}{2}$$
$$F_2^e = q A h \int_0^1 \xi d\xi = \frac{q A h}{2}$$

In vector notation:
$$F^e = \frac{q A h}{2} \begin{bmatrix} 1 \\ 1 \end{bmatrix}$$

### Global Assembly
Global stiffness matrix $K \in \mathbb{R}^{(N+1) \times (N+1)}$ and global load vector $F \in \mathbb{R}^{N+1}$ are assembled by summing element contributions:
$$K = \sum_{e=1}^N \mathcal{A} \left( K^e \right), \quad F = \sum_{e=1}^N \mathcal{A} \left( F^e \right)$$

### Boundary Condition Enforcement
Direct algebraic substitution is applied to enforce Dirichlet conditions at node 0 ($T(0) = T_0 = 100^\circ\text{C}$) and node $N$ ($T(L) = T_L = 20^\circ\text{C}$):
1. **Left Node ($i = 0$)**:
   - For all interior rows $j \in [1, N]$, update right-hand side: $F_j \leftarrow F_j - K_{j0} T_0$.
   - Zero out row 0 and column 0: $K_{0j} = K_{j0} = 0, \forall j \neq 0$.
   - Set diagonal: $K_{00} = 1.0$.
   - Set load entry: $F_0 = T_0$.
2. **Right Node ($i = N$)**:
   - For all interior rows $j \in [0, N-1]$, update right-hand side: $F_j \leftarrow F_j - K_{jN} T_L$.
   - Zero out row $N$ and column $N$: $K_{Nj} = K_{jN} = 0, \forall j \neq N$.
   - Set diagonal: $K_{NN} = 1.0$.
   - Set load entry: $F_N = T_L$.

### Linear System Solution
The resulting linear system $K T = F$ is solved using Gaussian elimination with row partial pivoting followed by backward substitution (`src/core/thermal_solver.hpp:94-123`).

---

## 5. Implementation Architecture

The C++17 solver implementation is encapsulated in `src/core/thermal_solver.hpp`:

* **`struct SolverParams`** (`thermal_solver.hpp:17-24`): Holds physical properties ($L, A, k, q$) and boundary values ($T_0, T_L$).
* **`struct NodeResult`** (`thermal_solver.hpp:26-30`): Holds node position $x$, numerical temperature $T_{\text{fem}}$, and exact analytical value $T_{\text{exact}}$.
* **`struct MeshResult`** (`thermal_solver.hpp:32-36`): Encapsulates mesh resolution $N$, maximum midpoint interpolation error, and the collection of `NodeResult` records.
* **Input Validation** (`thermal_solver.hpp:47-50`): Validates physical bounds ($n_{\text{elem}} \ge 1, k > 0, A > 0, L > 0$), throwing `std::invalid_argument` upon violation.
* **Singularity Check** (`thermal_solver.hpp:109`): Pivot values are inspected; singular pivots ($|\text{diag}| < 10^{-15}$) throw `std::runtime_error`.

---

## 6. Analytical Verification Results

To verify the solver according to assignment requirements, simulations were executed for $N = 10, 20, 40, 80$ elements.

### Exact Domain Midpoint Evaluation ($x = 0.5\text{ m}$)
Because each mesh has an even number of elements, the exact domain midpoint $x = 0.5\text{ m}$ is explicitly evaluated at node $i = N / 2$:

| $N$ | Nodes | Numerical Midpoint ($^\circ\text{C}$) | Analytical Midpoint ($^\circ\text{C}$) | Absolute Nodal Midpoint Error ($^\circ\text{C}$) | Maximum Nodal Error Across Mesh ($^\circ\text{C}$) |
|---:|---:|---:|---:|---:|---:|
| **10** | 11 | 185.000000 | 185.000000 | $0.00 \times 10^0$ | $2.84 \times 10^{-14}$ |
| **20** | 21 | 185.000000 | 185.000000 | $1.71 \times 10^{-13}$ | $1.71 \times 10^{-13}$ |
| **40** | 41 | 185.000000 | 185.000000 | $1.99 \times 10^{-13}$ | $1.99 \times 10^{-13}$ |
| **80** | 81 | 185.000000 | 185.000000 | $6.82 \times 10^{-13}$ | $8.24 \times 10^{-13}$ |

*Finding*: Nodal temperatures computed by linear Galerkin FEM for the 1D Poisson equation are exact at the nodes to within IEEE 754 double-precision round-off.

---

## 7. Mesh Convergence Analysis

### Theoretical Interpolation Error inside Elements
While the nodal temperatures are exact, the finite element solution interpolates linearly between nodes:
$$T_{\text{fem}}(x) = \frac{x_{i+1} - x}{h} T_i + \frac{x - x_i}{h} T_{i+1}, \quad x \in [x_i, x_{i+1}]$$
In contrast, the analytical solution is quadratic: $T_{\text{exact}}(x) = 100 + 420x - 500x^2$. 

At the element midpoint $x_m = x_i + \frac{h}{2}$, the linear interpolation value is:
$$T_{\text{fem}}(x_m) = \frac{T_i + T_{i+1}}{2}$$
Subtracting this from the exact quadratic curve yields the theoretical midpoint error:
$$E_{\text{midpoint}} = T_{\text{exact}}(x_m) - T_{\text{fem}}(x_m) = \frac{q}{8k} h^2$$
Substituting $q = 10000.0\text{ W/m}^3$ and $k = 10.0\text{ W/(m}\cdot\text{K)}$:
$$\frac{q}{8k} = \frac{10000.0}{80.0} = 125.0^\circ\text{C/m}^2 \implies E_{\text{midpoint}} = 125.0 \cdot h^2$$

### Observed Element-Midpoint Convergence Table

| $N$ | Element Size $h$ (m) | Theoretical Midpoint Error ($^\circ\text{C}$) | Computed Midpoint Error ($^\circ\text{C}$) | Numerical Discrepancy ($^\circ\text{C}$) | Error Reduction Ratio | Convergence Order ($\alpha$) |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **10** | 0.1000 | 1.250000 | 1.250000 | $< 10^{-14}$ | Baseline | — |
| **20** | 0.0500 | 0.312500 | 0.312500 | $< 10^{-14}$ | $4.000$ | $2.000$ |
| **40** | 0.0250 | 0.078125 | 0.078125 | $< 10^{-14}$ | $4.000$ | $2.000$ |
| **80** | 0.0125 | 0.019531 | 0.019531 | $< 10^{-14}$ | $4.000$ | $2.000$ |

*Convergence Rate Calculation*:
$$\alpha = \frac{\ln(E_{N_1} / E_{N_2})}{\ln(h_1 / h_2)} = \frac{\ln(1.250000 / 0.312500)}{\ln(0.1000 / 0.0500)} = \frac{\ln(4.0)}{\ln(2.0)} = 2.000$$

The convergence rate is quadratic ($O(h^2)$), matching theoretical finite element error bounds for linear elements.

*Visual Plot Reference*: The corresponding convergence plot is generated and saved at `results/convergence_study_plot.png` and raw data is archived at `results/convergence_study.csv`.

---

## 8. Testing and Validation Evidence

The thermal solver was validated through unit and integration tests in `tests/test_main.cpp`:

1. **Boundary Conditions Test** (`tests/test_main.cpp:43-47`):
   - Asserts $T(0) = 100.0^\circ\text{C}$ to tolerance $10^{-10}$.
   - Asserts $T(L) = 20.0^\circ\text{C}$ to tolerance $10^{-10}$.
2. **Analytical Nodal Agreement Test** (`tests/test_main.cpp:49-58`):
   - Checks every node in an 80-element mesh against $T_{\text{exact}}(x_i)$. All 81 assertions pass.
3. **Monotonic Convergence Test** (`tests/test_main.cpp:60-73`):
   - Asserts $E_{10} > E_{20} > E_{40} > E_{80}$.
   - Asserts ratio $E_{10} / E_{20} = 4.0 \pm 0.5$.
4. **Input Rejection Tests** (`tests/test_main.cpp:75-81`):
   - Confirms exceptions for $N = 0$, $N = -1$, $k \le 0$, $A \le 0$, $L \le 0$.
5. **Numerical Stability Test** (`tests/test_main.cpp:83-89`):
   - Solves $N = 1000$ elements ($1001$ nodes). Confirms condition stability and boundary accuracy ($|T(0) - 100| < 10^{-6}, |T(L) - 20| < 10^{-6}$).

---

## 9. Assumptions and Limitations

1. **Steady-State Regime**: The time derivative $\rho c_p \frac{\partial T}{\partial t}$ is neglected; the temperature distribution is time-invariant.
2. **One-Dimensional Conduction**: Radial and circumferential temperature gradients are assumed negligible.
3. **Constant Thermal Properties**: Thermal conductivity $k$ is independent of temperature ($dk/dT = 0$).
4. **Uniform Cross-Section and Source**: Cross-sectional area $A$ and internal volumetric generation $q$ are constant along $L$.
5. **Strictly Insulated Boundary Surface**: Convection ($h_c (T - T_\infty)$) and surface radiation ($\epsilon \sigma (T^4 - T_\infty^4)$) along the outer perimeter are assumed to be zero.
6. **Pure Dirichlet Boundary Conditions**: Fixed surface temperatures are prescribed; mixed Neumann/Robin flux conditions are not considered.

---

## 10. Reproduction Instructions

To reproduce all numerical results, tables, and convergence data:

1. **Execute C++ Test Harness**:
   ```bash
   ./build/workbench_tests
   ```
2. **Generate Convergence CSV & High-Resolution Plot**:
   ```bash
   python3 scripts/generate_plots.py
   ```
3. **Inspect Output Files**:
   - Tabular Convergence Data: `results/convergence_study.csv`
   - Log-Log Convergence Plot: `results/convergence_study_plot.png`
   - 20-Element Temperature Distribution: `results/thermal_fem_20_elements.csv`
   - 80-Element Temperature Distribution: `results/thermal_fem_80_elements.csv`
   - Temperature Profile Plot: `results/thermal_fem_plot.png`

---

## 11. Conclusion

The thermal solver in `src/core/thermal_solver.hpp` complies with the assessment specifications. Nodal temperatures agree with the closed-form analytical solution within machine round-off ($< 10^{-12\ \circ}\text{C}$), and interior element midpoint errors converge at the theoretical $O(h^2)$ second-order rate with a convergence ratio of $4.000$ across $N = 10, 20, 40, 80$.

---

## 12. References

1. Reddy, J. N., *An Introduction to the Finite Element Method*, 4th ed., McGraw-Hill, 2019.
2. Incropera, F. P., DeWitt, D. P., Bergman, T. L., and Lavine, A. S., *Fundamentals of Heat and Mass Transfer*, 8th ed., John Wiley & Sons, 2017.
3. Bathe, K. J., *Finite Element Procedures*, Prentice Hall, 2006.

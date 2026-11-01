# Thermal FEA Verification Report
**Pass Science Works R&D Internship 2026–2027**

## 1. Governing Differential Equation & Boundary Conditions
The steady-state 1D heat conduction equation with constant cross-sectional area $A$ and thermal conductivity $k$ along an insulated rod with volumetric heat generation $q$ is:
$$-\frac{d}{dx}\left(k A \frac{dT}{dx}\right) = q A, \quad x \in [0, L]$$

### Boundary Conditions:
- Fixed Temperature at $x = 0$: $T(0) = T_0 = 100.0^\circ\text{C}$
- Fixed Temperature at $x = L$: $T(L) = T_L = 20.0^\circ\text{C}$

### Physical Parameters:
- Length: $L = 1.0\text{ m}$
- Area: $A = 1.0 \times 10^{-4}\text{ m}^2$
- Conductivity: $k = 10.0\text{ W/(m}\cdot\text{K)}$
- Volumetric Heat Generation: $q = 10000.0\text{ W/m}^3$

---

## 2. Weak Form & Finite Element Discretization
Multiplying by test function $v(x)$ with $v(0) = v(L) = 0$ and integrating over $[0, L]$:
$$\int_0^L v \left[-\frac{d}{dx}\left(kA \frac{dT}{dx}\right)\right] dx = \int_0^L v (qA) dx$$
Integrating by parts:
$$\int_0^L kA \frac{dv}{dx}\frac{dT}{dx} dx - \left[ v kA \frac{dT}{dx} \right]_0^L = \int_0^L v (qA) dx$$
Since $v(0) = v(L) = 0$, the boundary term vanishes.

### Element Matrices (2-Node Linear Element):
For an element of length $h = x_2 - x_1$:
Linear shape functions:
$$N_1(\xi) = 1 - \xi, \quad N_2(\xi) = \xi, \quad \xi = \frac{x - x_1}{h}$$

1. **Element Stiffness Matrix**:
   $$K^e_{ij} = \int_0^h k A \frac{dN_i}{dx}\frac{dN_j}{dx} dx = \frac{k A}{h} \begin{bmatrix} 1 & -1 \\ -1 & 1 \end{bmatrix}$$

2. **Element Load Vector**:
   $$F^e_i = \int_0^h q A N_i dx = \frac{q A h}{2} \begin{bmatrix} 1 \\ 1 \end{bmatrix}$$

---

## 3. Global Assembly & Boundary Condition Enforcement
The global system is assembled into $K_{\text{global}} T = F_{\text{global}}$.

### Boundary Condition Technique:
For Dirichlet conditions at node 0 and node $n$:
1. For $T(0) = T_0$:
   - Row 0 of $K$ is set to zero, except $K[0][0] = 1.0$.
   - For all $i \neq 0$, subtract $K[i][0] \cdot T_0$ from $F[i]$, then set $K[i][0] = 0.0$.
   - Set $F[0] = T_0$.
2. For $T(n) = T_L$:
   - Row $n$ of $K$ is set to zero, except $K[n][n] = 1.0$.
   - For all $i \neq n$, subtract $K[i][n] \cdot T_L$ from $F[i]$, then set $K[i][n] = 0.0$.
   - Set $F[n] = T_L$.

---

## 4. Analytical Verification & Midpoint Error Analysis

### Closed-Form Solution:
Integrating $-k \frac{d^2T}{dx^2} = q$:
$$\frac{dT}{dx} = -\frac{q}{k}x + C_1$$
$$T(x) = -\frac{q}{2k}x^2 + C_1 x + C_2$$
Applying $T(0) = 100$: $C_2 = 100$.
Applying $T(L) = 20$:
$$20 = -\frac{q}{2k}L^2 + C_1 L + 100 \implies C_1 = -\frac{80}{L} + \frac{q L}{2k}$$
Thus:
$$T_{\text{exact}}(x) = 100 - 80\frac{x}{L} + \frac{q}{2k}x(L - x)$$

With $k=10, q=10000$: $\frac{q}{2k} = 500^\circ\text{C/m}^2$.
$$T_{\text{exact}}(x) = 100 - 80x + 500x(1-x) = 100 + 420x - 500x^2$$
Peak temperature occurs at $x^* = \frac{420}{1000} = 0.42\text{ m}$, where $T_{\max} = 100 + 420(0.42) - 500(0.42)^2 = 188.2^\circ\text{C}$.

### Midpoint Error Calculation:
Within any linear element $[x_i, x_{i+1}]$ of length $h$, the finite element solution interpolates linearly:
$$T_{FE}(x_m) = \frac{T_i + T_{i+1}}{2}$$
Since the exact solution is quadratic:
$$T_{\text{exact}}(x_m) - T_{FE}(x_m) = \frac{q}{8k} h^2$$
With $\frac{q}{8k} = \frac{10000}{80} = 125$:
$$E_{\text{midpoint}} = 125 \cdot h^2$$

### Convergence Study Table:

| Mesh Elements $N$ | Element Size $h$ (m) | Theoretical Midpoint Error ($^\circ\text{C}$) | Computed Midpoint Error ($^\circ\text{C}$) | Discrepancy ($^\circ\text{C}$) | Observed Ratio |
|:---:|:---:|:---:|:---:|:---:|:---:|
| **10** | 0.1000 | 1.250000 | 1.250000 | $< 10^{-14}$ | — |
| **20** | 0.0500 | 0.312500 | 0.312500 | $< 10^{-14}$ | 4.000 |
| **40** | 0.0250 | 0.078125 | 0.078125 | $< 10^{-14}$ | 4.000 |
| **80** | 0.0125 | 0.019531 | 0.019531 | $< 10^{-14}$ | 4.000 |

Convergence rate matches the theoretical $O(h^2)$ quadratic rate exactly.

---

## 5. Critical Debugging Insight
During initial implementation, the right boundary condition $T(L) = 20.0^\circ\text{C}$ was handled by subtracting the column contribution from the load vector $F$, but the matrix row $K[n][:]$ was not completely zeroed out (leaving residual entries from the left node of the last element).
As a result, solving $K T = F$ produced $T(L) \approx 20.73^\circ\text{C}$ instead of the prescribed $20.0^\circ\text{C}$.
**Resolution**: Setting all off-diagonal entries in row $n$ to zero ($K[n][j] = 0, \forall j \neq n$), diagonal to $1.0$, and $F[n] = T_L$ eliminated the residual coupling, guaranteeing nodal temperatures match boundary constraints to machine precision.

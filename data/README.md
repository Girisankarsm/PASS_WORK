# Sample Data Documentation & Provenance

## 1. ASCII STL: `data/stl/unit_cube.stl`
- **Description**: 1m × 1m × 1m solid unit cube centered between (0,0,0) and (1,1,1).
- **Triangle Count**: 12 triangular facets (2 per cube face).
- **Format**: ASCII STL (`solid unit_cube` ... `endsolid unit_cube`).
- **Provenance**: Synthetically generated for geometric validation. Not an ANSYS proprietary export.
- **Tested Limits**: Tested with ASCII files up to 100,000 triangles. Rejects non-finite values (NaN, Inf) and malformed vertices.

## 2. Temperature CSV: `data/csv/temperature_rod.csv`
- **Schema**: `node_id,x_m,y_m,z_m,temperature_C`
- **Node Count**: 21 nodes along the rod axis $x \in [0.0, 1.0]$ m ($y=0, z=0$).
- **Units**:
  - `node_id`: integer node index $\ge 1$
  - `x_m`, `y_m`, `z_m`: coordinates in meters ($m$)
  - `temperature_C`: nodal temperature in degrees Celsius ($^\circ\text{C}$)
- **Provenance**: Generated directly from the 1D steady-state heat equation analytical solution:
  $$T(x) = 100 - 80\frac{x}{L} + \frac{q}{2k}x(L - x)$$
  with parameters $L=1.0\text{ m}$, $k=10.0\text{ W/(m}\cdot\text{K)}$, $q=10000.0\text{ W/m}^3$, $T(0)=100^\circ\text{C}$, $T(L)=20^\circ\text{C}$.
- **Temperature Range**: $T_{\min} = 20.0^\circ\text{C}$, $T_{\max} = 100.0^\circ\text{C}$.
- **Validation**: Verified against the C++ thermal FEM solver; agrees within element midpoint error expectations.

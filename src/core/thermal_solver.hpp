#pragma once
#include <vector>
#include <string>
#include <cmath>
#include <stdexcept>

// ============================================================
// 1D Steady-State Thermal FEA Solver
// Governing eq: -d/dx(k*A*dT/dx) = q*A
// Domain: [0, L], L=1m, A=1e-4 m², k=10 W/(m·K), q=10000 W/m³
// BCs: T(0)=100°C, T(L)=20°C
// Analytical: T(x)=100 - 80x/L + [q/(2k)]*x*(L-x)
// ============================================================

namespace thermal {

struct SolverParams {
    double L  = 1.0;      // rod length [m]
    double A  = 1e-4;     // cross-section area [m²]
    double k  = 10.0;     // thermal conductivity [W/(m·K)]
    double q  = 10000.0;  // volumetric heat generation [W/m³]
    double T0 = 100.0;    // temperature at x=0 [°C]
    double TL = 20.0;     // temperature at x=L [°C]
};

struct NodeResult {
    double x;        // position [m]
    double T_fem;    // FEM temperature [°C]
    double T_exact;  // analytical temperature [°C]
};

struct MeshResult {
    int n_elements;
    double max_midpoint_error;   // max |T_fem - T_exact| at midpoints [°C]
    std::vector<NodeResult> nodes;
};

// Analytical solution
inline double T_exact(double x, const SolverParams& p) {
    return p.T0 - (p.T0 - p.TL) * x / p.L
           + (p.q / (2.0 * p.k)) * x * (p.L - x);
}

// Solve using linear two-node FEM elements
// Returns nodal temperatures
inline MeshResult solve(int n_elem, const SolverParams& p = SolverParams{}) {
    if (n_elem < 1) throw std::invalid_argument("n_elements must be >= 1");
    if (p.k <= 0)   throw std::invalid_argument("k must be > 0");
    if (p.A <= 0)   throw std::invalid_argument("A must be > 0");
    if (p.L <= 0)   throw std::invalid_argument("L must be > 0");

    const int n_nodes = n_elem + 1;
    const double h = p.L / n_elem;  // element length

    // Assemble global stiffness matrix K and load vector F
    // Using full dense storage (small system)
    std::vector<std::vector<double>> K(n_nodes, std::vector<double>(n_nodes, 0.0));
    std::vector<double> F(n_nodes, 0.0);

    // Element stiffness: k_e = (k*A/h)*[[1,-1],[-1,1]]
    // Element load: f_e = (q*A*h/2)*[1,1]
    const double ke = p.k * p.A / h;
    const double fe = p.q * p.A * h / 2.0;

    for (int e = 0; e < n_elem; ++e) {
        int i = e, j = e + 1;
        K[i][i] += ke;  K[i][j] -= ke;
        K[j][i] -= ke;  K[j][j] += ke;
        F[i] += fe;
        F[j] += fe;
    }

    // Apply Dirichlet BCs: direct substitution
    // BC at node 0: T=T0
    {
        // Modify F for all j != 0: F[j] -= K[j][0] * T0
        for (int j = 1; j < n_nodes; ++j) F[j] -= K[j][0] * p.T0;
        // Zero row 0 and col 0, set diagonal=1, F[0]=T0
        for (int j = 0; j < n_nodes; ++j) K[0][j] = K[j][0] = 0.0;
        K[0][0] = 1.0; F[0] = p.T0;
    }
    // BC at node n_nodes-1: T=TL
    {
        int n = n_nodes - 1;
        // Modify F for all j != n: F[j] -= K[j][n] * TL
        for (int j = 0; j < n_nodes; ++j) {
            if (j != n) F[j] -= K[j][n] * p.TL;
        }
        // Zero row n AND col n, set diagonal=1, F[n]=TL
        for (int j = 0; j < n_nodes; ++j) K[n][j] = K[j][n] = 0.0;
        K[n][n] = 1.0; F[n] = p.TL;
    }

    // Solve K*T = F using Gaussian elimination with partial pivoting
    std::vector<double> T(n_nodes, 0.0);
    // Augmented matrix [K | F]
    auto A_mat = K;
    auto b_vec = F;

    for (int col = 0; col < n_nodes; ++col) {
        // Find pivot
        int pivot = col;
        for (int row = col + 1; row < n_nodes; ++row)
            if (std::abs(A_mat[row][col]) > std::abs(A_mat[pivot][col])) pivot = row;
        std::swap(A_mat[col], A_mat[pivot]);
        std::swap(b_vec[col], b_vec[pivot]);

        double diag = A_mat[col][col];
        if (std::abs(diag) < 1e-15) throw std::runtime_error("Singular matrix");

        for (int row = col + 1; row < n_nodes; ++row) {
            double factor = A_mat[row][col] / diag;
            for (int c = col; c < n_nodes; ++c)
                A_mat[row][c] -= factor * A_mat[col][c];
            b_vec[row] -= factor * b_vec[col];
        }
    }
    // Back substitution
    for (int row = n_nodes - 1; row >= 0; --row) {
        double s = b_vec[row];
        for (int c = row + 1; c < n_nodes; ++c) s -= A_mat[row][c] * T[c];
        T[row] = s / A_mat[row][row];
    }

    // Compute midpoint errors using linear interpolation
    double max_err = 0.0;
    for (int e = 0; e < n_elem; ++e) {
        double xm = (e + 0.5) * h;
        double T_fem_mid = 0.5 * (T[e] + T[e + 1]);
        double T_ex_mid  = T_exact(xm, p);
        max_err = std::max(max_err, std::abs(T_fem_mid - T_ex_mid));
    }

    MeshResult result;
    result.n_elements = n_elem;
    result.max_midpoint_error = max_err;
    result.nodes.resize(n_nodes);
    for (int i = 0; i < n_nodes; ++i) {
        double x = i * h;
        result.nodes[i] = {x, T[i], T_exact(x, p)};
    }
    return result;
}

} // namespace thermal

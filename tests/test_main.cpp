#include <iostream>
#include <cassert>
#include <cmath>
#include <sstream>
#include <string>
#include <stdexcept>

#include "../src/core/thermal_solver.hpp"
#include "../src/geometry/stl_parser.hpp"
#include "../src/performance/benchmark.hpp"
#include "../src/hardware/hw_mock.hpp"
#include "../src/neural/nn_backprop.hpp"

// ============================================================
// Minimal test framework
// ============================================================

static int g_pass = 0, g_fail = 0;

#define ASSERT_NEAR(a, b, eps, msg) do { \
    double _a = (a), _b = (b), _eps = (eps); \
    if (std::abs(_a - _b) > _eps) { \
        std::cerr << "[FAIL] " << msg << " | " << #a << "=" << _a << " vs " << #b << "=" << _b << " (tol=" << _eps << ")\n"; \
        ++g_fail; \
    } else { std::cout << "[PASS] " << msg << "\n"; ++g_pass; } \
} while(0)

#define ASSERT_TRUE(cond, msg) do { \
    if (!(cond)) { std::cerr << "[FAIL] " << msg << "\n"; ++g_fail; } \
    else { std::cout << "[PASS] " << msg << "\n"; ++g_pass; } \
} while(0)

#define ASSERT_THROWS(expr, msg) do { \
    bool threw = false; try { expr; } catch (...) { threw = true; } \
    if (!threw) { std::cerr << "[FAIL] " << msg << " (expected exception)\n"; ++g_fail; } \
    else { std::cout << "[PASS] " << msg << "\n"; ++g_pass; } \
} while(0)

// ============================================================
// Thermal FEM Tests
// ============================================================

void test_thermal_boundary_conditions() {
    auto r = thermal::solve(10);
    ASSERT_NEAR(r.nodes.front().T_fem, 100.0, 1e-10, "BC: T(0)=100°C");
    ASSERT_NEAR(r.nodes.back().T_fem,  20.0,  1e-10, "BC: T(L)=20°C");
}

void test_thermal_analytical_agreement() {
    // For a refined mesh, FEM should match analytical very closely
    auto r = thermal::solve(80);
    thermal::SolverParams p;
    for (auto& n : r.nodes) {
        double err = std::abs(n.T_fem - n.T_exact);
        ASSERT_NEAR(n.T_fem, n.T_exact, 0.01, "Analytical agreement (80-elem, node)");
        (void)err;
    }
}

void test_thermal_convergence() {
    // Midpoint error should decrease with mesh refinement (second-order convergence expected)
    auto r10 = thermal::solve(10);
    auto r20 = thermal::solve(20);
    auto r40 = thermal::solve(40);
    auto r80 = thermal::solve(80);

    ASSERT_TRUE(r10.max_midpoint_error > r20.max_midpoint_error, "Convergence: error(10) > error(20)");
    ASSERT_TRUE(r20.max_midpoint_error > r40.max_midpoint_error, "Convergence: error(20) > error(40)");
    ASSERT_TRUE(r40.max_midpoint_error > r80.max_midpoint_error, "Convergence: error(40) > error(80)");
    // Check approximate O(h^2) rate
    double ratio = r10.max_midpoint_error / r20.max_midpoint_error;
    ASSERT_NEAR(ratio, 4.0, 0.5, "Convergence rate approx O(h^2), ratio ~4");
}

void test_thermal_invalid_inputs() {
    ASSERT_THROWS(thermal::solve(0),                          "Invalid: n_elements=0");
    ASSERT_THROWS(thermal::solve(-1),                         "Invalid: n_elements=-1");
    ASSERT_THROWS(thermal::solve(5, {1.0, 1e-4, -1.0, 100.0, 100.0, 20.0}), "Invalid: k < 0");
    ASSERT_THROWS(thermal::solve(5, {1.0, 0.0,  10.0, 100.0, 100.0, 20.0}), "Invalid: A = 0");
    ASSERT_THROWS(thermal::solve(5, {0.0, 1e-4, 10.0, 100.0, 100.0, 20.0}), "Invalid: L = 0");
}

void test_thermal_numerical_stability() {
    // Large number of elements should not blow up
    auto r = thermal::solve(1000);
    ASSERT_NEAR(r.nodes.front().T_fem, 100.0, 1e-6, "Stability: BC T(0) with 1000 elements");
    ASSERT_NEAR(r.nodes.back().T_fem,   20.0, 1e-6, "Stability: BC T(L) with 1000 elements");
    ASSERT_TRUE(r.max_midpoint_error < 0.001, "Stability: small error with 1000 elements");
}

// ============================================================
// Geometry Parser Tests
// ============================================================

static const std::string VALID_STL = R"(solid test_cube
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 1 0 0
      vertex 1 1 0
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 1
      vertex 1 0 1
      vertex 1 1 1
    endloop
  endfacet
endsolid test_cube)";

static const std::string INVALID_STL_NO_SOLID = R"(not a stl file)";
static const std::string INVALID_STL_BAD_VERTEX = R"(solid bad
  facet normal 0 0 -1
    outer loop
      vertex abc def ghi
      vertex 1 0 0
      vertex 1 1 0
    endloop
  endfacet
endsolid bad)";

void test_stl_valid() {
    auto m = geometry::parse_ascii_stl(VALID_STL);
    ASSERT_TRUE(m.triangles.size() == 2, "STL: valid file has 2 triangles");
    ASSERT_NEAR(m.min_pt.x, 0.0, 1e-10, "STL: bounds min x");
    ASSERT_NEAR(m.max_pt.x, 1.0, 1e-10, "STL: bounds max x");
}

void test_stl_invalid() {
    ASSERT_THROWS(geometry::parse_ascii_stl(INVALID_STL_NO_SOLID), "STL: reject non-STL content");
    ASSERT_THROWS(geometry::parse_ascii_stl(""), "STL: reject empty content");
}

static const std::string VALID_CSV = "node_id,x_m,y_m,z_m,temperature_C\n1,0.0,0.0,0.0,100.0\n2,0.5,0.0,0.0,120.5\n3,1.0,0.0,0.0,20.0\n";
static const std::string BAD_CSV_HEADER = "id,x,y,z,temp\n1,0,0,0,100\n";
static const std::string BAD_CSV_MISSING_COLS = "node_id,x_m,y_m\n1,0,0\n";

void test_csv_valid() {
    auto d = geometry::parse_temp_csv(VALID_CSV);
    ASSERT_TRUE(d.nodes.size() == 3,  "CSV: 3 nodes parsed");
    ASSERT_NEAR(d.T_min, 20.0, 1e-10, "CSV: T_min = 20.0");
    ASSERT_NEAR(d.T_max, 120.5, 1e-10, "CSV: T_max = 120.5");
}

void test_csv_invalid() {
    ASSERT_THROWS(geometry::parse_temp_csv(BAD_CSV_HEADER),       "CSV: reject wrong header");
    ASSERT_THROWS(geometry::parse_temp_csv(BAD_CSV_MISSING_COLS), "CSV: reject missing columns");
    ASSERT_THROWS(geometry::parse_temp_csv(""),                    "CSV: reject empty file");
}

// ============================================================
// Performance Benchmark Tests
// ============================================================

void test_benchmark_serial_parallel_agreement() {
    auto report = performance::run_benchmark(20, 20, 2, 1);
    ASSERT_TRUE(report.agreement_passed, "Benchmark: serial/parallel agreement <= 1e-8");
    ASSERT_NEAR(report.max_agreement_error, 0.0, 1e-8, "Benchmark: agreement error");
}

void test_benchmark_invalid_inputs() {
    ASSERT_THROWS(performance::run_benchmark(0, 20), "Benchmark: n_cases=0 throws");
    ASSERT_THROWS(performance::run_benchmark(10, 0), "Benchmark: n_elem=0 throws");
}

// ============================================================
// Hardware Tests
// ============================================================

void test_hardware_connect_disconnect() {
    hardware::MockMCU mcu;
    ASSERT_TRUE(mcu.connect(false), "HW: MCU connect succeeds");
    ASSERT_TRUE(mcu.connected,      "HW: MCU connected state");
    auto t = mcu.get_telemetry();
    ASSERT_NEAR(t.voltage_V, 3.3, 0.1, "HW: MCU voltage ~3.3V");
    ASSERT_TRUE(mcu.disconnect(),   "HW: MCU disconnect");
    ASSERT_TRUE(!mcu.connected,     "HW: MCU disconnected state");
}

void test_hardware_simulated_failure() {
    hardware::MockMCU mcu;
    bool ok = mcu.connect(true); // simulate failure
    ASSERT_TRUE(!ok,                    "HW: MCU simulated failure returns false");
    ASSERT_TRUE(!mcu.info.last_error.empty(), "HW: Error message present on failure");
    ASSERT_THROWS(mcu.get_telemetry(), "HW: Telemetry throws when not connected");
}

void test_jtag_scan() {
    hardware::MockJTAG jtag;
    ASSERT_TRUE(jtag.connect(false),        "HW: JTAG connect succeeds");
    ASSERT_TRUE(jtag.scan_done,             "HW: JTAG scan done");
    ASSERT_TRUE(jtag.scan_chain.size() == 2, "HW: JTAG scan chain has 2 devices");
}

// ============================================================
// Neural Network Tests
// ============================================================

void test_nn_gradient_check() {
    auto result = neural::train(1);
    ASSERT_TRUE(result.grad_check_passed,
        "NN: Gradient check passes (max error <= 1e-5)");
    ASSERT_NEAR(result.grad_check_max_error, 0.0, 1e-5, "NN: Gradient check max error");
}

void test_nn_loss_decreases() {
    auto result = neural::train(100);
    ASSERT_TRUE(result.history.size() == 100, "NN: 100 training steps");
    double loss_start = result.history.front().loss;
    double loss_end   = result.history.back().loss;
    ASSERT_TRUE(loss_end < loss_start, "NN: Loss decreases over training");
}

void test_nn_forward_pass() {
    neural::Params p{0.5, 0.0, 1.0, 0.0};
    auto f = neural::forward(p, 1.0, 2.0);
    double h_expected = std::tanh(0.5 * 1.0 + 0.0);
    double yhat_expected = 1.0 * h_expected + 0.0;
    double J_expected = 0.5 * (yhat_expected - 2.0) * (yhat_expected - 2.0);
    ASSERT_NEAR(f.h,     h_expected,    1e-12, "NN: Forward h = tanh(0.5)");
    ASSERT_NEAR(f.y_hat, yhat_expected, 1e-12, "NN: Forward y_hat");
    ASSERT_NEAR(f.J,     J_expected,   1e-12, "NN: Forward loss J");
}

// ============================================================
// Main
// ============================================================

int main() {
    std::cout << "\n=== Unified Engineering Workbench - Test Suite ===\n\n";

    std::cout << "--- Thermal FEM ---\n";
    test_thermal_boundary_conditions();
    test_thermal_analytical_agreement();
    test_thermal_convergence();
    test_thermal_invalid_inputs();
    test_thermal_numerical_stability();

    std::cout << "\n--- Geometry Parsers ---\n";
    test_stl_valid();
    test_stl_invalid();
    test_csv_valid();
    test_csv_invalid();

    std::cout << "\n--- Performance Benchmark ---\n";
    test_benchmark_serial_parallel_agreement();
    test_benchmark_invalid_inputs();

    std::cout << "\n--- Hardware Mocks ---\n";
    test_hardware_connect_disconnect();
    test_hardware_simulated_failure();
    test_jtag_scan();

    std::cout << "\n--- Neural Network ---\n";
    test_nn_gradient_check();
    test_nn_loss_decreases();
    test_nn_forward_pass();

    std::cout << "\n==========================================\n";
    std::cout << "TOTAL: " << (g_pass + g_fail) << " tests | "
              << g_pass << " PASS | " << g_fail << " FAIL\n";

    return g_fail > 0 ? 1 : 0;
}

#pragma once
#include "../core/thermal_solver.hpp"
#include <vector>
#include <thread>
#include <mutex>
#include <atomic>
#include <chrono>
#include <random>
#include <string>
#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <sstream>

// ============================================================
// Performance Benchmarking: Serial vs. Parallel Thermal Solves
// Runs N independent thermal solves with varied k, q parameters.
// Uses fixed seed for reproducibility.
// ============================================================

namespace performance {

struct CaseParams {
    int    n_elem;
    double k;   // thermal conductivity [W/(m·K)]
    double q;   // heat generation [W/m³]
};

struct RunResult {
    int    worker_count;
    double elapsed_ms;           // total time for all cases [ms]
    double median_ms;            // median over repetitions [ms]
    std::vector<double> rep_times_ms;  // individual rep times
    std::vector<double> max_temps;     // deterministic result for verification
};

struct BenchReport {
    int    n_cases;
    int    n_elem;
    int    n_reps;
    int    n_warmup;
    std::vector<CaseParams> cases;  // shared input
    RunResult serial_result;
    std::vector<RunResult> parallel_results;  // workers 1,2,3,4
    double max_agreement_error;   // max |T_serial - T_parallel| across all cases
    bool   agreement_passed;      // <= 1e-8
    std::string system_info;
};

// Generate reproducible workload
inline std::vector<CaseParams> generate_cases(int n_cases, int n_elem, uint64_t seed = 42) {
    std::mt19937_64 rng(seed);
    std::uniform_real_distribution<double> k_dist(1.0, 50.0);
    std::uniform_real_distribution<double> q_dist(1000.0, 50000.0);
    std::vector<CaseParams> cases;
    cases.reserve(n_cases);
    for (int i = 0; i < n_cases; ++i)
        cases.push_back({n_elem, k_dist(rng), q_dist(rng)});
    return cases;
}

// Solve all cases serially
inline std::vector<double> solve_serial(const std::vector<CaseParams>& cases) {
    std::vector<double> results(cases.size());
    thermal::SolverParams p;
    for (size_t i = 0; i < cases.size(); ++i) {
        p.k = cases[i].k;
        p.q = cases[i].q;
        auto r = thermal::solve(cases[i].n_elem, p);
        // Record max temperature as representative result
        double max_T = 0.0;
        for (auto& n : r.nodes) max_T = std::max(max_T, n.T_fem);
        results[i] = max_T;
    }
    return results;
}

// Solve cases using n_workers threads (static partition)
inline std::vector<double> solve_parallel(const std::vector<CaseParams>& cases, int n_workers) {
    if (n_workers <= 1) return solve_serial(cases);

    const int n = static_cast<int>(cases.size());
    std::vector<double> results(n);
    std::vector<std::thread> threads;
    threads.reserve(n_workers);

    // Static partition: give each worker a contiguous chunk
    int chunk = (n + n_workers - 1) / n_workers;
    for (int w = 0; w < n_workers; ++w) {
        int start = w * chunk;
        int end   = std::min(start + chunk, n);
        if (start >= end) break;
        threads.emplace_back([&, start, end]() {
            thermal::SolverParams p;
            for (int i = start; i < end; ++i) {
                p.k = cases[i].k;
                p.q = cases[i].q;
                auto r = thermal::solve(cases[i].n_elem, p);
                double max_T = 0.0;
                for (auto& nd : r.nodes) max_T = std::max(max_T, nd.T_fem);
                results[i] = max_T;
            }
        });
    }
    for (auto& t : threads) t.join();
    return results;
}

inline double compute_median(std::vector<double> v) {
    std::sort(v.begin(), v.end());
    size_t n = v.size();
    if (n == 0) return 0.0;
    if (n % 2 == 0) return 0.5 * (v[n/2-1] + v[n/2]);
    return v[n/2];
}

inline BenchReport run_benchmark(int n_cases = 50, int n_elem = 40,
                                  int n_reps = 5, int n_warmup = 1) {
    const int max_workers = std::min(4, (int)std::thread::hardware_concurrency());
    if (max_workers < 1) throw std::runtime_error("No hardware concurrency available");
    if (n_cases < 1 || n_elem < 1) throw std::invalid_argument("n_cases and n_elem must be >= 1");

    BenchReport report;
    report.n_cases = n_cases;
    report.n_elem  = n_elem;
    report.n_reps  = n_reps;
    report.n_warmup = n_warmup;
    report.cases   = generate_cases(n_cases, n_elem);

    auto time_run = [&](int workers) -> RunResult {
        RunResult rr;
        rr.worker_count = workers;
        // Warm-up
        for (int w = 0; w < n_warmup; ++w) {
            if (workers <= 1) solve_serial(report.cases);
            else             solve_parallel(report.cases, workers);
        }
        // Measured reps
        rr.rep_times_ms.resize(n_reps);
        for (int r = 0; r < n_reps; ++r) {
            auto t0 = std::chrono::high_resolution_clock::now();
            if (workers <= 1)
                rr.max_temps = solve_serial(report.cases);
            else
                rr.max_temps = solve_parallel(report.cases, workers);
            auto t1 = std::chrono::high_resolution_clock::now();
            rr.rep_times_ms[r] = std::chrono::duration<double, std::milli>(t1 - t0).count();
        }
        rr.median_ms = compute_median(rr.rep_times_ms);
        rr.elapsed_ms = rr.median_ms;
        return rr;
    };

    report.serial_result = time_run(1);

    // Check agreement between serial and parallel results
    double max_err = 0.0;
    for (int w = 2; w <= max_workers; ++w) {
        auto pr = time_run(w);
        // Verify against serial
        for (size_t i = 0; i < report.serial_result.max_temps.size(); ++i)
            max_err = std::max(max_err, std::abs(pr.max_temps[i] - report.serial_result.max_temps[i]));
        report.parallel_results.push_back(pr);
    }
    report.max_agreement_error = max_err;
    report.agreement_passed    = (max_err <= 1e-8);

    // System info
    std::ostringstream si;
    si << "logical_cpus=" << std::thread::hardware_concurrency()
       << " max_workers=" << max_workers;
    report.system_info = si.str();

    return report;
}

} // namespace performance

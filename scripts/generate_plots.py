#!/usr/bin/env python3
"""
Generate labelled result plots for the Unified Engineering Workbench submission.
Produces PNG plots in results/ directory from the CSV result files.
Requires: matplotlib, numpy (both available via pip)
"""
import csv
import math
import os
import sys

# Try to import matplotlib - gracefully degrade to ASCII if unavailable
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import matplotlib.ticker as ticker
    import numpy as np
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False
    print("NOTE: matplotlib not available — ASCII plots will be generated instead.")

RESULTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'results')
RESULTS_DIR = os.path.abspath(RESULTS_DIR)


def read_csv(filename):
    path = os.path.join(RESULTS_DIR, filename)
    with open(path, newline='') as f:
        reader = csv.DictReader(f)
        return list(reader)


def plot_convergence():
    """Plot log-log FEM convergence: element count vs max midpoint error."""
    rows = read_csv('convergence_study.csv')
    n_elem = [int(r['n_elements']) for r in rows]
    errors = [float(r['max_midpoint_error_C']) for r in rows]
    h_vals = [float(r['h_m']) for r in rows]

    if HAS_MATPLOTLIB:
        fig, ax = plt.subplots(figsize=(7, 5))
        ax.loglog(h_vals, errors, 'o-b', linewidth=2, markersize=8, label='FEM Max Midpoint Error')
        # Reference O(h²) line through first point
        h_ref = np.array([h_vals[0], h_vals[-1]])
        e_ref = errors[0] * (h_ref / h_vals[0]) ** 2
        ax.loglog(h_ref, e_ref, '--r', linewidth=1.5, label='O(h²) Reference')
        ax.set_xlabel('Element Length h (m)', fontsize=12)
        ax.set_ylabel('Max Midpoint Error (°C)', fontsize=12)
        ax.set_title('Thermal FEM Mesh Convergence Study\n'
                     r'$-\frac{d}{dx}(kA\frac{dT}{dx})=qA$, L=1m, k=10, q=10000', fontsize=11)
        ax.legend(fontsize=11)
        ax.grid(True, which='both', linestyle='--', alpha=0.6)
        # Annotate points
        for h, e, n in zip(h_vals, errors, n_elem):
            ax.annotate(f'{n} elem\n{e:.6f}°C', (h, e),
                        textcoords='offset points', xytext=(8, 4), fontsize=8)
        plt.tight_layout()
        out = os.path.join(RESULTS_DIR, 'convergence_study_plot.png')
        plt.savefig(out, dpi=150, bbox_inches='tight')
        plt.close()
        print(f"[PLOT] Convergence plot saved: {out}")
    else:
        # ASCII fallback
        print("\n=== FEM Convergence Study (Log-Log) ===")
        print(f"{'N_elem':>8} {'h(m)':>10} {'Error(°C)':>14} {'Ratio':>8}")
        prev_e = None
        for h, e, n in zip(h_vals, errors, n_elem):
            ratio = f"{prev_e/e:.3f}" if prev_e else "baseline"
            print(f"{n:>8} {h:>10.4f} {e:>14.6f} {ratio:>8}")
            prev_e = e


def plot_benchmark():
    """Plot parallel benchmark: speedup and efficiency vs thread count."""
    rows = read_csv('benchmark_multithread_results.csv')
    threads = [int(r['worker_count']) for r in rows]
    speedups = [float(r['speedup']) for r in rows]
    efficiencies = [float(r['efficiency_pct']) for r in rows]
    medians = [float(r['median_ms']) for r in rows]

    if HAS_MATPLOTLIB:
        fig, axes = plt.subplots(1, 2, figsize=(12, 5))

        # Speedup plot
        ax = axes[0]
        ax.plot(threads, speedups, 'o-b', linewidth=2, markersize=8, label='Measured Speedup')
        ax.plot(threads, threads, '--k', linewidth=1.2, alpha=0.5, label='Ideal Linear Speedup')
        for t, s in zip(threads, speedups):
            ax.annotate(f'{s:.2f}×', (t, s), textcoords='offset points',
                        xytext=(5, 5), fontsize=9)
        ax.set_xlabel('Worker Threads', fontsize=12)
        ax.set_ylabel('Speedup S = T₁ / Tₚ', fontsize=12)
        ax.set_title('Parallel Speedup\n(200 FEA cases, 80 elem, seed=42)', fontsize=11)
        ax.set_xticks(threads)
        ax.legend(fontsize=10)
        ax.grid(True, linestyle='--', alpha=0.6)

        # Efficiency plot
        ax = axes[1]
        ax.bar(threads, efficiencies, color='steelblue', edgecolor='navy', alpha=0.8)
        ax.axhline(100, color='red', linestyle='--', linewidth=1.2, label='100% Efficiency')
        for t, e in zip(threads, efficiencies):
            ax.text(t, e + 1.5, f'{e:.1f}%', ha='center', fontsize=10)
        ax.set_xlabel('Worker Threads', fontsize=12)
        ax.set_ylabel('Parallel Efficiency E = S/p × 100%', fontsize=12)
        ax.set_title('Parallel Efficiency\n(Median of 5 repetitions, 1 warm-up)', fontsize=11)
        ax.set_xticks(threads)
        ax.set_ylim(0, 115)
        ax.legend(fontsize=10)
        ax.grid(True, axis='y', linestyle='--', alpha=0.6)

        plt.suptitle('Multithreaded Performance Benchmark — Unified Engineering Workbench',
                     fontsize=12, fontweight='bold', y=1.01)
        plt.tight_layout()
        out = os.path.join(RESULTS_DIR, 'benchmark_plot.png')
        plt.savefig(out, dpi=150, bbox_inches='tight')
        plt.close()
        print(f"[PLOT] Benchmark plot saved: {out}")
    else:
        print("\n=== Parallel Benchmark Results ===")
        print(f"{'Threads':>8} {'Median(ms)':>12} {'Speedup':>10} {'Efficiency%':>12}")
        for t, m, s, e in zip(threads, medians, speedups, efficiencies):
            print(f"{t:>8} {m:>12.2f} {s:>10.2f} {e:>12.1f}")


def plot_neural_loss():
    """Plot neural network loss convergence over 100 training steps."""
    rows = read_csv('neural_training_history.csv')
    steps = [int(r['step']) for r in rows]
    losses = [float(r['loss']) for r in rows]

    if HAS_MATPLOTLIB:
        fig, axes = plt.subplots(1, 2, figsize=(12, 5))

        # Linear scale
        ax = axes[0]
        ax.plot(steps, losses, '-b', linewidth=1.8)
        ax.set_xlabel('Training Step', fontsize=12)
        ax.set_ylabel('Loss J = 0.5(ŷ-y)²', fontsize=12)
        ax.set_title('Neural Network Loss (Linear Scale)\n'
                     r'$J_0$≈1.1825 → $J_{100}$≈2.68×10⁻²⁰', fontsize=11)
        ax.grid(True, linestyle='--', alpha=0.6)

        # Log scale
        ax = axes[1]
        ax.semilogy(steps, losses, '-r', linewidth=1.8)
        ax.set_xlabel('Training Step', fontsize=12)
        ax.set_ylabel('Loss J (log scale)', fontsize=12)
        ax.set_title('Neural Network Loss (Log Scale)\n'
                     'Exponential convergence to near-zero', fontsize=11)
        ax.grid(True, which='both', linestyle='--', alpha=0.6)

        plt.suptitle('Backpropagation Training — Unified Engineering Workbench\n'
                     r'$h=\tanh(wx+b)$, $\hat{y}=vh+c$, $\eta=0.1$, x=1.0, y=2.0',
                     fontsize=11, fontweight='bold', y=1.02)
        plt.tight_layout()
        out = os.path.join(RESULTS_DIR, 'neural_training_plot.png')
        plt.savefig(out, dpi=150, bbox_inches='tight')
        plt.close()
        print(f"[PLOT] Neural training plot saved: {out}")
    else:
        print("\n=== Neural Network Loss Curve ===")
        print(f"{'Step':>6} {'Loss':>20}")
        for step, loss in zip(steps[::10], losses[::10]):
            bar = '#' * min(40, max(1, int(-math.log10(max(loss, 1e-25)) * 2)))
            print(f"{step:>6} {loss:>20.6e} {bar}")


def plot_thermal_fem():
    """Plot FEM vs analytical temperature distribution for 20-element mesh."""
    rows = read_csv('thermal_fem_20_elements.csv')
    xs = [float(r['x_m']) for r in rows]
    t_fem = [float(r['T_fem_C']) for r in rows]
    t_exact = [float(r['T_exact_C']) for r in rows]

    if HAS_MATPLOTLIB:
        fig, axes = plt.subplots(1, 2, figsize=(12, 5))

        ax = axes[0]
        ax.plot(xs, t_exact, '-r', linewidth=2, label='Analytical Exact')
        ax.plot(xs, t_fem, 'ob', markersize=6, linewidth=1.5,
                markerfacecolor='none', label='FEM Nodes (20 elements)')
        ax.set_xlabel('Position x (m)', fontsize=12)
        ax.set_ylabel('Temperature T (°C)', fontsize=12)
        ax.set_title('1D Thermal FEA: FEM vs Analytical\n'
                     r'$T(x)=100-80\frac{x}{L}+\frac{q}{2k}x(L-x)$', fontsize=11)
        ax.legend(fontsize=10)
        ax.grid(True, linestyle='--', alpha=0.6)

        ax = axes[1]
        errors = [abs(f - e) for f, e in zip(t_fem, t_exact)]
        ax.plot(xs, errors, '-g', linewidth=2)
        ax.set_xlabel('Position x (m)', fontsize=12)
        ax.set_ylabel('|T_FEM - T_exact| (°C)', fontsize=12)
        ax.set_title('Nodal Error Distribution\n'
                     f'Max node error = {max(errors):.6f} °C', fontsize=11)
        ax.grid(True, linestyle='--', alpha=0.6)

        plt.suptitle('Thermal FEM Analysis (20 Elements) — Unified Engineering Workbench',
                     fontsize=12, fontweight='bold', y=1.01)
        plt.tight_layout()
        out = os.path.join(RESULTS_DIR, 'thermal_fem_plot.png')
        plt.savefig(out, dpi=150, bbox_inches='tight')
        plt.close()
        print(f"[PLOT] Thermal FEM plot saved: {out}")
    else:
        print("\n=== Thermal FEM: FEM vs Analytical (20 elements) ===")
        print(f"{'x(m)':>8} {'T_FEM':>12} {'T_exact':>12} {'|error|':>12}")
        for x, tf, te in zip(xs, t_fem, t_exact):
            print(f"{x:>8.4f} {tf:>12.6f} {te:>12.6f} {abs(tf-te):>12.2e}")


if __name__ == '__main__':
    print("=== Unified Engineering Workbench — Result Plot Generator ===")
    print(f"Results directory: {RESULTS_DIR}")
    print(f"Matplotlib available: {HAS_MATPLOTLIB}\n")

    plot_convergence()
    plot_benchmark()
    plot_neural_loss()
    plot_thermal_fem()

    print("\n=== Plot Generation Complete ===")
    if HAS_MATPLOTLIB:
        generated = [f for f in os.listdir(RESULTS_DIR) if f.endswith('.png')]
        print(f"Generated {len(generated)} PNG plot(s): {', '.join(sorted(generated))}")
    else:
        print("Install matplotlib for PNG output: pip install matplotlib numpy")

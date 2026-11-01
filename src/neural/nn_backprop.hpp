#pragma once
#include <cmath>
#include <vector>
#include <string>
#include <sstream>
#include <stdexcept>

// ============================================================
// Neural Network: Single-sample regression, handcoded backprop
// 
// Architecture:
//   h    = tanh(w*x + b)      [hidden unit]
//   y_hat = v*h + c           [output]
//   J    = 0.5*(y_hat - y)^2  [MSE loss]
//
// Parameters: w, b, v, c
// Training sample: x=1, y=2
// Initial: w=0.5, b=0, v=1, c=0
// Learning rate: 0.1
// ============================================================

namespace neural {

struct Params {
    double w = 0.5, b = 0.0, v = 1.0, c = 0.0;
};

struct TrainStep {
    int    step;
    double loss;
    double w, b, v, c;
    // Gradients
    double dJ_dw, dJ_db, dJ_dv, dJ_dc;
};

struct ForwardResult {
    double h;      // tanh(w*x + b)
    double y_hat;  // v*h + c
    double J;      // 0.5*(y_hat - y)^2
};

// Forward pass
inline ForwardResult forward(const Params& p, double x, double y) {
    ForwardResult r;
    r.h     = std::tanh(p.w * x + p.b);
    r.y_hat = p.v * r.h + p.c;
    r.J     = 0.5 * (r.y_hat - y) * (r.y_hat - y);
    return r;
}

// Analytical gradients via chain rule:
//   dJ/dc   = (y_hat - y)
//   dJ/dv   = (y_hat - y) * h
//   dJ/d(pre) where pre = w*x + b:
//     dJ/d(pre) = (y_hat - y) * v * (1 - h^2)
//   dJ/db   = dJ/d(pre) * 1
//   dJ/dw   = dJ/d(pre) * x
struct Gradients {
    double dJ_dw, dJ_db, dJ_dv, dJ_dc;
};

inline Gradients compute_gradients(const Params& p, const ForwardResult& f, double x, double y) {
    double err   = f.y_hat - y;
    double dJ_dc = err;
    double dJ_dv = err * f.h;
    double dpre  = err * p.v * (1.0 - f.h * f.h);  // chain through tanh
    double dJ_db = dpre;
    double dJ_dw = dpre * x;
    return {dJ_dw, dJ_db, dJ_dv, dJ_dc};
}

// Finite-difference gradient check (central differences, epsilon=1e-6)
inline Gradients fd_gradients(const Params& p0, double x, double y, double eps = 1e-6) {
    auto loss = [&](const Params& p) { return forward(p, x, y).J; };
    Gradients fd;
    {Params p = p0; p.w += eps; double fp = loss(p); p.w = p0.w - eps; double fm = loss(p);
     fd.dJ_dw = (fp - fm) / (2.0 * eps);}
    {Params p = p0; p.b += eps; double fp = loss(p); p.b = p0.b - eps; double fm = loss(p);
     fd.dJ_db = (fp - fm) / (2.0 * eps);}
    {Params p = p0; p.v += eps; double fp = loss(p); p.v = p0.v - eps; double fm = loss(p);
     fd.dJ_dv = (fp - fm) / (2.0 * eps);}
    {Params p = p0; p.c += eps; double fp = loss(p); p.c = p0.c - eps; double fm = loss(p);
     fd.dJ_dc = (fp - fm) / (2.0 * eps);}
    return fd;
}

// Run training for n_steps steps, returning history
// Returns: {steps, params, loss, gradients}
struct TrainResult {
    std::vector<TrainStep> history;
    double grad_check_max_error;  // max |analytic - fd| gradient error at step 0
    bool   grad_check_passed;     // <= 1e-5
    Params final_params;
};

inline TrainResult train(int n_steps = 100, double lr = 0.1,
                          double x = 1.0, double y = 2.0,
                          Params initial = {}) {
    Params p = initial;
    TrainResult result;

    // Gradient check at initial params
    auto f0 = forward(p, x, y);
    auto g_analytic = compute_gradients(p, f0, x, y);
    auto g_fd       = fd_gradients(p, x, y);
    double max_err = 0.0;
    max_err = std::max(max_err, std::abs(g_analytic.dJ_dw - g_fd.dJ_dw));
    max_err = std::max(max_err, std::abs(g_analytic.dJ_db - g_fd.dJ_db));
    max_err = std::max(max_err, std::abs(g_analytic.dJ_dv - g_fd.dJ_dv));
    max_err = std::max(max_err, std::abs(g_analytic.dJ_dc - g_fd.dJ_dc));
    result.grad_check_max_error = max_err;
    result.grad_check_passed    = (max_err <= 1e-5);

    for (int step = 0; step < n_steps; ++step) {
        auto f = forward(p, x, y);
        auto g = compute_gradients(p, f, x, y);

        TrainStep ts;
        ts.step  = step;
        ts.loss  = f.J;
        ts.w = p.w; ts.b = p.b; ts.v = p.v; ts.c = p.c;
        ts.dJ_dw = g.dJ_dw; ts.dJ_db = g.dJ_db;
        ts.dJ_dv = g.dJ_dv; ts.dJ_dc = g.dJ_dc;
        result.history.push_back(ts);

        // Simultaneous gradient-descent update
        p.w -= lr * g.dJ_dw;
        p.b -= lr * g.dJ_db;
        p.v -= lr * g.dJ_dv;
        p.c -= lr * g.dJ_dc;
    }
    result.final_params = p;
    return result;
}

} // namespace neural

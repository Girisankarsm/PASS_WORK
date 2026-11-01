#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <chrono>
#include <thread>
#include <mutex>
#include <atomic>
#include <map>
#include <memory>
#include <functional>
#include <filesystem>
#include <sys/utsname.h>

// Single-header libraries (fetched by CMake)
#undef CPPHTTPLIB_OPENSSL_SUPPORT
#include "httplib.h"
#include "nlohmann/json.hpp"

// Engineering modules
#include "core/thermal_solver.hpp"
#include "geometry/stl_parser.hpp"
#include "performance/benchmark.hpp"
#include "hardware/hw_mock.hpp"
#include "neural/nn_backprop.hpp"

using json = nlohmann::json;

// ============================================================
// Globals and job management
// ============================================================

static std::mutex g_jobs_mutex;
static std::atomic<int> g_job_id_counter{1};
static std::map<int, json> g_jobs;

static hardware::MockMCU  g_mcu;
static hardware::MockFPGA g_fpga;
static hardware::MockJTAG g_jtag;

// ============================================================
// Utility helpers
// ============================================================

static json make_error(int code, const std::string& msg) {
    return {{"success", false}, {"error", {{"code", code}, {"message", msg}}}};
}

static json make_success(json data = json::object()) {
    data["success"] = true;
    return data;
}

static int new_job(const std::string& type) {
    int id = g_job_id_counter++;
    std::lock_guard<std::mutex> lk(g_jobs_mutex);
    g_jobs[id] = {{"id", id}, {"type", type}, {"status", "pending"}, {"progress", 0}};
    return id;
}

static void update_job(int id, json update) {
    std::lock_guard<std::mutex> lk(g_jobs_mutex);
    auto it = g_jobs.find(id);
    if (it != g_jobs.end()) it->second.merge_patch(update);
}

static json get_job(int id) {
    std::lock_guard<std::mutex> lk(g_jobs_mutex);
    auto it = g_jobs.find(id);
    if (it == g_jobs.end()) return json::object();
    return it->second;
}

// ============================================================
// CORS helper
// ============================================================

static void set_cors(httplib::Response& res) {
    res.set_header("Access-Control-Allow-Origin", "*");
    res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set_header("Access-Control-Allow-Headers", "Content-Type");
}

// ============================================================
// Route handlers
// ============================================================

// GET /api/health
static void handle_health(const httplib::Request&, httplib::Response& res) {
    set_cors(res);
    struct utsname u; uname(&u);
    json resp = make_success({
        {"version", "1.0.0"},
        {"backend", "C++17 / Apple Clang"},
        {"os", std::string(u.sysname) + " " + u.release},
        {"timestamp", std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()).count()}
    });
    res.set_content(resp.dump(), "application/json");
}

// GET /api/system-info
static void handle_system_info(const httplib::Request&, httplib::Response& res) {
    set_cors(res);
    struct utsname u; uname(&u);
    json resp = make_success({
        {"cpu_logical_cores", (int)std::thread::hardware_concurrency()},
        {"cpu_physical_cores", (int)std::thread::hardware_concurrency()},
        {"os_name", std::string(u.sysname)},
        {"os_release", std::string(u.release)},
        {"machine", std::string(u.machine)},
        {"compiler", "Apple Clang 21.0.0"},
        {"cpp_standard", "C++17"},
        {"optimization", "-O2"},
        {"build_type", "RelWithDebInfo"}
    });
    res.set_content(resp.dump(), "application/json");
}

// POST /api/geometry/parse-stl
static void handle_parse_stl(const httplib::Request& req, httplib::Response& res) {
    set_cors(res);
    try {
        auto body = json::parse(req.body);
        std::string content = body.at("content").get<std::string>();
        if (content.size() > 20 * 1024 * 1024)
            throw std::runtime_error("File too large (max 20 MB)");
        auto model = geometry::parse_ascii_stl(content);
        json resp = make_success({
            {"name",          model.name},
            {"triangle_count", (int)model.triangles.size()},
            {"bounds", {
                {"min", {model.min_pt.x, model.min_pt.y, model.min_pt.z}},
                {"max", {model.max_pt.x, model.max_pt.y, model.max_pt.z}},
                {"center", {model.center.x, model.center.y, model.center.z}}
            }},
            {"triangles", [&]() {
                json tris = json::array();
                for (auto& t : model.triangles) {
                    tris.push_back({
                        {"n",  {t.normal.x, t.normal.y, t.normal.z}},
                        {"v0", {t.v0.x, t.v0.y, t.v0.z}},
                        {"v1", {t.v1.x, t.v1.y, t.v1.z}},
                        {"v2", {t.v2.x, t.v2.y, t.v2.z}}
                    });
                }
                return tris;
            }()}
        });
        res.set_content(resp.dump(), "application/json");
    } catch (const std::exception& e) {
        res.status = 400;
        res.set_content(make_error(400, e.what()).dump(), "application/json");
    }
}

// POST /api/geometry/parse-csv
static void handle_parse_csv(const httplib::Request& req, httplib::Response& res) {
    set_cors(res);
    try {
        auto body = json::parse(req.body);
        std::string content = body.at("content").get<std::string>();
        auto data = geometry::parse_temp_csv(content);
        json nodes = json::array();
        for (auto& n : data.nodes) {
            nodes.push_back({{"id", n.node_id}, {"x", n.x}, {"y", n.y}, {"z", n.z}, {"T", n.temperature_C}});
        }
        json resp = make_success({
            {"node_count",     (int)data.nodes.size()},
            {"T_min",          data.T_min},
            {"T_max",          data.T_max},
            {"nodes",          nodes}
        });
        res.set_content(resp.dump(), "application/json");
    } catch (const std::exception& e) {
        res.status = 400;
        res.set_content(make_error(400, e.what()).dump(), "application/json");
    }
}

// POST /api/thermal/solve
static void handle_thermal_solve(const httplib::Request& req, httplib::Response& res) {
    set_cors(res);
    try {
        auto body = json::parse(req.body);
        int n_elem = body.value("n_elements", 20);
        if (n_elem < 1 || n_elem > 10000)
            throw std::invalid_argument("n_elements must be in [1, 10000]");

        thermal::SolverParams p;
        p.L  = body.value("L", 1.0);
        p.A  = body.value("A", 1e-4);
        p.k  = body.value("k", 10.0);
        p.q  = body.value("q", 10000.0);
        p.T0 = body.value("T0", 100.0);
        p.TL = body.value("TL", 20.0);

        auto result = thermal::solve(n_elem, p);

        json nodes_j = json::array();
        for (auto& n : result.nodes) {
            nodes_j.push_back({{"x", n.x}, {"T_fem", n.T_fem}, {"T_exact", n.T_exact}});
        }
        json resp = make_success({
            {"n_elements",         result.n_elements},
            {"max_midpoint_error", result.max_midpoint_error},
            {"nodes",              nodes_j},
            {"params",             {{"L", p.L}, {"A", p.A}, {"k", p.k}, {"q", p.q}, {"T0", p.T0}, {"TL", p.TL}}}
        });
        res.set_content(resp.dump(), "application/json");
    } catch (const std::exception& e) {
        res.status = 400;
        res.set_content(make_error(400, e.what()).dump(), "application/json");
    }
}

// POST /api/thermal/convergence
static void handle_thermal_convergence(const httplib::Request& req, httplib::Response& res) {
    set_cors(res);
    try {
        thermal::SolverParams p;
        if (!req.body.empty()) {
            auto body = json::parse(req.body);
            p.k = body.value("k", p.k);
            p.q = body.value("q", p.q);
        }
        std::vector<int> meshes = {10, 20, 40, 80};
        json results = json::array();
        for (int m : meshes) {
            auto r = thermal::solve(m, p);
            results.push_back({{"n_elements", m}, {"max_midpoint_error", r.max_midpoint_error}});
        }
        res.set_content(make_success({{"convergence", results}}).dump(), "application/json");
    } catch (const std::exception& e) {
        res.status = 400;
        res.set_content(make_error(400, e.what()).dump(), "application/json");
    }
}

// POST /api/performance/benchmark  (async job)
static void handle_benchmark(const httplib::Request& req, httplib::Response& res) {
    set_cors(res);
    try {
        int n_cases = 50, n_elem = 40;
        if (!req.body.empty()) {
            auto body = json::parse(req.body);
            n_cases = body.value("n_cases", 50);
            n_elem  = body.value("n_elem",  40);
        }
        int job_id = new_job("benchmark");
        // Launch async
        std::thread([job_id, n_cases, n_elem]() {
            try {
                update_job(job_id, {{"status", "running"}, {"progress", 10}});
                auto report = performance::run_benchmark(n_cases, n_elem);
                update_job(job_id, {{"status", "running"}, {"progress", 90}});

                json serial_j = {
                    {"worker_count",   1},
                    {"median_ms",      report.serial_result.median_ms},
                    {"rep_times_ms",   report.serial_result.rep_times_ms}
                };
                json parallel_j = json::array();
                for (auto& pr : report.parallel_results) {
                    double speedup   = report.serial_result.median_ms / pr.median_ms;
                    double efficiency = speedup / pr.worker_count;
                    parallel_j.push_back({
                        {"worker_count",   pr.worker_count},
                        {"median_ms",      pr.median_ms},
                        {"rep_times_ms",   pr.rep_times_ms},
                        {"speedup",        speedup},
                        {"efficiency",     efficiency}
                    });
                }
                json result = {
                    {"n_cases",              report.n_cases},
                    {"n_elem",               report.n_elem},
                    {"n_reps",               report.n_reps},
                    {"n_warmup",             report.n_warmup},
                    {"serial",               serial_j},
                    {"parallel",             parallel_j},
                    {"max_agreement_error",  report.max_agreement_error},
                    {"agreement_passed",     report.agreement_passed},
                    {"system_info",          report.system_info},
                    {"compiler",             "Apple Clang 21.0.0 -O2"}
                };
                update_job(job_id, {{"status", "done"}, {"progress", 100}, {"result", result}});
            } catch (const std::exception& e) {
                update_job(job_id, {{"status", "error"}, {"error", e.what()}});
            }
        }).detach();

        res.set_content(make_success({{"job_id", job_id}}).dump(), "application/json");
    } catch (const std::exception& e) {
        res.status = 400;
        res.set_content(make_error(400, e.what()).dump(), "application/json");
    }
}

// GET /api/jobs/:id
static void handle_job_status(const httplib::Request& req, httplib::Response& res) {
    set_cors(res);
    try {
        int id = std::stoi(req.path_params.at("id"));
        auto job = get_job(id);
        if (job.empty()) {
            res.status = 404;
            res.set_content(make_error(404, "Job not found").dump(), "application/json");
            return;
        }
        res.set_content(make_success(job).dump(), "application/json");
    } catch (...) {
        res.status = 400;
        res.set_content(make_error(400, "Invalid job id").dump(), "application/json");
    }
}

static std::string normalize_device(std::string d) {
    for (char& c : d) c = std::tolower(static_cast<unsigned char>(c));
    if (d.find("mcu") != std::string::npos) return "mcu";
    if (d.find("fpga") != std::string::npos) return "fpga";
    if (d.find("jtag") != std::string::npos) return "jtag";
    return d;
}

// POST /api/hardware/connect
static void handle_hw_connect(const httplib::Request& req, httplib::Response& res) {
    set_cors(res);
    try {
        auto body = json::parse(req.body);
        std::string raw_device = body.at("device").get<std::string>();
        std::string device = normalize_device(raw_device);
        bool simulate_failure = body.value("simulate_failure", false);

        bool ok = false;
        std::string status_str, error_str;

        if (device == "mcu") {
            ok = g_mcu.connect(simulate_failure);
            status_str = ok ? "connected" : "error";
            error_str  = g_mcu.info.last_error;
        } else if (device == "fpga") {
            ok = g_fpga.connect();
            status_str = ok ? "connected" : "error";
        } else if (device == "jtag") {
            ok = g_jtag.connect(simulate_failure);
            status_str = ok ? "connected" : "error";
            error_str  = g_jtag.info.last_error;
        } else {
            throw std::invalid_argument("Unknown device: " + raw_device);
        }

        json resp = make_success({
            {"device", device},
            {"connected", ok},
            {"status", status_str},
            {"error", error_str},
            {"simulated", true}
        });
        res.set_content(resp.dump(), "application/json");
    } catch (const std::exception& e) {
        res.status = 400;
        res.set_content(make_error(400, e.what()).dump(), "application/json");
    }
}

// POST /api/hardware/disconnect
static void handle_hw_disconnect(const httplib::Request& req, httplib::Response& res) {
    set_cors(res);
    try {
        auto body = json::parse(req.body);
        std::string raw_device = body.at("device").get<std::string>();
        std::string device = normalize_device(raw_device);
        if (device == "mcu") g_mcu.disconnect();
        else if (device == "fpga") g_fpga.disconnect();
        else if (device == "jtag") g_jtag.disconnect();
        else throw std::invalid_argument("Unknown device: " + raw_device);
        res.set_content(make_success({{"device", device}, {"connected", false}}).dump(), "application/json");
    } catch (const std::exception& e) {
        res.status = 400;
        res.set_content(make_error(400, e.what()).dump(), "application/json");
    }
}

// GET /api/hardware/telemetry/:device
static void handle_hw_telemetry(const httplib::Request& req, httplib::Response& res) {
    set_cors(res);
    try {
        std::string raw_device = req.path_params.at("device");
        std::string device = normalize_device(raw_device);
        hardware::Telemetry t;
        bool connected = false;
        if      (device == "mcu")  { t = g_mcu.get_telemetry();  connected = g_mcu.connected; }
        else if (device == "fpga") { t = g_fpga.get_telemetry(); connected = g_fpga.connected; }
        else if (device == "jtag") { t = g_jtag.get_telemetry(); connected = g_jtag.connected; }
        else throw std::invalid_argument("Unknown device: " + raw_device);

        json extra = json::object();
        for (auto& [k, v] : t.extra) extra[k] = v;

        res.set_content(make_success({
            {"device",        device},
            {"connected",     connected},
            {"voltage_V",     t.voltage_V},
            {"current_mA",    t.current_mA},
            {"temperature_C", t.temperature_C},
            {"uptime_ms",     t.uptime_ms},
            {"extra",         extra},
            {"simulated",     true}
        }).dump(), "application/json");
    } catch (const std::exception& e) {
        res.status = 400;
        res.set_content(make_error(400, e.what()).dump(), "application/json");
    }
}

// GET /api/hardware/devices
static void handle_hw_devices(const httplib::Request&, httplib::Response& res) {
    set_cors(res);
    auto device_info_json = [](const hardware::DeviceInfo& d) {
        json caps = json::array();
        for (auto& c : d.capabilities) caps.push_back({{"name", c.name}, {"desc", c.description}});
        std::string st;
        switch (d.status) {
            case hardware::DeviceStatus::CONNECTED: st = "connected"; break;
            case hardware::DeviceStatus::DISCONNECTED: st = "disconnected"; break;
            case hardware::DeviceStatus::CONNECTING: st = "connecting"; break;
            case hardware::DeviceStatus::ERROR: st = "error"; break;
        }
        return json{
            {"id", d.id}, {"name", d.name}, {"vendor", d.vendor},
            {"part_number", d.part_number}, {"firmware", d.firmware_version},
            {"capabilities", caps}, {"interfaces", d.interfaces},
            {"status", st}, {"last_error", d.last_error}, {"simulated", true}
        };
    };
    res.set_content(make_success({
        {"devices", json::array({
            device_info_json(g_mcu.info),
            device_info_json(g_fpga.info),
            device_info_json(g_jtag.info)
        })}
    }).dump(), "application/json");
}

// POST /api/neural/train
static void handle_neural_train(const httplib::Request& req, httplib::Response& res) {
    set_cors(res);
    try {
        int n_steps = 100;
        double lr = 0.1;
        if (!req.body.empty()) {
            auto body = json::parse(req.body);
            n_steps = body.value("n_steps", 100);
            lr      = body.value("lr", 0.1);
        }
        if (n_steps < 1 || n_steps > 10000) throw std::invalid_argument("n_steps must be in [1, 10000]");
        if (lr <= 0 || lr > 10.0) throw std::invalid_argument("lr must be in (0, 10]");

        auto result = neural::train(n_steps, lr);

        json history = json::array();
        for (auto& s : result.history) {
            history.push_back({{"step", s.step}, {"loss", s.loss},
                {"w", s.w}, {"b", s.b}, {"v", s.v}, {"c", s.c},
                {"dJ_dw", s.dJ_dw}, {"dJ_db", s.dJ_db},
                {"dJ_dv", s.dJ_dv}, {"dJ_dc", s.dJ_dc}});
        }
        json resp = make_success({
            {"history",              history},
            {"final_params",         {{"w", result.final_params.w}, {"b", result.final_params.b},
                                       {"v", result.final_params.v}, {"c", result.final_params.c}}},
            {"grad_check_max_error", result.grad_check_max_error},
            {"grad_check_passed",    result.grad_check_passed},
            {"n_steps",              n_steps},
            {"lr",                   lr}
        });
        res.set_content(resp.dump(), "application/json");
    } catch (const std::exception& e) {
        res.status = 400;
        res.set_content(make_error(400, e.what()).dump(), "application/json");
    }
}

// ============================================================
// Main
// ============================================================

int main(int argc, char* argv[]) {
    int port = 8080;
    if (argc > 1) port = std::stoi(argv[1]);

    httplib::Server svr;

    // Preflight OPTIONS for CORS
    svr.Options(".*", [](const httplib::Request&, httplib::Response& res) {
        set_cors(res);
        res.set_content("", "text/plain");
    });

    // Routes
    svr.Get("/api/health",           handle_health);
    svr.Get("/api/system-info",      handle_system_info);
    svr.Post("/api/geometry/parse-stl", handle_parse_stl);
    svr.Post("/api/geometry/parse-csv", handle_parse_csv);
    svr.Post("/api/thermal/solve",   handle_thermal_solve);
    svr.Post("/api/thermal/convergence", handle_thermal_convergence);
    svr.Post("/api/performance/benchmark", handle_benchmark);
    svr.Get("/api/jobs/:id",         handle_job_status);
    svr.Get("/api/hardware/devices", handle_hw_devices);
    svr.Post("/api/hardware/connect",    handle_hw_connect);
    svr.Post("/api/hardware/disconnect", handle_hw_disconnect);
    svr.Get("/api/hardware/telemetry/:device", handle_hw_telemetry);
    svr.Post("/api/neural/train",    handle_neural_train);

    // Mount static frontend bundle if present
    std::string dist_path = "";
    if (std::filesystem::exists("frontend/dist")) dist_path = "frontend/dist";
    else if (std::filesystem::exists("../frontend/dist")) dist_path = "../frontend/dist";
    else if (std::filesystem::exists("dist")) dist_path = "dist";

    if (!dist_path.empty()) {
        svr.set_mount_point("/", dist_path);
        std::cout << "Serving static frontend bundle from: " << dist_path << std::endl;
    }

    std::cout << "=== Unified Engineering Workbench Backend ===" << std::endl;
    std::cout << "Listening on http://localhost:" << port << std::endl;
    std::cout << "C++17 | Apple Clang 21.0.0 | " << std::thread::hardware_concurrency() << " logical CPUs" << std::endl;

    svr.listen("0.0.0.0", port);
    return 0;
}

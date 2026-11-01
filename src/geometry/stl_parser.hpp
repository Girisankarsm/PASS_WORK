#pragma once
#include <string>
#include <vector>
#include <array>
#include <stdexcept>
#include <sstream>
#include <cctype>
#include <cmath>
#include <limits>

// ============================================================
// ASCII STL Parser
// Supports ASCII STL format only (binary not implemented)
// ============================================================

namespace geometry {

struct Vec3 {
    double x, y, z;
};

struct Triangle {
    Vec3 normal;
    Vec3 v0, v1, v2;
};

struct STLModel {
    std::string name;
    std::vector<Triangle> triangles;
    // Bounding box
    Vec3 min_pt, max_pt;
    Vec3 center;
};

inline bool is_finite_vec(const Vec3& v) {
    return std::isfinite(v.x) && std::isfinite(v.y) && std::isfinite(v.z);
}

inline STLModel parse_ascii_stl(const std::string& content) {
    STLModel model;
    std::istringstream ss(content);
    std::string line, token;

    // Read first line for "solid <name>"
    if (!std::getline(ss, line)) throw std::runtime_error("Empty STL file");
    {
        std::istringstream ls(line);
        std::string solid_kw;
        ls >> solid_kw;
        if (solid_kw != "solid") throw std::runtime_error("Not an ASCII STL: missing 'solid' keyword");
        std::string name;
        std::getline(ls >> std::ws, name);
        model.name = name;
    }

    Vec3 global_min = {std::numeric_limits<double>::max(),
                        std::numeric_limits<double>::max(),
                        std::numeric_limits<double>::max()};
    Vec3 global_max = {std::numeric_limits<double>::lowest(),
                        std::numeric_limits<double>::lowest(),
                        std::numeric_limits<double>::lowest()};

    auto update_bounds = [&](const Vec3& v) {
        global_min.x = std::min(global_min.x, v.x);
        global_min.y = std::min(global_min.y, v.y);
        global_min.z = std::min(global_min.z, v.z);
        global_max.x = std::max(global_max.x, v.x);
        global_max.y = std::max(global_max.y, v.y);
        global_max.z = std::max(global_max.z, v.z);
    };

    auto parse_vec3 = [](const std::string& ln) -> Vec3 {
        std::istringstream ls(ln);
        std::string kw;
        double x, y, z;
        ls >> kw >> x >> y >> z;
        if (ls.fail()) throw std::runtime_error("Failed to parse vertex/normal: " + ln);
        return {x, y, z};
    };

    bool in_facet = false;
    Triangle current;
    int vertex_idx = 0;

    while (std::getline(ss, line)) {
        std::istringstream ls(line);
        ls >> token;
        if (token == "facet") {
            in_facet = true;
            vertex_idx = 0;
            // parse normal: "facet normal nx ny nz"
            std::string kw;
            double nx, ny, nz;
            ls >> kw >> nx >> ny >> nz;
            current.normal = {nx, ny, nz};
        } else if (token == "vertex") {
            double x, y, z;
            ls >> x >> y >> z;
            if (ls.fail()) throw std::runtime_error("Malformed vertex line: " + line);
            Vec3 v = {x, y, z};
            if (!is_finite_vec(v)) throw std::runtime_error("Non-finite vertex coordinates");
            if      (vertex_idx == 0) current.v0 = v;
            else if (vertex_idx == 1) current.v1 = v;
            else if (vertex_idx == 2) current.v2 = v;
            vertex_idx++;
        } else if (token == "endfacet") {
            if (vertex_idx != 3) throw std::runtime_error("Facet does not have exactly 3 vertices");
            if (!is_finite_vec(current.v0) || !is_finite_vec(current.v1) || !is_finite_vec(current.v2))
                throw std::runtime_error("Non-finite vertex in facet");
            model.triangles.push_back(current);
            update_bounds(current.v0);
            update_bounds(current.v1);
            update_bounds(current.v2);
            in_facet = false;
        } else if (token == "endsolid") {
            break;
        }
    }

    if (model.triangles.empty()) throw std::runtime_error("STL file contains no triangles");

    model.min_pt = global_min;
    model.max_pt = global_max;
    model.center = {
        0.5 * (global_min.x + global_max.x),
        0.5 * (global_min.y + global_max.y),
        0.5 * (global_min.z + global_max.z)
    };
    return model;
}

// ============================================================
// Temperature CSV Parser
// Schema: node_id,x_m,y_m,z_m,temperature_C
// ============================================================

struct TempNode {
    int    node_id;
    double x, y, z;
    double temperature_C;
};

struct TempData {
    std::vector<TempNode> nodes;
    double T_min, T_max;
};

inline TempData parse_temp_csv(const std::string& content) {
    TempData data;
    data.T_min =  std::numeric_limits<double>::max();
    data.T_max = -std::numeric_limits<double>::max();

    std::istringstream ss(content);
    std::string line;

    // Find header line, skipping empty lines and comments
    bool found_header = false;
    while (std::getline(ss, line)) {
        // trim leading whitespace
        size_t first = line.find_first_not_of(" \t\r\n");
        if (first == std::string::npos) continue;
        if (line[first] == '#') continue;
        found_header = true;
        break;
    }
    if (!found_header) throw std::runtime_error("Empty CSV or missing header");
    // Validate header
    {
        std::istringstream hs(line);
        std::vector<std::string> cols;
        std::string col;
        while (std::getline(hs, col, ',')) {
            // trim
            col.erase(0, col.find_first_not_of(" \t\r\n"));
            col.erase(col.find_last_not_of(" \t\r\n") + 1);
            cols.push_back(col);
        }
        if (cols.size() < 5) throw std::runtime_error("CSV must have at least 5 columns: node_id,x_m,y_m,z_m,temperature_C");
        if (cols[0] != "node_id" || cols[1] != "x_m" || cols[2] != "y_m" ||
            cols[3] != "z_m"    || cols[4] != "temperature_C")
            throw std::runtime_error("CSV header mismatch. Expected: node_id,x_m,y_m,z_m,temperature_C");
    }

    int row = 1;
    while (std::getline(ss, line)) {
        ++row;
        if (line.empty() || line[0] == '#') continue;
        std::istringstream ls(line);
        TempNode n;
        char comma;
        if (!(ls >> n.node_id >> comma >> n.x >> comma >> n.y >> comma >> n.z >> comma >> n.temperature_C))
            throw std::runtime_error("Malformed CSV row " + std::to_string(row) + ": " + line);
        if (!std::isfinite(n.x) || !std::isfinite(n.y) || !std::isfinite(n.z) || !std::isfinite(n.temperature_C))
            throw std::runtime_error("Non-finite value in CSV row " + std::to_string(row));
        data.nodes.push_back(n);
        data.T_min = std::min(data.T_min, n.temperature_C);
        data.T_max = std::max(data.T_max, n.temperature_C);
    }

    if (data.nodes.empty()) throw std::runtime_error("CSV has no data rows");
    return data;
}

} // namespace geometry

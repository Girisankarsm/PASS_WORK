#pragma once
#include <string>
#include <vector>
#include <map>
#include <chrono>
#include <thread>
#include <stdexcept>
#include <sstream>
#include <random>

// ============================================================
// Embedded Hardware Mock Adapters
// Clearly labeled as SIMULATED - no physical hardware tested
// ============================================================

#ifdef ERROR
#undef ERROR
#endif

namespace hardware {

enum class DeviceType { MCU, FPGA, JTAG };
enum class DeviceStatus { DISCONNECTED, CONNECTING, CONNECTED, ERROR };

struct Capability {
    std::string name;
    std::string description;
};

struct Telemetry {
    double voltage_V;
    double current_mA;
    double temperature_C;
    uint64_t uptime_ms;
    std::map<std::string, double> extra;
};

struct DeviceInfo {
    std::string id;
    std::string name;
    DeviceType  type;
    std::string vendor;
    std::string part_number;
    std::string firmware_version;
    std::vector<Capability> capabilities;
    std::vector<std::string> interfaces;
    DeviceStatus status;
    std::string  last_error;
};

// ---- Mock MCU (e.g. STM32F4) ----
struct MockMCU {
    DeviceInfo info;
    bool connected = false;
    uint64_t connect_time_ms = 0;

    MockMCU() {
        info.id = "MCU-STM32F4-001";
        info.name = "STM32F446RE Nucleo [SIMULATED]";
        info.type = DeviceType::MCU;
        info.vendor = "STMicroelectronics";
        info.part_number = "STM32F446RETx";
        info.firmware_version = "1.2.3-mock";
        info.capabilities = {
            {"ADC", "12-bit, 12 channels"},
            {"UART", "115200 baud, 8N1"},
            {"SPI", "10 MHz max"},
            {"I2C", "400 kHz fast mode"},
            {"GPIO", "51 pins"},
            {"Timer", "14x hardware timers"}
        };
        info.interfaces = {"USB-CDC", "ST-Link", "JTAG/SWD"};
        info.status = DeviceStatus::DISCONNECTED;
    }

    bool connect(bool simulate_failure = false) {
        std::this_thread::sleep_for(std::chrono::milliseconds(80)); // simulated latency
        if (simulate_failure) {
            info.status = DeviceStatus::ERROR;
            info.last_error = "[SIMULATED] USB enumeration timeout after 80ms";
            connected = false;
            return false;
        }
        connected = true;
        info.status = DeviceStatus::CONNECTED;
        info.last_error = "";
        connect_time_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now().time_since_epoch()).count();
        return true;
    }

    bool disconnect() {
        std::this_thread::sleep_for(std::chrono::milliseconds(20));
        connected = false;
        info.status = DeviceStatus::DISCONNECTED;
        return true;
    }

    Telemetry get_telemetry() {
        if (!connected) throw std::runtime_error("[SIMULATED] Device not connected");
        auto now = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now().time_since_epoch()).count();
        std::mt19937 rng(now & 0xFFFF);
        std::normal_distribution<double> noise(0.0, 0.01);
        Telemetry t;
        t.voltage_V     = 3.300 + noise(rng);
        t.current_mA    = 85.0  + noise(rng) * 5.0;
        t.temperature_C = 42.5  + noise(rng) * 2.0;
        t.uptime_ms     = now - connect_time_ms;
        t.extra["adc_ch0"] = 1.245 + noise(rng);
        t.extra["gpio_state"] = 0x3F;
        return t;
    }
};

// ---- Mock FPGA (e.g. Xilinx Artix-7) ----
struct MockFPGA {
    DeviceInfo info;
    bool connected = false;
    bool bitstream_loaded = false;

    MockFPGA() {
        info.id = "FPGA-ARTIX7-001";
        info.name = "Xilinx Artix-7 XC7A35T [SIMULATED]";
        info.type = DeviceType::FPGA;
        info.vendor = "AMD/Xilinx";
        info.part_number = "XC7A35TCPG236-1";
        info.firmware_version = "bitstream-v0.9-mock";
        info.capabilities = {
            {"LUTs", "20800 logic cells"},
            {"DSP48E1", "90 DSP slices"},
            {"BRAM", "25 x 36Kb"},
            {"IOB", "106 user I/O"},
            {"PLL", "5x MMCM/PLL"},
            {"LVDS", "Differential I/O pairs"}
        };
        info.interfaces = {"JTAG", "UART", "SPI Flash", "PMOD"};
        info.status = DeviceStatus::DISCONNECTED;
    }

    bool connect() {
        std::this_thread::sleep_for(std::chrono::milliseconds(150));
        connected = true;
        info.status = DeviceStatus::CONNECTED;
        return true;
    }

    bool load_bitstream(const std::string& /*path*/) {
        if (!connected) throw std::runtime_error("[SIMULATED] Not connected");
        std::this_thread::sleep_for(std::chrono::milliseconds(200));
        bitstream_loaded = true;
        return true;
    }

    bool disconnect() {
        connected = false;
        bitstream_loaded = false;
        info.status = DeviceStatus::DISCONNECTED;
        return true;
    }

    Telemetry get_telemetry() {
        if (!connected) throw std::runtime_error("[SIMULATED] FPGA not connected");
        Telemetry t;
        t.voltage_V     = 1.000;  // VCCINT 1.0V
        t.current_mA    = 320.0;
        t.temperature_C = 55.0;
        t.uptime_ms     = 12345;
        t.extra["vccaux"] = 1.800;
        t.extra["vcco_0"] = 3.300;
        t.extra["bitstream_loaded"] = bitstream_loaded ? 1.0 : 0.0;
        t.extra["lut_utilization_pct"] = 47.3;
        return t;
    }
};

// ---- Mock JTAG Debug Adapter (e.g. J-Link) ----
struct MockJTAG {
    DeviceInfo info;
    bool connected = false;
    bool scan_done = false;
    std::vector<std::string> scan_chain;

    MockJTAG() {
        info.id = "JTAG-JLINK-001";
        info.name = "Segger J-Link EDU Mini [SIMULATED]";
        info.type = DeviceType::JTAG;
        info.vendor = "Segger";
        info.part_number = "8.08.28";
        info.firmware_version = "J-Link_V10.20s-mock";
        info.capabilities = {
            {"JTAG", "IEEE 1149.1, 100 kHz – 15 MHz"},
            {"SWD", "ARM Serial Wire Debug"},
            {"SWO", "Serial Wire Output trace"},
            {"TRST", "Test reset pin"},
            {"nSRST", "System reset pin"}
        };
        info.interfaces = {"USB 2.0 Full Speed"};
        info.status = DeviceStatus::DISCONNECTED;
    }

    bool connect(bool simulate_timeout = false) {
        std::this_thread::sleep_for(std::chrono::milliseconds(60));
        if (simulate_timeout) {
            info.status = DeviceStatus::ERROR;
            info.last_error = "[SIMULATED] JTAG scan chain: no devices found (timeout 60ms)";
            return false;
        }
        connected = true;
        info.status = DeviceStatus::CONNECTED;
        scan_chain = {"IR_LEN=4 IDCODE=0x2BA01477 [STM32 Cortex-M4]",
                       "IR_LEN=6 IDCODE=0x0362D093 [XC7A35T]"};
        scan_done = true;
        return true;
    }

    bool disconnect() {
        connected = false;
        scan_done = false;
        scan_chain.clear();
        info.status = DeviceStatus::DISCONNECTED;
        return true;
    }

    Telemetry get_telemetry() {
        if (!connected) throw std::runtime_error("[SIMULATED] JTAG not connected");
        Telemetry t;
        t.voltage_V = 3.3;
        t.current_mA = 5.0;
        t.temperature_C = 35.0;
        t.uptime_ms = 5000;
        t.extra["tck_freq_khz"] = 4000;
        t.extra["devices_in_chain"] = scan_chain.size();
        return t;
    }
};

} // namespace hardware

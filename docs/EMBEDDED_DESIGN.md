# Embedded Hardware Integration Design
**Pass Science Works R&D Internship 2026–2027**

> [!NOTE]
> All hardware drivers, communication buses, and device telemetry in this module are **[SIMULATED]**. No physical hardware was connected or damaged during development.

---

## 1. System Architecture & Block Diagram

The embedded hardware integration module simulates an industrial hardware-in-the-loop (HIL) testbench consisting of a host workstation, a Segger J-Link debug adapter, an STM32F4 microcontroller target, and an Artix-7 FPGA target.

```
+-------------------------------------------------------------------------+
|                           Host Workstation                              |
|             Unified Engineering Workbench Backend (C++17)                |
+-------------------------------------------------------------------------+
                                     | USB 2.0 High-Speed (5.0V VBUS)
                                     v
+-------------------------------------------------------------------------+
|                  Segger J-Link EDU Debug Probe [SIMULATED]              |
|   - VCC Sense (Pin 1) detects target voltage (1.8V - 3.3V)              |
|   - Internal Bi-directional Level Shifters (TXB0108 / TXS0108)           |
+-------------------------------------------------------------------------+
                 |                                      |
         SWD Bus (3.3V Logic)                  JTAG Bus (1.8V Logic)
                 |                                      |
                 v                                      v
+----------------------------------+   +----------------------------------+
|    STM32F446RE Nucleo Target     |   |      Xilinx Artix-7 FPGA Target  |
|          [SIMULATED]             |   |             [SIMULATED]          |
| - Domain: 3.3V VDD               |   | - Domain: 1.0V VCCINT (Core)     |
| - ARM Cortex-M4 @ 180 MHz        |   | - Domain: 1.8V VCCO_0 (JTAG I/O) |
| - Interface: SWDIO, SWCLK, NRST  |   | - Interface: TDI, TDO, TCK, TMS  |
+----------------------------------+   +----------------------------------+
                 \                                      /
                  \---- Common Ground Star Topology ---/
```

---

## 2. Interface & Pin-Voltage Table

| Signal | Pin Name | Direction | Voltage Domain | Primary Owner | Description & Electrical Constraint |
|:---|:---|:---:|:---:|:---:|:---|
| **SWDIO / TMS** | PA13 / TMS | Bidirectional | 3.3V / 1.8V | J-Link / Target | SWD data line / JTAG mode select. Driven by J-Link during setup. |
| **SWDCLK / TCK** | PA14 / TCK | Output from Host | 3.3V / 1.8V | J-Link | Synchronous test clock (up to 4.0 MHz). Must maintain clean edges. |
| **TDI** | T8 (FPGA) | Output from Host | 1.8V | J-Link | JTAG Test Data In. Shifted on falling edge of TCK. |
| **TDO** | R8 (FPGA) | Input to Host | 1.8V | Target (FPGA) | JTAG Test Data Out. High impedance (tri-state) except in Shift-IR/DR. |
| **nSRST / NRST** | NRST (MCU) | Open-drain Output | 3.3V | J-Link | System reset. Active-low with 10 kΩ pull-up to target 3.3V VDD. |
| **VCC (Sense)** | Pin 1 (Header) | Input to J-Link | 1.8V - 3.3V | Target | Target reference sense pin; powers adapter output buffer stages. |
| **GND** | Header Pins | Reference (0V) | 0.0V | Star Common | Common ground return path; mandatory to avoid ground-bounce faults. |
| **SWO** | PB3 (MCU) | Input to Host | 3.3V | Target (MCU) | Serial Wire Output for ITM instrumentation and real-time trace. |

---

## 3. Voltage Domains & Level-Shifting Assumptions

1. **Dual Domain Isolation**:
   - The STM32F4 operates entirely within a **3.3V single-supply domain**.
   - The Artix-7 FPGA operates with split rails: **1.0V internal core logic (VCCINT)** and **1.8V dedicated configuration/JTAG bank (VCCO_0)**.
2. **Level-Shifting Architecture**:
   - Connecting 3.3V directly to the FPGA's 1.8V JTAG bank would violate the absolute maximum ratings ($V_{\text{in,max}} = V_{\text{CCO}} + 0.55\text{V} = 2.35\text{V}$) and cause irreversible ESD clamp diode burnout.
   - The J-Link adapter dynamically shifts its output driver levels to match the voltage sensed on Pin 1 (Target Reference). When multiplexed between MCU and FPGA, active bidirectional level-shifters (such as TI TXB0108) translate between 3.3V and 1.8V domains.

---

## 4. JTAG Signal Ownership & Protocol Rules

- **TCK (Clock)**: Solely owned and driven by the JTAG master (J-Link). Targets never drive this line.
- **TMS (State Machine)**: Solely owned by the J-Link master. Changes on the falling edge of TCK to transition TAP states (Test-Logic-Reset, Shift-DR, Shift-IR).
- **TDI (Data Input)**: Owned by the J-Link master; presents bitstream shifted into the target register.
- **TDO (Data Output)**: Owned by the target device currently addressed in the scan chain. Must remain in high-impedance state ($Z$) during all states other than `Shift-IR` and `Shift-DR`.
- **Chain Integrity**: When chaining MCU and FPGA in series, TDI enters Device 1, TDO of Device 1 connects to TDI of Device 2, and TDO of Device 2 returns to J-Link.

---

## 5. Safe Integration Plan & Recovery Procedures

1. **Power-Up Sequence**:
   - Step 1: Connect common ground (GND) across all boards.
   - Step 2: Power target systems (3.3V MCU, 1.8V FPGA).
   - Step 3: Connect J-Link VCC sense pin to verify stable target rail.
   - Step 4: Assert system reset (nSRST) low while initializing clock lines.
2. **Simulated Fault Injection**:
   - The workbench simulates communication timeouts (e.g. lost clock pulses, cable disconnections, and parity faults).
   - Upon fault detection (`status = "error"`), the host issues a bus reset sequence: driving TMS high for 5 consecutive TCK cycles to force all target TAP controllers into `Test-Logic-Reset`.
   - The UI permits the user to simulate recoverable connection errors and test the automatic retry logic.

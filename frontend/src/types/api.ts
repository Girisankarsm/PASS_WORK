// ============================================================
// Shared TypeScript interfaces mirroring C++ backend responses
// ============================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  error?: { code: number; message: string };
  [key: string]: unknown;
}

export interface HealthResponse {
  success: boolean;
  version: string;
  backend: string;
  os: string;
  timestamp: number;
}

export interface SystemInfoResponse {
  success: boolean;
  cpu_logical_cores: number;
  cpu_physical_cores: number;
  os_name: string;
  os_release: string;
  machine: string;
  compiler: string;
  cpp_standard: string;
  optimization: string;
  build_type: string;
}

// Geometry
export interface STLTriangle {
  n: [number, number, number];
  v0: [number, number, number];
  v1: [number, number, number];
  v2: [number, number, number];
}

export interface STLBounds {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
}

export interface STLResult {
  success: boolean;
  name: string;
  triangle_count: number;
  bounds: STLBounds;
  triangles: STLTriangle[];
}

export interface TempNode {
  id: number;
  x: number; y: number; z: number;
  T: number;
}

export interface CSVResult {
  success: boolean;
  node_count: number;
  T_min: number;
  T_max: number;
  nodes: TempNode[];
}

// Thermal
export interface ThermalNode {
  x: number;
  T_fem: number;
  T_exact: number;
}

export interface ThermalParams {
  L: number; A: number; k: number; q: number; T0: number; TL: number;
}

export interface ThermalResult {
  success: boolean;
  n_elements: number;
  max_midpoint_error: number;
  nodes: ThermalNode[];
  params: ThermalParams;
}

export interface ConvergencePoint {
  n_elements: number;
  max_midpoint_error: number;
}

export interface ConvergenceResult {
  success: boolean;
  convergence: ConvergencePoint[];
}

// Performance
export interface RunResult {
  worker_count: number;
  median_ms: number;
  rep_times_ms: number[];
  speedup?: number;
  efficiency?: number;
}

export interface BenchmarkResult {
  n_cases: number;
  n_elem: number;
  n_reps: number;
  n_warmup: number;
  serial: RunResult;
  parallel: RunResult[];
  max_agreement_error: number;
  agreement_passed: boolean;
  system_info: string;
  compiler: string;
}

// Job
export interface JobStatus {
  success: boolean;
  id: number;
  type: string;
  status: 'pending' | 'running' | 'done' | 'error';
  progress: number;
  result?: BenchmarkResult;
  error?: string;
}

// Hardware
export interface DeviceCapability {
  name: string;
  desc: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  vendor: string;
  part_number: string;
  firmware: string;
  capabilities: DeviceCapability[];
  interfaces: string[];
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  last_error: string;
  simulated: boolean;
}

export interface HardwareDevicesResult {
  success: boolean;
  devices: DeviceInfo[];
}

export interface TelemetryResult {
  success: boolean;
  device: string;
  connected: boolean;
  voltage_V: number;
  current_mA: number;
  temperature_C: number;
  uptime_ms: number;
  extra: Record<string, number>;
  simulated: boolean;
}

// Neural Network
export interface TrainStep {
  step: number;
  loss: number;
  w: number; b: number; v: number; c: number;
  dJ_dw: number; dJ_db: number; dJ_dv: number; dJ_dc: number;
}

export interface NeuralTrainResult {
  success: boolean;
  history: TrainStep[];
  final_params: { w: number; b: number; v: number; c: number };
  grad_check_max_error: number;
  grad_check_passed: boolean;
  n_steps: number;
  lr: number;
}

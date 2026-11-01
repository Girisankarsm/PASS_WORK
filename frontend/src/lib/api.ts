// ============================================================
// Centralized API Client
// All requests go through this module.
// Base URL: /api (proxied by Vite to http://localhost:8080)
// ============================================================

import type {
  HealthResponse, SystemInfoResponse,
  STLResult, CSVResult,
  ThermalResult, ConvergenceResult,
  JobStatus, HardwareDevicesResult, TelemetryResult,
  NeuralTrainResult,
} from '../types/api';

const BASE = '/api';
const TIMEOUT_MS = 30000;

class ApiError extends Error {
  constructor(public code: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${BASE}${path}`);
  const data = await res.json();
  if (!data.success) throw new ApiError(data.error?.code ?? res.status, data.error?.message ?? 'Request failed');
  return data as T;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithTimeout(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.success) throw new ApiError(data.error?.code ?? res.status, data.error?.message ?? 'Request failed');
  return data as T;
}

// Polling helper for async jobs
export async function pollJob(
  jobId: number,
  onProgress?: (p: number) => void,
  intervalMs = 500,
  maxWaitMs = 120000,
): Promise<JobStatus> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const job = await apiGet<JobStatus>(`/jobs/${jobId}`);
    onProgress?.(job.progress ?? 0);
    if (job.status === 'done') return job;
    if (job.status === 'error') throw new ApiError(500, job.error ?? 'Job failed');
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new ApiError(408, 'Job timed out');
}

export const api = {
  health:        () => apiGet<HealthResponse>('/health'),
  systemInfo:    () => apiGet<SystemInfoResponse>('/system-info'),

  parseSTL:      (content: string) => apiPost<STLResult>('/geometry/parse-stl', { content }),
  parseCSV:      (content: string) => apiPost<CSVResult>('/geometry/parse-csv', { content }),

  thermalSolve:  (params: Record<string, number>) => apiPost<ThermalResult>('/thermal/solve', params),
  thermalConvergence: (params?: Record<string, number>) => apiPost<ConvergenceResult>('/thermal/convergence', params ?? {}),

  benchmark:     (n_cases: number, n_elem: number) =>
    apiPost<{ success: boolean; job_id: number }>('/performance/benchmark', { n_cases, n_elem }),

  hwDevices:     () => apiGet<HardwareDevicesResult>('/hardware/devices'),
  hwConnect:     (device: string, simulate_failure = false) =>
    apiPost<{ success: boolean; connected: boolean; status: string; error: string }>('/hardware/connect', { device, simulate_failure }),
  hwDisconnect:  (device: string) =>
    apiPost<{ success: boolean }>('/hardware/disconnect', { device }),
  hwTelemetry:   (device: string) => apiGet<TelemetryResult>(`/hardware/telemetry/${device}`),

  neuralTrain:   (n_steps: number, lr: number) =>
    apiPost<NeuralTrainResult>('/neural/train', { n_steps, lr }),
};

export { ApiError };

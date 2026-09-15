/**
 * Runtime performance metrics and debugging overlay module
 *
 * Collects and displays performance metrics including FPS, memory usage,
 * GPU information, and event loop lag. Provides debugging overlay
 * functionality for performance monitoring and optimization.
 */

import { perf } from './settings';

interface GpuInfo { vendor: string; renderer: string }
interface ChromePerformanceMemory { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number }

let gpuInfo: GpuInfo | null = null;
let eventLoopLagMs = 0;
let lastIntervalTs = 0;

function detectGpuInfo(): GpuInfo | null {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return null;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      const vendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL);
      const renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
      return { vendor: String(vendor), renderer: String(renderer) };
    }
    // Fallback: use version string
    return { vendor: 'WebGL', renderer: String(gl.getParameter(gl.VERSION)) };
  } catch (_e) {
    return null;
  }
}

function formatMb(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function getHeapLine() {
  const m = (performance as Performance & { memory?: ChromePerformanceMemory }).memory ?? null;
  if (!m) return 'Heap: n/a';
  const used = m.usedJSHeapSize || 0;
  const total = m.totalJSHeapSize || 0;
  const limit = m.jsHeapSizeLimit || 0;
  const base = limit || total || 0;
  if (!base) return `Heap: ${formatMb(used)} MB`;
  const pct = Math.min(100, Math.max(0, (used / base) * 100));
  const cap = limit ? `/${formatMb(limit)} MB` : total ? `/${formatMb(total)} MB` : '';
  return `Heap: ${formatMb(used)} MB${cap} (${pct.toFixed(0)}%)`;
}

export function initRuntimeMetrics() {
  if (typeof window === 'undefined') return;
  if (!gpuInfo) gpuInfo = detectGpuInfo();
  // Track event loop lag via interval drift
  lastIntervalTs = performance.now();
  setInterval(() => {
    const now = performance.now();
    const expected = lastIntervalTs + perf.timing.metricsUpdateIntervalMs;
    const drift = now - expected; // positive when lagging
    lastIntervalTs = now;
    // EWMA to smooth
    const alpha = perf.timing.eventLoopLagAlpha;
    eventLoopLagMs = Math.max(0, alpha * drift + (1 - alpha) * eventLoopLagMs);
  }, perf.timing.metricsUpdateIntervalMs);
}

export function buildOverlayText(currentFps: number) {
  const fps = Math.max(0, Math.round(currentFps || 0));
  const ms = fps > 0 ? Math.round(1000 / fps) : 0;
  const heap = getHeapLine();
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 'n/a';
  const dpr = (window.devicePixelRatio || 1).toFixed(2);
  const lag = eventLoopLagMs > perf.metrics.lagThresholdMs ? `${eventLoopLagMs.toFixed(1)}ms lag` : 'ok';
  const gpu = gpuInfo ? `${gpuInfo.vendor} — ${gpuInfo.renderer}` : 'GPU: n/a';
  return `${fps} fps | ~${ms} ms/frame | loop: ${lag}\n${heap}\nCores: ${cores} | DPR: ${dpr}\n${gpu}`;
}



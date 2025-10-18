// Browser runtime metrics overlay helpers

let gpuInfo = null;
let eventLoopLagMs = 0;
let lastIntervalTs = 0;

function detectGpuInfo() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return null;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      const vendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL);
      const renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
      return { vendor, renderer };
    }
    // Fallback: use version string
    return { vendor: 'WebGL', renderer: gl.getParameter(gl.VERSION) };
  } catch (_e) {
    return null;
  }
}

function formatMb(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function getHeapLine() {
  const m = performance && performance.memory ? performance.memory : null;
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
  if (!gpuInfo) gpuInfo = detectGpuInfo();
  // Track event loop lag via interval drift
  lastIntervalTs = performance.now();
  setInterval(() => {
    const now = performance.now();
    const expected = lastIntervalTs + 500;
    const drift = now - expected; // positive when lagging
    lastIntervalTs = now;
    // EWMA to smooth
    const alpha = 0.2;
    eventLoopLagMs = Math.max(0, alpha * drift + (1 - alpha) * eventLoopLagMs);
  }, 500);
}

export function buildOverlayText(currentFps) {
  const fps = Math.max(0, Math.round(currentFps || 0));
  const ms = fps > 0 ? Math.round(1000 / fps) : 0;
  const heap = getHeapLine();
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 'n/a';
  const dpr = (window.devicePixelRatio || 1).toFixed(2);
  const lag = eventLoopLagMs > 0.5 ? `${eventLoopLagMs.toFixed(1)}ms lag` : 'ok';
  const gpu = gpuInfo ? `${gpuInfo.vendor} — ${gpuInfo.renderer}` : 'GPU: n/a';
  return `${fps} fps | ~${ms} ms/frame | loop: ${lag}\n${heap}\nCores: ${cores} | DPR: ${dpr}\n${gpu}`;
}



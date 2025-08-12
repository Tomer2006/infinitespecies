/* PNG Export */
import { canvas, exportPngBtn, puffLink, puffLinkAnchor } from './dom.js';
import { current } from './state.js';

function makeSafeFilename(name) {
  const base = (name || 'biozoom').toString().trim() || 'biozoom';
  const safe = base
    .toLowerCase()
    .replace(/[^a-z0-9\-_.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `${safe}-${ts}.png`;
}

export function setupExportPNG() {
  if (!exportPngBtn || !canvas) return;
  exportPngBtn.addEventListener('click', () => exportPNG());
}

export function exportPNG() {
  try {
    const name = current && current.name ? current.name : 'biozoom';
    const filename = makeSafeFilename(name);

    const done = (url) => {
      if (puffLink && puffLinkAnchor) {
        puffLinkAnchor.href = url;
        if (!puffLinkAnchor.getAttribute('download')) {
          puffLinkAnchor.setAttribute('download', filename);
        }
        puffLink.style.display = 'block';
        // Auto-click to download immediately
        // Keep the puff visible as a fallback link
        setTimeout(() => { try { puffLinkAnchor.click(); } catch (_) {} }, 0);
        // Hide the puff link after a short while
        setTimeout(() => { if (puffLink) puffLink.style.display = 'none'; }, 6000);
      }
      // Revoke after a delay to allow download to start
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    };

    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        // Ensure filename on anchor
        if (puffLinkAnchor) {
          puffLinkAnchor.setAttribute('download', filename);
        }
        done(url);
      }, 'image/png');
    } else {
      // Fallback for very old browsers
      const dataUrl = canvas.toDataURL('image/png');
      if (puffLinkAnchor) {
        puffLinkAnchor.setAttribute('download', filename);
      }
      done(dataUrl);
    }
  } catch (err) {
    console.error('PNG export failed:', err);
  }
}



/* Image preview stubs */
import { bigPreview, bigPreviewImg, bigPreviewCap } from './dom.js';

export let thumbDelayTimer = null;
export let lastThumbShownForId = 0;
export let isPreviewPinned = false;

export function hideBigPreview() {
  if (bigPreview) bigPreview.style.display = 'none';
}

export function showBigFor(node) {
  if (!bigPreview) return;
  bigPreview.style.display = 'block';
  if (bigPreviewImg) bigPreviewImg.src = '';
  if (bigPreviewCap) bigPreviewCap.textContent = node && node.name ? node.name : '';
}

export function pinPreviewFor(node) {
  isPreviewPinned = true;
  showBigFor(node);
}

export function unpinPreview() {
  isPreviewPinned = false;
  hideBigPreview();
}



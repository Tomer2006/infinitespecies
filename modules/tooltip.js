/* Tooltip updates */
import { ttip, tName, tMeta } from './dom.js';

export function updateTooltip(node, x, y) {
  if (!ttip) return;
  if (!node) {
    ttip.style.opacity = 0;
    return;
  }
  if (tName) tName.textContent = node.name || '';
  if (tMeta) tMeta.textContent = node.level ? String(node.level) : '';
  ttip.style.opacity = 1;
  ttip.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
}



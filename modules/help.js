/* Help modal */
import { helpModal } from './dom.js';

export function openHelp() {
  if (helpModal) helpModal.classList.add('open');
}

export function closeHelp() {
  if (helpModal) helpModal.classList.remove('open');
}

export function setupHelpModal() {
  // no-op placeholder for compatibility
}



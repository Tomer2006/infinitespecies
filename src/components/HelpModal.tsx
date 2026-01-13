import { motion } from 'framer-motion'

interface HelpModalProps {
  onClose: () => void
}

const controls = [
  { key: 'Left Click', description: 'Zoom into a group (desktop only)' },
  { key: 'Right Click / Long Press', description: 'Zoom out to parent' },
  { key: 'Mouse Wheel / Pinch', description: 'Smooth zoom in/out' },
  { key: 'Middle Drag / Drag', description: 'Pan the view' },
  { key: 'Double Tap', description: 'Fit current node in view' },
  { key: 'Hover / Touch', description: 'Show image preview' },
  { key: 'Enter', description: 'Search and navigate' },
  { key: 'S', description: 'Web search current/hovered' },
  { key: 'R', description: 'Reset to root' },
  { key: 'F', description: 'Fit current node in view' },
  { key: 'H', description: 'Hide/show controls panel' },
  { key: '?', description: 'Toggle this help panel' },
]

export default function HelpModal({ onClose }: HelpModalProps) {
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        className="modal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">Keyboard Shortcuts & Controls</h2>
          <div className="modal-header-actions">
            <button className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="help-grid">
            {controls.map((control) => (
              <div key={control.key} className="help-item">
                <span className="help-key">{control.key}</span>
                <span className="help-description">{control.description}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}


import { motion } from 'framer-motion'

interface AboutModalProps {
  onClose: () => void
}

export default function AboutModal({ onClose }: AboutModalProps) {
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
          <h2 className="modal-title">About InfiniteSpecies</h2>
          <div className="modal-header-actions">
            <button className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="modal-section">
            <h4>🧬 InfiniteSpecies</h4>
            <p>
              InfiniteSpecies is an interactive web application for exploring the Tree of Life.
              It provides a zoomable, interactive visualization of taxonomic relationships
              across millions of organisms.
            </p>
            <p style={{ marginTop: '1rem' }}>
              Navigate through the hierarchy of life from the highest domains down to
              individual species. Use smooth zooming and panning to explore at any level
              of detail.
            </p>
          </div>

          <div className="modal-section" style={{ marginTop: '1rem' }}>
            <h4>Features</h4>
            <p>• Circle-packing visualization of taxonomic hierarchy</p>
            <p>• Smooth camera animations and transitions</p>
            <p>• Search functionality to find any organism</p>
            <p>• Integration with external databases (Wikipedia, GBIF, etc.)</p>
            <p>• Deep linking for sharing specific views</p>
            <p>• Keyboard shortcuts for power users</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}


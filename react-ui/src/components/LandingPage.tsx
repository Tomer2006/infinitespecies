import { motion } from 'framer-motion'

interface LandingPageProps {
  onStart: () => void
  onHelp: () => void
  onAbout: () => void
}

export default function LandingPage({ onStart, onHelp, onAbout }: LandingPageProps) {
  return (
    <motion.div
      className="landing-page"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="landing-content"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className="landing-logo"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        >
          🧬
        </motion.div>

        <motion.h1
          className="landing-title"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          infinitespecies
        </motion.h1>

        <motion.p
          className="landing-tagline"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          Explore the Tree of Life — millions of organisms in one zoomable map.
        </motion.p>

        <motion.div
          className="landing-menu"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <motion.button
            className="landing-btn landing-btn-primary"
            onClick={onStart}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="landing-btn-icon">🌍</span>
            <span>Start Exploration</span>
            <span className="landing-btn-hint">Usually takes 10 seconds to load</span>
          </motion.button>

          <motion.button
            className="landing-btn landing-btn-secondary"
            onClick={onHelp}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="landing-btn-icon">❓</span>
            <span>Help</span>
          </motion.button>

          <motion.button
            className="landing-btn landing-btn-secondary"
            onClick={onAbout}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="landing-btn-icon">ℹ️</span>
            <span>About</span>
          </motion.button>
        </motion.div>

        <motion.div
          className="landing-footer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          <p>Navigate with mouse and keyboard. Press <kbd>?</kbd> for controls.</p>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}


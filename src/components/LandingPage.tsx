import { motion } from 'framer-motion'

interface LandingPageProps {
  onStart: () => void
  onHelp: () => void
  onAbout: () => void
  onSettings: () => void
}

export default function LandingPage({ onStart, onHelp, onAbout, onSettings }: LandingPageProps) {
  return (
    <motion.div
      className="landing-page"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Top-left header */}
      <motion.div
        className="landing-header"
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="landing-title">InfiniteSpecies</h1>
        <p className="landing-tagline">
          millions of organisms<br />
          one <span className="highlight">zoomable map</span>.
        </p>
      </motion.div>

      {/* Center content */}
      <motion.div
        className="landing-center"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.button
          className="landing-start-btn"
          onClick={onStart}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="landing-start-icon">🌍</span>
          <span className="landing-start-text">Start Exploration</span>
          <span className="landing-start-hint">Usually takes 10 seconds to load</span>
        </motion.button>
      </motion.div>

      {/* Bottom buttons */}
      <motion.div
        className="landing-footer-buttons"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <motion.button
          className="landing-footer-btn"
          onClick={onSettings}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Settings
        </motion.button>
        <motion.button
          className="landing-footer-btn"
          onClick={onAbout}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          About
        </motion.button>
        <motion.button
          className="landing-footer-btn"
          onClick={onHelp}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Help
        </motion.button>
      </motion.div>
    </motion.div>
  )
}

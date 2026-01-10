import { motion } from 'framer-motion'

export default function MobileBlocker() {
  return (
    <motion.div 
      className="mobile-blocker"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="mobile-blocker-content">
        <motion.div 
          className="mobile-blocker-icon"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 200, 
            damping: 15,
            delay: 0.2 
          }}
        >
          💻
        </motion.div>
        
        <motion.h1 
          className="mobile-blocker-title"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          Desktop Only
        </motion.h1>
        
        <motion.p 
          className="mobile-blocker-message"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          InfiniteSpecies is designed for desktop exploration.
          <br />
          Please visit us on a computer to experience the full tree of life.
        </motion.p>

        <motion.div 
          className="mobile-blocker-devices"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="device device-no">
            <span className="device-icon">📱</span>
            <span className="device-label">Mobile</span>
            <span className="device-status">✕</span>
          </div>
          <div className="device device-no">
            <span className="device-icon">📲</span>
            <span className="device-label">Tablet</span>
            <span className="device-status">✕</span>
          </div>
          <div className="device device-yes">
            <span className="device-icon">🖥️</span>
            <span className="device-label">Desktop</span>
            <span className="device-status">✓</span>
          </div>
        </motion.div>

        <motion.div 
          className="mobile-blocker-hint"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          🌍 Explore 2.3 million species on a larger screen
        </motion.div>
      </div>

      {/* Floating particles for atmosphere */}
      <div className="mobile-blocker-particles">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="particle"
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0.2, 0.5, 0.2],
              y: [-20, 20, -20],
              x: [-10, 10, -10],
            }}
            transition={{
              duration: 4 + i,
              repeat: Infinity,
              delay: i * 0.5,
            }}
            style={{
              left: `${15 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
            }}
          />
        ))}
      </div>
    </motion.div>
  )
}


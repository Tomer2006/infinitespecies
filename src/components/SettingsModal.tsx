import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { perf } from '../modules/settings'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  // Load saved settings from localStorage or use defaults
  const getSavedFontPreset = () => {
    const saved = localStorage.getItem('infinitespecies_fontPreset')
    if (saved && perf.fonts.presets[saved as keyof typeof perf.fonts.presets]) {
      return saved
    }
    return perf.fonts.currentPreset
  }
  
  const getSavedColorPreset = () => {
    const saved = localStorage.getItem('infinitespecies_colorPreset')
    if (saved && perf.colors.presets[saved as keyof typeof perf.colors.presets]) {
      return saved
    }
    return perf.colors.currentPreset
  }

  const getSavedSearchProvider = () => {
    const saved = localStorage.getItem('infinitespecies_searchProvider')
    if (saved && perf.search.providers[saved as keyof typeof perf.search.providers]) {
      return saved
    }
    return perf.search.currentProvider
  }

  const [currentColorPreset, setCurrentColorPreset] = useState(getSavedColorPreset)
  const [currentFontPreset, setCurrentFontPreset] = useState(getSavedFontPreset)
  const [currentSearchProvider, setCurrentSearchProvider] = useState(getSavedSearchProvider)

  // Color preset options
  const colorPresets = Object.keys(perf.colors.presets)
  
  // Font preset options
  const fontPresets = Object.keys(perf.fonts.presets)

  // Search provider options
  const searchProviders = Object.keys(perf.search.providers)

  const handleColorChange = (preset: string) => {
    setCurrentColorPreset(preset)
    perf.colors.currentPreset = preset
    // Save to localStorage
    localStorage.setItem('infinitespecies_colorPreset', preset)
  }

  const handleSearchProviderChange = (provider: string) => {
    setCurrentSearchProvider(provider)
    perf.search.currentProvider = provider
    // Save to localStorage
    localStorage.setItem('infinitespecies_searchProvider', provider)
  }

  const handleFontChange = (preset: string) => {
    setCurrentFontPreset(preset)
    perf.fonts.currentPreset = preset
    // Save to localStorage
    localStorage.setItem('infinitespecies_fontPreset', preset)
    
    // Apply font immediately
    const fontConfig = perf.fonts.presets[preset as keyof typeof perf.fonts.presets]
    if (fontConfig) {
      // Load Google Font if needed
      if (fontConfig.import) {
        const existingLink = document.querySelector(`link[href*="${fontConfig.import}"]`)
        if (!existingLink) {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = `https://fonts.googleapis.com/css2?family=${fontConfig.import}&display=swap`
          document.head.appendChild(link)
        }
      }
      
      // Apply to CSS variables
      document.documentElement.style.setProperty('--font-sans', `'${fontConfig.name}', ui-sans-serif, system-ui, -apple-system, sans-serif`)
      document.documentElement.style.setProperty('--font-mono', `'${fontConfig.name}', ui-sans-serif, system-ui, -apple-system, sans-serif`)
      
      // Apply to canvas labels
      perf.rendering.labelFontFamily = `'${fontConfig.name}', ui-sans-serif, system-ui, sans-serif`
    }
  }

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal settings-modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Settings</h2>
              <button className="modal-close" onClick={onClose} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="modal-body settings-body">
              {/* Font Settings */}
              <div className="settings-section">
                <h3 className="settings-section-title">Font</h3>
                <div className="settings-select-group">
                  <label htmlFor="font-select">Font Family</label>
                  <select
                    id="font-select"
                    className="settings-select"
                    value={currentFontPreset}
                    onChange={(e) => handleFontChange(e.target.value)}
                  >
                    {fontPresets.map((preset) => (
                      <option key={preset} value={preset}>
                        {perf.fonts.presets[preset as keyof typeof perf.fonts.presets].name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Color Settings */}
              <div className="settings-section">
                <h3 className="settings-section-title">Color Palette</h3>
                <div className="settings-select-group">
                  <label htmlFor="color-select">Color Scheme</label>
                  <select
                    id="color-select"
                    className="settings-select"
                    value={currentColorPreset}
                    onChange={(e) => handleColorChange(e.target.value)}
                  >
                    {colorPresets.map((preset) => (
                      <option key={preset} value={preset}>
                        {preset.charAt(0).toUpperCase() + preset.slice(1).replace(/([A-Z])/g, ' $1')}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Color Preview */}
                <div className="settings-color-preview">
                  {perf.colors.presets[currentColorPreset as keyof typeof perf.colors.presets]?.slice(0, 10).map((color: string, i: number) => (
                    <div
                      key={i}
                      className="settings-color-swatch"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* Search Provider Settings */}
              <div className="settings-section">
                <h3 className="settings-section-title">Web Search (S key)</h3>
                <div className="settings-select-group">
                  <label htmlFor="search-provider-select">Search Provider</label>
                  <select
                    id="search-provider-select"
                    className="settings-select"
                    value={currentSearchProvider}
                    onChange={(e) => handleSearchProviderChange(e.target.value)}
                  >
                    {searchProviders.map((provider) => (
                      <option key={provider} value={provider}>
                        {perf.search.providers[provider as keyof typeof perf.search.providers].name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

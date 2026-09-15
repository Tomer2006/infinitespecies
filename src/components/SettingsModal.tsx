import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { perf } from '../modules/settings'
import {
  getColorPresetLabel,
  translate,
  type AppLanguage,
} from '../modules/i18n'
import { useModalFocus } from '../hooks/useModalFocus'
import { requestRender } from '../modules/canvas'

interface SettingsModalProps {
  isOpen: boolean
  language: AppLanguage
  colorPreset: string
  onColorPresetChange: (preset: string) => void
  onClose: () => void
}

export default function SettingsModal({ isOpen, language, colorPreset, onColorPresetChange, onClose }: SettingsModalProps) {
  const initialFocusRef = useModalFocus(isOpen)

  const [currentColorPreset, setCurrentColorPreset] = useState(colorPreset)

  const colorPresets = Object.keys(perf.colors.presets)

  const handleColorChange = (preset: string) => {
    setCurrentColorPreset(preset)
    perf.colors.currentPreset = preset
    try { localStorage.setItem('infinitespecies_colorPreset', preset) } catch { /* Settings still work when storage is blocked. */ }
    onColorPresetChange(preset)
    requestRender()
  }

  useEffect(() => {
    setCurrentColorPreset(colorPreset)
  }, [colorPreset])

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
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-dialog-title"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="settings-dialog-title">{translate('settings.title', undefined, language)}</h2>
              <button ref={initialFocusRef} className="modal-close" type="button" onClick={onClose} aria-label={translate('common.close', undefined, language)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="modal-body settings-body">
              <div className="settings-section">
                <h3 className="settings-section-title">{translate('settings.colorSection', undefined, language)}</h3>
                <div className="settings-select-group">
                  <label htmlFor="color-select">{translate('settings.colorLabel', undefined, language)}</label>
                  <select id="color-select" className="settings-select" value={currentColorPreset} onChange={(e) => handleColorChange(e.target.value)}>
                    {colorPresets.map((preset) => (
                      <option key={preset} value={preset}>
                        {getColorPresetLabel(preset, language)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="settings-color-preview">
                  {(perf.colors.presets[currentColorPreset as keyof typeof perf.colors.presets] || []).slice(0, 10).map((color: string, index: number) => (
                    <div key={index} className="settings-color-swatch" style={{ backgroundColor: color }} title={color} />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

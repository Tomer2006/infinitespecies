import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import { perf } from './modules/settings.js'

// Load saved settings from localStorage
const savedFontPreset = localStorage.getItem('infinitespecies_fontPreset')
const savedColorPreset = localStorage.getItem('infinitespecies_colorPreset')
const savedSearchProvider = localStorage.getItem('infinitespecies_searchProvider')

// Apply saved font preset if exists
if (savedFontPreset && perf.fonts.presets[savedFontPreset as keyof typeof perf.fonts.presets]) {
  perf.fonts.currentPreset = savedFontPreset
}

// Apply saved color preset if exists
if (savedColorPreset && perf.colors.presets[savedColorPreset as keyof typeof perf.colors.presets]) {
  perf.colors.currentPreset = savedColorPreset
}

// Apply saved search provider if exists
if (savedSearchProvider && perf.search.providers[savedSearchProvider as keyof typeof perf.search.providers]) {
  perf.search.currentProvider = savedSearchProvider
}

// Apply font from settings
const fontConfig = perf.fonts.current
if (fontConfig) {
  // Load Google Font dynamically (only if not a system font)
  if (fontConfig.import) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${fontConfig.import}&display=swap`
    document.head.appendChild(link)
  }
  
  // Apply font to CSS variables (for HTML/CSS elements)
  document.documentElement.style.setProperty('--font-sans', `'${fontConfig.name}', ui-sans-serif, system-ui, -apple-system, sans-serif`)
  document.documentElement.style.setProperty('--font-mono', `'${fontConfig.name}', ui-sans-serif, system-ui, -apple-system, sans-serif`)
  
  // Apply font to canvas label settings (for canvas rendering)
  perf.rendering.labelFontFamily = `'${fontConfig.name}', ui-sans-serif, system-ui, sans-serif`
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)


import { perf } from './settings'
import { initializeLanguage } from './i18n'
import { applyPersistedPerfOverrides } from './runtimeSettings'

export function initializeRuntime() {
  try {
    initializeLanguage()

    // Load saved settings from localStorage
    const savedColorPreset = localStorage.getItem('infinitespecies_colorPreset')
    const savedSearchProvider = localStorage.getItem('infinitespecies_searchProvider')

    // Apply saved color preset if exists
    if (savedColorPreset && perf.colors.presets[savedColorPreset as keyof typeof perf.colors.presets]) {
      perf.colors.currentPreset = savedColorPreset
    }

    // Apply saved search provider if exists
    if (savedSearchProvider && perf.search.providers[savedSearchProvider as keyof typeof perf.search.providers]) {
      perf.search.currentProvider = savedSearchProvider
    }

    applyPersistedPerfOverrides()

    perf.rendering.labelFontFamily = 'ui-sans-serif, system-ui, sans-serif'
  } catch (error) { console.warn('Saved preferences unavailable:', error) }
}

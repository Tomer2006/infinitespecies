'use client'

/**
 * App.tsx - Root React component for InfiniteSpecies.
 * Composes landing, topbar, breadcrumbs, canvas stage, loading overlay,
 * settings/help dialogs and toast notifications.
 */
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { AnimatePresence } from 'framer-motion'
import LandingPage from './components/LandingPage'
import Topbar from './components/Topbar'
import Breadcrumbs from './components/Breadcrumbs'
import Stage from './components/Stage'
import LoadingOverlay from './components/LoadingOverlay'
import HelpModal from './components/HelpModal'
import SettingsModal from './components/SettingsModal'
import ToastContainer from './components/Toast'

// Lazy-loaded: the perf "lab" panel is a power-user tool, so its code is split
// into a separate chunk fetched only when it's first opened.
const SettingsLabModal = lazy(() => import('./components/SettingsLabModal'))
import { useToast } from './hooks/useToast'

import { state } from './modules/state'
import { resizeCanvas, registerDrawCallback, tick } from './modules/canvas'
import { draw } from './modules/render'
import { loadEager } from './modules/data'
import { ensureBackendViewport, findBackendNodeByPath, loadBackend, randomBackendNode } from './modules/data-backend'
import { decodePath, findNodeByPath, getNodePath, updateDeepLinkFromNode } from './modules/deeplink'
import { updateNavigation, fitNodeInView, goToNode } from './modules/navigation'
import { openProviderSearch } from './modules/providers'
import {
  getCurrentLanguage,
  translate,
  type AppLanguage,
} from './modules/i18n'
import { perf } from './modules/settings'
import { initializeRuntime } from './modules/initialize-runtime'
import { subscribeProgress } from './modules/loading'
import type { TaxonomyNode } from './modules/types'
import { performSearch, handleSearchResultClick } from './modules/search-handler'
import { requestNodePulse } from './modules/visual-events'
import { discoveryCopy } from './modules/discovery-copy'
import { useCurrentNode } from './hooks/useTaxonomyState'

export interface AppState {
  isLanding: boolean
  isLoading: boolean
  loadingTitle: string
  loadingStage: string
  loadingProgress: number
  loadingPct: string
  loadingTimer: string
  showTopbar: boolean
  breadcrumbs: Array<{ id: number; name: string; node: TaxonomyNode }>
  currentNode: TaxonomyNode | null
  hoverNode: TaxonomyNode | null
}

export default function App() {
  const language: AppLanguage = 'en'
  const [colorPreset, setColorPreset] = useState(() => perf.colors.currentPreset)
  const selectedNode = useCurrentNode()
  const [appState, setAppState] = useState<AppState>({
    isLanding: true,
    isLoading: false,
    loadingTitle: translate('loading.defaultTitle', undefined, getCurrentLanguage()),
    loadingStage: translate('loading.stage', { current: 1, total: 1 }, getCurrentLanguage()),
    loadingProgress: 0,
    loadingPct: '0%',
    loadingTimer: '00:00',
    showTopbar: false,
    breadcrumbs: [],
    currentNode: null,
    hoverNode: null,
  })

  const [helpOpen, setHelpOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsLabOpen, setSettingsLabOpen] = useState(false)

  const toast = useToast()

  const loadingStartTime = useRef<number>(0)
  const timerInterval = useRef<number | null>(null)
  const startInFlight = useRef(false)
  const dataReady = useRef(false)
  const autoStartAttempted = useRef(false)

  useEffect(() => {
    initializeRuntime()
    setColorPreset(perf.colors.currentPreset)
    resizeCanvas()
    registerDrawCallback(draw)
  }, [])

  useEffect(() => {
    const handleHashChange = async () => {
      const hash = decodePath(location.hash.slice(1))
      if (!hash || !state.DATA_ROOT) return
      try {
        const node = state.loadMode === 'backend'
          ? await findBackendNodeByPath(hash)
          : await findNodeByPath(hash)
        if (node) {
          await updateNavigation(node, true)
          updateBreadcrumbs(node)
          requestNodePulse(node)
        } else toast.info(discoveryCopy(language).missing)
      } catch { toast.error(discoveryCopy(language).error) }
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (startInFlight.current) return

      const target = e.target as HTMLElement
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable

      if (e.key === 'Escape' || e.code === 'Escape') {
        if (isTyping && target.tagName === 'TEXTAREA') {
          return
        }

        if (helpOpen) {
          e.preventDefault()
          setHelpOpen(false)
        }
        return
      }

      if (isTyping || helpOpen || settingsOpen || settingsLabOpen || e.ctrlKey || e.metaKey || e.altKey) return

      if (e.code === 'Slash' || e.key === '?' || e.code === 'F1') {
        e.preventDefault()
        setHelpOpen((prev: boolean) => !prev)
      } else if (e.code === 'KeyW') {
        e.preventDefault()
        const targetNode = state.hoverNode || state.current || state.DATA_ROOT
        if (targetNode) {
          openProviderSearch(targetNode)
        }
      } else if (e.code === 'KeyR') {
        e.preventDefault()
        handleReset()
      } else if (e.code === 'KeyF') {
        e.preventDefault()
        handleFit()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [helpOpen, settingsOpen, settingsLabOpen])

  const updateBreadcrumbs = useCallback((node: TaxonomyNode | null) => {
    if (!node) {
      setAppState((prev: AppState) => ({ ...prev, breadcrumbs: [], currentNode: null }))
      if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search)
      }
      document.documentElement.style.setProperty('--breadcrumbs-height', '0px')
      return
    }

    const crumbs: Array<{ id: number; name: string; node: TaxonomyNode }> = []
    let current: TaxonomyNode | null = node
    while (current) {
      crumbs.unshift({
        id: current._id,
        name: current.name,
        node: current,
      })
      current = current.parent
    }

    setAppState((prev: AppState) => ({ ...prev, breadcrumbs: crumbs, currentNode: node }))
    updateDeepLinkFromNode(node)
  }, [])

  useEffect(() => {
    const updateBreadcrumbsHeight = () => {
      const breadcrumbsEl = document.querySelector('.breadcrumbs') as HTMLElement | null
      const topbarEl = document.querySelector('.topbar') as HTMLElement | null
      document.documentElement.style.setProperty('--topbar-height', `${topbarEl?.offsetHeight || 0}px`)
      document.documentElement.style.setProperty('--hud-height', `${(breadcrumbsEl?.offsetHeight || 0) + (topbarEl?.offsetHeight || 0)}px`)
      if (breadcrumbsEl) {
        document.documentElement.style.setProperty('--breadcrumbs-height', `${breadcrumbsEl.offsetHeight}px`)
      } else {
        document.documentElement.style.setProperty('--breadcrumbs-height', '0px')
      }
    }

    updateBreadcrumbsHeight()
    const observer = new ResizeObserver(updateBreadcrumbsHeight)
    for (const element of document.querySelectorAll('.topbar, .breadcrumbs')) observer.observe(element)
    const timer = setTimeout(updateBreadcrumbsHeight, 100)

    window.addEventListener('resize', updateBreadcrumbsHeight)
    return () => {
      clearTimeout(timer)
      observer.disconnect()
      window.removeEventListener('resize', updateBreadcrumbsHeight)
    }
  }, [appState.breadcrumbs, appState.showTopbar])

  useEffect(() => {
    if (!appState.isLoading) {
      setAppState((prev: AppState) => ({
        ...prev,
        loadingTitle: translate('loading.defaultTitle', undefined, language),
        loadingStage: translate('loading.stage', { current: 1, total: 1 }, language),
      }))
    }
  }, [appState.isLoading, language])

  const showLoading = useCallback((title?: string) => {
    if (timerInterval.current !== null) {
      clearInterval(timerInterval.current)
    }
    loadingStartTime.current = performance.now()
    setAppState((prev: AppState) => ({
      ...prev,
      isLoading: true,
      loadingTitle: title ?? translate('loading.defaultTitle', undefined, language),
      loadingStage: translate('loading.stage', { current: 1, total: 1 }, language),
      loadingProgress: 0,
      loadingPct: '0%',
      loadingTimer: '00:00',
    }))

    timerInterval.current = window.setInterval(() => {
      const elapsed = Math.floor((performance.now() - loadingStartTime.current) / 1000)
      const mins = Math.floor(elapsed / 60).toString().padStart(2, '0')
      const secs = (elapsed % 60).toString().padStart(2, '0')
      setAppState((prev: AppState) => ({ ...prev, loadingTimer: `${mins}:${secs}` }))
    }, 1000)
  }, [language])

  const hideLoading = useCallback(() => {
    if (timerInterval.current !== null) {
      clearInterval(timerInterval.current)
      timerInterval.current = null
    }
    setAppState((prev: AppState) => ({ ...prev, isLoading: false }))
  }, [])

  useEffect(() => {
    if (!appState.isLanding && selectedNode) updateBreadcrumbs(selectedNode)
  }, [selectedNode, appState.isLanding, updateBreadcrumbs])

  useEffect(() => () => {
    if (timerInterval.current !== null) {
      clearInterval(timerInterval.current)
      timerInterval.current = null
    }
  }, [])

  const updateProgress = useCallback((progress: number, label?: string, currentStage = 1, totalStages = 1) => {
    setAppState((prev: AppState) => prev.isLoading ? ({
      ...prev,
      loadingProgress: Math.max(prev.loadingProgress, Math.min(95, Number.isFinite(progress) ? progress : 0)),
      loadingPct: `${Math.round(Math.max(prev.loadingProgress, Math.min(95, Number.isFinite(progress) ? progress : 0)))}%`,
      loadingStage: translate('loading.stage', { current: currentStage, total: totalStages }, language),
      ...(label && { loadingTitle: label }),
    }) : prev)
  }, [language])

  useEffect(() => subscribeProgress(({ percentage, label, currentStage, totalStages }) => {
    updateProgress(percentage, label, currentStage, totalStages)
  }), [updateProgress])

  const handleStartExploration = async (destination?: string) => {
    if (startInFlight.current) return
    startInFlight.current = true
    const initialHash = decodePath(location.hash.slice(1))
    showLoading(translate('loading.loadingTaxonomy', undefined, language))
    setAppState(prev => ({ ...prev, isLanding: false, showTopbar: true }))
    try {
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      resizeCanvas()
      if (!dataReady.current) {
        try { await loadBackend() }
        catch (backendError) {
          console.warn('Backend unavailable, loading static taxonomy:', backendError)
          await loadEager('/data/manifest.json')
        }
        dataReady.current = true
      }
      if (!state.DATA_ROOT) throw new Error('Taxonomy did not provide a root')
      updateProgress(95, 'Preparing map…')
      state.layoutChanged = true
      if (destination) await openDestination(destination)
      else if (initialHash) {
        const target = state.loadMode === 'backend'
          ? await findBackendNodeByPath(initialHash)
          : await findNodeByPath(initialHash)
        await goToNode(target || state.DATA_ROOT, false)
        updateBreadcrumbs(target || state.DATA_ROOT)
        if (target) requestNodePulse(target)
        else toast.info(discoveryCopy(language).missing)
      } else {
        await goToNode(state.DATA_ROOT, false)
        updateBreadcrumbs(state.DATA_ROOT)
      }
      await ensureBackendViewport({ force: true })
      tick()
    } catch (error) {
      console.error('Exploration failed:', error)
      setAppState(prev => ({ ...prev, isLanding: true, showTopbar: false, breadcrumbs: [] }))
      toast.error(translate('app.dataLoadFailed', undefined, language), 5000)
    } finally {
      hideLoading()
      startInFlight.current = false
    }
  }
  const openDestination = async (destination: string) => {
    if (!state.DATA_ROOT) return
    if (destination === 'random') {
      await handleBreadcrumbRandom(state.DATA_ROOT)
      return
    }
    if (destination === 'all') {
      await goToNode(state.DATA_ROOT, false)
      updateBreadcrumbs(state.DATA_ROOT)
      return
    }
    const result = await performSearch(destination)
    const node = result.matches.find(item => item.name.toLowerCase() === destination.toLowerCase())
    if (node) {
      await handleSearchResultClick(node)
      updateBreadcrumbs(state.current)
    } else {
      await goToNode(state.DATA_ROOT, false)
      updateBreadcrumbs(state.DATA_ROOT)
      toast.info(discoveryCopy(language).missing)
    }
  }

  useEffect(() => {
    const destination = new URLSearchParams(location.search).get('explore')
    if (autoStartAttempted.current || (!location.hash && !destination)) return
    autoStartAttempted.current = true
    void handleStartExploration(destination || undefined)
  }, [])

  const handleBackToMenu = async () => {
    setAppState((prev: AppState) => ({
      ...prev,
      isLanding: true,
      showTopbar: false,
      breadcrumbs: [],
    }))
    setSettingsLabOpen(false)

    // Returning home needs no data request and must not leave an auto-start URL.
    const url = new URL(location.href)
    url.pathname = '/'
    url.hash = ''
    url.searchParams.delete('explore')
    history.replaceState(null, '', url)
  }

  const handleReset = async () => {
    if (state.DATA_ROOT) {
      await goToNode(state.DATA_ROOT, true)
      updateBreadcrumbs(state.DATA_ROOT)
    }
  }

  const handleFit = () => {
    const targetNode = state.hoverNode || state.current || state.DATA_ROOT
    if (targetNode) {
      fitNodeInView(targetNode)
    }
  }

  const handleBreadcrumbClick = async (node: TaxonomyNode) => {
    await goToNode(node, true)
    updateBreadcrumbs(node)
    await ensureBackendViewport({ force: true })
  }

  const handleBreadcrumbRandom = async (rootNode: TaxonomyNode) => {
    // A species has no descendants; surprise the user within its parent group.
    if (!(rootNode._hasChildren ?? rootNode.children.length > 0)) {
      rootNode = rootNode.parent || state.DATA_ROOT || rootNode
    }
    // Backend mode: the subtree isn't fully loaded client-side, so we can't walk
    // it here. Let the server pick a random leaf (same way search asks the backend
    // when the tree isn't loaded yet), then load and zoom to it.
    if (state.loadMode === 'backend') {
      if (!rootNode?._hasChildren) {
        toast.info(translate('breadcrumbs.noDeeperBranch', undefined, language))
        return
      }

      const node = await randomBackendNode(rootNode._id)
      if (node && node._id !== rootNode._id) {
        await goToNode(node, true)
        updateBreadcrumbs(node)
        requestNodePulse(node)
        await ensureBackendViewport({ force: true })
      }
      return
    }

    // Local mode: the full tree is in memory, so descend client-side.
    if (!rootNode?.children?.length) {
      toast.info(translate('breadcrumbs.noDeeperBranch', undefined, language))
      return
    }

    let node = rootNode
    let targetIndex = Math.floor(Math.random() * (node._leaves || 1))

    while (node.children && node.children.length > 0) {
      let nextNode = node.children[0]

      for (const child of node.children) {
        const weight = child._leaves || 1
        if (targetIndex < weight) {
          nextNode = child
          break
        }
        targetIndex -= weight
      }

      node = nextNode
    }

    if (node && node !== rootNode) {
      await goToNode(node, true)
      updateBreadcrumbs(node)
      requestNodePulse(node)
    }
  }

  const handleCopyLink = async () => {
    const url = new URL(location.href)
    url.pathname = '/'
    url.searchParams.delete('explore')
    const path = state.current ? getNodePath(state.current).join('/') : ''
    url.hash = path ? `#${encodeURIComponent(path)}` : ''

    try {
      await navigator.clipboard.writeText(url.toString())
      toast.success(translate('app.linkCopied', undefined, language))
    } catch {
      window.prompt(translate('app.copyLinkPrompt', undefined, language), url.toString())
    }
  }

  return (
    <div className="app">

      <AnimatePresence>
        {appState.isLanding && (
          <LandingPage
            language={language}
            colorPreset={colorPreset}
            isStarting={appState.isLoading}
            onStart={() => void handleStartExploration()}
            onDiscover={(destination) => void handleStartExploration(destination)}
            onHelp={() => setHelpOpen(true)}
            onSettings={() => setSettingsOpen(true)}
          />
        )}
      </AnimatePresence>

      {appState.showTopbar && (
        <Topbar
          language={language}
          onBackToMenu={handleBackToMenu}
          onCopyLink={handleCopyLink}
          onSettings={() => setSettingsOpen(true)}
          onSettingsLab={() => setSettingsLabOpen((prev) => !prev)}
          onHelp={() => setHelpOpen(true)}
        />
      )}

      {appState.showTopbar && appState.breadcrumbs.length > 0 && (
        <Breadcrumbs
          language={language}
          crumbs={appState.breadcrumbs}
          onCrumbClick={(node) => void handleBreadcrumbClick(node).catch(() => toast.error(discoveryCopy(language).error))}
        />
      )}

      <Stage
        language={language}
        isLoading={appState.isLoading}
        onUpdateBreadcrumbs={updateBreadcrumbs}
        hidden={appState.isLanding}
        onRandom={async () => { if (state.DATA_ROOT) await handleBreadcrumbRandom(state.current || state.DATA_ROOT) }}
      />

      {appState.isLoading && (
        <LoadingOverlay
          language={language}
          title={appState.loadingTitle}
          stage={appState.loadingStage}
          progress={appState.loadingProgress}
          pct={appState.loadingPct}
          timer={appState.loadingTimer}
        />
      )}

      <AnimatePresence>
        {helpOpen && <HelpModal language={language} onClose={() => setHelpOpen(false)} />}
      </AnimatePresence>
      <SettingsModal
        isOpen={settingsOpen}
        language={language}
        colorPreset={colorPreset}
        onColorPresetChange={setColorPreset}
        onClose={() => setSettingsOpen(false)}
      />
      {settingsLabOpen && (
        <Suspense fallback={null}>
          <SettingsLabModal
            isOpen={settingsLabOpen}
            onClose={() => setSettingsLabOpen(false)}
            onPerfChange={() => {
              setColorPreset(perf.colors.currentPreset)
            }}
          />
        </Suspense>
      )}

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import LandingPage from './components/LandingPage'
import Topbar from './components/Topbar'
import Breadcrumbs from './components/Breadcrumbs'
import Stage from './components/Stage'
import LoadingOverlay from './components/LoadingOverlay'
import HelpModal from './components/HelpModal'
import AboutModal from './components/AboutModal'
import JsonModal from './components/JsonModal'
import ToastContainer from './components/Toast'
import MobileBlocker from './components/MobileBlocker'
import { useToast } from './hooks/useToast'

// Detect if user is on a mobile or tablet device
function isMobileDevice(): boolean {
  // Check user agent for mobile/tablet
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || ''
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i
  
  // Also check screen width as a fallback (tablets and phones typically < 1024px)
  const isSmallScreen = window.innerWidth < 1024
  
  // Check for touch-only devices (no mouse)
  const isTouchOnly = 'ontouchstart' in window && !window.matchMedia('(pointer: fine)').matches
  
  return mobileRegex.test(userAgent) || (isSmallScreen && isTouchOnly)
}

// Import the existing visualization modules
import { state } from './modules/state'
import { resizeCanvas, registerDrawCallback, tick } from './modules/canvas'
import { draw } from './modules/render'
import { loadEager, loadFromJSONText } from './modules/data'
import { decodePath, findNodeByPath, getNodePath } from './modules/deeplink'
import { updateNavigation, fitNodeInView, goToNode } from './modules/navigation'
import { openProviderSearch } from './modules/providers'

export interface AppState {
  isLanding: boolean
  isLoading: boolean
  loadingTitle: string
  loadingStage: string
  loadingProgress: number
  loadingPct: string
  loadingTimer: string
  showTopbar: boolean
  breadcrumbs: Array<{ id: number; name: string; node: any }>
  currentNode: any
  hoverNode: any
}

export default function App() {
  const [isMobile, setIsMobile] = useState(false)
  const [appState, setAppState] = useState<AppState>({
    isLanding: true,
    isLoading: false,
    loadingTitle: 'Loading…',
    loadingStage: 'Stage 1 of 2',
    loadingProgress: 0,
    loadingPct: '0%',
    loadingTimer: '00:00',
    showTopbar: false,
    breadcrumbs: [],
    currentNode: null,
    hoverNode: null,
  })

  const [helpOpen, setHelpOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [jsonOpen, setJsonOpen] = useState(false)

  const toast = useToast()

  // Check for mobile device on mount
  useEffect(() => {
    setIsMobile(isMobileDevice())
  }, [])
  const loadingStartTime = useRef<number>(0)
  const timerInterval = useRef<number | null>(null)

  // Initialize canvas and render
  useEffect(() => {
    resizeCanvas()
    registerDrawCallback(draw)
  }, [])

  // Handle deep links
  useEffect(() => {
    const handleHashChange = async () => {
      const hash = decodePath(location.hash.slice(1))
      if (!hash || !state.DATA_ROOT) return
      const node = await findNodeByPath(hash)
      if (node) {
        updateNavigation(node, true)
        updateBreadcrumbs(node)
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable

      // Handle Escape key - close modals or clear search
      if (e.key === 'Escape' || e.code === 'Escape') {
        // Don't prevent default if typing in a textarea (like JsonModal)
        // Allow Escape to work normally in text inputs
        if (isTyping && target.tagName === 'TEXTAREA') {
          return // Let textarea handle Escape normally
        }
        
        // Close modals in order of priority
        if (jsonOpen) {
          e.preventDefault()
          setJsonOpen(false)
        } else if (helpOpen) {
          e.preventDefault()
          setHelpOpen(false)
        } else if (aboutOpen) {
          e.preventDefault()
          setAboutOpen(false)
        }
        return
      }

      if (isTyping) return

      if (e.code === 'Slash' || e.key === '?' || e.code === 'F1') {
        e.preventDefault()
        setHelpOpen((prev: boolean) => !prev)
      } else if (e.code === 'KeyS') {
        e.preventDefault()
        const target = state.hoverNode || state.current || state.DATA_ROOT
        if (target) {
          openProviderSearch(target)
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
  }, [helpOpen, aboutOpen, jsonOpen])

  const updateBreadcrumbs = useCallback((node: any) => {
    const crumbs: Array<{ id: number; name: string; node: any }> = []
    let current = node
    while (current) {
      crumbs.unshift({
        id: current._id,
        name: current.name,
        node: current,
      })
      current = current.parent
    }
    setAppState((prev: AppState) => ({ ...prev, breadcrumbs: crumbs, currentNode: node }))
  }, [])

  const showLoading = useCallback((title: string) => {
    loadingStartTime.current = performance.now()
    setAppState((prev: AppState) => ({
      ...prev,
      isLoading: true,
      loadingTitle: title,
      loadingProgress: 0,
      loadingPct: '0%',
      loadingTimer: '00:00',
    }))

    // Start timer
    timerInterval.current = window.setInterval(() => {
      const elapsed = Math.floor((performance.now() - loadingStartTime.current) / 1000)
      const mins = Math.floor(elapsed / 60).toString().padStart(2, '0')
      const secs = (elapsed % 60).toString().padStart(2, '0')
      setAppState((prev: AppState) => ({ ...prev, loadingTimer: `${mins}:${secs}` }))
    }, 1000)
  }, [])

  const hideLoading = useCallback(() => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current)
      timerInterval.current = null
    }
    setAppState((prev: AppState) => ({ ...prev, isLoading: false }))
  }, [])

  const updateProgress = useCallback((progress: number, label?: string, stage?: string) => {
    setAppState((prev: AppState) => ({
      ...prev,
      loadingProgress: progress,
      loadingPct: `${Math.round(progress)}%`,
      ...(label && { loadingTitle: label }),
      ...(stage && { loadingStage: stage }),
    }))
  }, [])

  // Override the loading module's functions
  useEffect(() => {
    // @ts-ignore
    window.__reactShowLoading = showLoading
    // @ts-ignore
    window.__reactHideLoading = hideLoading
    // @ts-ignore
    window.__reactUpdateProgress = updateProgress
  }, [showLoading, hideLoading, updateProgress])

  const handleStartExploration = async () => {
    setAppState((prev: AppState) => ({ ...prev, isLanding: false, showTopbar: true }))
    
    // Wait for canvas to be ready
    await new Promise(resolve => setTimeout(resolve, 100))
    resizeCanvas()
    
    try {
      showLoading('Loading taxonomy data…')

      // Try to load default data (use leading / for Vite public folder)
      const candidates = ['/data/manifest.json']
      
      for (const url of candidates) {
        try {
          await loadEager(url)
          hideLoading()
          
          state.layoutChanged = true
          fitNodeInView(state.DATA_ROOT)
          tick()
          
          if (state.DATA_ROOT) {
            updateBreadcrumbs(state.DATA_ROOT)
          }
          return
        } catch (err) {
          console.error(`Failed to load ${url}:`, err)
        }
      }

      // All failed, show JSON modal
      hideLoading()
      setJsonOpen(true)
    } catch (err) {
      hideLoading()
      console.error('Error starting exploration:', err)
    }
  }

  const handleBackToMenu = async () => {
    setAppState((prev: AppState) => ({
      ...prev,
      isLanding: true,
      showTopbar: false,
      breadcrumbs: [],
    }))

    // Reset state
    if (state.DATA_ROOT) {
      await goToNode(state.DATA_ROOT, false)
    }

    // Clear URL hash
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }

  const handleReset = async () => {
    if (state.DATA_ROOT) {
      await goToNode(state.DATA_ROOT, true)
      updateBreadcrumbs(state.DATA_ROOT)
    }
  }

  const handleFit = () => {
    const target = state.hoverNode || state.current || state.DATA_ROOT
    if (target) {
      fitNodeInView(target)
    }
  }

  const handleBreadcrumbClick = async (node: any) => {
    await goToNode(node, true)
    updateBreadcrumbs(node)
  }

  const handleCopyLink = async () => {
    const url = new URL(location.href)
    const path = state.current ? getNodePath(state.current).join('/') : ''
    url.hash = path ? `#${encodeURIComponent(path)}` : ''
    
    try {
      await navigator.clipboard.writeText(url.toString())
      toast.success('Link copied to clipboard')
    } catch {
      window.prompt('Copy link:', url.toString())
    }
  }

  const handleJsonLoad = async (text: string) => {
    try {
      showLoading('Parsing custom JSON…')
      await loadFromJSONText(text)
      hideLoading()
      setJsonOpen(false)
      
      state.layoutChanged = true
      fitNodeInView(state.DATA_ROOT)
      tick()
      
      if (state.DATA_ROOT) {
        updateBreadcrumbs(state.DATA_ROOT)
      }
    } catch (err) {
      hideLoading()
      throw err
    }
  }

  // Show mobile blocker if on mobile device
  if (isMobile) {
    return <MobileBlocker />
  }

  return (
    <div className="app">
      <AnimatePresence>
        {appState.isLanding && (
          <LandingPage
            onStart={handleStartExploration}
            onHelp={() => setHelpOpen(true)}
            onAbout={() => setAboutOpen(true)}
          />
        )}
      </AnimatePresence>

      {appState.showTopbar && (
        <Topbar
          onBackToMenu={handleBackToMenu}
          onReset={handleReset}
          onFit={handleFit}
          onCopyLink={handleCopyLink}
          onUpdateBreadcrumbs={updateBreadcrumbs}
          onShowToast={toast.showToast}
        />
      )}

      {appState.showTopbar && appState.breadcrumbs.length > 0 && (
        <Breadcrumbs
          crumbs={appState.breadcrumbs}
          onCrumbClick={handleBreadcrumbClick}
        />
      )}

      <Stage
        isLoading={appState.isLoading}
        onUpdateBreadcrumbs={updateBreadcrumbs}
        hidden={appState.isLanding}
      />

      {appState.isLoading && (
        <LoadingOverlay
          title={appState.loadingTitle}
          stage={appState.loadingStage}
          progress={appState.loadingProgress}
          pct={appState.loadingPct}
          timer={appState.loadingTimer}
        />
      )}

      <AnimatePresence>
        {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {jsonOpen && (
          <JsonModal
            onClose={() => setJsonOpen(false)}
            onLoad={handleJsonLoad}
          />
        )}
      </AnimatePresence>

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  )
}


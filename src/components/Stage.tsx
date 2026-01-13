import { useEffect, useRef, useState, useCallback } from 'react'
import { state } from '../modules/state'
import { requestRender, screenToWorld, resizeCanvas, tick, onCameraChange } from '../modules/canvas'
import { pickNodeAt, isNodeStillHoverable } from '../modules/picking'
import { openProviderSearch } from '../modules/providers'
import { perf } from '../modules/settings'
import { showBigFor, hideBigPreview as hidePreviewModule } from '../modules/preview'
import { updateCurrentNodeOnly } from '../modules/navigation'

// Type for taxonomy nodes from the state module
interface TaxonomyNode {
  _id: number
  name: string
  level: number
  children?: TaxonomyNode[]
  parent?: TaxonomyNode | null
  _leaves?: number
  _vx?: number
  _vy?: number
  _vr?: number
}

interface StageProps {
  isLoading: boolean
  onUpdateBreadcrumbs: (node: TaxonomyNode) => void
  hidden?: boolean
}

interface TooltipState {
  visible: boolean
  x: number
  y: number
  name: string
  meta: string
}

export default function Stage({ isLoading, onUpdateBreadcrumbs, hidden = false }: StageProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    name: '',
    meta: '',
  })
  const [legendVisible, setLegendVisible] = useState(() => {
    const saved = localStorage.getItem('legendVisible')
    return saved !== null ? saved === 'true' : true
  })

  // Big preview is managed by the preview module via DOM manipulation
  // We just need to provide the DOM elements

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const isPanningRef = useRef(false)
  const lastPanRef = useRef<{ x: number; y: number } | null>(null)
  const pickingScheduledRef = useRef(false)
  const lastMouseRef = useRef({ x: 0, y: 0 })
  const prevHoverIdRef = useRef<number | null>(null)
  const breadcrumbTimerRef = useRef<number | null>(null)
  const pendingBreadcrumbNodeIdRef = useRef<number | null>(null)

  // Set up canvas reference in DOM module and initialize
  useEffect(() => {
    if (canvasRef.current) {
      // @ts-ignore - setting canvas reference for the modules
      window.__reactCanvas = canvasRef.current
    }
    
    // Cleanup: clear breadcrumb timer on unmount
    return () => {
      if (breadcrumbTimerRef.current !== null) {
        clearTimeout(breadcrumbTimerRef.current)
        breadcrumbTimerRef.current = null
      }
    }
  }, [onUpdateBreadcrumbs])
  
  // Initialize canvas when it becomes visible
  useEffect(() => {
    if (!hidden && canvasRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        resizeCanvas()
        tick()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [hidden])

  // O(1) hover validation when camera changes - only checks current hover node
  // Only does full pick when current hover becomes invalid (rare)
  useEffect(() => {
    const validateHover = () => {
      const { x, y } = lastMouseRef.current
      if (x === 0 && y === 0) return  // No mouse position yet
      
      const currentHover = state.hoverNode
      
      // If no current hover, try to pick one (user might have zoomed into a node)
      if (!currentHover) {
        const n = pickNodeAt(x, y)
        if (n) {
          state.hoverNode = n
          updateTooltipAndPreview(n, x, y)
        }
        return
      }
      
      // Check if current hover is still valid (O(1) check)
      if (!isNodeStillHoverable(currentHover, x, y)) {
        // Node is no longer hoverable - find the new node under cursor
        const n = pickNodeAt(x, y)
        state.hoverNode = n
        if (n) {
          updateTooltipAndPreview(n, x, y)
        } else {
          setTooltip(prev => ({ ...prev, visible: false }))
          hidePreviewModule()
          prevHoverIdRef.current = null
        }
      }
    }
    
    onCameraChange(validateHover)
    return () => onCameraChange(null)
  }, [])

  const updateTooltipAndPreview = useCallback((node: any, x: number, y: number) => {
    if (!node) {
      setTooltip(prev => ({ ...prev, visible: false }))
      hidePreviewModule()
      return
    }

    const nodeId = node._id || 0
    const changedNode = nodeId !== prevHoverIdRef.current
    prevHoverIdRef.current = nodeId

    // Update tooltip position and content
    const name = node.name || 'Unknown'
    let meta = ''
    
    if (node._leaves) {
      meta = `${node._leaves.toLocaleString()} leaves`
    }
    if (node.level !== undefined) {
      meta += meta ? ` • Level ${node.level}` : `Level ${node.level}`
    }

    setTooltip({
      visible: true,
      x,
      y,
      name,
      meta,
    })

    // Update big preview only on node change - fetch from Wikipedia
    if (changedNode) {
      showBigFor(node)
    }
  }, [])

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    lastMouseRef.current = { x, y }

    // Handle panning
    if (isPanningRef.current && lastPanRef.current) {
      const dx = x - lastPanRef.current.x
      const dy = y - lastPanRef.current.y
      state.camera.x -= dx / state.camera.k
      state.camera.y -= dy / state.camera.k
      lastPanRef.current = { x, y }
      requestRender()
      setTooltip(prev => ({ ...prev, visible: false }))
      hidePreviewModule()
      return
    }

    // Throttle picking
    if (!pickingScheduledRef.current) {
      pickingScheduledRef.current = true
      requestAnimationFrame(() => {
        pickingScheduledRef.current = false
        const n = pickNodeAt(lastMouseRef.current.x, lastMouseRef.current.y)
        state.hoverNode = n
        updateTooltipAndPreview(n, lastMouseRef.current.x, lastMouseRef.current.y)
        
        // Breadcrumbs will update when preview image loads (handled in preview.js)
        // No timer needed - breadcrumbs sync with image preview display
      })
    }
  }

  const handleMouseLeave = () => {
    state.hoverNode = null
    setTooltip(prev => ({ ...prev, visible: false }))
    hidePreviewModule()
    
    // Clear any pending breadcrumb update when mouse leaves
    if (breadcrumbTimerRef.current !== null) {
      clearTimeout(breadcrumbTimerRef.current)
      breadcrumbTimerRef.current = null
    }
    pendingBreadcrumbNodeIdRef.current = null
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      // Middle mouse button
      isPanningRef.current = true
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        lastPanRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      }
      e.preventDefault()
    }
  }

  useEffect(() => {
    const handleMouseUp = () => {
      isPanningRef.current = false
      lastPanRef.current = null
    }
    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [])

  // Keyboard shortcut to toggle legend visibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      
      if (e.key.toLowerCase() === 'h') {
        setLegendVisible(prev => !prev)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Save legend visibility to localStorage
  useEffect(() => {
    localStorage.setItem('legendVisible', String(legendVisible))
  }, [legendVisible])

  // Use native wheel event listener to enable preventDefault (React's onWheel is passive)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheel = (e: WheelEvent) => {
      const scale = Math.exp(-e.deltaY * perf.input.zoomSensitivity)
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const [wx, wy] = screenToWorld(mx, my)

      state.camera.k *= scale
      state.camera.x = wx - (mx - rect.width / 2) / state.camera.k
      state.camera.y = wy - (my - rect.height / 2) / state.camera.k

      requestRender()
      e.preventDefault()
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [])

  const handleContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (isLoading) return

    const current = state.current as TaxonomyNode | null
    if (current && current.parent) {
      // Update breadcrumbs to parent (go up one level), don't zoom
      // Example: if breadcrumbs are "1 dog > 2 fish > 3 cat", 
      // right click updates to "1 dog > 2 fish" (removes last item)
      updateCurrentNodeOnly(current.parent as any)
      onUpdateBreadcrumbs(current.parent)
    }
  }

  const handleClick = async (e: React.MouseEvent) => {
    if (e.button !== 0) return
    if (isLoading) return

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const n = pickNodeAt(x, y)
    if (!n) return

    // Update tree view to show only this subtree, don't move camera
    updateCurrentNodeOnly(n as any)
    onUpdateBreadcrumbs(n)
  }

  const handleTooltipSearch = (e: React.MouseEvent) => {
    e.stopPropagation()
    const target = state.hoverNode || state.current
    if (target) {
      openProviderSearch(target)
    }
  }

  return (
    <div className={`stage ${hidden ? 'hidden' : ''}`} ref={stageRef}>
      <canvas
        id="view"
        ref={canvasRef}
        className={isLoading ? 'loading' : ''}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        onClick={handleClick}
      />

      {/* Tooltip */}
      <div
        className="tooltip"
        style={{
          left: tooltip.x,
          top: tooltip.y,
          opacity: tooltip.visible ? 1 : 0,
        }}
      >
        <div className="tooltip-content">
          <div className="tooltip-name">{tooltip.name}</div>
          {tooltip.meta && <div className="tooltip-meta">{tooltip.meta}</div>}
        </div>
        <div className="tooltip-actions">
          <button className="tooltip-btn" onClick={handleTooltipSearch} title="Search">
            🔎
          </button>
        </div>
      </div>

      {/* Big Preview - managed by preview.js module */}
      <div className="big-preview" id="bigPreview" aria-hidden="true">
        <div className="big-preview-header">
          <div className="big-preview-caption" id="bigPreviewCap"></div>
        </div>
        <img id="bigPreviewImg" alt="" decoding="async" />
        <div className="big-preview-empty" id="bigPreviewEmpty" aria-hidden="true">
          No image
        </div>
        <div className="big-preview-footer">
          <button 
            className="btn btn-small" 
            onClick={(e) => {
              e.stopPropagation()
              const target = state.hoverNode || state.current
              if (target) openProviderSearch(target)
            }}
            title="Search on the web (S)"
          >
            Web Search (S)
          </button>
        </div>
      </div>

      {/* Legend */}
      {legendVisible && (
        <div className="legend">
          <div className="legend-title">Controls</div>
          <ul>
            <li><kbd>Left Click</kbd> Zoom into a group</li>
            <li><kbd>Right Click</kbd> Zoom out to parent</li>
            <li><kbd>Wheel</kbd> Smooth zoom</li>
            <li><kbd>Middle Drag</kbd> Pan the view</li>
            <li><kbd>Enter</kbd> Search; pick a result</li>
            <li><kbd>F</kbd> Fit hovered/current</li>
            <li><kbd>R</kbd> Reset to root</li>
            <li><kbd>S</kbd> Web search</li>
            <li><kbd>H</kbd> Hide/show controls</li>
            <li><kbd>?</kbd> Toggle help</li>
          </ul>
        </div>
      )}

      {/* Pulse animation element */}
      <div className="pulse" id="pulse" />
    </div>
  )
}


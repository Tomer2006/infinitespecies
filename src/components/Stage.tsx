import { useEffect, useRef, useState, useCallback } from 'react'
import { state } from '../modules/state'
import { requestRender, screenToWorld, resizeCanvas, tick, onCameraChange } from '../modules/canvas'
import { openProviderSearch } from '../modules/providers'
import { showBigFor, hideBigPreview as hidePreviewModule } from '../modules/preview'
import { updateCurrentNodeOnly, fitNodeInView } from '../modules/navigation'
import { handleWheelEvent, handleMouseMovePan, handleMouseMovePick, handleMouseLeaveEvent, handleMouseDown as handleMouseDownJS, validateHoverOnCameraChange } from '../modules/mouse-handler'
import { pickNodeAt } from '../modules/picking'
import { handleCameraPan } from '../modules/camera'

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
  
  // Touch handling refs
  const touchStateRef = useRef({
    isPanning: false,
    isZooming: false,
    lastTouch: null as { x: number; y: number } | null,
    initialDistance: 0,
    initialZoom: 1,
    initialCenter: null as { x: number; y: number } | null,
    lastTapTime: 0,
    longPressTimer: null as number | null,
  })

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

  // O(1) hover validation when camera changes - use vanilla JS function
  useEffect(() => {
    const validateHover = () => {
      const { x, y } = lastMouseRef.current
      validateHoverOnCameraChange(x, y, (node: any, px: number, py: number) => {
        if (node) {
          updateTooltipAndPreview(node, px, py)
        } else {
          setTooltip(prev => ({ ...prev, visible: false }))
          hidePreviewModule()
          prevHoverIdRef.current = null
        }
      })
    }
    
    onCameraChange(validateHover)
    return () => onCameraChange(null)
  }, [updateTooltipAndPreview])

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    lastMouseRef.current = { x, y }

    // Handle panning - use vanilla JS function
    if (isPanningRef.current && lastPanRef.current) {
      const newPan = handleMouseMovePan(x, y, isPanningRef.current, lastPanRef.current) as { x: number; y: number } | null
      if (newPan) {
        lastPanRef.current = newPan
        setTooltip(prev => ({ ...prev, visible: false }))
        hidePreviewModule()
        return
      }
    }

    // Throttle picking for non-panning moves
    if (!pickingScheduledRef.current) {
      pickingScheduledRef.current = true
      requestAnimationFrame(() => {
        pickingScheduledRef.current = false
        const n = handleMouseMovePick(lastMouseRef.current.x, lastMouseRef.current.y)
        if (n) {
          updateTooltipAndPreview(n, lastMouseRef.current.x, lastMouseRef.current.y)
        }
      })
    }
  }

  const handleMouseLeave = () => {
    // Use vanilla JS function
    handleMouseLeaveEvent()
    setTooltip(prev => ({ ...prev, visible: false }))
    
    // Clear any pending breadcrumb update when mouse leaves
    if (breadcrumbTimerRef.current !== null) {
      clearTimeout(breadcrumbTimerRef.current)
      breadcrumbTimerRef.current = null
    }
    pendingBreadcrumbNodeIdRef.current = null
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      // Middle mouse button - use vanilla JS function
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const result = handleMouseDownJS(1, x, y)
        if (result && typeof result === 'object' && 'x' in result && 'y' in result) {
          isPanningRef.current = true
          lastPanRef.current = { x: (result as { x: number; y: number }).x, y: (result as { x: number; y: number }).y }
        }
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

  // Keyboard shortcut to toggle legend visibility (desktop only)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      
      // Disable on mobile/touch devices
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      if (isTouchDevice) {
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
  // Use vanilla JS function for performance-critical wheel handling
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheelEventWrapper = (e: WheelEvent) => {
      handleWheelEvent(e, canvas)
    }

    canvas.addEventListener('wheel', handleWheelEventWrapper, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheelEventWrapper)
  }, [])

  // Touch event handlers for mobile support
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const touchState = touchStateRef.current

    const getTouchPos = (touch: Touch) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      }
    }

    const getDistance = (t1: Touch, t2: Touch) => {
      const dx = t1.clientX - t2.clientX
      const dy = t1.clientY - t2.clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    const getCenter = (t1: Touch, t2: Touch) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: ((t1.clientX + t2.clientX) / 2) - rect.left,
        y: ((t1.clientY + t2.clientY) / 2) - rect.top,
      }
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        // Single touch - prepare for pan or tap
        const touch = e.touches[0]
        const pos = getTouchPos(touch)
        touchState.lastTouch = pos
        touchState.isPanning = false
        
        // Clear any existing long press timer
        if (touchState.longPressTimer) {
          clearTimeout(touchState.longPressTimer)
          touchState.longPressTimer = null
        }
        
        // Set up long press timer (500ms)
        touchState.longPressTimer = window.setTimeout(() => {
          // Long press - trigger context menu (go to parent)
          const current = state.current as TaxonomyNode | null
          if (current && current.parent && !isLoading) {
            updateCurrentNodeOnly(current.parent as any)
            onUpdateBreadcrumbs(current.parent)
            // Visual feedback
            canvas.style.opacity = '0.8'
            setTimeout(() => {
              canvas.style.opacity = '1'
            }, 200)
          }
          touchState.longPressTimer = null
        }, 500)
        
        // Update hover on touch start
        const n = pickNodeAt(pos.x, pos.y)
        state.hoverNode = n
        if (n) {
          updateTooltipAndPreview(n, pos.x, pos.y)
        }
      } else if (e.touches.length === 2) {
        // Two touches - prepare for pinch zoom
        touchState.isZooming = true
        touchState.isPanning = false
        const distance = getDistance(e.touches[0], e.touches[1])
        touchState.initialDistance = distance
        touchState.initialZoom = state.camera.k
        touchState.initialCenter = getCenter(e.touches[0], e.touches[1])
        
        // Cancel long press timer
        if (touchState.longPressTimer) {
          clearTimeout(touchState.longPressTimer)
          touchState.longPressTimer = null
        }
      }
      e.preventDefault()
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && touchState.lastTouch) {
        // Single touch move - panning
        const touch = e.touches[0]
        const pos = getTouchPos(touch)
        
        // Cancel long press if moved
        if (touchState.longPressTimer) {
          clearTimeout(touchState.longPressTimer)
          touchState.longPressTimer = null
        }
        
        if (!touchState.isPanning) {
          // Check if moved enough to start panning (5px threshold)
          const dx = pos.x - touchState.lastTouch.x
          const dy = pos.y - touchState.lastTouch.y
          if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            touchState.isPanning = true
            setTooltip(prev => ({ ...prev, visible: false }))
            hidePreviewModule()
          }
        }
        
        if (touchState.isPanning) {
          const dx = pos.x - touchState.lastTouch.x
          const dy = pos.y - touchState.lastTouch.y
          handleCameraPan(dx, dy)
          touchState.lastTouch = pos
        }
      } else if (e.touches.length === 2 && touchState.isZooming) {
        // Two touches - pinch zoom
        const distance = getDistance(e.touches[0], e.touches[1])
        const scale = distance / touchState.initialDistance
        const newZoom = touchState.initialZoom * scale
        
        if (touchState.initialCenter) {
          const center = getCenter(e.touches[0], e.touches[1])
          const [wx, wy] = screenToWorld(center.x, center.y)
          
          state.camera.k = newZoom
          state.camera.x = wx - (center.x - canvas.width / 2) / state.camera.k
          state.camera.y = wy - (center.y - canvas.height / 2) / state.camera.k
          
          requestRender()
        }
      }
      e.preventDefault()
    }

    const handleTouchEnd = (e: TouchEvent) => {
      // Cancel long press timer
      if (touchState.longPressTimer) {
        clearTimeout(touchState.longPressTimer)
        touchState.longPressTimer = null
      }
      
      if (e.touches.length === 0) {
        // All touches ended
        if (!touchState.isPanning && !touchState.isZooming && touchState.lastTouch) {
          // Single tap - disabled on mobile to prevent accidental navigation
          // Only double tap is enabled for fitting nodes
          const now = Date.now()
          const timeSinceLastTap = now - touchState.lastTapTime
          
          if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
            // Double tap - fit current node
            const target = state.hoverNode || state.current || state.DATA_ROOT
            if (target) {
              // @ts-ignore - JS module import
              fitNodeInView(target)
            }
          }
          // Single tap navigation removed - prevents accidental clicks while panning/zooming
          
          touchState.lastTapTime = now
        }
        
        touchState.isPanning = false
        touchState.isZooming = false
        touchState.lastTouch = null
        touchState.initialDistance = 0
        touchState.initialCenter = null
      } else if (e.touches.length === 1) {
        // One touch remaining - switch to single touch mode
        touchState.isZooming = false
        const touch = e.touches[0]
        touchState.lastTouch = getTouchPos(touch)
      }
      
      e.preventDefault()
    }

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false })
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false })
    
    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchmove', handleTouchMove)
      canvas.removeEventListener('touchend', handleTouchEnd)
      canvas.removeEventListener('touchcancel', handleTouchEnd)
      if (touchState.longPressTimer) {
        clearTimeout(touchState.longPressTimer)
      }
    }
  }, [isLoading, onUpdateBreadcrumbs])

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
          <div className="big-preview-path" id="bigPreviewPath"></div>
        </div>
      </div>

      {/* Legend */}
      {legendVisible && (
        <div className="legend">
          <div className="legend-title">Controls</div>
          <ul>
            <li><kbd>Left Click</kbd> Zoom into a group (desktop only)</li>
            <li><kbd>Right Click</kbd> / <kbd>Long Press</kbd> Zoom out to parent</li>
            <li><kbd>Wheel</kbd> / <kbd>Pinch</kbd> Smooth zoom</li>
            <li><kbd>Middle Drag</kbd> / <kbd>Drag</kbd> Pan the view</li>
            <li><kbd>Double Tap</kbd> Fit hovered/current</li>
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


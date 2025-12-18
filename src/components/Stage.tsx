import { useEffect, useRef, useState, useCallback } from 'react'
import { state } from '../modules/state'
import { requestRender, screenToWorld, resizeCanvas, tick } from '../modules/canvas'
import { pickNodeAt } from '../modules/picking'
import { goToNode, fitNodeInView } from '../modules/navigation'
import { openProviderSearch } from '../modules/providers'
import { perf } from '../modules/settings'
import { showBigFor, hideBigPreview as hidePreviewModule } from '../modules/preview'

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

  // Big preview is managed by the preview module via DOM manipulation
  // We just need to provide the DOM elements

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const isPanningRef = useRef(false)
  const lastPanRef = useRef<{ x: number; y: number } | null>(null)
  const pickingScheduledRef = useRef(false)
  const lastMouseRef = useRef({ x: 0, y: 0 })
  const prevHoverIdRef = useRef<number | null>(null)

  // Set up canvas reference in DOM module and initialize
  useEffect(() => {
    if (canvasRef.current) {
      // @ts-ignore - setting canvas reference for the modules
      window.__reactCanvas = canvasRef.current
    }
  }, [])
  
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
    
    if (node.children?.length) {
      meta = `${node.children.length} children`
    }
    if (node._leaves) {
      meta += meta ? ` • ${node._leaves} leaves` : `${node._leaves} leaves`
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
      })
    }
  }

  const handleMouseLeave = () => {
    state.hoverNode = null
    setTooltip(prev => ({ ...prev, visible: false }))
    hidePreviewModule()
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
      await goToNode(current.parent, true)
      onUpdateBreadcrumbs(current)
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

    if (n === state.current) {
      fitNodeInView(n)
    } else {
      await goToNode(n, true)
      onUpdateBreadcrumbs(n)
    }
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
        <img id="bigPreviewImg" alt="" decoding="async" />
        <div className="big-preview-empty" id="bigPreviewEmpty" aria-hidden="true">
          No image
        </div>
        <div className="big-preview-caption" id="bigPreviewCap"></div>
      </div>

      {/* Legend */}
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
          <li><kbd>?</kbd> Toggle help</li>
        </ul>
      </div>

      {/* Pulse animation element */}
      <div className="pulse" id="pulse" />
    </div>
  )
}


import { useEffect, useRef, useCallback, useState } from 'react'
import { state, setHoverNode } from '../modules/state'
import { attachCanvas, detachCanvas, requestRender, screenToWorld, resizeCanvas, onCameraChange, W, H } from '../modules/canvas'
import { openProviderSearch } from '../modules/providers'
import { initialPreview, loadPreview, prefetchPreview, type PreviewData } from '../modules/preview'
import { goToNode } from '../modules/navigation'
import { handleWheelEvent, handleMouseMovePick, handleMouseLeaveEvent } from '../modules/mouse-handler'
import { pickNodeAt } from '../modules/picking'
import { handleCameraPan, clampCameraZoom, stopCameraAnimation } from '../modules/camera'
import { ensureBackendViewport } from '../modules/data-backend'
import { type AppLanguage } from '../modules/i18n'
import { subscribeToPulse } from '../modules/visual-events'
import type { TaxonomyNode } from '../modules/types'
import { MapGesture } from '../modules/map-gesture.js'
import { getCommonName } from '../modules/taxon-names.js'
import PulseOverlay from './PulseOverlay'
import BigPreview from './BigPreview'
import MapControls from './MapControls'
import { discoveryCopy } from '../modules/discovery-copy'
import { getTooltipPosition } from '../modules/ui-layout'

interface StageProps {
  language: AppLanguage
  isLoading: boolean
  onUpdateBreadcrumbs: (node: TaxonomyNode) => void
  hidden?: boolean
  onRandom: () => Promise<void>
}

export default function Stage({ language, isLoading, onUpdateBreadcrumbs, hidden = false, onRandom }: StageProps) {
  const copy = discoveryCopy(language)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const tooltipNameRef = useRef<HTMLDivElement>(null)
  const tooltipMetaRef = useRef<HTMLDivElement>(null)
  const gesture = useRef(new MapGesture())
  const previewRequest = useRef(0)
  const previewPrefetch = useRef<{ node: TaxonomyNode; timer: ReturnType<typeof setTimeout> } | null>(null)
  const pinnedRef = useRef(false)
  const selectionRequest = useRef(0)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [pinned, setPinned] = useState(false)
  const [error, setError] = useState(false)
  const [pulse, setPulse] = useState<{ node: TaxonomyNode; sequence: number } | null>(null)

  const hideTooltip = useCallback(() => {
    if (previewPrefetch.current) clearTimeout(previewPrefetch.current.timer)
    previewPrefetch.current = null
    if (tooltipRef.current) tooltipRef.current.style.opacity = '0'
  }, [])

  const showPreview = useCallback((node: TaxonomyNode, force = false) => {
    if (pinnedRef.current && !force) return
    const request = ++previewRequest.current
    setPreview(initialPreview(node))
    const update = (result: PreviewData) => {
      if (request === previewRequest.current) setPreview(result)
    }
    void loadPreview(node, update).then(update)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const stage = stageRef.current
    if (canvas && stage) attachCanvas(canvas, stage)
    const resize = () => { resizeCanvas(); requestRender(); void ensureBackendViewport({ force: true }).catch(() => setError(true)) }
    // Navigation can change height without a window resize (mobile or expanded path).
    const observer = new ResizeObserver(resize)
    if (stage) observer.observe(stage)
    const cancel = () => { gesture.current.cancel(); if (canvas) canvas.style.cursor = 'grab' }
    window.addEventListener('resize', resize)
    window.addEventListener('blur', cancel)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', resize)
      window.removeEventListener('blur', cancel)
      if (canvas) detachCanvas(canvas)
      gesture.current.cancel()
      previewRequest.current++
      if (previewPrefetch.current) clearTimeout(previewPrefetch.current.timer)
    }
  }, [])

  useEffect(() => subscribeToPulse(node => {
    setPulse(previous => ({ node, sequence: (previous?.sequence ?? 0) + 1 }))
    showPreview(node)
  }), [showPreview])

  useEffect(() => onCameraChange(hideTooltip), [hideTooltip])

  useEffect(() => {
    gesture.current.cancel()
    hideTooltip()
    if (hidden) {
      pinnedRef.current = false
      setPinned(false)
      previewRequest.current++
      setPreview(null)
      setError(false)
    } else { resizeCanvas(); requestRender() }
  }, [hidden, isLoading, hideTooltip])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || hidden || isLoading) return
    const wheel = (event: WheelEvent) => { hideTooltip(); handleWheelEvent(event, canvas) }
    canvas.addEventListener('wheel', wheel, { passive: false })
    return () => canvas.removeEventListener('wheel', wheel)
  }, [hidden, isLoading, hideTooltip])

  const selectNode = async (node: TaxonomyNode | null) => {
    if (!node || isLoading) return
    const request = ++selectionRequest.current
    setError(false)
    hideTooltip()
    try {
      setPulse(null)
      await goToNode(node, false)
      onUpdateBreadcrumbs(node)
      showPreview(node)
      await ensureBackendViewport({ force: true })
    } catch { if (request === selectionRequest.current) setError(true) }
  }

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const pointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (isLoading || (event.button !== 0 && event.button !== 1)) return
    event.preventDefault()
    stopCameraAnimation()
    gesture.current.start(event.pointerId, point(event), event.button === 0)
    event.currentTarget.setPointerCapture(event.pointerId)
    hideTooltip()
  }

  const pointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (isLoading) return
    const position = point(event)
    if (gesture.current.points.size) {
      const action = gesture.current.move(event.pointerId, position)
      if (!action) return
      event.currentTarget.style.cursor = 'grabbing'
      hideTooltip()
      setHoverNode(null)
      if (action.type === 'pan') handleCameraPan(action.dx, action.dy)
      else {
        const [wx, wy] = screenToWorld(action.from.x, action.from.y)
        const k = clampCameraZoom(state.camera.k * action.scale)
        state.camera = { x: wx - (action.to.x - W / 2) / k, y: wy - (action.to.y - H / 2) / k, k }
        requestRender()
      }
      return
    }
    if (event.pointerType === 'touch') return
    const node = handleMouseMovePick(position.x, position.y)
    event.currentTarget.style.cursor = node ? 'pointer' : 'grab'
    if (!node || !tooltipRef.current) { hideTooltip(); return }
    if (previewPrefetch.current?.node !== node) {
      if (previewPrefetch.current) clearTimeout(previewPrefetch.current.timer)
      previewPrefetch.current = { node, timer: setTimeout(() => prefetchPreview(node), 150) }
    }
    // Hover gives a lightweight cue. Reading cards change only after selection.
    if (tooltipNameRef.current) tooltipNameRef.current.textContent = getCommonName(node.name, language) || node.name
    if (tooltipMetaRef.current) tooltipMetaRef.current.textContent = copy.clickExplore
    const tooltip = tooltipRef.current
    const placement = getTooltipPosition(position.x, position.y, tooltip.offsetWidth, tooltip.offsetHeight, W, H)
    tooltip.style.left = `${placement.left}px`
    tooltip.style.top = `${placement.top}px`
    tooltip.style.opacity = '1'
  }

  const pointerEnd = (event: React.PointerEvent<HTMLCanvasElement>, cancelled = false) => {
    const tap = gesture.current.end(event.pointerId, point(event), cancelled)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    event.currentTarget.style.cursor = 'grab'
    if (tap) void selectNode(pickNodeAt(tap.x, tap.y))
  }

  return (
    <div className={`stage ${hidden ? 'hidden' : ''}`} ref={stageRef}>
      <canvas id="view" ref={canvasRef} className={isLoading ? 'loading' : ''}
        onPointerDown={pointerDown} onPointerMove={pointerMove}
        onPointerUp={event => pointerEnd(event)} onPointerCancel={event => pointerEnd(event, true)}
        onLostPointerCapture={event => { gesture.current.end(event.pointerId, point(event), true) }}
        onPointerLeave={() => { handleMouseLeaveEvent(); hideTooltip() }}
        onContextMenu={event => { event.preventDefault(); if (state.current?.parent) void selectNode(state.current.parent) }}
        role="img" aria-label={copy.explanation}
      />
      <div className="tooltip" ref={tooltipRef}><div className="tooltip-content">
        <div className="tooltip-name" ref={tooltipNameRef} />
        <div className="tooltip-meta" ref={tooltipMetaRef} />
      </div></div>
      <BigPreview language={language} preview={preview} pinned={pinned}
        onTogglePin={() => {
          pinnedRef.current = !pinnedRef.current
          setPinned(pinnedRef.current)
          if (!pinnedRef.current && state.current) showPreview(state.current, true)
        }}
        onClose={() => { pinnedRef.current = false; setPinned(false); previewRequest.current++; setPreview(null) }}
        onWebSearch={() => openProviderSearch(preview?.node || state.current)}
      />
      {!hidden && !isLoading && <MapControls language={language} onRandom={onRandom} hasPreview={!!preview} />}
      {error && !hidden && <div className="map-error" role="alert">{copy.error}<button type="button" onClick={() => setError(false)} aria-label={copy.dismiss}>×</button></div>}
      <PulseOverlay node={pulse?.node ?? null} sequence={pulse?.sequence ?? 0} onFinish={() => setPulse(null)} />
    </div>
  )
}

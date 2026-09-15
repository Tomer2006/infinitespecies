import { useEffect, useRef, useState } from 'react'
import { useTaxonomyState } from '../hooks/useTaxonomyState'
import { state } from '../modules/state'
import { animateToCam, clampCameraZoom } from '../modules/camera'
import { goToNode } from '../modules/navigation'
import { ensureBackendViewport, loadChildGroups } from '../modules/data-backend'
import { requestNodePulse } from '../modules/visual-events'
import { getCommonName } from '../modules/taxon-names.js'
import { discoveryCopy } from '../modules/discovery-copy'
import type { AppLanguage } from '../modules/i18n'
import type { TaxonomyNode } from '../modules/types'

export default function MapControls({ language, onRandom, hasPreview }: { language: AppLanguage; onRandom: () => Promise<void>; hasPreview: boolean }) {
  const copy = discoveryCopy(language)
  const { current, dataRoot } = useTaxonomyState()
  const [browse, setBrowse] = useState(false)
  const [children, setChildren] = useState<TaxonomyNode[]>([])
  const [total, setTotal] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(0)
  const [retry, setRetry] = useState(0)
  const [tip, setTip] = useState(() => localStorage.getItem('infinitespecies_mapTipsSeen') !== 'true')
  const [detailTip, setDetailTip] = useState(false)
  const browseButton = useRef<HTMLButtonElement>(null)
  const controls = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const node = current || dataRoot

  useEffect(() => {
    const toolbar = controls.current
    const stage = toolbar?.closest<HTMLElement>('.stage')
    if (!toolbar || !stage) return
    const measure = () => {
      const clearance = Math.ceil(stage.getBoundingClientRect().bottom - toolbar.getBoundingClientRect().top + 12)
      stage.style.setProperty('--map-controls-clearance', `${clearance}px`)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(toolbar)
    observer.observe(stage)
    measure()
    return () => { observer.disconnect(); stage.style.removeProperty('--map-controls-clearance') }
  }, [])

  useEffect(() => { setChildren([]); setTotal(0); setPage(0); setError(false) }, [node?._id])
  useEffect(() => {
    if (current && current !== dataRoot) setDetailTip(true)
  }, [current, dataRoot])
  useEffect(() => {
    if (!browse || !node) return
    const controller = new AbortController()
    setBusy(true)
    setError(false)
    void loadChildGroups(node, page * 50, controller.signal).then(result => {
      if (controller.signal.aborted) return
      setChildren(previous => page === 0 ? result.nodes : [...new Map([...previous, ...result.nodes].map(item => [item._id, item])).values()])
      setTotal(result.total)
    }).catch(() => { if (!controller.signal.aborted) setError(true) })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [browse, node?._id, page, retry])
  useEffect(() => { if (browse) heading.current?.focus({ preventScroll: true }) }, [browse, node?._id])

  const navigate = async (target: TaxonomyNode | null) => {
    if (!target) return
    setBusy(true)
    setError(false)
    try {
      await goToNode(target, true)
      await ensureBackendViewport({ force: true })
      requestNodePulse(target)
    } catch { setError(true) }
    finally { setBusy(false) }
  }
  const closeBrowse = () => { setBrowse(false); setBusy(false); browseButton.current?.focus({ preventScroll: true }) }
  return (
    <>
      <div className="map-controls" ref={controls} aria-label={copy.browse}>
        <button type="button" aria-label={copy.zoomIn} title={copy.zoomIn} onClick={() => animateToCam(state.camera.x, state.camera.y, clampCameraZoom(state.camera.k * 1.6), 180)}>+</button>
        <button type="button" aria-label={copy.zoomOut} title={copy.zoomOut} onClick={() => animateToCam(state.camera.x, state.camera.y, clampCameraZoom(state.camera.k / 1.6), 180)}>−</button>
        <button className="map-browse-button" ref={browseButton} type="button" aria-expanded={browse} aria-controls="group-browser" onClick={() => browse ? closeBrowse() : setBrowse(true)}>{copy.browse}</button>
        <button type="button" disabled={busy} onClick={() => { setBusy(true); setError(false); void onRandom().catch(() => setError(true)).finally(() => setBusy(false)) }}>{copy.random} ✧</button>
      </div>
      {tip && !error && !browse && !hasPreview && <div className="map-tip" dir={language === 'he' ? 'rtl' : 'ltr'}>
        <p>{detailTip ? copy.detailHint : window.matchMedia('(pointer: coarse)').matches ? copy.touchHint : copy.hint}</p>
        <button type="button" aria-label={copy.dismiss} onClick={() => { setTip(false); localStorage.setItem('infinitespecies_mapTipsSeen', 'true') }}>×</button>
      </div>}
      {error && !browse && <div className="map-tip" role="alert">{copy.error}</div>}
      {browse && <section id="group-browser" className="group-browser" aria-labelledby="group-heading" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); closeBrowse() } }}>
        <header><h2 id="group-heading" ref={heading} tabIndex={-1}>{copy.groups} <bdi>{getCommonName(node?.name || '', language) || node?.name}</bdi></h2><button type="button" aria-label={copy.dismiss} onClick={closeBrowse}>×</button></header>
        <div className="group-list" aria-busy={busy}>
          {children.map(child => <button type="button" key={child._id} disabled={busy} onClick={() => void navigate(child)}><span>{getCommonName(child.name, language) || child.name}<small>{getCommonName(child.name, language) ? child.name : ''}</small></span><span aria-hidden="true">→</span></button>)}
          {busy && <p role="status">{copy.loading}</p>}
          {!busy && !error && !children.length && <p>{copy.empty}</p>}
          {error && <p role="alert">{copy.error} <button type="button" onClick={() => setRetry(value => value + 1)}>{copy.retry}</button></p>}
          {!busy && !error && children.length < total && <button type="button" onClick={() => setPage(value => value + 1)}>{copy.more} ({children.length}/{total})</button>}
        </div>
      </section>}
    </>
  )
}

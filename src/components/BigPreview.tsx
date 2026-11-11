import { useEffect, useState } from 'react'
import type { PreviewData } from '../modules/preview'
import { translate, type AppLanguage } from '../modules/i18n'
import { discoveryCopy } from '../modules/discovery-copy'
import { getCommonName } from '../modules/taxon-names.js'

interface BigPreviewProps {
  language: AppLanguage
  preview: PreviewData | null
  pinned: boolean
  onTogglePin: () => void
  onClose: () => void
  onWebSearch: () => void
}

// Where the card would cover the selected circle (phones, narrow windows), it
// starts as a compact peek so the map stays visible; the reader opens it.
const startsCollapsed = () => typeof window !== 'undefined' && window.innerWidth < 1100

export default function BigPreview({ language, preview, pinned, onTogglePin, onClose, onWebSearch }: BigPreviewProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const [collapsed, setCollapsed] = useState(startsCollapsed)
  const copy = discoveryCopy(language)
  useEffect(() => setImageFailed(false), [preview?.thumbnail])
  if (!preview) return null
  const { node } = preview
  const name = getCommonName(node.name, language) || preview.commonName || node.name
  const image = preview.thumbnail && !imageFailed ? preview.thumbnail : null
  const hasGroups = node._hasChildren ?? node.children?.length > 0
  const count = hasGroups && node._leaves > 1 ? node._leaves : 0
  return (
    <aside className={`big-preview species-card visible${collapsed ? ' is-collapsed' : ''}`} aria-label={name}>
      <header className="species-card-header">
        {collapsed && image && <img className="species-card-thumb" src={image} alt="" decoding="async" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />}
        <div><h2 dir="auto">{name}</h2>{name !== node.name && <p lang="la">{node.name}</p>}</div>
        <button type="button" onClick={onClose} aria-label={copy.close}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </header>
      <div className="species-card-actions">
        <button type="button" aria-pressed={pinned} onClick={onTogglePin}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17v5M9 3h6l-1 7 3 3v2H7v-2l3-3-1-7Z" /></svg>
          {pinned ? copy.unpin : copy.pin}
        </button>
        <button type="button" aria-expanded={!collapsed} aria-controls="species-card-details" onClick={() => setCollapsed(value => !value)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          {collapsed ? copy.expand : copy.collapse}
        </button>
      </div>
      <div id="species-card-details" className="species-card-details" hidden={collapsed}>
        {image
          ? <img className="species-card-image" src={image} alt={name} decoding="async" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
          : preview.loading && <div className="species-card-image skeleton" aria-hidden="true" />}
        <div className="species-facts">
          {preview.rank && <span className="species-rank" lang="en" title={copy.rank}>{preview.rank}</span>}
          {count > 0 && <span className="species-count">{count.toLocaleString(language)} {copy.inside}</span>}
        </div>
        {preview.loading ? <>
          <p className="sr-only" role="status">{copy.loading}</p>
          <div className="skeleton-lines" aria-hidden="true"><span /><span /><span /></div>
        </> : <>
          <p className="species-description" lang={preview.description ? 'en' : language}>{preview.description || copy.noDescription}</p>
          {preview.sourceUrl && <p className="species-source"><a href={preview.sourceUrl} target="_blank" rel="noopener noreferrer">{copy.source} ↗</a><small>{copy.license}</small></p>}
        </>}
        <details className="species-path"><summary>{translate('breadcrumbs.ariaLabel', undefined, language)}</summary><p>{preview.path}</p></details>
        <button type="button" className="species-web" onClick={onWebSearch}>{translate('stage.webSearch', undefined, language)} ↗</button>
      </div>
    </aside>
  )
}

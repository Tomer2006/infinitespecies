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

export default function BigPreview({ language, preview, pinned, onTogglePin, onClose, onWebSearch }: BigPreviewProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const copy = discoveryCopy(language)
  useEffect(() => setImageFailed(false), [preview?.thumbnail])
  if (!preview) return null
  const name = getCommonName(preview.node.name, language) || preview.commonName || preview.node.name
  return (
    <aside className={`big-preview species-card visible${collapsed ? ' is-collapsed' : ''}`} aria-label={name}>
      <header className="species-card-header">
        <div><h2 dir="auto">{name}</h2>{name !== preview.node.name && <p lang="la">{preview.node.name}</p>}</div>
        <button type="button" onClick={onClose} aria-label={copy.close}>×</button>
      </header>
      <div className="species-card-actions">
        <button type="button" aria-pressed={pinned} onClick={onTogglePin}>{pinned ? copy.unpin : copy.pin}</button>
        <button type="button" aria-expanded={!collapsed} aria-controls="species-card-details" onClick={() => setCollapsed(value => !value)}>{collapsed ? copy.expand : copy.collapse}</button>
      </div>
      <div id="species-card-details" className="species-card-details" hidden={collapsed}>
        {preview.thumbnail && !imageFailed && <img src={preview.thumbnail} alt={name} decoding="async" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />}
        {preview.loading ? <p role="status">{copy.loading}</p> : <>
          {preview.rank && <p className="species-rank">{copy.rank}: <span lang="en">{preview.rank}</span></p>}
          <p className="species-description" lang={preview.description ? 'en' : language}>{preview.description || copy.noDescription}</p>
          {preview.sourceUrl && <p className="species-source"><a href={preview.sourceUrl} target="_blank" rel="noopener noreferrer">{copy.source} ↗</a><small>{copy.license}</small></p>}
        </>}
        <details className="species-path"><summary>{translate('breadcrumbs.ariaLabel', undefined, language)}</summary><p>{preview.path}</p></details>
        <button type="button" className="species-web" onClick={onWebSearch}>{translate('stage.webSearch', undefined, language)} ↗</button>
      </div>
    </aside>
  )
}

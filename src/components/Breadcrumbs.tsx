import { useState, useEffect } from 'react'
import { translate, type AppLanguage } from '../modules/i18n'
import { discoveryCopy } from '../modules/discovery-copy'
import { getCommonName } from '../modules/taxon-names.js'
import type { TaxonomyNode } from '../modules/types'

interface Crumb { id: number; name: string; node: TaxonomyNode }
interface BreadcrumbsProps { language: AppLanguage; crumbs: Crumb[]; onCrumbClick: (node: TaxonomyNode) => void }

export default function Breadcrumbs({ language, crumbs, onCrumbClick }: BreadcrumbsProps) {
  const [expanded, setExpanded] = useState(false)
  const copy = discoveryCopy(language)
  const current = crumbs[crumbs.length - 1]
  const parent = crumbs[crumbs.length - 2]
  useEffect(() => setExpanded(false), [current?.id])
  if (!current) return null
  const name = (crumb: Crumb) => getCommonName(crumb.name, language) || crumb.name
  const hasChildren = current.node._hasChildren ?? current.node.children.length > 0
  const context = current.name.toLowerCase() === 'eukaryota'
    ? language === 'he' ? 'הענף הזה כולל בעלי חיים, צמחים, פטריות וצורות חיים נוספות עם גרעיני תאים.' : 'This branch includes animals, plants, fungi and other life with cell nuclei.'
    : hasChildren ? null : copy.contextLeaf
  return (
    <nav className="breadcrumbs simple-breadcrumbs" aria-label={translate('breadcrumbs.ariaLabel', undefined, language)}>
      <div className="simple-trail">
        <button className="crumb" type="button" onClick={() => onCrumbClick(crumbs[0].node)} aria-current={crumbs.length === 1 ? 'page' : undefined}>{copy.allLife}</button>
        {crumbs.length > 3 && <>
          <span aria-hidden="true">/</span>
          <button className="crumb path-toggle" type="button" aria-label={expanded ? copy.hidePath : copy.fullPath} aria-expanded={expanded} aria-controls="full-taxonomy-path" onClick={() => setExpanded(value => !value)}>…</button>
        </>}
        {crumbs.length > 2 && <><span aria-hidden="true">/</span><button className="crumb" type="button" title={parent.name} onClick={() => onCrumbClick(parent.node)}>{name(parent)}</button></>}
        {crumbs.length > 1 && <><span aria-hidden="true">/</span><span className="current-crumb" aria-current="page" title={current.name}>{name(current)}</span></>}
        {parent && <button className="location-back" type="button" title={`${copy.backTo} ${name(parent)}`} onClick={() => onCrumbClick(parent.node)}>← {copy.backTo} <bdi>{name(parent)}</bdi></button>}
      </div>
      {expanded && <div id="full-taxonomy-path" className="full-taxonomy-path">{crumbs.map(crumb => <button type="button" className="crumb" key={crumb.id} onClick={() => onCrumbClick(crumb.node)}>{name(crumb)}</button>)}</div>}
      {context && <p className="location-context" dir={language === 'he' ? 'rtl' : 'ltr'}>{context}</p>}
    </nav>
  )
}

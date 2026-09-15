import { useEffect, useRef } from 'react'
import { translate, type AppLanguage } from '../modules/i18n'

interface LoadingOverlayProps {
  language: AppLanguage
  title: string
  stage: string
  progress: number
  pct: string
  timer: string
}

export default function LoadingOverlay({ language, title, stage, progress, timer }: LoadingOverlayProps) {
  const overlay = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement
    overlay.current?.focus({ preventScroll: true })
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])
  const percentage = Math.round(Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0)))
  return (
    <div ref={overlay} tabIndex={-1} className="loading-overlay" role="dialog" aria-modal="true" aria-labelledby="loading-title"
      onKeyDown={event => { if (event.key === 'Tab') event.preventDefault() }}>
      <div className="loading-content">
        <div className="loading-brand">
          <div className="loading-brand-text">
            <div className="loading-brand-title">InfiniteSpecies</div>
          </div>
        </div>

        <h3 className="loading-title" id="loading-title" role="status" aria-live="polite">{title}</h3>
        <div className="loading-stage">{stage}</div>

        <div className="progress-bar" role="progressbar" aria-label={translate('loading.loadingLabel', undefined, language)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>
          <div className="progress-fill" style={{ width: `${percentage}%` }} />
        </div>

        <div className="loading-meta">
          <span>{translate('loading.loadingLabel', undefined, language)}</span>
          <span>{percentage}%</span>
        </div>

        <div className="loading-timer">{timer}</div>
      </div>
    </div>
  )
}

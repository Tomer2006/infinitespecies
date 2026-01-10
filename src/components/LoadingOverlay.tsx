interface LoadingOverlayProps {
  title: string
  stage: string
  progress: number
  pct: string
  timer: string
}

export default function LoadingOverlay({
  title,
  stage,
  progress,
  pct,
  timer,
}: LoadingOverlayProps) {
  return (
    <div className="loading-overlay">
      <div className="loading-card">
        <div className="loading-brand">
          <div className="loading-logo">🧬</div>
          <div className="loading-brand-text">
            <div className="loading-brand-title">InfiniteSpecies</div>
            <div className="loading-brand-sub">Tree of Life Explorer</div>
          </div>
        </div>

        <h3 className="loading-title">{title}</h3>
        
        <div className="loading-stage">{stage}</div>
        
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="loading-meta">
          <span>Loading...</span>
          <span>{pct}</span>
        </div>

        <div className="loading-timer">{timer}</div>

        <div className="loading-hint">
          Tip: Press <kbd>?</kbd> for help, <kbd>F</kbd> to fit, <kbd>S</kbd> for web search
        </div>
      </div>
    </div>
  )
}


export interface ProgressUpdate {
  percentage: number
  label?: string
  currentStage: number
  totalStages: number
}

type ProgressListener = (update: ProgressUpdate) => void
const listeners = new Set<ProgressListener>()

export function subscribeProgress(listener: ProgressListener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function setProgress(progress: number, label?: string, currentStage = 1, totalStages = 1) {
  const total = Number.isFinite(totalStages) ? Math.max(1, Math.floor(totalStages)) : 1
  const stage = Number.isFinite(currentStage) ? Math.min(total, Math.max(1, Math.floor(currentStage))) : 1
  const fraction = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0
  const update: ProgressUpdate = {
    percentage: Math.round(((stage - 1 + fraction) / total) * 100),
    label,
    currentStage: stage,
    totalStages: total,
  }
  listeners.forEach((listener) => listener(update))
}

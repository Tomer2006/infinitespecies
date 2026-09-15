/** Keep hover text inside the map, preferring above the pointer when it fits. */
export function getTooltipPosition(x: number, y: number, width: number, height: number, viewportWidth: number, viewportHeight: number) {
  const padding = 8
  const gap = 12
  const clamp = (value: number, size: number, viewport: number) =>
    Math.max(padding, Math.min(value, Math.max(padding, viewport - size - padding)))
  const above = y - height - gap
  return {
    left: clamp(x - width / 2, width, viewportWidth),
    top: clamp(above >= padding ? above : y + gap, height, viewportHeight),
  }
}

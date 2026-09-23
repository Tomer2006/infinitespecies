interface Point { x: number; y: number }
interface Camera extends Point { k: number }

/** Keep the containing circle's center at its existing screen position. */
export function getSelectionCamera(camera: Camera, container: Point, zoom: number): Camera {
  if (!(zoom > 0 && Number.isFinite(zoom) && camera.k > 0)) return { ...camera }
  const ratio = camera.k / zoom
  return {
    x: container.x - (container.x - camera.x) * ratio,
    y: container.y - (container.y - camera.y) * ratio,
    k: zoom,
  }
}

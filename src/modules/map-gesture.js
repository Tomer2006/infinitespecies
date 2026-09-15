/** Pointer gesture recognition without DOM or camera dependencies. */
export class MapGesture {
  points = new Map();
  origin = null;
  moved = false;
  multiple = false;
  selectable = true;

  start(id, point, selectable = true) {
    if (!this.points.size) {
      this.origin = point;
      this.moved = false;
      this.multiple = false;
      this.selectable = selectable;
    }
    this.points.set(id, point);
    if (this.points.size > 1) this.multiple = true;
  }

  move(id, point) {
    const previous = this.points.get(id);
    if (!previous) return null;
    const before = [...this.points.values()];
    this.points.set(id, point);
    if (this.points.size > 1) {
      this.moved = true;
      const after = [...this.points.values()];
      const midpoint = pair => ({ x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 });
      const distance = pair => Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
      const oldDistance = distance(before);
      return { type: 'zoom', scale: oldDistance > 0 ? distance(after) / oldDistance : 1, from: midpoint(before), to: midpoint(after) };
    }
    if (!this.moved && this.selectable && Math.hypot(point.x - this.origin.x, point.y - this.origin.y) <= 6) return null;
    const from = this.moved ? previous : this.origin;
    this.moved = true;
    return { type: 'pan', dx: point.x - from.x, dy: point.y - from.y };
  }

  end(id, point, cancelled = false) {
    if (!this.points.has(id)) return null;
    const tap = !cancelled && this.selectable && !this.multiple && !this.moved && this.origin
      && Math.hypot(point.x - this.origin.x, point.y - this.origin.y) <= 6;
    this.points.delete(id);
    if (!this.points.size) this.cancel();
    return tap ? point : null;
  }

  cancel() {
    this.points.clear();
    this.origin = null;
    this.moved = false;
    this.multiple = false;
  }
}

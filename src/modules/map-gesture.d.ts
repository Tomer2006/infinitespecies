type Point = { x: number; y: number };
type Gesture = { type: 'pan'; dx: number; dy: number } | { type: 'zoom'; scale: number; from: Point; to: Point };
export class MapGesture {
  points: Map<number, Point>;
  start(id: number, point: Point, selectable?: boolean): void;
  move(id: number, point: Point): Gesture | null;
  end(id: number, point: Point, cancelled?: boolean): Point | null;
  cancel(): void;
}

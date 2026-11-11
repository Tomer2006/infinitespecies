/** The InfiniteSpecies mark: circles packed inside a circle, like the map itself. */
export default function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10.75" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9.2" cy="10" r="4.4" fill="currentColor" />
      <circle cx="16.3" cy="13.4" r="2.7" fill="currentColor" opacity=".7" />
      <circle cx="10.8" cy="17.3" r="1.8" fill="currentColor" opacity=".45" />
    </svg>
  )
}

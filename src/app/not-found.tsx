import Link from 'next/link'
import ReadingShell from '../components/ReadingShell'

export default function NotFound() {
  return <ReadingShell><div className="reading-hero"><p className="eyebrow">404</p><h1>This branch is missing.</h1>
    <p>The page may have moved. You can start again from the map.</p><Link className="hero-start" href="/">Return to InfiniteSpecies ↗</Link>
  </div></ReadingShell>
}

import Link from 'next/link'

export default function ReadingShell({ children }: { children: React.ReactNode }) {
  return <div className="reading-page min-h-dvh">
    <a className="reading-skip" href="#content">Skip to content</a>
    <header className="reading-nav">
      <Link className="reading-brand" href="/">InfiniteSpecies ↗</Link>
      <nav aria-label="Main navigation"><Link href="/tree-of-life/">How to explore</Link><Link href="/about/">About &amp; sources</Link></nav>
    </header>
    <main id="content">{children}</main>
    <footer className="reading-footer"><Link href="/">Explore the map</Link><Link href="/about/">Data sources &amp; feedback</Link></footer>
  </div>
}

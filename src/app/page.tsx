import type { Metadata } from 'next'
import App from '../App'

export const metadata: Metadata = { alternates: { canonical: '/' } }

export default function Home() {
  const structured = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'InfiniteSpecies', url: 'https://infinitespecies.com/', inLanguage: 'en' }
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured) }} />
    <App />
    <noscript><div className="noscript-notice">Enable JavaScript to explore the map, or <a href="/tree-of-life/">read the guide</a>.</div></noscript>
  </>
}

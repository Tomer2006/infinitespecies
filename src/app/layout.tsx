import type { Metadata, Viewport } from 'next'
import '../styles/index.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://infinitespecies.com'),
  title: { default: 'InfiniteSpecies.com - Explore the Tree of Life', template: '%s | InfiniteSpecies' },
  description: 'Millions of organisms, one zoomable map. Explore the tree of life and search by everyday or scientific name.',
  applicationName: 'InfiniteSpecies',
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
  openGraph: { type: 'website', siteName: 'InfiniteSpecies', images: ['/landing-tree-bg1.png'] },
  twitter: { card: 'summary_large_image' },
  icons: { icon: '/icon.svg' },
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#080e13' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><div id="root">{children}</div></body></html>
}

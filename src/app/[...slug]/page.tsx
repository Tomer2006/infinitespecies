import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { discoveryPages } from '../../../build/discovery-pages.js'
import ReadingShell from '../../components/ReadingShell'

type Props = { params: Promise<{ slug: string[] }> }
const findPage = (slug: string[]) => discoveryPages.find(page => page.path === `/${slug.join('/')}/`)
export const dynamicParams = false
export function generateStaticParams() { return discoveryPages.map(page => ({ slug: page.path.split('/').filter(Boolean) })) }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = findPage((await params).slug)
  if (!page) notFound()
  return { title: page.title, description: page.description, alternates: { canonical: page.path },
    openGraph: { title: page.title, description: page.description, url: page.path, images: ['/landing-tree-bg1.png'] } }
}
export default async function ReadingPage({ params }: Props) {
  const page = findPage((await params).slug)
  if (!page) notFound()
  const related = discoveryPages.filter(other => other.path !== page.path && other.path !== '/about/')
  const structured = { '@context': 'https://schema.org', '@type': 'WebPage', name: page.title, description: page.description,
    url: `https://infinitespecies.com${page.path}`, inLanguage: 'en' }
  return <ReadingShell>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, '\\u003c') }} />
    <div className="reading-hero"><p className="eyebrow">{page.label}</p><h1>{page.heading}</h1><p className="reading-intro">{page.description}</p>
      <Link className="hero-start" href={`/?explore=${encodeURIComponent(page.target)}`}>{page.action} ↗</Link>
    </div>
    <div className="reading-layout"><article>
      {page.sections.map(([heading, text]) => <section key={heading}><h2>{heading}</h2><p>{text}</p></section>)}
      <section className="reading-sources"><h2>Sources &amp; further reading</h2><ul>{page.sources.map(([name, url]) => <li key={url}><a href={url}>{name}</a></li>)}</ul></section>
    </article><aside aria-label="More to explore"><p className="eyebrow">KEEP EXPLORING</p>{related.map(other => <Link key={other.path} href={other.path}>{other.label} ↗</Link>)}</aside></div>
  </ReadingShell>
}

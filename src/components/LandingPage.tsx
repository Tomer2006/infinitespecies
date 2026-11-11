import { useState } from 'react'
import { motion } from 'framer-motion'
import { translate, type AppLanguage } from '../modules/i18n'
import { discoveryCopy } from '../modules/discovery-copy'
import BrandMark from './BrandMark'

interface LandingPageProps {
  language: AppLanguage
  colorPreset: string
  isStarting: boolean
  onStart: () => void
  onDiscover: (destination: string) => void
  onHelp: () => void
  onSettings: () => void
}

export default function LandingPage({ language, colorPreset, isStarting, onStart, onDiscover, onHelp, onSettings }: LandingPageProps) {
  const copy = discoveryCopy(language)
  const [query, setQuery] = useState('')
  const destination = query.trim().replace(/\s+/g, ' ')
  // One control, two intents: an empty field opens the whole map, a name goes straight to it.
  const begin = () => { if (destination) onDiscover(destination); else onStart() }
  return (
    <motion.main className="landing-page discovery-landing" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <header className="landing-nav">
        <span className="landing-brand"><BrandMark size={26} />InfiniteSpecies</span>
        <nav aria-label={translate('common.settings', undefined, language)}>
          <button type="button" onClick={onHelp}>{copy.helpTitle}</button>
          <button type="button" onClick={onSettings}>{translate('common.settings', undefined, language)}</button>
        </nav>
      </header>
      <section className="discovery-hero">
        <div className="hero-copy" dir={language === 'he' ? 'rtl' : 'ltr'}>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.headline}</h1>
          <p className="hero-intro">{copy.intro}</p>
          <form className="hero-search" role="search" onSubmit={event => { event.preventDefault(); if (!isStarting) begin() }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
            <input type="search" dir="auto" value={query} maxLength={100} disabled={isStarting} placeholder={copy.heroSearch}
              aria-label={copy.search} autoComplete="off" spellCheck={false} enterKeyHint="go"
              onChange={event => setQuery(event.target.value)} />
            <button className="hero-start" type="button" disabled={isStarting} aria-busy={isStarting} onClick={begin}>
              {isStarting ? copy.loading : destination ? copy.go : copy.start}<span aria-hidden="true">→</span>
            </button>
          </form>
          <div className="discovery-starts">
            <span>{copy.orTry}</span>
            <button type="button" disabled={isStarting} onClick={() => onDiscover('Homo sapiens')}>{copy.humans}</button>
            <button type="button" disabled={isStarting} onClick={() => onDiscover('Aves')}>{copy.birds}</button>
            <button type="button" disabled={isStarting} onClick={() => onDiscover('random')}>{copy.random} <span aria-hidden="true">✧</span></button>
          </div>
          <ul className="hero-facts">
            <li>{copy.factCount}</li>
            <li>{copy.factSource}</li>
            <li>{copy.factFree}</li>
          </ul>
        </div>
        <figure className="hero-art">
          <img src={colorPreset === 'blueGradient' ? '/landing-tree-bg1.png' : '/landing-tree-bg.png'} alt="" />
          <figcaption>{copy.explanation}</figcaption>
        </figure>
      </section>
      <section className="landing-learn" dir={language === 'he' ? 'rtl' : 'ltr'}>
        <div><h2><a href="/tree-of-life/">{copy.guide} →</a></h2><p>{copy.dataNote}</p></div>
        <nav aria-label={copy.learn}>
          <a href="/explore/humans/"><span>01</span>{copy.humanGuide}<span aria-hidden="true">→</span></a>
          <a href="/explore/birds/"><span>02</span>{copy.birdGuide}<span aria-hidden="true">→</span></a>
          <a href="/explore/oaks/"><span>03</span>{copy.oakGuide}<span aria-hidden="true">→</span></a>
        </nav>
      </section>
      <footer className="landing-bottom"><span>InfiniteSpecies</span><a href="/about/">{copy.about}</a></footer>
    </motion.main>
  )
}

import { motion } from 'framer-motion'
import { translate, type AppLanguage } from '../modules/i18n'
import { discoveryCopy } from '../modules/discovery-copy'

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
  return (
    <motion.main className="landing-page discovery-landing" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <header className="landing-nav">
        <span className="landing-brand">InfiniteSpecies<span aria-hidden="true"> ↗</span></span>
        <nav aria-label={translate('common.settings', undefined, language)}>
          <button type="button" onClick={onHelp}>{translate('common.help', undefined, language)}</button>
          <button type="button" onClick={onSettings}>{translate('common.settings', undefined, language)}</button>
        </nav>
      </header>
      <section className="discovery-hero">
        <div className="hero-copy" dir={language === 'he' ? 'rtl' : 'ltr'}>
          <h1>{copy.headline}</h1>
          <p className="hero-intro">{copy.intro}</p>
          <button className="hero-start" type="button" disabled={isStarting} aria-busy={isStarting} onClick={onStart}>
            {isStarting ? copy.loading : copy.start}<span aria-hidden="true"> ↗</span>
          </button>
          <p className="hero-reassurance">{copy.free}</p>
          <div className="discovery-starts">
            <div>
              <button type="button" disabled={isStarting} onClick={() => onDiscover('Homo sapiens')}>{copy.humans}</button>
              <button type="button" disabled={isStarting} onClick={() => onDiscover('Aves')}>{copy.birds}</button>
              <button type="button" disabled={isStarting} onClick={() => onDiscover('random')}>{copy.random} <span aria-hidden="true">✧</span></button>
            </div>
          </div>
        </div>
        <figure className="hero-art">
          <img src={colorPreset === 'blueGradient' ? '/landing-tree-bg1.png' : '/landing-tree-bg.png'} alt="" />
          <figcaption>{copy.explanation}</figcaption>
        </figure>
      </section>
      <section className="landing-learn" dir={language === 'he' ? 'rtl' : 'ltr'}>
        <div><h2><a href="/tree-of-life/">{copy.guide} →</a></h2><p>{copy.dataNote}</p></div>
        <nav aria-label={copy.learn}>
          <a href="/explore/humans/"><span>01</span>{copy.humanGuide}<span aria-hidden="true">↗</span></a>
          <a href="/explore/birds/"><span>02</span>{copy.birdGuide}<span aria-hidden="true">↗</span></a>
          <a href="/explore/oaks/"><span>03</span>{copy.oakGuide}<span aria-hidden="true">↗</span></a>
        </nav>
      </section>
      <footer className="landing-bottom"><span>InfiniteSpecies</span><a href="/about/">{copy.about}</a></footer>
    </motion.main>
  )
}

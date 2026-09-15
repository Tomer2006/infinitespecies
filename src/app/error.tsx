'use client'

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
    <h1 className="text-3xl font-semibold">This page couldn’t load.</h1>
    <button className="hero-start" onClick={reset}>Try again</button><a href="/">Return home</a>
  </main>
}

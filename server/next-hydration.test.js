import assert from 'node:assert/strict'
import test from 'node:test'
import React, { act } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { MotionGlobalConfig } from 'framer-motion'
import App from '../src/App.tsx'

test('server-rendered homepage hydrates with saved settings and working dialogs', { timeout: 15000 }, async () => {
  MotionGlobalConfig.skipAnimations = true
  const markup = renderToString(React.createElement(App))
  assert.ok(markup.includes('Explore how life on Earth is connected'))
  const dom = new JSDOM(`<div id="root">${markup}</div>`, { url: 'http://localhost/' })
  const previous = new Map()
  const globals = { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    location: dom.window.location, history: dom.window.history, localStorage: dom.window.localStorage,
    requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
    ResizeObserver: class { observe() {} disconnect() {} }, IS_REACT_ACT_ENVIRONMENT: true }
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  dom.window.matchMedia = () => ({ matches: true, addListener() {}, removeListener() {} })
  localStorage.setItem('infinitespecies_colorPreset', 'blueGradient')
  localStorage.setItem('infinitespecies_language', 'he')
  const errors = []
  let root
  try {
    await act(async () => { root = hydrateRoot(document.getElementById('root'), React.createElement(App), { onRecoverableError: error => errors.push(error) }) })
    assert.deepEqual(errors, [], 'No server/client hydration mismatch')
    assert.equal(document.documentElement.lang, 'en')
    assert.equal(document.querySelector('.hero-art img').getAttribute('src'), '/landing-tree-bg1.png')
    const settings = [...document.querySelectorAll('.landing-nav button')].find(button => button.textContent === 'Settings')
    await act(async () => settings.click())
    assert.ok(document.querySelector('[role="dialog"]'))
    assert.equal(document.querySelector('#color-select').value, 'blueGradient')
    await act(async () => document.querySelector('.modal-close').click())
    assert.equal(document.querySelector('[role="dialog"]'), null)
  } finally {
    await act(async () => root?.unmount())
    dom.window.close()
    MotionGlobalConfig.skipAnimations = false
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
})

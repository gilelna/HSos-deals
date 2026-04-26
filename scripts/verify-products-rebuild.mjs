#!/usr/bin/env node
// Smoke-verify the rebuilt products.html / products.js. Loads the page,
// captures console errors + 4xx/5xx network responses, and asserts the
// products list root rendered (loaded or empty state).
//
// Usage:
//   1. Start a static server in repo root: npx http-server -p 5500
//   2. Run: node scripts/verify-products-rebuild.mjs
//   3. Optional flags: --base http://127.0.0.1:5500 --headed

import { chromium } from 'playwright'

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, arr) => {
    if (!a.startsWith('--')) return []
    const k = a.slice(2)
    const v = arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true
    return [[k, v]]
  })
)

const BASE = args.base || 'http://127.0.0.1:5500'
const HEADED = !!args.headed

const browser = await chromium.launch({ headless: !HEADED })
const ctx = await browser.newContext()
const page = await ctx.newPage()

const consoleErrors = []
const pageErrors = []
const httpErrors = []
const apiHits = []

page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
page.on('pageerror', err => pageErrors.push(err.message))
page.on('response', resp => {
  const status = resp.status()
  const url = resp.url()
  if (status >= 400) httpErrors.push(`${status} ${resp.request().method()} ${url}`)
  if (url.includes('/rest/v1/')) {
    const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    apiHits.push(`${status} ${path}`)
  }
})

// Seed admin role so guardSpace passes.
await page.addInitScript(() => {
  sessionStorage.setItem('hsos_role', 'admin')
})

let navError = null
try {
  await page.goto(`${BASE}/products.html`, { waitUntil: 'networkidle', timeout: 30000 })
} catch (e) { navError = e.message }

// Wait for the list root to populate (not the loading placeholder).
let listMarkup = null
try {
  await page.waitForFunction(() => {
    const el = document.getElementById('products-list')
    if (!el) return false
    const txt = el.textContent || ''
    return !txt.includes('Loading…')
  }, { timeout: 8000 })
  listMarkup = await page.evaluate(() => document.getElementById('products-list').innerHTML.slice(0, 200))
} catch (e) {
  listMarkup = `(timeout: ${e.message})`
}

// Click "+ New product" and verify the panel opens.
let panelOpen = null
try {
  await page.click('button.btn-primary')
  await page.waitForFunction(() => document.getElementById('products-panel').classList.contains('is-open'), { timeout: 4000 })
  panelOpen = true
  await page.click('.products-panel-close')
} catch (e) { panelOpen = `failed: ${e.message}` }

// Expand the first product card and confirm plan grid appears (or empty state).
let expandWorked = null
try {
  const firstHead = await page.$('.products-card-head')
  if (firstHead) {
    await firstHead.click()
    await page.waitForFunction(() => document.querySelector('.products-card.is-open') != null, { timeout: 3000 })
    const hasGrid = await page.evaluate(() => {
      const card = document.querySelector('.products-card.is-open')
      return !!card && (card.querySelector('.products-plans-grid, .products-plans-empty') != null)
    })
    expandWorked = hasGrid ? true : 'expanded but no grid/empty rendered'
  } else {
    expandWorked = 'no product cards present (DB empty?)'
  }
} catch (e) { expandWorked = `failed: ${e.message}` }

await ctx.close()
await browser.close()

const issues =
  (navError ? 1 : 0) + consoleErrors.length + pageErrors.length + httpErrors.length

console.log('═══ products.html smoke ═══')
console.log('  URL:', `${BASE}/products.html`)
if (navError) console.log('  ✗ navError:', navError)
if (pageErrors.length) { console.log('  ✗ pageErrors:'); pageErrors.forEach(e => console.log('     ', e)) }
if (consoleErrors.length) { console.log('  ✗ consoleErrors:'); consoleErrors.forEach(e => console.log('     ', e)) }
if (httpErrors.length) { console.log('  ✗ httpErrors:'); httpErrors.forEach(e => console.log('     ', e)) }
if (apiHits.length) {
  console.log('  ↳ supabase calls:')
  for (const h of apiHits) console.log('     ', h)
}
console.log('  list markup head:', listMarkup)
console.log('  new-product panel opens:', panelOpen)
console.log('  expand product card:', expandWorked)
console.log('')
const ok = issues === 0 && panelOpen === true && expandWorked === true
console.log(ok ? '✅ PASS' : `⚠ ${issues} issue(s)`)
process.exit(ok ? 0 : 1)

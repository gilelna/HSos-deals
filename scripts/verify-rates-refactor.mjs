#!/usr/bin/env node
// Verify the rates simplification refactor by loading each affected page
// in headless Chromium and capturing console errors + 4xx/5xx network
// responses. The user drives the actual click-through; this only proves
// the page boots cleanly.
//
// Usage:
//   1. Start a local static server in the repo root, e.g.:
//      npx http-server -p 5500
//   2. Run: node scripts/verify-rates-refactor.mjs
//   3. Optional flags:
//        --base http://127.0.0.1:5500   (default)
//        --vendor <uuid>                (used by pages that take ?vendor=...)
//        --headed                       (show the browser)
//
// Requires playwright. Install:
//   npm i -D playwright && npx playwright install chromium

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
const VENDOR_ID = args.vendor || null
const HEADED = !!args.headed

const PAGES = [
  // v1
  { label: 'v1 workload (log tab)',     url: `${BASE}/workload.html?tab=log` },
  { label: 'v1 workload (sessions)',    url: `${BASE}/workload.html?tab=work` },
  ...(VENDOR_ID ? [{
    label: 'v1 vendor-profile',
    url: `${BASE}/vendor-profile.html?id=${VENDOR_ID}`
  }] : []),
  // v2
  { label: 'v2 operations (log tab)',     url: `${BASE}/v2/spaces/operations/operations.html?tab=log` },
  { label: 'v2 operations (sessions)',    url: `${BASE}/v2/spaces/operations/operations.html?tab=sessions` },
  { label: 'v2 operations (clients)',     url: `${BASE}/v2/spaces/operations/operations.html?tab=clients` },
  { label: 'v2 operations (profile)',     url: `${BASE}/v2/spaces/operations/operations.html?tab=profile` },
]

async function checkPage(browser, { label, url }) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const consoleErrors = []
  const pageErrors = []
  const httpErrors = []

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', err => pageErrors.push(err.message))
  page.on('response', resp => {
    const status = resp.status()
    if (status >= 400) httpErrors.push(`${status} ${resp.request().method()} ${resp.url()}`)
  })

  let navError = null
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  } catch (e) {
    navError = e.message
  }

  await ctx.close()
  return { label, url, navError, consoleErrors, pageErrors, httpErrors }
}

function summarize(results) {
  let totalIssues = 0
  for (const r of results) {
    const issues = (r.navError ? 1 : 0) + r.consoleErrors.length + r.pageErrors.length + r.httpErrors.length
    totalIssues += issues
    const icon = issues === 0 ? 'OK' : 'FAIL'
    console.log(`\n[${icon}] ${r.label}`)
    console.log(`     ${r.url}`)
    if (r.navError) console.log(`     navigation: ${r.navError}`)
    for (const e of r.consoleErrors) console.log(`     console: ${e}`)
    for (const e of r.pageErrors)    console.log(`     pageerror: ${e}`)
    for (const e of r.httpErrors)    console.log(`     http: ${e}`)
  }
  console.log(`\n${results.length} pages checked. ${totalIssues} issue(s).`)
  return totalIssues
}

;(async () => {
  console.log(`Base URL: ${BASE}`)
  if (!VENDOR_ID) console.log('Note: --vendor not provided; skipping v1 vendor-profile.')
  const browser = await chromium.launch({ headless: !HEADED })
  const results = []
  for (const p of PAGES) {
    process.stdout.write(`Checking ${p.label}... `)
    const r = await checkPage(browser, p)
    process.stdout.write('done\n')
    results.push(r)
  }
  await browser.close()
  const issues = summarize(results)
  process.exit(issues === 0 ? 0 : 1)
})()

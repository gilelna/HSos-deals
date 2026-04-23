// v2/core/env.js — Supabase client init for demo + production environments.
// Depends on env-keys.js (gitignored) providing window.HSOS_KEYS = { demo, production }.
// Depends on the Supabase UMD bundle being loaded before this file.

if (!window.HSOS_KEYS) {
  throw new Error('[HSos v2] env-keys.js not loaded. Deploy env-keys.js alongside app files — it is gitignored by design.')
}

const Env = (() => {
  const CONFIG = {
    demo: {
      url: 'https://pqkzffgpkpovternesmt.supabase.co',
      anonKey: window.HSOS_KEYS.demo,
      label: 'Demo',
      color: '#e0a040'
    },
    production: {
      url: 'https://wmqmonjnmgtoilxfqqkv.supabase.co',
      anonKey: window.HSOS_KEYS.production,
      label: 'Production',
      color: '#4caf82'
    }
  }

  const STORAGE_KEY = 'HSOS_ENV'

  function current() {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dummy') {
      localStorage.setItem(STORAGE_KEY, 'demo')
      return 'demo'
    }
    return CONFIG[stored] ? stored : 'demo'
  }

  function config() {
    return CONFIG[current()]
  }

  function switchTo(env) {
    if (!CONFIG[env]) {
      console.error(`[HSos v2] Invalid environment: ${env}`)
      return false
    }
    localStorage.setItem(STORAGE_KEY, env)
    window.location.reload()
    return true
  }

  function createClient() {
    if (typeof supabase === 'undefined' || !supabase.createClient) {
      throw new Error('[HSos v2] Supabase SDK not loaded before core/env.js')
    }
    const c = config()
    return supabase.createClient(c.url, c.anonKey)
  }

  return { CONFIG, current, config, switchTo, createClient }
})()

window.Env = Env
window._sb = Env.createClient()

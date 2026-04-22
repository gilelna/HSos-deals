// env-config.js
// Environment configuration for HSos - switches between two real Supabase databases.
// 'demo'       → demo Supabase project (sample content, fully writable)
// 'production' → production Supabase project (empty initially, real business data later)
// Both envs use the real Supabase client. No local/dummy/mock runtime.

// Keys are loaded from env-keys.js (gitignored, deployed separately).
// env-keys.js must set window.HSOS_KEYS = { demo: '...', production: '...' }
if (!window.HSOS_KEYS) {
  throw new Error('[HSos] env-keys.js not loaded. Deploy env-keys.js to the server manually — it is gitignored by design.')
}

const ENV_CONFIG = {
  production: {
    url: 'https://wmqmonjnmgtoilxfqqkv.supabase.co',
    anonKey: window.HSOS_KEYS.production,
    label: 'Production',
    color: '#4caf82'
  },
  demo: {
    url: 'https://pqkzffgpkpovternesmt.supabase.co',
    anonKey: window.HSOS_KEYS.demo,
    label: 'Demo',
    color: '#e0a040'
  }
}

// Get current environment from localStorage (default: demo)
function getCurrentEnv() {
  const stored = localStorage.getItem('HSOS_ENV')
  // Migrate legacy 'dummy' key to 'demo'
  if (stored === 'dummy') {
    localStorage.setItem('HSOS_ENV', 'demo')
    return 'demo'
  }
  return stored || 'demo'
}

// Get config for current environment
function getEnvConfig() {
  const env = getCurrentEnv()
  return ENV_CONFIG[env] || ENV_CONFIG.demo
}

// Switch environment (requires page reload).
// Both environments use real Supabase — HSOS_DATA_MODE is always 'supabase'.
function switchEnvironment(env) {
  if (!ENV_CONFIG[env]) {
    console.error(`Invalid environment: ${env}`)
    return false
  }
  localStorage.setItem('HSOS_ENV', env)
  // Always use real Supabase — never dummy mode
  localStorage.setItem('HSOS_DATA_MODE', 'supabase')
  console.log(`[HSos] Environment switched to: ${env}. Reloading...`)
  window.location.reload()
  return true
}

// Initialize Supabase client with current environment
function initSupabaseClient() {
  const config = getEnvConfig()
  console.log(`[HSos] Initializing Supabase client for: ${config.label}`)
  return supabase.createClient(config.url, config.anonKey)
}

// Ensure HSOS_DATA_MODE is always 'supabase' on every page load.
// Clears any stale 'dummy' value that may exist from a prior session.
;(function enforceSupabaseMode() {
  localStorage.setItem('HSOS_DATA_MODE', 'supabase')
})()

// isDummyMode: always false — both environments use real Supabase.
// Defined here as a global so any legacy call sites in deals.js / workload.js
// that still reference isDummyMode() never throw a ReferenceError.
function isDummyMode() { return false }

// ─── env toggle UI functions ──────────────────────────────────
// These are global so env-toggle.html's inline onclick handlers can call them.
// env-toggle.html is injected as innerHTML (scripts inside innerHTML don't run),
// so ALL toggle JS lives here instead.

function initEnvToggle() {
  if (!window.getEnvConfig) {
    console.error('[HSos] env-config.js not loaded')
    return
  }
  updateEnvToggle()
  document.addEventListener('click', (e) => {
    const dd = document.getElementById('env-dropdown')
    if (dd && !e.target.closest('.env-toggle') && !e.target.closest('.env-dropdown')) {
      dd.classList.remove('open')
    }
  })
}

function updateEnvToggle() {
  const config = getEnvConfig()
  const currentEnv = getCurrentEnv()
  const indicator = document.getElementById('env-indicator')
  const label = document.getElementById('env-label')
  if (indicator) indicator.style.background = config.color
  if (label) label.textContent = config.label
  document.querySelectorAll('.env-option').forEach(opt => {
    const env = opt.id.replace('env-opt-', '')
    const check = opt.querySelector('.env-option-check')
    if (env === currentEnv) {
      opt.classList.add('active')
      if (check) check.textContent = '✓'
    } else {
      opt.classList.remove('active')
      if (check) check.textContent = ''
    }
  })
}

function toggleEnvDropdown() {
  const dd = document.getElementById('env-dropdown')
  if (dd) dd.classList.toggle('open')
}

function selectEnvironment(env) {
  const currentEnv = getCurrentEnv()
  if (env === currentEnv) {
    const dd = document.getElementById('env-dropdown')
    if (dd) dd.classList.remove('open')
    return
  }
  if (env === 'production') {
    const dd = document.getElementById('env-dropdown')
    if (dd) dd.classList.remove('open')
    showConfirm(
      'Switch to Production database? You will be connected to live business data. Writes will affect real records. The page will reload.',
      () => switchEnvironment(env),
      { confirmLabel: 'Switch to Production' }
    )
    return
  }
  switchEnvironment(env)
}

// Export for use in other modules
window.ENV_CONFIG = ENV_CONFIG
window.getCurrentEnv = getCurrentEnv
window.getEnvConfig = getEnvConfig
window.switchEnvironment = switchEnvironment
window.initSupabaseClient = initSupabaseClient
window.isDummyMode = isDummyMode
window.initEnvToggle = initEnvToggle
window.updateEnvToggle = updateEnvToggle
window.toggleEnvDropdown = toggleEnvDropdown
window.selectEnvironment = selectEnvironment

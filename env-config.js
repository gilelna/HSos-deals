// env-config.js
// Environment configuration for HSos - switches between two real Supabase databases.
// 'demo'       → demo Supabase project (sample content, fully writable)
// 'production' → production Supabase project (empty initially, real business data later)
// Both envs use the real Supabase client. No local/dummy/mock runtime.

const ENV_CONFIG = {
  production: {
    url: 'https://wmqmonjnmgtoilxfqqkv.supabase.co',
    anonKey: 'sb_publishable_ujPTzw0beGD6fJ-V2PfNwg_mHgsoify',
    label: 'Production',
    color: '#4caf82'
  },
  demo: {
    url: 'https://pqkzffgpkpovternesmt.supabase.co',
    anonKey: 'sb_publishable_aYfTv_dPUhz76X8wp1u0_Q_By9ab8Si',
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

// Export for use in other modules
window.ENV_CONFIG = ENV_CONFIG
window.getCurrentEnv = getCurrentEnv
window.getEnvConfig = getEnvConfig
window.switchEnvironment = switchEnvironment
window.initSupabaseClient = initSupabaseClient
window.isDummyMode = isDummyMode

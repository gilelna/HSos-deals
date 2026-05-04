// auth.js — HSos Google OAuth authentication layer
// Uses the Supabase client (_sb) initialized in db.js. db.js must be loaded first.
// Public surface (window.HSOS_AUTH):
//   signInWithGoogle(), signOut(), getSession(), getUser(), onAuthStateChange(cb),
//   isEmailAllowed(email), enforceAllowedEmail(session)

;(function () {
  if (!window._sb) throw new Error('[HSos] auth.js: db.js must be loaded before auth.js')

  const ALLOWED_EMAILS = [
    'gil@hadarshemesh.com'
  ]

  // Compute the post-login redirect from whatever origin the app is being
  // served from (works on localhost and on the Cloudways production host).
  function postLoginRedirect() {
    const origin = window.location.origin
    return origin.replace(/\/$/, '') + '/index.html'
  }

  function isEmailAllowed(email) {
    if (!email) return false
    return ALLOWED_EMAILS.includes(String(email).toLowerCase())
  }

  async function signInWithGoogle() {
    const { data, error } = await window._sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: postLoginRedirect() }
    })
    if (error) throw error
    return data
  }

  async function signOut() {
    await window._sb.auth.signOut()
    window.location.href = 'login.html'
  }

  async function getSession() {
    const { data, error } = await window._sb.auth.getSession()
    if (error) throw error
    return data?.session || null
  }

  async function getUser() {
    const { data, error } = await window._sb.auth.getUser()
    if (error) return null
    return data?.user || null
  }

  function onAuthStateChange(callback) {
    return window._sb.auth.onAuthStateChange((event, session) => callback(event, session))
  }

  // Verify the signed-in user is allowed. If not, sign out and return false.
  // Pass the session object — uses session.user.email.
  async function enforceAllowedEmail(session) {
    const email = session?.user?.email
    if (isEmailAllowed(email)) return true
    await window._sb.auth.signOut()
    return false
  }

  window.HSOS_AUTH = {
    ALLOWED_EMAILS,
    signInWithGoogle,
    signOut,
    getSession,
    getUser,
    onAuthStateChange,
    isEmailAllowed,
    enforceAllowedEmail
  }
})()

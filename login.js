// login.js — Google OAuth login screen logic
// Pairs with login.html. Depends on auth.js (window.HSOS_AUTH).

document.addEventListener('DOMContentLoaded', async () => {
  const btn = document.getElementById('login-google-btn')
  const errorEl = document.getElementById('login-error')

  // Surface OAuth provider errors that come back as URL params.
  const params = new URLSearchParams(window.location.search)
  const urlError = params.get('error_description') || params.get('error')
  if (urlError) {
    showLoginError(decodeURIComponent(urlError))
    history.replaceState({}, '', 'login.html')
  }

  // If already signed in (and allowed), skip straight to the home page.
  try {
    const session = await window.HSOS_AUTH.getSession()
    if (session) {
      const allowed = await window.HSOS_AUTH.enforceAllowedEmail(session)
      if (allowed) {
        window.location.href = 'index.html'
        return
      }
      showLoginError('This Google account is not authorized to access HSos.')
    }
  } catch (err) {
    showLoginError(err?.message || 'Failed to read session.')
  }

  btn.addEventListener('click', async () => {
    btn.disabled = true
    try {
      await window.HSOS_AUTH.signInWithGoogle()
      // signInWithOAuth redirects the browser — nothing more to do here.
    } catch (err) {
      showLoginError(err?.message || 'Sign in failed.')
      btn.disabled = false
    }
  })

  function showLoginError(msg) {
    errorEl.textContent = msg
    errorEl.style.display = 'block'
  }
})

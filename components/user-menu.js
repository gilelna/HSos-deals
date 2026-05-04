// components/user-menu.js — Avatar dropdown in the topbar.
// Click avatar → shows the signed-in user's name, email, role, an admin-only
// "Manage Users" link, and a Sign out button. By the time USER_MENU.init()
// runs, LAYOUT._runAuthGate has already populated window.__hsosAuth with
// { session, user, profile } — so this module never needs to re-fetch and
// never has a demo branch.

const USER_MENU = {
  _open: false,

  _displayName() {
    const auth = window.__hsosAuth || {}
    return (
      auth.profile?.full_name ||
      auth.user?.user_metadata?.full_name ||
      auth.user?.user_metadata?.name ||
      auth.user?.email ||
      ''
    )
  },

  _displayEmail() {
    const auth = window.__hsosAuth || {}
    return auth.profile?.email || auth.user?.email || ''
  },

  _displayRole() {
    return (window.__hsosAuth?.profile?.system_role || '').toLowerCase()
  },

  _renderAvatar() {
    const av = document.getElementById('user-menu-avatar')
    if (!av) return
    const name = this._displayName()
    av.textContent = name ? initials(name) : 'HS'
  },

  _renderDropdown() {
    const dd = document.getElementById('user-menu-dropdown')
    if (!dd) return
    while (dd.firstChild) dd.removeChild(dd.firstChild)

    const name = this._displayName()
    const email = this._displayEmail()
    const role = this._displayRole()

    const identity = document.createElement('div')
    identity.className = 'um-row um-identity'
    const nameEl = document.createElement('div')
    nameEl.className = 'um-name'
    nameEl.textContent = name || '—'
    const emailEl = document.createElement('div')
    emailEl.className = 'um-email'
    emailEl.textContent = email || ''
    identity.appendChild(nameEl)
    identity.appendChild(emailEl)
    if (role) {
      const roleEl = document.createElement('div')
      roleEl.className = 'um-email'
      roleEl.style.marginTop = '4px'
      roleEl.style.textTransform = 'uppercase'
      roleEl.style.letterSpacing = '0.06em'
      roleEl.textContent = role
      identity.appendChild(roleEl)
    }
    dd.appendChild(identity)

    const divider = document.createElement('div')
    divider.className = 'um-divider'
    dd.appendChild(divider)

    if (role === 'admin') {
      const manage = document.createElement('a')
      manage.className = 'um-btn'
      manage.href = '/admin/users.html'
      manage.textContent = 'Manage users'
      dd.appendChild(manage)
    }

    const out = document.createElement('button')
    out.type = 'button'
    out.className = 'um-btn'
    out.textContent = 'Sign out'
    out.addEventListener('click', () => USER_MENU.signOut())
    dd.appendChild(out)
  },

  toggle() {
    const dd = document.getElementById('user-menu-dropdown')
    if (!dd) return
    this._open = !this._open
    dd.style.display = this._open ? 'flex' : 'none'
  },

  close() {
    const dd = document.getElementById('user-menu-dropdown')
    if (dd) dd.style.display = 'none'
    this._open = false
  },

  async signOut() {
    try {
      if (!window.HSOS_AUTH?.signOut) return
      await window.HSOS_AUTH.signOut()
    } catch (err) {
      if (typeof showToast === 'function') showToast(err?.message || 'Sign out failed', 'error')
    }
  },

  init() {
    this._renderAvatar()
    this._renderDropdown()

    document.addEventListener('click', (e) => {
      const av = document.getElementById('user-menu-avatar')
      const dd = document.getElementById('user-menu-dropdown')
      if (!av || !dd) return
      if (av.contains(e.target) || dd.contains(e.target)) return
      this.close()
    })

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close()
    })
  },
}

window.USER_MENU = USER_MENU

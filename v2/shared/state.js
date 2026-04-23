// v2/shared/state.js — Tiny in-memory state bus.
// State.set(key, val) stores + notifies subscribers for that key.
// State.get(key) returns current value (or undefined).
// State.on(key, fn) subscribes; returns an unsubscribe function.
// No persistence — reload clears everything.

const State = (() => {
  const _values = new Map()
  const _subs = new Map() // key → Set<fn>

  function set(key, val) {
    _values.set(key, val)
    const listeners = _subs.get(key)
    if (!listeners) return
    for (const fn of listeners) {
      try { fn(val, key) } catch (err) { console.error('[State] listener error', err) }
    }
  }

  function get(key) {
    return _values.get(key)
  }

  function has(key) {
    return _values.has(key)
  }

  function del(key) {
    _values.delete(key)
    const listeners = _subs.get(key)
    if (listeners) for (const fn of listeners) {
      try { fn(undefined, key) } catch (err) { console.error('[State] listener error', err) }
    }
  }

  function on(key, fn) {
    if (typeof fn !== 'function') {
      console.error(`[State] on("${key}") requires a function`)
      return () => {}
    }
    if (!_subs.has(key)) _subs.set(key, new Set())
    _subs.get(key).add(fn)
    return () => {
      const s = _subs.get(key)
      if (s) s.delete(fn)
    }
  }

  function reset(prefix) {
    if (!prefix) {
      _values.clear()
      return
    }
    for (const k of [..._values.keys()]) {
      if (k.startsWith(prefix)) _values.delete(k)
    }
  }

  return { set, get, has, del, on, reset }
})()

window.State = State

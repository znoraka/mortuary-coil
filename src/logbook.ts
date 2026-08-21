// Client-side error reporting to logbook (logs.gawaak.ovh).
// The write token ships in the bundle by design: a leaked token can only
// produce bounded noise (server-side rate limit + size caps).

const ENDPOINT = 'https://logs.gawaak.ovh/log/coil'
const TOKEN = 'd3e1dfe40bb690c6790fce38d48a9bb0273a1aaccb380f23'
const GAME_VERSION = 3 // keep in sync with VERSION in src/game/store.ts
const MAX_REPORTS_PER_SESSION = 10
const MAX_STACK_CHARS = 1024

let sent = 0
const seenMessages = new Set<string>()

function baseMeta(): Record<string, unknown> {
  return { path: location.pathname, version: GAME_VERSION }
}

/** Fire-and-forget: swallows every failure, never retries. */
export function logCoil(level: string, msg: string, meta: Record<string, unknown> = {}) {
  if (sent >= MAX_REPORTS_PER_SESSION) return
  sent++
  try {
    fetch(ENDPOINT, {
      method: 'POST',
      keepalive: true,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ level, msg, meta: { ...baseMeta(), ...meta } }),
    }).catch(() => {})
  } catch {
    // an unreachable logger must never break the game
  }
}

function reportError(msg: string, stack?: string) {
  if (seenMessages.has(msg)) return // each unique message once per session
  seenMessages.add(msg)
  logCoil('error', msg, stack ? { stack: stack.slice(0, MAX_STACK_CHARS) } : {})
}

export function initLogbook() {
  window.addEventListener('error', (e) => {
    reportError(e.message || 'unknown error', e.error?.stack)
  })
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason
    if (reason instanceof Error) {
      reportError(`unhandledrejection: ${reason.message}`, reason.stack)
    } else {
      reportError(`unhandledrejection: ${String(reason)}`)
    }
  })
  logCoil('info', 'boot')
}

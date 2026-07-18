import type { GameState } from './types'
import { mulberry32, pick } from './rng'
import * as B from './balance'
import { MONSTERS, LOOT, TRAIN_LINES, CONTEMPLATE_LINES } from './flavor'

const DURATIONS = {
  slay: B.SLAY_SECS,
  train: B.TRAIN_SECS,
  contemplate: B.CONTEMPLATE_SECS,
} as const

function log(s: GameState, msg: string) {
  s.log = [msg, ...s.log].slice(0, 60)
}

// Pure fixed-timestep simulation. Mutates a draft copy and returns it —
// the same function drives live play and offline catch-up.
export function tick(prev: GameState, nTicks: number): GameState {
  const s: GameState = { ...prev, log: [...prev.log] }
  const rng = mulberry32(s.seed)
  s.seed = (s.seed + nTicks) >>> 0

  for (let i = 0; i < nTicks; i++) {
    if (s.dead) break
    s.heartbeats -= B.DRAIN_PER_TICK
    if (s.heartbeats <= 0) {
      s.heartbeats = 0
      s.dead = true
      break
    }

    const durTicks = (DURATIONS[s.activity] * 1000) / B.TICK_MS
    const speed = s.activity === 'slay' ? 1 + s.power * 0.05 : 1
    s.bar += speed / durTicks
    if (s.bar < 1) continue
    s.bar = 0

    const mult = B.legacyMult(s.totalLegacy)
    if (s.activity === 'slay') {
      const monster = pick(rng, MONSTERS)
      const gold = Math.round((4 + rng() * 5) * mult)
      s.gold += gold
      s.kills += 1
      s.legacy += 1
      const beats = Math.round(DURATIONS.slay / speed) * 5
      if (rng() < 0.25) {
        const loot = pick(rng, LOOT)
        log(s, `Slew the ${monster} (+${gold}g). It dropped ${loot}. Cost: ${beats} heartbeats.`)
        s.gold += 5
      } else {
        log(s, `Slew the ${monster}. +${gold}g. Cost: ${beats} heartbeats.`)
      }
    } else if (s.activity === 'train') {
      s.power += 1
      log(s, `${pick(rng, TRAIN_LINES)} Power ${s.power}.`)
    } else {
      const gained = Math.round(2 * mult)
      s.legacy += gained
      log(s, `${pick(rng, CONTEMPLATE_LINES)} +${gained} Legacy.`)
    }
  }
  return s
}

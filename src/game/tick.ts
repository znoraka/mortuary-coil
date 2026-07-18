import type { GameState } from './types'
import { mulberry32, pick } from './rng'
import * as B from './balance'
import { ZONES, EVENTS } from './data'
import { MONSTERS, LOOT, TRAIN_LINES, CONTEMPLATE_LINES } from './flavor'

const DURATIONS = {
  slay: B.SLAY_SECS,
  train: B.TRAIN_SECS,
  contemplate: B.CONTEMPLATE_SECS,
} as const

function log(s: GameState, msg: string) {
  s.log = [msg, ...s.log].slice(0, 60)
}

function die(s: GameState, cause: string) {
  s.heartbeats = 0
  s.dead = true
  s.causeOfDeath = cause
}

// Pure fixed-timestep simulation — drives live play and offline catch-up.
export function tick(prev: GameState, nTicks: number): GameState {
  const s: GameState = { ...prev, log: [...prev.log] }
  const rng = mulberry32(s.seed)
  s.seed = (s.seed + nTicks) >>> 0
  const zone = ZONES.find((z) => z.id === s.zoneId) ?? ZONES[0]

  for (let i = 0; i < nTicks; i++) {
    if (s.dead) break
    s.ticksLived += 1
    s.heartbeats -= B.drainAt(s.ticksLived, s.wounds)
    if (s.heartbeats <= 0) {
      die(s, s.wounds >= 3 ? 'Bled out through unbandaged optimism.' : 'Ran out of heartbeats, as scheduled.')
      break
    }

    // dilemma events queue up (game keeps grinding; the choice waits for you)
    if (!s.pendingEvent && s.ticksLived >= s.nextEventAt) {
      s.pendingEvent = { defId: pick(rng, EVENTS).id }
      s.nextEventAt = s.ticksLived + B.EVENT_MIN_TICKS + Math.floor(rng() * B.EVENT_SPAN_TICKS)
    }

    // contract offers appear when the slot is free
    if (!s.contract && !s.contractOffer && s.ticksLived >= s.nextContractAt) {
      const kills = 8 + Math.floor(rng() * 8)
      const deadline = s.ticksLived + kills * 90
      s.contractOffer = {
        kills,
        done: 0,
        deadline,
        rewardLegacy: kills * 3,
        text: `Cull ${kills} of the local undead. The Necropolis pays in reputation.`,
      }
    }

    // contract deadline
    if (s.contract && s.ticksLived > s.contract.deadline) {
      s.wounds = Math.min(B.MAX_WOUNDS, s.wounds + 1)
      log(s, `Contract failed. The client sends "feedback" (+1 wound). Reputation unbanked.`)
      s.contract = null
      s.nextContractAt = s.ticksLived + B.CONTRACT_OFFER_TICKS
    }

    const durTicks = (DURATIONS[s.activity] * 1000) / B.TICK_MS
    const speed = s.activity === 'slay' ? 1 + s.power * 0.04 : 1
    s.bar += speed / durTicks
    if (s.bar < 1) continue
    s.bar = 0

    const mult = B.legacyMult(s.totalLegacy)
    if (s.activity === 'slay') {
      const monster = pick(rng, MONSTERS)
      // damage scales with how outmatched you are in this zone
      const ratio = (s.power + 8) / (zone.minPower + 8)
      const dmgMult = Math.min(3, Math.max(0.25, 1.4 / (0.4 + ratio)))
      const dmg = Math.round(zone.danger * dmgMult * (0.6 + rng() * 0.8))
      s.heartbeats -= dmg
      if (s.heartbeats <= 0) {
        die(s, `Slain by a ${monster} in ${zone.name}. It seemed rude to survive.`)
        break
      }
      if (dmgMult > 1 && rng() < 0.12 * dmgMult && s.wounds < B.MAX_WOUNDS) {
        s.wounds += 1
        log(s, `The ${monster} opens a wound (+0.5/s drain). Bandages exist, you know.`)
      }
      const gold = Math.round((4 + rng() * 5) * mult * zone.rewardMult)
      s.gold += gold
      s.kills += 1
      s.legacy += Math.round(1 * zone.rewardMult)
      if (s.contract) {
        s.contract = { ...s.contract, done: s.contract.done + 1 }
        if (s.contract.done >= s.contract.kills) {
          s.legacy += s.contract.rewardLegacy
          log(s, `Contract fulfilled. +${s.contract.rewardLegacy} Legacy, and a firm skeletal handshake.`)
          s.contract = null
          s.nextContractAt = s.ticksLived + B.CONTRACT_OFFER_TICKS
        }
      }
      if (rng() < 0.2) {
        s.gold += 6
        log(s, `Slew the ${monster} (+${gold}g, −${dmg} beats). It dropped ${pick(rng, LOOT)}.`)
      } else {
        log(s, `Slew the ${monster}. +${gold}g, −${dmg} beats.`)
      }
    } else if (s.activity === 'train') {
      s.power += 1
      if (s.power % 5 === 0) log(s, `${pick(rng, TRAIN_LINES)} Power ${s.power}.`)
    } else {
      const gained = Math.round(2 * mult)
      s.legacy += gained
      log(s, `${pick(rng, CONTEMPLATE_LINES)} +${gained} Legacy.`)
    }
  }
  return s
}

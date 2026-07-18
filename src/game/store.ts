import { create } from 'zustand'
import type { GameState, ActivityId } from './types'
import { tick } from './tick'
import * as B from './balance'
import { DEATH_LINES } from './flavor'
import { mulberry32, pick } from './rng'

const SAVE_KEY = 'mortuary-coil-save'

function freshLife(carry?: Partial<GameState>): GameState {
  const debt = carry?.reaperDebt ?? 0
  const life = Math.max(1500, B.BASE_LIFE - debt)
  return {
    version: 1,
    seed: carry?.seed ?? 1337,
    incarnation: (carry?.incarnation ?? 0) + 1,
    heartbeats: life,
    maxHeartbeats: life,
    gold: 0,
    legacy: 0,
    totalLegacy: carry?.totalLegacy ?? 0,
    power: 0,
    activity: 'slay',
    bar: 0,
    healerPrice: B.HEALER_BASE_PRICE,
    tombLevel: 0,
    reaperDebt: 0,
    kills: 0,
    dead: false,
    lastSeen: Date.now(),
    log: carry
      ? [
          `Incarnation ${(carry.incarnation ?? 0) + 1}. ${debt > 0 ? `The Reaper collected ${debt} heartbeats at the door.` : 'A clean slate, actuarially speaking.'}`,
        ]
      : ['You are born. The meter is running.'],
  }
}

interface Store {
  state: GameState
  lastDeathReport: string | null
  advance: (nTicks: number) => void
  setActivity: (a: ActivityId) => void
  buyHealer: () => void
  buyTomb: () => void
  takeLoan: () => void
  rebirth: () => void
  hardReset: () => void
}

function load(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return freshLife()
    const saved = JSON.parse(raw) as GameState
    if (saved.version !== 1) return freshLife()
    // offline catch-up through the same pure engine, capped
    const elapsed = Math.min(Math.max(0, Date.now() - saved.lastSeen), B.OFFLINE_CAP_MS)
    const n = Math.floor(elapsed / B.TICK_MS)
    const caught = n > 40 ? tick(saved, n) : saved
    if (n > 240) {
      caught.log = [
        `While you were gone, ${Math.round((n * B.TICK_MS) / 60000)} minutes of your life elapsed. This is also true generally.`,
        ...caught.log,
      ].slice(0, 60)
    }
    return caught
  } catch {
    return freshLife()
  }
}

export function save(s: GameState) {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ...s, lastSeen: Date.now() }))
}

export const useGame = create<Store>((set, get) => ({
  state: load(),
  lastDeathReport: null,

  advance: (n) => set(({ state }) => ({ state: tick(state, n) })),

  setActivity: (a) =>
    set(({ state }) => (state.activity === a ? {} : { state: { ...state, activity: a, bar: 0 } })),

  buyHealer: () =>
    set(({ state: s }) => {
      if (s.gold < s.healerPrice || s.dead) return {}
      return {
        state: {
          ...s,
          gold: s.gold - s.healerPrice,
          heartbeats: Math.min(s.maxHeartbeats, s.heartbeats + B.HEALER_BEATS),
          healerPrice: Math.round(s.healerPrice * B.HEALER_PRICE_MULT),
          log: [
            `The healer sells you ${B.HEALER_BEATS} heartbeats. The price of living has gone up. Again.`,
            ...s.log,
          ].slice(0, 60),
        },
      }
    }),

  buyTomb: () =>
    set(({ state: s }) => {
      const price = B.TOMB_BASE_PRICE * (s.tombLevel + 1)
      if (s.gold < price || s.dead) return {}
      return {
        state: {
          ...s,
          gold: s.gold - price,
          tombLevel: s.tombLevel + 1,
          log: [
            `Vanity Tomb upgraded to tier ${s.tombLevel + 1}. Future generations will be moderately impressed.`,
            ...s.log,
          ].slice(0, 60),
        },
      }
    }),

  takeLoan: () =>
    set(({ state: s }) => {
      if (s.dead) return {}
      return {
        state: {
          ...s,
          heartbeats: Math.min(s.maxHeartbeats, s.heartbeats + B.LOAN_BEATS),
          reaperDebt: s.reaperDebt + B.LOAN_OWED,
          log: [
            `The Reaper advances you ${B.LOAN_BEATS} heartbeats against your next life. He does not offer a receipt. You owe ${s.reaperDebt + B.LOAN_OWED}.`,
            ...s.log,
          ].slice(0, 60),
        },
      }
    }),

  rebirth: () => {
    const s = get().state
    const rng = mulberry32(s.seed)
    const tombBonus = 1 + s.tombLevel * B.TOMB_LEGACY_BONUS
    const cut = s.reaperDebt > 0 ? B.DEBT_LEGACY_CUT : 1
    const banked = Math.floor(s.legacy * tombBonus * cut)
    const report =
      `${pick(rng, DEATH_LINES)} Incarnation ${s.incarnation}: ${s.kills} slain, ` +
      `${s.legacy} Legacy earned${s.tombLevel ? ` ×${tombBonus.toFixed(2)} tomb` : ''}` +
      `${s.reaperDebt > 0 ? ` — the Reaper took his 25% cut` : ''}. Banked ${banked} Legacy.`
    const next = freshLife({
      incarnation: s.incarnation,
      totalLegacy: s.totalLegacy + banked,
      reaperDebt: s.reaperDebt,
      seed: s.seed,
    })
    set({ state: next, lastDeathReport: report })
    save(next)
  },

  hardReset: () => {
    localStorage.removeItem(SAVE_KEY)
    set({ state: freshLife(), lastDeathReport: null })
  },
}))

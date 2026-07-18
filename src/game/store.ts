import { create } from 'zustand'
import type { GameState, ActivityId } from './types'
import { tick } from './tick'
import * as B from './balance'
import { EVENTS, ZONES } from './data'
import { DEATH_LINES } from './flavor'
import { mulberry32, pick } from './rng'

const SAVE_KEY = 'mortuary-coil-save'
const VERSION = 2

export interface Boon {
  id: string
  name: string
  desc: string
}

export const BOONS: Boon[] = [
  { id: 'muscle', name: 'Muscle Memory', desc: 'Begin with 12 power' },
  { id: 'inheritance', name: 'Suspicious Inheritance', desc: 'Begin with 200 gold' },
  { id: 'hardy', name: 'Hardy Stock', desc: 'Begin with +900 heartbeats' },
]

function freshLife(carry?: Partial<GameState> & { boonId?: string }): GameState {
  const debt = carry?.reaperDebt ?? 0
  const boon = carry?.boonId
  let life = Math.max(1500, B.BASE_LIFE - debt)
  if (boon === 'hardy') life += 900
  const inc = (carry?.incarnation ?? 0) + 1
  return {
    version: VERSION,
    seed: carry?.seed ?? 1337,
    incarnation: inc,
    heartbeats: life,
    maxHeartbeats: life,
    ticksLived: 0,
    gold: boon === 'inheritance' ? 200 : 0,
    legacy: 0,
    totalLegacy: carry?.totalLegacy ?? 0,
    power: boon === 'muscle' ? 12 : 0,
    wounds: 0,
    activity: 'slay',
    zoneId: ZONES[0].id,
    bar: 0,
    bandagePrice: B.BANDAGE_BASE_PRICE,
    elixirPrice: B.ELIXIR_BASE_PRICE,
    tombLevel: 0,
    reaperDebt: 0,
    kills: 0,
    dead: false,
    causeOfDeath: '',
    pendingEvent: null,
    nextEventAt: B.EVENT_MIN_TICKS,
    contract: null,
    contractOffer: null,
    nextContractAt: 200,
    boon: boon ?? null,
    lastSeen: Date.now(),
    log: carry
      ? [
          `Incarnation ${inc}. ${debt > 0 ? `The Reaper collected ${debt} heartbeats at the door.` : 'A clean slate, actuarially speaking.'}`,
        ]
      : ['You are born. The meter is running.'],
  }
}

interface Store {
  state: GameState
  advance: (nTicks: number) => void
  setActivity: (a: ActivityId) => void
  setZone: (id: string) => void
  chooseEvent: (idx: number) => void
  acceptContract: () => void
  declineContract: () => void
  buyBandage: () => void
  buyElixir: () => void
  buyTomb: () => void
  takeLoan: () => void
  rebirth: (boonId: string) => void
  hardReset: () => void
}

function load(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return freshLife()
    const saved = JSON.parse(raw) as GameState
    if (saved.version !== VERSION) return freshLife({ totalLegacy: (saved as GameState).totalLegacy ?? 0, incarnation: (saved as GameState).incarnation ?? 0, seed: saved.seed })
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

const upd = (fn: (s: GameState) => Partial<GameState> | null) => (st: { state: GameState }) => {
  const patch = fn(st.state)
  return patch ? { state: { ...st.state, ...patch } } : {}
}

function withLog(s: GameState, msg: string): string[] {
  return [msg, ...s.log].slice(0, 60)
}

export const useGame = create<Store>((set, get) => ({
  state: load(),

  advance: (n) => set(({ state }) => ({ state: tick(state, n) })),

  setActivity: (a) => set(upd((s) => (s.activity === a || s.dead ? null : { activity: a, bar: 0 }))),

  setZone: (id) =>
    set(
      upd((s) => {
        if (s.zoneId === id || s.dead) return null
        const z = ZONES.find((x) => x.id === id)
        if (!z) return null
        return { zoneId: id, bar: 0, log: withLog(s, `You descend to the ${z.name}. The acoustics are ominous.`) }
      })
    ),

  chooseEvent: (idx) =>
    set(
      upd((s) => {
        if (!s.pendingEvent) return null
        const def = EVENTS.find((e) => e.id === s.pendingEvent!.defId)
        const c = def?.choices[idx]
        if (!c) return { pendingEvent: null }
        if (c.gold && c.gold < 0 && s.gold < -c.gold) return null // can't afford
        const beats = Math.min(s.maxHeartbeats, s.heartbeats + (c.beats ?? 0))
        if (beats <= 0) return null // don't let an event kill silently; block it
        return {
          pendingEvent: null,
          gold: s.gold + (c.gold ?? 0),
          heartbeats: beats,
          legacy: s.legacy + (c.legacy ?? 0),
          wounds: Math.max(0, Math.min(B.MAX_WOUNDS, s.wounds + (c.wounds ?? 0))),
          power: Math.max(0, s.power + (c.power ?? 0)),
          log: withLog(s, c.outcome),
        }
      })
    ),

  acceptContract: () =>
    set(
      upd((s) => {
        if (!s.contractOffer) return null
        const dl = s.ticksLived + s.contractOffer.kills * 90
        return {
          contract: { ...s.contractOffer, deadline: dl },
          contractOffer: null,
          log: withLog(s, `Contract signed: ${s.contractOffer.kills} kills. The deadline is load-bearing.`),
        }
      })
    ),

  declineContract: () =>
    set(
      upd((s) =>
        s.contractOffer
          ? { contractOffer: null, nextContractAt: s.ticksLived + B.CONTRACT_OFFER_TICKS, log: withLog(s, 'Offer declined. The courier sighs, dustily.') }
          : null
      )
    ),

  buyBandage: () =>
    set(
      upd((s) => {
        if (s.gold < s.bandagePrice || s.wounds < 1 || s.dead) return null
        return {
          gold: s.gold - s.bandagePrice,
          wounds: s.wounds - 1,
          bandagePrice: Math.round(s.bandagePrice * B.BANDAGE_PRICE_MULT),
          log: withLog(s, 'A wound closes. The bandage was itemized on the invoice.'),
        }
      })
    ),

  buyElixir: () =>
    set(
      upd((s) => {
        if (s.gold < s.elixirPrice || s.dead) return null
        return {
          gold: s.gold - s.elixirPrice,
          heartbeats: Math.min(s.maxHeartbeats, s.heartbeats + B.ELIXIR_BEATS),
          elixirPrice: Math.round(s.elixirPrice * B.ELIXIR_PRICE_MULT),
          log: withLog(s, `The apothecary sells you ${B.ELIXIR_BEATS} heartbeats. The price of living has gone up. Again.`),
        }
      })
    ),

  buyTomb: () =>
    set(
      upd((s) => {
        const price = B.TOMB_BASE_PRICE * (s.tombLevel + 1)
        if (s.gold < price || s.dead) return null
        return {
          gold: s.gold - price,
          tombLevel: s.tombLevel + 1,
          log: withLog(s, `Vanity Tomb upgraded to tier ${s.tombLevel + 1}. Future generations will be moderately impressed.`),
        }
      })
    ),

  takeLoan: () =>
    set(
      upd((s) => {
        if (s.dead) return null
        return {
          heartbeats: Math.min(s.maxHeartbeats, s.heartbeats + B.LOAN_BEATS),
          reaperDebt: s.reaperDebt + B.LOAN_OWED,
          log: withLog(s, `The Reaper advances ${B.LOAN_BEATS} heartbeats against your next life. No receipt. You owe ${s.reaperDebt + B.LOAN_OWED}.`),
        }
      })
    ),

  rebirth: (boonId) => {
    const s = get().state
    const rng = mulberry32(s.seed)
    const tombBonus = 1 + s.tombLevel * B.TOMB_LEGACY_BONUS
    const cut = s.reaperDebt > 0 ? B.DEBT_LEGACY_CUT : 1
    const banked = Math.floor(s.legacy * tombBonus * cut)
    const next = freshLife({
      incarnation: s.incarnation,
      totalLegacy: s.totalLegacy + banked,
      reaperDebt: s.reaperDebt,
      seed: s.seed,
      boonId,
    })
    next.log = [
      `${pick(rng, DEATH_LINES)} Banked ${banked} Legacy${s.reaperDebt > 0 ? ' (after the Reaper’s cut)' : ''}.`,
      ...next.log,
    ]
    set({ state: next })
    save(next)
  },

  hardReset: () => {
    localStorage.removeItem(SAVE_KEY)
    set({ state: freshLife() })
  },
}))

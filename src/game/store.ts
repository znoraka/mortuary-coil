import { create } from 'zustand'
import type { GameState, RouteId, Slot } from './types'
import { tick } from './tick'
import * as B from './balance'
import { genItem } from './loot'
import { mulberry32, pick } from './rng'
import { EXTRACT_LINES } from './flavor'

const SAVE_KEY = 'ossuary-depths-save'
const VERSION = 1

function freshState(): GameState {
  return {
    version: VERSION,
    seed: 20260718,
    itemSeq: 1,
    gold: 0,
    shards: 0,
    deepest: 0,
    runsDone: 0,
    deaths: 0,
    equipment: { weapon: null, armor: null, helm: null, boots: null, charm: null },
    unids: [],
    run: null,
    lastRunSummary: null,
    lastSeen: Date.now(),
    log: ['The ossuary yawns below. It smells of opportunity and femurs.'],
  }
}

function load(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return freshState()
    const saved = JSON.parse(raw) as GameState
    if (saved.version !== VERSION) return freshState()
    return saved // runs are live-only; no offline sim
  } catch {
    return freshState()
  }
}

export function save(s: GameState) {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ...s, lastSeen: Date.now() }))
}

const withLog = (s: GameState, msg: string) => [msg, ...s.log].slice(0, 60)

interface Store {
  state: GameState
  advance: (n: number) => void
  startRun: (route: RouteId) => void
  descend: () => void
  extract: () => void
  keepDrop: () => void
  shatterDrop: () => void
  equipFromSatchelOrUnids: (id: number) => void
  shatterItem: (id: number) => void
  gamble: (slot: Slot) => void
  identify: (id: number) => void
  dismissSummary: () => void
  hardReset: () => void
}

export const useGame = create<Store>((set) => ({
  state: load(),

  advance: (n) => set(({ state }) => (state.run ? { state: tick(state, n) } : {})),

  startRun: (routeId) =>
    set(({ state: s }) => {
      if (s.run) return {}
      const route = B.ROUTES[routeId]
      if (s.deepest < route.unlock) return {}
      return {
        state: {
          ...s,
          lastRunSummary: null,
          run: {
            routeId,
            floor: 1,
            progress: 0,
            hp: B.MAX_HP,
            kills: 0,
            goldFound: 0,
            shardsFound: 0,
            satchel: [],
            pendingDrop: null,
            awaitingDescend: false,
            bossFloor: route.bossAt === 1,
          },
          log: withLog(s, `You descend into the ${route.name}. The door does not lock behind you, which is somehow worse.`),
        },
      }
    }),

  descend: () =>
    set(({ state: s }) => {
      if (!s.run?.awaitingDescend) return {}
      return { state: { ...s, run: { ...s.run, floor: s.run.floor + 1, awaitingDescend: false } } }
    }),

  extract: () =>
    set(({ state: s }) => {
      const r = s.run
      if (!r || (!r.awaitingDescend && r.hp > 0)) return {}
      const rng = mulberry32(s.seed)
      const kept = r.satchel
      return {
        state: {
          ...s,
          seed: (s.seed + 7) >>> 0,
          gold: s.gold + r.goldFound,
          shards: s.shards + r.shardsFound,
          runsDone: s.runsDone + 1,
          unids: s.unids, // unids only from gambling/boss for now
          run: null,
          lastRunSummary: `✅ Extracted from floor ${r.floor}: +${r.goldFound}g, +${r.shardsFound} shards, ${kept.length} item${kept.length === 1 ? '' : 's'} in the satchel.`,
          // satchel items land in unids list identified (they were seen in-run) → they go to a holding list via unids with unid=false
          log: withLog(s, pick(rng, EXTRACT_LINES)),
          equipment: s.equipment,
          // stash satchel into unids array (identified) for town decisions
          ...(kept.length ? { unids: [...s.unids, ...kept].slice(-B.MAX_UNIDS - B.SATCHEL_SIZE) } : {}),
        },
      }
    }),

  keepDrop: () =>
    set(({ state: s }) => {
      const r = s.run
      if (!r?.pendingDrop) return {}
      const it = r.pendingDrop
      let satchel = [...r.satchel]
      let shards = r.shardsFound
      let logs = s.log
      if (satchel.length >= B.SATCHEL_SIZE) {
        // auto-swap out the lowest-score item
        let worst = 0
        for (let i = 1; i < satchel.length; i++) if (satchel[i].score < satchel[worst].score) worst = i
        if (satchel[worst].score >= it.score) {
          return { state: { ...s, run: { ...r, pendingDrop: null, shardsFound: shards + B.SHATTER_VALUE[it.rarity] }, log: withLog(s, `Satchel full of better things. ${it.name} shatters.`) } }
        }
        const out = satchel.splice(worst, 1)[0]
        shards += B.SHATTER_VALUE[out.rarity]
        logs = withLog(s, `${out.name} shattered to make room for ${it.name}.`)
      }
      satchel.push(it)
      return { state: { ...s, run: { ...r, satchel, pendingDrop: null, shardsFound: shards }, log: logs } }
    }),

  shatterDrop: () =>
    set(({ state: s }) => {
      const r = s.run
      if (!r?.pendingDrop) return {}
      return {
        state: {
          ...s,
          run: { ...r, pendingDrop: null, shardsFound: r.shardsFound + B.SHATTER_VALUE[r.pendingDrop.rarity] },
        },
      }
    }),

  equipFromSatchelOrUnids: (id) =>
    set(({ state: s }) => {
      const idx = s.unids.findIndex((i) => i.id === id)
      if (idx < 0) return {}
      const it = s.unids[idx]
      if (it.unid) return {}
      const old = s.equipment[it.slot]
      const unids = s.unids.filter((i) => i.id !== id)
      return {
        state: {
          ...s,
          equipment: { ...s.equipment, [it.slot]: it },
          unids,
          shards: s.shards + (old ? B.SHATTER_VALUE[old.rarity] : 0),
          log: withLog(s, old ? `Equipped ${it.name}. ${old.name} shatters into ${B.SHATTER_VALUE[old.rarity]} shards.` : `Equipped ${it.name}.`),
        },
      }
    }),

  shatterItem: (id) =>
    set(({ state: s }) => {
      const it = s.unids.find((i) => i.id === id)
      if (!it) return {}
      const val = it.unid ? 4 : B.SHATTER_VALUE[it.rarity]
      return {
        state: { ...s, unids: s.unids.filter((i) => i.id !== id), shards: s.shards + val, log: withLog(s, `${it.unid ? 'The unidentified thing' : it.name} shatters into ${val} shards.`) },
      }
    }),

  gamble: (slot) =>
    set(({ state: s }) => {
      if (s.shards < B.GAMBLE_COST || s.unids.length >= B.MAX_UNIDS + B.SATCHEL_SIZE) return {}
      const rng = mulberry32(s.seed)
      const it = genItem(s.itemSeq, Math.max(4, s.deepest), rng, 0, slot, 'rare')
      it.unid = true
      return {
        state: {
          ...s,
          seed: (s.seed + 13) >>> 0,
          itemSeq: s.itemSeq + 1,
          shards: s.shards - B.GAMBLE_COST,
          unids: [...s.unids, it],
          log: withLog(s, `The gambler hands over something wrapped in a shroud. "No refunds. Especially no refunds."`),
        },
      }
    }),

  identify: (id) =>
    set(({ state: s }) => {
      const idx = s.unids.findIndex((i) => i.id === id && i.unid)
      if (idx < 0 || s.gold < B.IDENTIFY_COST) return {}
      const unids = [...s.unids]
      unids[idx] = { ...unids[idx], unid: false }
      return {
        state: { ...s, gold: s.gold - B.IDENTIFY_COST, unids, log: withLog(s, `The scribe squints. "Ah. ${unids[idx].name}." He charges by the syllable.`) },
      }
    }),

  dismissSummary: () => set(({ state: s }) => ({ state: { ...s, lastRunSummary: null } })),

  hardReset: () => {
    localStorage.removeItem(SAVE_KEY)
    set({ state: freshState() })
  },
}))

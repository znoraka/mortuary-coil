import { create } from 'zustand'
import type { GameState, Direction, SkillId, Slot, SupplyId } from './types'
import { tick, resolveDrop, applyShrine, endRun } from './tick'
import * as B from './balance'
import { genItem, tierUpItem, rerollItem, tierFor, NEXT_RARITY } from './loot'
import { mulberry32 } from './rng'

const SAVE_KEY = 'ossuary-depths-save'
const VERSION = 3

const ZERO_SKILLS: Record<SkillId, number> = { butchery: 0, skin: 0, secondwind: 0, scent: 0, cartography: 0, packrat: 0 }
const ZERO_SUPPLIES: Record<SupplyId, number> = { draught: 0, torch: 0, candle: 0, ladder: 0, powder: 0 }

function freshState(carry?: Partial<GameState>): GameState {
  return {
    version: VERSION,
    seed: carry?.seed ?? 20260719,
    itemSeq: carry?.itemSeq ?? 1,
    gold: carry?.gold ?? 0,
    shards: carry?.shards ?? 0,
    xp: 0,
    deepest: carry?.deepest ?? 0,
    runsDone: carry?.runsDone ?? 0,
    deaths: carry?.deaths ?? 0,
    equipment: carry?.equipment ?? { weapon: null, armor: null, helm: null, boots: null, charm: null },
    stash: carry?.stash ?? [],
    skills: { ...ZERO_SKILLS },
    waypoints: [1, ...(carry?.deepest ? [5, 10, 15, 20, 25].filter((w) => w <= carry.deepest!) : [])],
    supplies: { ...ZERO_SUPPLIES },
    loadout: [null, null, null],
    startFloor: 1,
    run: null,
    lastRunSummary: null,
    lastSeen: Date.now(),
    log: ['The Spindle hums. Five minutes at a time, it will tolerate you.'],
  }
}

function load(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return freshState()
    const saved = JSON.parse(raw) as GameState & { unids?: GameState['stash'] }
    if (saved.version === VERSION) return { ...saved, run: null } // runs don't survive reloads
    // migrate v1: keep economy + gear
    return freshState({
      gold: saved.gold,
      shards: saved.shards,
      deepest: saved.deepest,
      runsDone: saved.runsDone,
      deaths: saved.deaths,
      equipment: saved.equipment,
      stash: saved.stash ?? saved.unids ?? [],
      seed: saved.seed,
      itemSeq: saved.itemSeq,
    })
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
  startRun: () => void
  setDirection: (d: Direction) => void
  keepDrop: () => void
  shatterDrop: () => void
  chooseShrine: (idx: number) => void
  extractNow: () => void
  setStartFloor: (f: number) => void
  setLoadout: (slot: number, id: SupplyId | null) => void
  buySupply: (id: SupplyId) => void
  learnSkill: (id: SkillId) => void
  equipItem: (id: number) => void
  shatterItem: (id: number) => void
  identify: (id: number) => void
  gamble: (slot: Slot) => void
  craftTierUp: (id: number) => void
  craftReroll: (id: number) => void
  craftFuse: (rarity: string) => void
  dismissSummary: () => void
  hardReset: () => void
}

export const useGame = create<Store>((set) => ({
  state: load(),

  advance: (n) => set(({ state }) => (state.run ? { state: tick(state, n) } : {})),

  startRun: () =>
    set(({ state: s }) => {
      if (s.run || !s.waypoints.includes(s.startFloor)) return {}
      const loadout = s.loadout.filter((x): x is SupplyId => !!x && s.supplies[x] > 0)
      const supplies = { ...s.supplies }
      for (const id of loadout) supplies[id] -= 1
      return {
        state: {
          ...s,
          supplies,
          lastRunSummary: null,
          run: {
            floor: s.startFloor,
            progress: 0,
            hp: B.MAX_HP,
            kills: 0,
            currentMonster: 'Something Damp',
            direction: 'down',
            timeLeft: B.RUN_SECONDS,
            transitionLeft: 0,
            alarm: 0,
            lastBandKey: -1,
            xpFound: 0,
            goldFound: 0,
            shardsFound: 0,
            satchel: [],
            pendingDrop: null,
            shrine: null,
            nextShrineAt: B.RUN_SECONDS - 40,
            elite: null,
            suppliesUsed: {},
            loadout,
            mfBuffUntil: Infinity,
            goldBuffUntil: Infinity,
            powderCharges: loadout.includes('powder') ? 3 : 0,
            secondWindUsed: false,
            plungeFloors: 0,
            ended: null,
          },
          log: withLog(s, `Descent begins at floor ${s.startFloor}. The Spindle starts its five-minute grudge.`),
        },
      }
    }),

  setDirection: (d) =>
    set(({ state: s }) => (s.run && s.run.direction !== d ? { state: { ...s, run: { ...s.run, direction: d } } } : {})),

  keepDrop: () =>
    set(({ state: s }) => {
      if (!s.run?.pendingDrop) return {}
      const st = { ...s, run: { ...s.run, satchel: [...s.run.satchel] } }
      resolveDrop(st, st.run!, true)
      return { state: st }
    }),

  shatterDrop: () =>
    set(({ state: s }) => {
      if (!s.run?.pendingDrop) return {}
      const st = { ...s, run: { ...s.run, satchel: [...s.run.satchel] } }
      resolveDrop(st, st.run!, false)
      return { state: st }
    }),

  chooseShrine: (idx) =>
    set(({ state: s }) => {
      if (!s.run?.shrine) return {}
      const st = { ...s, run: { ...s.run, satchel: [...s.run.satchel] }, log: [...s.log] }
      const rng = mulberry32(st.seed)
      st.seed = (st.seed + 17) >>> 0
      applyShrine(st, st.run!, idx, rng)
      return { state: st }
    }),

  extractNow: () =>
    set(({ state: s }) => {
      if (!s.run) return {}
      const st = { ...s, run: { ...s.run, satchel: [...s.run.satchel] }, stash: [...s.stash], log: [...s.log] }
      const rng = mulberry32(st.seed)
      st.seed = (st.seed + 23) >>> 0
      endRun(st, st.run!, false, rng)
      return { state: st }
    }),

  setStartFloor: (f) => set(({ state: s }) => (s.waypoints.includes(f) && !s.run ? { state: { ...s, startFloor: f } } : {})),

  setLoadout: (slot, id) =>
    set(({ state: s }) => {
      if (s.run || slot < 0 || slot > 2) return {}
      const loadout = [...s.loadout] as (SupplyId | null)[]
      loadout[slot] = id
      return { state: { ...s, loadout } }
    }),

  buySupply: (id) =>
    set(({ state: s }) => {
      const price = B.supplyPrice(id, s.deepest)
      if (s.gold < price) return {}
      return { state: { ...s, gold: s.gold - price, supplies: { ...s.supplies, [id]: s.supplies[id] + 1 } } }
    }),

  learnSkill: (id) =>
    set(({ state: s }) => {
      const lvl = s.skills[id]
      const cost = B.skillCost(lvl)
      if (lvl >= B.MAX_SKILL || s.xp < cost) return {}
      return {
        state: {
          ...s,
          xp: s.xp - cost,
          skills: { ...s.skills, [id]: lvl + 1 },
          log: withLog(s, `${B.SKILLS[id].name} → level ${lvl + 1}.`),
        },
      }
    }),

  equipItem: (id) =>
    set(({ state: s }) => {
      const it = s.stash.find((i) => i.id === id)
      if (!it || it.unid || s.run) return {}
      const old = s.equipment[it.slot]
      return {
        state: {
          ...s,
          equipment: { ...s.equipment, [it.slot]: it },
          stash: [...s.stash.filter((i) => i.id !== id), ...(old ? [old] : [])].slice(-B.STASH_CAP),
          log: withLog(s, `Equipped ${it.name}.`),
        },
      }
    }),

  shatterItem: (id) =>
    set(({ state: s }) => {
      const it = s.stash.find((i) => i.id === id)
      if (!it) return {}
      const val = it.unid ? 4 : B.SHATTER_VALUE[it.rarity]
      return { state: { ...s, stash: s.stash.filter((i) => i.id !== id), shards: s.shards + val } }
    }),

  identify: (id) =>
    set(({ state: s }) => {
      const idx = s.stash.findIndex((i) => i.id === id && i.unid)
      if (idx < 0 || s.gold < B.IDENTIFY_COST) return {}
      const stash = [...s.stash]
      stash[idx] = { ...stash[idx], unid: false }
      return { state: { ...s, gold: s.gold - B.IDENTIFY_COST, stash, log: withLog(s, `The scribe squints. "Ah. ${stash[idx].name}."`) } }
    }),

  gamble: (slot) =>
    set(({ state: s }) => {
      if (s.shards < B.GAMBLE_COST || s.stash.length >= B.STASH_CAP) return {}
      const rng = mulberry32(s.seed)
      const it = genItem(s.itemSeq, Math.max(4, s.deepest), rng, 0, slot, 'rare')
      it.unid = true
      return {
        state: {
          ...s,
          seed: (s.seed + 13) >>> 0,
          itemSeq: s.itemSeq + 1,
          shards: s.shards - B.GAMBLE_COST,
          stash: [...s.stash, it],
          log: withLog(s, `The gambler hands over something in a shroud. "No refunds. Especially no refunds."`),
        },
      }
    }),

  craftTierUp: (id) =>
    set(({ state: s }) => {
      const idx = s.stash.findIndex((i) => i.id === id && !i.unid)
      const inStash = idx >= 0
      const it = inStash ? s.stash[idx] : Object.values(s.equipment).find((e) => e?.id === id)
      if (!it || s.shards < B.TIERUP_SHARDS || s.gold < B.TIERUP_GOLD || it.tier >= tierFor(s.deepest)) return {}
      const up = tierUpItem(it)
      const stash = inStash ? s.stash.map((i) => (i.id === id ? up : i)) : s.stash
      const equipment = inStash ? s.equipment : { ...s.equipment, [it.slot]: up }
      return {
        state: { ...s, shards: s.shards - B.TIERUP_SHARDS, gold: s.gold - B.TIERUP_GOLD, stash, equipment, log: withLog(s, `${up.name} reforged to tier ${up.tier}.`) },
      }
    }),

  craftReroll: (id) =>
    set(({ state: s }) => {
      const idx = s.stash.findIndex((i) => i.id === id && !i.unid && (i.rarity === 'magic' || i.rarity === 'rare'))
      if (idx < 0 || s.shards < B.REROLL_SHARDS) return {}
      const rng = mulberry32(s.seed)
      const rerolled = rerollItem(s.stash[idx], rng)
      const stash = s.stash.map((i, j) => (j === idx ? rerolled : i))
      return {
        state: { ...s, seed: (s.seed + 29) >>> 0, shards: s.shards - B.REROLL_SHARDS, stash, log: withLog(s, `The affixes of ${rerolled.name} are renegotiated.`) },
      }
    }),

  craftFuse: (rarity) =>
    set(({ state: s }) => {
      const next = NEXT_RARITY[rarity]
      const fodder = s.stash.filter((i) => i.unid && i.rarity === rarity).slice(0, 3)
      if (!next || fodder.length < 3 || s.shards < B.FUSE_SHARDS) return {}
      const rng = mulberry32(s.seed)
      const it = genItem(s.itemSeq, Math.max(4, s.deepest), rng, 0, null, next)
      it.unid = true
      const ids = new Set(fodder.map((f) => f.id))
      return {
        state: {
          ...s,
          seed: (s.seed + 31) >>> 0,
          itemSeq: s.itemSeq + 1,
          shards: s.shards - B.FUSE_SHARDS,
          stash: [...s.stash.filter((i) => !ids.has(i.id)), it],
          log: withLog(s, `Three shrouded somethings become one better-shrouded something.`),
        },
      }
    }),

  dismissSummary: () => set(({ state: s }) => ({ state: { ...s, lastRunSummary: null } })),

  hardReset: () => {
    localStorage.removeItem(SAVE_KEY)
    set({ state: freshState() })
  },
}))

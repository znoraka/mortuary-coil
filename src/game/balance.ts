import type { RouteId, Slot } from './types'

export const TICK_MS = 250
export const MAX_HP = 100
export const SATCHEL_SIZE = 6
export const MAX_UNIDS = 8

// per-second rates (converted per tick in the engine)
export const BASE_DRAIN = 0.45 // passive hp loss during a run — the timer
export const DRAIN_PER_FLOOR = 0.28
export const BASE_KILLS_PER_SEC = 0.5
export const KILLS_PER_FLOOR = 7 // + floor
export const MONSTER_DPS_PER_FLOOR = 1.0

export const DROP_CHANCE = 0.3 // per kill
export const GOLD_PER_KILL = 2 // + floor, scaled by greed

export const GAMBLE_COST = 40 // shards → unidentified rare of chosen slot
export const IDENTIFY_COST = 15 // gold

export const SHATTER_VALUE: Record<string, number> = {
  common: 1,
  magic: 3,
  rare: 8,
  unique: 25,
}

export const DEATH_GOLD_KEPT = 0.5

export interface RouteDef {
  name: string
  bias: Slot | null
  unlock: number // deepest floor required
  goldMult: number
  bossAt: number | null
  blurb: string
}

export const ROUTES: Record<RouteId, RouteDef> = {
  catacombs: { name: 'Catacombs', bias: 'weapon', unlock: 0, goldMult: 1, bossAt: null, blurb: 'weapon-biased drops' },
  vaults: { name: 'Gilded Vaults', bias: 'armor', unlock: 5, goldMult: 1.5, bossAt: null, blurb: 'armor bias · +50% gold' },
  baron: { name: 'Baron run', bias: null, unlock: 8, goldMult: 1, bossAt: 4, blurb: 'boss at floor 4 · unique hunting' },
}

import type { SkillId, SupplyId } from './types'

export const TICK_MS = 250
export const RUN_SECONDS = 300
export const MAX_HP = 100
export const BASE_SATCHEL = 6
export const STASH_CAP = 12
export const TRANSITION_SECS = 3

export const BASE_KILLS_PER_SEC = 0.5
export const KILLS_PER_FLOOR = 7 // + floor

export const DROP_CHANCE = 0.14 // per kill
export const REWARD_GROWTH = 1.14 // ^floor
export const ALARM_REWARD = 0.08 // per stack
export const ALARM_DANGER = 0.06
export const MAX_ALARM = 5

export const PLUNGE_WINDOW = 20 // seconds left
export const PLUNGE_REWARD_MULT = 2
export const PLUNGE_RISK = 0.03 // escape chance lost per plunged floor

export const GAMBLE_COST = 40
export const IDENTIFY_COST = 15
export const TIERUP_SHARDS = 60
export const TIERUP_GOLD = 30
export const REROLL_SHARDS = 25
export const FUSE_SHARDS = 15

export const SHATTER_VALUE: Record<string, number> = { common: 1, magic: 3, rare: 8, unique: 25 }

export const WAYPOINT_STEP = 5

export const skillCost = (lvl: number) => 50 * Math.pow(2, lvl)
export const MAX_SKILL = 5

export interface SkillDef {
  name: string
  desc: (lvl: number) => string
}

export const SKILLS: Record<SkillId, SkillDef> = {
  butchery: { name: 'Butchery', desc: (l) => `+${8 * l}% kill rate` },
  skin: { name: "Deadman's Skin", desc: (l) => `+${4 * l} armor` },
  secondwind: { name: 'Second Wind', desc: (l) => (l ? `survive first death at ${25 + 5 * l} HP, climb 3` : 'survive first death, climb 3') },
  scent: { name: 'Scent of Gold', desc: (l) => `+${10 * l}% gold, +${5 * l}% shards` },
  cartography: { name: 'Cartography', desc: (l) => `waypoints unlock ${2 * l} floors early` },
  packrat: { name: 'Packrat', desc: (l) => `+${l} satchel slots` },
}

export interface SupplyDef {
  name: string
  price: number
  desc: string
}

export const SUPPLIES: Record<SupplyId, SupplyDef> = {
  draught: { name: 'Embalming Draught', price: 40, desc: 'heal 50 HP when below 25%' },
  torch: { name: 'Grave Torch', price: 60, desc: '+40% magic find for 60s on entering a loot band' },
  candle: { name: 'Tithe Candle', price: 50, desc: '+50% gold for 60s on entering a gold band' },
  ladder: { name: 'Rope Ladder', price: 80, desc: 'ascend 5 floors when below 15% HP' },
  powder: { name: 'Powder Charge', price: 100, desc: 'first 3 floor transitions are instant' },
}

export const supplyPrice = (id: SupplyId, deepest: number) => Math.round(SUPPLIES[id].price * (1 + deepest * 0.03))

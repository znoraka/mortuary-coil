import type { Item, Slot, Rarity, Affix, StatKey } from './types'
import type { Rng } from './rng'
import { pick } from './rng'

// ---- bases: [name, tier floor requirement] per slot; implicit stat scales with tier
const BASES: Record<Slot, [string, number][]> = {
  weapon: [['Rusty Gladius', 1], ['Femur Club', 4], ['Sexton’s Spade', 8], ['Vault-Cracker Maul', 13], ['Ossuary Scythe', 19]],
  armor: [['Moth-Eaten Gambeson', 1], ['Pallbearer’s Coat', 4], ['Gravewax Cuirass', 8], ['Baronial Plate', 13], ['Relic Shell', 19]],
  helm: [['Cracked Skullcap', 1], ['Mourner’s Hood', 5], ['Sealed Barbute', 10], ['Crown of Sconces', 16]],
  boots: [['Borrowed Sandals', 1], ['Gravedigger Boots', 5], ['Crypt Striders', 10], ['Processional Greaves', 16]],
  charm: [['Chipped Phalanx', 1], ['Coffin Nail', 5], ['Weeping Locket', 10], ['Saint’s Knuckle', 16]],
}

const IMPLICIT: Record<Slot, StatKey> = { weapon: 'dmg', armor: 'armor', helm: 'armor', boots: 'haste', charm: 'mf' }

// ---- affix pools: stat, per-tier value, prefix?, label maker
interface AffixDef {
  stat: StatKey
  prefix: boolean
  words: string[]
  perTier: number
}

const AFFIX_POOL: AffixDef[] = [
  { stat: 'dmg', prefix: true, words: ['Brutal', 'Jagged', 'Cruel', 'Merciless'], perTier: 4 },
  { stat: 'armor', prefix: true, words: ['Fortified', 'Studded', 'Sainted', 'Bulwark'], perTier: 3 },
  { stat: 'vamp', prefix: true, words: ['Vampiric', 'Leeching', 'Thirsting'], perTier: 0.7 },
  { stat: 'mf', prefix: false, words: ['of Fortune', 'of Divination', 'of the Magpie'], perTier: 6 },
  { stat: 'greed', prefix: false, words: ['of Avarice', 'of the Tithe', 'of Pockets'], perTier: 8 },
  { stat: 'haste', prefix: false, words: ['of Haste', 'of the Ferret', 'of Unseemly Speed'], perTier: 5 },
]

const RARE_A = ['Bone', 'Grim', 'Dirge', 'Wraith', 'Grave', 'Sorrow', 'Marrow', 'Pyre', 'Vault', 'Hollow']
const RARE_B = ['Whorl', 'Bite', 'Song', 'Brand', 'Shroud', 'Needle', 'Grasp', 'Toll', 'Mark', 'Hunger']

interface UniqueDef {
  slot: Slot
  name: string
  base: string
  affixes: [StatKey, number, string][]
}

export const UNIQUES: UniqueDef[] = [
  { slot: 'weapon', name: 'Grandfather’s Femur', base: 'Femur Club', affixes: [['dmg', 30, '+30 damage'], ['vamp', 6, '+6 life per kill'], ['greed', 25, '+25% gold']] },
  { slot: 'helm', name: 'The Baron’s Sneer', base: 'Sealed Barbute', affixes: [['armor', 15, '+15 armor'], ['mf', 40, '+40% magic find']] },
  { slot: 'charm', name: 'IOU (Notarized)', base: 'Coffin Nail', affixes: [['greed', 60, '+60% gold'], ['mf', 20, '+20% magic find'], ['dmg', 8, '+8 damage']] },
  { slot: 'boots', name: 'Pallbearer’s Hurry', base: 'Crypt Striders', affixes: [['haste', 35, '+35% speed'], ['vamp', 3, '+3 life per kill']] },
]

const STAT_LABEL: Record<StatKey, (v: number) => string> = {
  dmg: (v) => `+${v} damage`,
  armor: (v) => `+${v} armor`,
  vamp: (v) => `+${v} life per kill`,
  mf: (v) => `+${v}% magic find`,
  greed: (v) => `+${v}% gold`,
  haste: (v) => `+${v}% speed`,
}

export function tierFor(floor: number): number {
  return 1 + Math.floor(floor / 4)
}

export function rollRarity(rng: Rng, mf: number): Rarity {
  const m = 1 + mf / 100
  const r = rng()
  if (r < 0.0035 * m) return 'unique'
  if (r < 0.075 * m) return 'rare'
  if (r < 0.4 * Math.min(m, 1.6)) return 'magic'
  return 'common'
}

export function genItem(id: number, floor: number, rng: Rng, mf: number, bias: Slot | null, forceRarity?: Rarity): Item {
  const slots = Object.keys(BASES) as Slot[]
  let slot = pick(rng, slots)
  if (bias && (forceRarity || rng() < 0.45)) slot = bias
  const rarity = forceRarity ?? rollRarity(rng, mf)

  if (rarity === 'unique') {
    const pool = UNIQUES.filter((u) => !bias || u.slot === bias || true)
    const u = pick(rng, pool)
    const affixes: Affix[] = u.affixes.map(([stat, val, label]) => ({ stat, val, label }))
    return finish({ id, slot: u.slot, base: u.base, name: u.name, rarity, tier: tierFor(floor), affixes, implicit: implicitFor(u.slot, tierFor(floor)), score: 0 })
  }

  const tier = tierFor(floor)
  const avail = BASES[slot].filter(([, t]) => t <= Math.max(1, floor))
  const base = avail.length ? avail[avail.length - 1][0] : BASES[slot][0][0]
  const nAffix = rarity === 'common' ? 0 : rarity === 'magic' ? 1 + Math.floor(rng() * 2) : 3 + Math.floor(rng() * 2)
  const pool = [...AFFIX_POOL]
  const affixes: Affix[] = []
  for (let i = 0; i < nAffix && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length)
    const def = pool.splice(idx, 1)[0]
    const val = Math.max(1, Math.round(def.perTier * tier * (0.7 + rng() * 0.6)))
    affixes.push({ stat: def.stat, val, label: STAT_LABEL[def.stat](val) })
  }

  let name = base
  if (rarity === 'magic' && affixes.length) {
    const def = AFFIX_POOL.find((d) => d.stat === affixes[0].stat)!
    name = def.prefix ? `${pick(rng, def.words)} ${base}` : `${base} ${pick(rng, def.words)}`
  } else if (rarity === 'rare') {
    name = `${pick(rng, RARE_A)}${pick(rng, RARE_B).toLowerCase()}` // D2-style rare name: "Bonewhorl"
  }

  return finish({ id, slot, base, name, rarity, tier, affixes, implicit: implicitFor(slot, tier), score: 0 })
}

function implicitFor(slot: Slot, tier: number): Affix {
  const stat = IMPLICIT[slot]
  const per: Record<StatKey, number> = { dmg: 5, armor: 4, vamp: 0.8, mf: 4, greed: 5, haste: 3 }
  const val = Math.max(1, Math.round(per[stat] * tier))
  return { stat, val, label: STAT_LABEL[stat](val) }
}

const SCORE_W: Record<StatKey, number> = { dmg: 3, armor: 3, vamp: 8, mf: 2, greed: 1.2, haste: 2 }

function finish(it: Item): Item {
  it.score = Math.round([it.implicit, ...it.affixes].reduce((a, x) => a + x.val * SCORE_W[x.stat], 0))
  return it
}

export function statsOf(equipment: Partial<Record<Slot, Item | null>>): Record<StatKey, number> {
  const t: Record<StatKey, number> = { dmg: 0, armor: 0, vamp: 0, mf: 0, greed: 0, haste: 0 }
  for (const it of Object.values(equipment)) {
    if (!it || it.unid) continue
    for (const a of [it.implicit, ...it.affixes]) t[a.stat] += a.val
  }
  return t
}

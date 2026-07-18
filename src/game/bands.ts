export type Affinity = 'none' | 'gold' | 'xp' | 'loot'

export interface Band {
  name: string
  affinity: Affinity
  mult: number // gold/xp multiplier, or MF bonus % for loot bands
}

const CYCLE: [string, Affinity][] = [
  ['Tithe Halls', 'gold'],
  ['Bone Library', 'xp'],
  ['Reliquary', 'loot'],
]

const DEEP_NAMES: Record<Affinity, string[]> = {
  gold: ['Tithe Halls', 'Counting Crypts', 'Mint of the Dead', 'The Long Ledger'],
  xp: ['Bone Library', 'Whisper Galleries', 'Sunken Seminary', 'The Last Lecture'],
  loot: ['Reliquary', 'Deep Reliquary', 'Vault of Vanities', 'The Hoard Below'],
  none: ['Charnel Steps'],
}

export function bandFor(floor: number): Band {
  if (floor < 5) return { name: 'Charnel Steps', affinity: 'none', mult: 1 }
  const idx = Math.floor((floor - 5) / 5)
  const cycle = Math.floor(idx / 3)
  const [, affinity] = CYCLE[idx % 3]
  const name = DEEP_NAMES[affinity][Math.min(cycle, DEEP_NAMES[affinity].length - 1)]
  if (affinity === 'loot') return { name, affinity, mult: 60 + 30 * cycle } // MF bonus %
  return { name, affinity, mult: 2 + 0.5 * cycle }
}

export function bandKey(floor: number): number {
  return floor < 5 ? 0 : 1 + Math.floor((floor - 5) / 5)
}

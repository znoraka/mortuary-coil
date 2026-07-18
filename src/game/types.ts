export type Slot = 'weapon' | 'armor' | 'helm' | 'boots' | 'charm'
export type Rarity = 'common' | 'magic' | 'rare' | 'unique'

export type StatKey = 'dmg' | 'armor' | 'vamp' | 'mf' | 'greed' | 'haste'

export interface Affix {
  stat: StatKey
  val: number
  label: string
}

export interface Item {
  id: number
  slot: Slot
  base: string
  name: string
  rarity: Rarity
  tier: number
  affixes: Affix[]
  implicit: Affix
  score: number
  unid?: boolean
}

export type RouteId = 'catacombs' | 'vaults' | 'baron'

export interface RunState {
  routeId: RouteId
  floor: number
  progress: number // 0..1 of current floor
  hp: number
  kills: number
  goldFound: number
  shardsFound: number
  satchel: Item[]
  pendingDrop: Item | null
  awaitingDescend: boolean // floor cleared → descend or extract
  bossFloor: boolean
}

export interface GameState {
  version: number
  seed: number
  itemSeq: number
  gold: number
  shards: number
  deepest: number
  runsDone: number
  deaths: number
  equipment: Record<Slot, Item | null>
  unids: Item[]
  run: RunState | null
  lastRunSummary: string | null
  lastSeen: number
  log: string[]
}

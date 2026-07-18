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

export type Direction = 'up' | 'down' | 'farm'
export type SkillId = 'butchery' | 'skin' | 'secondwind' | 'scent' | 'cartography' | 'packrat'
export type SupplyId = 'draught' | 'torch' | 'candle' | 'ladder' | 'powder'

export interface UndoEvent {
  kind: 'kept' | 'shattered'
  item: Item
  replaced: Item | null // item that was pushed out of the satchel, if any
  expiresAt: number // run timeLeft below which the undo disappears
}

export interface RunState {
  floor: number
  progress: number // 0..1
  hp: number
  kills: number
  direction: Direction
  timeLeft: number // seconds
  transitionLeft: number // seconds of floor transition remaining
  alarm: number // farming heat stacks 0..5
  lastBandKey: number
  xpFound: number
  goldFound: number
  shardsFound: number
  satchel: Item[]
  undo: UndoEvent | null
  suppliesUsed: Partial<Record<SupplyId, boolean>>
  loadout: SupplyId[]
  mfBuffUntil: number // timeLeft threshold (buff active while timeLeft > this)
  goldBuffUntil: number
  powderCharges: number
  secondWindUsed: boolean
  plungeFloors: number
  ended: null | 'extracted' | 'died'
}

export interface GameState {
  version: number
  seed: number
  itemSeq: number
  gold: number
  shards: number
  xp: number
  deepest: number
  runsDone: number
  deaths: number
  equipment: Record<Slot, Item | null>
  stash: Item[]
  skills: Record<SkillId, number>
  waypoints: number[]
  supplies: Record<SupplyId, number>
  loadout: (SupplyId | null)[]
  startFloor: number
  run: RunState | null
  lastRunSummary: string | null
  lastSeen: number
  log: string[]
}

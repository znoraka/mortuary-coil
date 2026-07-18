export type ActivityId = 'slay' | 'train' | 'contemplate'

export interface GameState {
  version: number
  seed: number
  incarnation: number
  heartbeats: number
  maxHeartbeats: number
  gold: number
  legacy: number // accrued this life, banked at death
  totalLegacy: number // permanent, survives death
  power: number
  activity: ActivityId
  bar: number // 0..1
  healerPrice: number
  tombLevel: number
  reaperDebt: number // heartbeats owed to the Reaper
  kills: number
  dead: boolean
  lastSeen: number
  log: string[]
}

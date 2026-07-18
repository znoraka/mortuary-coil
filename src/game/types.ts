export type ActivityId = 'slay' | 'train' | 'contemplate'

export interface ActiveEvent {
  defId: string
}

export interface ActiveContract {
  kills: number
  done: number
  deadline: number // ticksLived at which it expires
  rewardLegacy: number
  text: string
}

export interface GameState {
  version: number
  seed: number
  incarnation: number
  heartbeats: number
  maxHeartbeats: number
  ticksLived: number
  gold: number
  legacy: number // accrued this life, banked at death
  totalLegacy: number // permanent, survives death
  power: number
  wounds: number
  activity: ActivityId
  zoneId: string
  bar: number // 0..1
  bandagePrice: number
  elixirPrice: number
  tombLevel: number
  reaperDebt: number // heartbeats owed to the Reaper
  kills: number
  dead: boolean
  causeOfDeath: string
  pendingEvent: ActiveEvent | null
  nextEventAt: number // in ticksLived
  contract: ActiveContract | null
  contractOffer: ActiveContract | null
  nextContractAt: number
  boon: string | null // boon chosen at last rebirth (display only)
  lastSeen: number
  log: string[]
}

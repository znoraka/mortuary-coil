export const TICK_MS = 250 // one logical tick
export const BASE_LIFE = 6000 // heartbeats per fresh incarnation (~20 min at base drain)
export const DRAIN_PER_TICK = 1.25 // 5 heartbeats/s — time itself is the cost

export const SLAY_SECS = 5
export const TRAIN_SECS = 4
export const CONTEMPLATE_SECS = 6

export const HEALER_BASE_PRICE = 50
export const HEALER_PRICE_MULT = 1.6
export const HEALER_BEATS = 900

export const TOMB_BASE_PRICE = 120
export const TOMB_LEGACY_BONUS = 0.25 // +25% legacy at death per tomb level

export const LOAN_BEATS = 1200 // what the Reaper fronts you now
export const LOAN_OWED = 1800 // what he takes from your next life
export const DEBT_LEGACY_CUT = 0.75 // die indebted: the Reaper's Cut on banked legacy

export const OFFLINE_CAP_MS = 2 * 60 * 60 * 1000

export const legacyMult = (totalLegacy: number) => 1 + totalLegacy / 100

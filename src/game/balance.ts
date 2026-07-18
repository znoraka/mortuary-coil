export const TICK_MS = 250 // one logical tick
export const BASE_LIFE = 6000 // heartbeats per fresh incarnation
export const DRAIN_PER_TICK = 1.0 // 4 heartbeats/s at birth — time itself is the cost

// Aging: drain accelerates over a life. At the nominal end of life you burn ~2.2x.
export const AGE_RAMP = 1.2
export const AGE_SCALE_TICKS = 6000

// Wounds: each open wound bleeds extra heartbeats until bandaged.
export const WOUND_DRAIN_PER_TICK = 0.12 // +0.48/s per wound
export const MAX_WOUNDS = 6

export const SLAY_SECS = 5
export const TRAIN_SECS = 4
export const CONTEMPLATE_SECS = 6

export const BANDAGE_BASE_PRICE = 35
export const BANDAGE_PRICE_MULT = 1.35

export const ELIXIR_BASE_PRICE = 60
export const ELIXIR_PRICE_MULT = 1.6
export const ELIXIR_BEATS = 800

export const TOMB_BASE_PRICE = 150
export const TOMB_LEGACY_BONUS = 0.25

export const LOAN_BEATS = 1200
export const LOAN_OWED = 1800
export const DEBT_LEGACY_CUT = 0.75

export const EVENT_MIN_TICKS = 220 // a dilemma every ~55-110s
export const EVENT_SPAN_TICKS = 220
export const CONTRACT_OFFER_TICKS = 480 // a contract offer ~2min after slot frees

export const OFFLINE_CAP_MS = 2 * 60 * 60 * 1000

export const legacyMult = (totalLegacy: number) => 1 + totalLegacy / 100

export const drainAt = (ticksLived: number, wounds: number) =>
  DRAIN_PER_TICK * (1 + AGE_RAMP * Math.min(1.5, ticksLived / AGE_SCALE_TICKS)) +
  wounds * WOUND_DRAIN_PER_TICK

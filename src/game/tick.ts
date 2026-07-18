import type { GameState, RunState } from './types'
import { mulberry32, pick } from './rng'
import * as B from './balance'
import { genItem, statsOf } from './loot'
import { MONSTERS, BOSS_INTRO } from './flavor'

function log(s: GameState, msg: string) {
  s.log = [msg, ...s.log].slice(0, 60)
}

// Pure fixed-timestep run simulation. Town state doesn't tick.
export function tick(prev: GameState, nTicks: number): GameState {
  if (!prev.run) return prev
  const s: GameState = { ...prev, run: { ...prev.run, satchel: [...prev.run.satchel] }, log: [...prev.log] }
  const rng = mulberry32(s.seed)
  s.seed = (s.seed + nTicks) >>> 0
  const route = B.ROUTES[s.run!.routeId]
  const stats = statsOf(s.equipment)
  const dt = B.TICK_MS / 1000

  for (let i = 0; i < nTicks; i++) {
    const r = s.run as RunState
    if (!r) break

    // the timer: health always drains, faster while deciding nothing
    const drain = (B.BASE_DRAIN + B.DRAIN_PER_FLOOR * r.floor) * dt
    r.hp -= drain
    if (r.hp <= 0) {
      endRunDeath(s)
      break
    }
    if (r.awaitingDescend || r.pendingDrop) continue // world holds its breath, heart doesn't

    // combat
    const killRate = B.BASE_KILLS_PER_SEC * (1 + stats.dmg / 25) * (1 + stats.haste / 100)
    const needed = B.KILLS_PER_FLOOR + r.floor
    const isBoss = route.bossAt === r.floor
    const monsterDps = B.MONSTER_DPS_PER_FLOOR * Math.pow(r.floor, 1.35) * (isBoss ? 2.2 : 1)
    r.hp -= Math.max(0.1, monsterDps - stats.armor * 0.35) * dt
    if (r.hp <= 0) {
      endRunDeath(s)
      break
    }

    r.progress += (killRate * dt) / (needed * (isBoss ? 1.6 : 1))
    // fractional kill accrual; loot/gold trigger on each whole kill
    const fracKills = killRate * dt
    r.kills += fracKills
    if (Math.floor(r.kills) > Math.floor(r.kills - fracKills)) {
      // a whole kill landed
      r.hp = Math.min(B.MAX_HP, r.hp + stats.vamp)
      const gold = Math.round((B.GOLD_PER_KILL + r.floor) * (1 + stats.greed / 100) * route.goldMult)
      r.goldFound += gold
      if (rng() < B.DROP_CHANCE) {
        const it = genItem(s.itemSeq++, r.floor, rng, stats.mf, route.bias)
        const equipped = s.equipment[it.slot]
        const notable = it.rarity !== 'common' || (equipped ? it.score > equipped.score : true)
        if (!notable) {
          r.goldFound += 2 + it.tier
        } else if (r.pendingDrop) {
          r.shardsFound += B.SHATTER_VALUE[it.rarity]
        } else {
          r.pendingDrop = it
        }
      }
      if (rng() < 0.18) log(s, `Slew a ${pick(rng, MONSTERS)} on floor ${r.floor}. +${gold}g.`)
    }

    if (r.progress >= 1) {
      if (isBoss) {
        // boss chest: guaranteed rare, real unique chance
        const forced = rng() < 0.22 ? 'unique' : 'rare'
        const it = genItem(s.itemSeq++, r.floor + 2, rng, stats.mf + 50, null, forced)
        r.pendingDrop = r.pendingDrop ?? it
        if (r.pendingDrop !== it) r.shardsFound += B.SHATTER_VALUE[it.rarity]
        log(s, `The Baron falls. His estate enters probate — in your favor.`)
      }
      r.progress = 0
      r.awaitingDescend = true
      r.bossFloor = route.bossAt === r.floor + 1
      if (r.bossFloor) log(s, BOSS_INTRO)
      s.deepest = Math.max(s.deepest, r.floor)
    }
  }
  return s
}

function endRunDeath(s: GameState) {
  const r = s.run!
  s.gold += Math.floor(r.goldFound * B.DEATH_GOLD_KEPT)
  s.shards += r.shardsFound
  s.deaths += 1
  s.runsDone += 1
  s.lastRunSummary = `☠️ Died on floor ${r.floor}. Satchel lost (${r.satchel.length} items). Kept ${Math.floor(r.goldFound * B.DEATH_GOLD_KEPT)}g of ${r.goldFound}g.`
  log(s, 'You die. The dungeon keeps the satchel as a gratuity.')
  s.run = null
}

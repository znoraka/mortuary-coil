import type { GameState, RunState, Item } from './types'
import { mulberry32, pick } from './rng'
import * as B from './balance'
import { bandFor, bandKey } from './bands'
import { genItem, statsOf } from './loot'
import { MONSTERS, DEATH_LINES, EXTRACT_LINES } from './flavor'

function log(s: GameState, msg: string) {
  s.log = [msg, ...s.log].slice(0, 60)
}

function satchelCap(s: GameState) {
  return B.BASE_SATCHEL + s.skills.packrat
}

function moveFloor(r: RunState, delta: number) {
  r.floor = Math.max(1, r.floor + delta)
  r.progress = 0
  r.alarm = 0
  if (r.powderCharges > 0) {
    r.powderCharges -= 1
  } else {
    r.transitionLeft = B.TRANSITION_SECS
  }
}

function autoResolveDrop(s: GameState, r: RunState, it: Item) {
  const equipped = s.equipment[it.slot]
  if (it.rarity === 'common' && (!equipped || it.score <= equipped.score)) {
    r.goldFound += 2 + it.tier
    return
  }
  const cap = satchelCap(s)
  if (r.satchel.length < cap) {
    r.satchel.push(it)
    r.undo = { kind: 'kept', item: it, replaced: null, expiresAt: r.timeLeft - 4 }
    return
  }
  let worst = 0
  for (let i = 1; i < r.satchel.length; i++) if (r.satchel[i].score < r.satchel[worst].score) worst = i
  if (r.satchel[worst].score < it.score) {
    const out = r.satchel[worst]
    r.satchel = [...r.satchel.slice(0, worst), ...r.satchel.slice(worst + 1), it]
    r.shardsFound += B.SHATTER_VALUE[out.rarity]
    r.undo = { kind: 'kept', item: it, replaced: out, expiresAt: r.timeLeft - 4 }
  } else {
    r.shardsFound += B.SHATTER_VALUE[it.rarity]
    r.undo = { kind: 'shattered', item: it, replaced: null, expiresAt: r.timeLeft - 4 }
  }
}

function endRun(s: GameState, r: RunState, died: boolean, rng: () => number) {
  s.gold += r.goldFound
  s.shards += r.shardsFound
  s.xp += r.xpFound
  s.runsDone += 1
  if (died) {
    s.deaths += 1
    s.lastRunSummary = `☠️ ${pick(rng, DEATH_LINES)} Floor ${r.floor}. Satchel lost (${r.satchel.length}). Kept ${r.goldFound}g · ${r.xpFound}xp · ${r.shardsFound}🔷.`
  } else {
    if (r.satchel.length) {
      s.stash = [...s.stash, ...r.satchel].slice(-B.STASH_CAP)
    }
    s.lastRunSummary = `✅ ${pick(rng, EXTRACT_LINES)} Depth ${r.floor}: +${r.goldFound}g · +${r.xpFound}xp · +${r.shardsFound}🔷 · ${r.satchel.length} items.`
  }
  s.run = null
}

// Pure fixed-timestep run simulation.
export function tick(prev: GameState, nTicks: number): GameState {
  if (!prev.run) return prev
  const s: GameState = { ...prev, run: { ...prev.run, satchel: [...prev.run.satchel] }, stash: [...prev.stash], log: [...prev.log] }
  const rng = mulberry32(s.seed)
  s.seed = (s.seed + nTicks) >>> 0
  const stats = statsOf(s.equipment)
  const armor = stats.armor + 4 * s.skills.skin
  const killRateBase = B.BASE_KILLS_PER_SEC * (1 + stats.dmg / 25) * (1 + stats.haste / 100) * (1 + 0.08 * s.skills.butchery)
  const dt = B.TICK_MS / 1000

  for (let i = 0; i < nTicks; i++) {
    const r = s.run as RunState
    if (!r) break

    r.timeLeft -= dt
    if (r.undo && r.timeLeft < r.undo.expiresAt) r.undo = null

    if (r.timeLeft <= 0) {
      // timer: auto-extract — unless a plunge went wrong
      if (r.plungeFloors > 0 && rng() > 0.9 - B.PLUNGE_RISK * r.plungeFloors) {
        log(s, 'The plunge was one floor too greedy. The way up is gone.')
        endRun(s, r, true, rng)
      } else {
        endRun(s, r, false, rng)
      }
      break
    }

    if (r.transitionLeft > 0) {
      r.transitionLeft = Math.max(0, r.transitionLeft - dt)
      r.hp = Math.min(B.MAX_HP, r.hp + 1.2 * dt) // catching breath between floors
      continue
    }

    // UP is travel, not combat: climb floor by floor, healing as you go
    if (r.direction === 'up') {
      if (r.floor > 1) {
        moveFloor(r, -1)
      } else {
        r.hp = Math.min(B.MAX_HP, r.hp + 2 * dt)
      }
      continue
    }

    const band = bandFor(r.floor)
    // band-entry supply triggers
    const bk = bandKey(r.floor)
    if (bk !== r.lastBandKey) {
      r.lastBandKey = bk
      if (band.affinity === 'loot' && r.loadout.includes('torch') && !r.suppliesUsed.torch) {
        r.suppliesUsed = { ...r.suppliesUsed, torch: true }
        r.mfBuffUntil = r.timeLeft - 60
        log(s, 'The Grave Torch flares green. Loot senses tingling.')
      }
      if (band.affinity === 'gold' && r.loadout.includes('candle') && !r.suppliesUsed.candle) {
        r.suppliesUsed = { ...r.suppliesUsed, candle: true }
        r.goldBuffUntil = r.timeLeft - 60
        log(s, 'The Tithe Candle burns gold. The dead pay attention.')
      }
    }

    // damage
    const raw = Math.pow(r.floor, 1.5) * (1 + B.ALARM_DANGER * r.alarm) - armor * 0.35
    const net = Math.max(raw, -2.5) // out-geared floors heal, capped
    r.hp = Math.min(B.MAX_HP, r.hp - net * dt)
    // hp supplies
    if (r.hp < B.MAX_HP * 0.15 && r.loadout.includes('ladder') && !r.suppliesUsed.ladder) {
      r.suppliesUsed = { ...r.suppliesUsed, ladder: true }
      moveFloor(r, -5)
      log(s, 'The Rope Ladder unrolls itself. Dignity optional, survival mandatory.')
      continue
    }
    if (r.hp < B.MAX_HP * 0.25 && r.loadout.includes('draught') && !r.suppliesUsed.draught) {
      r.suppliesUsed = { ...r.suppliesUsed, draught: true }
      r.hp = Math.min(B.MAX_HP, r.hp + 50)
      log(s, 'The Embalming Draught tastes of formaldehyde and second chances.')
    }
    if (r.hp <= 0) {
      if (s.skills.secondwind > 0 && !r.secondWindUsed) {
        r.secondWindUsed = true
        r.hp = 25 + 5 * s.skills.secondwind
        moveFloor(r, -3)
        log(s, 'Second Wind. Your heart lodges a complaint and restarts.')
        continue
      }
      endRun(s, r, true, rng)
      break
    }

    // combat progress
    const needed = B.KILLS_PER_FLOOR + r.floor
    r.progress += (killRateBase * dt) / needed
    const before = r.kills
    r.kills += killRateBase * dt
    if (Math.floor(r.kills) > Math.floor(before)) {
      // a whole kill landed
      r.hp = Math.min(B.MAX_HP, r.hp + stats.vamp)
      const rw = Math.pow(B.REWARD_GROWTH, r.floor) * (1 + B.ALARM_REWARD * r.alarm) * (r.plungeFloors > 0 ? B.PLUNGE_REWARD_MULT : 1)
      const goldBuff = r.timeLeft > r.goldBuffUntil && r.suppliesUsed.candle ? 1.5 : 1
      const goldMult = (band.affinity === 'gold' ? band.mult : 1) * goldBuff * (1 + (stats.greed + 10 * s.skills.scent) / 100)
      const xpMult = band.affinity === 'xp' ? band.mult : 1
      r.goldFound += Math.round(2 * rw * goldMult)
      r.xpFound += Math.round(1.5 * rw * xpMult)
      if (rng() < 0.02) r.shardsFound += 1 + Math.round(s.skills.scent * 0.5)

      const mfBuff = r.timeLeft > r.mfBuffUntil && r.suppliesUsed.torch ? 40 : 0
      const mf = stats.mf + mfBuff + (band.affinity === 'loot' ? band.mult : 0)
      const dropChance = B.DROP_CHANCE * (band.affinity === 'loot' ? 1.5 : 1) * (1 - 0.12 * r.alarm)
      if (rng() < dropChance) {
        autoResolveDrop(s, r, genItem(s.itemSeq++, r.floor, rng, mf, null))
      }
      if (rng() < 0.1) log(s, `Slew a ${pick(rng, MONSTERS)} on floor ${r.floor}.`)
    }

    // floor clear
    if (r.progress >= 1) {
      s.deepest = Math.max(s.deepest, r.floor)
      // waypoint unlocks (cartography lowers the requirement)
      const cart = 2 * s.skills.cartography
      for (let w = B.WAYPOINT_STEP; w <= r.floor + cart; w += B.WAYPOINT_STEP) {
        if (r.floor >= w - cart && !s.waypoints.includes(w)) {
          s.waypoints = [...s.waypoints, w].sort((a, b) => a - b)
          log(s, `Waypoint ${w} chalked onto the map. The chalk is bone. Obviously.`)
        }
      }
      if (r.direction === 'down') {
        if (r.timeLeft < B.PLUNGE_WINDOW) {
          r.plungeFloors += 1
          if (r.plungeFloors === 1) log(s, 'Overtime plunge! Double rewards; the exit files a grievance.')
        }
        moveFloor(r, +1)
      } else {
        r.progress = 0
        r.alarm = Math.min(B.MAX_ALARM, r.alarm + 1)
        if (r.alarm === B.MAX_ALARM) log(s, `Floor ${r.floor} is fully alarmed. Everything knows you're here.`)
      }
    }
  }
  return s
}

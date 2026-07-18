import { useEffect, useRef, useState } from 'react'
import { useGame, save } from './game/store'
import * as B from './game/balance'
import { bandFor } from './game/bands'
import { statsOf, tierFor, NEXT_RARITY } from './game/loot'
import type { Item, Direction, SkillId, Slot, SupplyId } from './game/types'

const SLOTS: Slot[] = ['weapon', 'armor', 'helm', 'boots', 'charm']
const SLOT_ICON: Record<Slot, string> = { weapon: '🗡️', armor: '🛡️', helm: '⛑️', boots: '🥾', charm: '🧿' }
const AFF_ICON: Record<string, string> = { gold: '💰', xp: '📖', loot: '🎁', none: '💀' }

type Tab = 'descend' | 'gear' | 'skills' | 'shop' | 'log'
const TABS: [Tab, string, string][] = [
  ['descend', '🕳️', 'Descend'],
  ['gear', '🎒', 'Gear'],
  ['skills', '📖', 'Skills'],
  ['shop', '🧪', 'Shop'],
  ['log', '📜', 'Log'],
]

function useGameLoop() {
  const advance = useGame((g) => g.advance)
  const acc = useRef(0)
  const last = useRef(performance.now())
  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now()
      acc.current += now - last.current
      last.current = now
      const n = Math.floor(acc.current / B.TICK_MS)
      if (n > 0) {
        acc.current -= n * B.TICK_MS
        advance(n)
      }
    }, 100)
    const persist = () => save(useGame.getState().state)
    const saver = setInterval(persist, 8000)
    document.addEventListener('visibilitychange', persist)
    return () => {
      clearInterval(id)
      clearInterval(saver)
      document.removeEventListener('visibilitychange', persist)
    }
  }, [advance])
}

function ItemCard({ it, compare, children }: { it: Item; compare?: Item | null; children?: React.ReactNode }) {
  return (
    <div className={`item r-${it.rarity}`}>
      <div className="iname">
        {it.unid ? `❓ Unidentified (${it.rarity})` : it.name}
        <span className="islot">{SLOT_ICON[it.slot]} T{it.tier}</span>
      </div>
      {!it.unid && (
        <div className="statline">
          {[it.implicit, ...it.affixes].map((a, i) => (
            <span key={i}>{a.label}</span>
          ))}
          {compare !== undefined && <span className="dim">· {it.score}{compare ? ` vs ${compare.score}` : ''}</span>}
        </div>
      )}
      {children}
    </div>
  )
}

function fmt(sec: number) {
  const s = Math.max(0, Math.ceil(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function Meter({ label, value, max, color, note }: { label: string; value: number; max: number; color?: string; note?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="meter">
      <div className="mlabel"><span>{label}</span><span className="dim">{note ?? `${Math.floor(value)}/${max}`}</span></div>
      <div className="track slim"><div className="fill" style={{ width: `${pct}%`, background: color ?? '#5b8def' }} /></div>
    </div>
  )
}

export default function App() {
  useGameLoop()
  const s = useGame((g) => g.state)
  const g = useGame()
  const [tab, setTab] = useState<Tab>('descend')
  const stats = statsOf(s.equipment)

  // ---------- DESCENT ----------
  if (s.run) {
    const r = s.run
    const band = bandFor(r.floor)
    const hpPct = Math.max(0, (r.hp / B.MAX_HP) * 100)
    const dirs: [Direction, string][] = [['up', '▲ Up'], ['down', '▼ Down'], ['farm', '■ Farm']]
    return (
      <div className="app run">
        <header>
          <span>FLOOR {r.floor}</span>
          <span className="dim">{AFF_ICON[band.affinity]} {band.name}{band.affinity === 'loot' ? ` +${band.mult}%` : band.affinity !== 'none' ? ` ×${band.mult}` : ''}{r.alarm ? ` 🔔${r.alarm}` : ''}</span>
        </header>

        <div className="lifebox">
          <div className="lifelabel">
            <span>⏱ {fmt(r.timeLeft)}</span>
            <span className="dim">{r.plungeFloors > 0 ? `PLUNGE ×2 · ${Math.round((0.9 - B.PLUNGE_RISK * r.plungeFloors) * 100)}%` : `❤️ ${Math.ceil(r.hp)}`}</span>
          </div>
          <div className="track"><div className="fill tfill" style={{ width: `${(r.timeLeft / B.RUN_SECONDS) * 100}%` }} /></div>
          <div className="track life"><div className="fill" style={{ width: `${hpPct}%`, background: hpPct < 25 ? '#e0645c' : '#c94f8c' }} /></div>
          <div className="track"><div className="fill act" style={{ width: `${r.direction === 'up' || r.transitionLeft > 0 ? 100 - (r.transitionLeft / B.TRANSITION_SECS) * 100 : r.progress * 100}%` }} /></div>
          <div className="dim smallnote">{r.direction === 'up' ? 'climbing…' : r.transitionLeft > 0 ? 'moving…' : `floor ${Math.floor(r.progress * (B.KILLS_PER_FLOOR + r.floor))}/${B.KILLS_PER_FLOOR + r.floor} kills`}</div>
          {r.direction !== 'up' && r.transitionLeft <= 0 && (
            <>
              <div className="track slim"><div className="fill mfill" style={{ width: `${(r.kills % 1) * 100}%` }} /></div>
              <div className="dim smallnote">⚔ politely dismantling a {r.currentMonster}</div>
            </>
          )}
        </div>

        <div className="dirs">
          {dirs.map(([d, label]) => (
            <button key={d} className={r.direction === d ? 'on' : ''} onClick={() => g.setDirection(d)}>{label}</button>
          ))}
        </div>

        <div className="chips">
          <span>💰 {r.goldFound}</span>
          <span>📖 {r.xpFound}</span>
          <span>🔷 {r.shardsFound}</span>
        </div>
        <div className="meters">
          <Meter label="🎒 satchel" value={r.satchel.length} max={B.BASE_SATCHEL + s.skills.packrat} color="#b07cf0" />
          {r.direction === 'farm' && <Meter label="🔔 alarm" value={r.alarm} max={B.MAX_ALARM} color="#e0a33e" />}
          {r.plungeFloors > 0 && <Meter label="🚪 escape odds" value={Math.round((0.9 - B.PLUNGE_RISK * r.plungeFloors) * 100)} max={100} color="#e0645c" note={`${Math.round((0.9 - B.PLUNGE_RISK * r.plungeFloors) * 100)}%`} />}
        </div>

        {r.undo && (
          <div className={`undo ${r.undo.kind}`}>
            <span className="utext">{r.undo.kind === 'kept' ? 'Kept' : 'Shattered'} {r.undo.item.name}</span>
            <button onClick={g.undoDrop}>Undo</button>
          </div>
        )}

        <div className="logbox grow">
          {s.log.slice(0, 8).map((l, i) => (
            <div key={s.log.length - i} className="logline">{l}</div>
          ))}
        </div>
      </div>
    )
  }

  // ---------- PREPARATION (tabbed) ----------
  return (
    <div className="app prep">
      <header>
        <span>OSSUARY DEPTHS</span>
        <span className="dim">depth {s.deepest} · {s.deaths}☠</span>
      </header>

      <div className="chips slim">
        <span>💰 {s.gold}</span>
        <span>🔷 {s.shards}</span>
        <span>📖 {s.xp}</span>
        <span>⚔{stats.dmg} 🛡{stats.armor + 4 * s.skills.skin} 🔮{stats.mf}%</span>
      </div>

      <div className="tabcontent">
        {tab === 'descend' && (
          <>
            {s.lastRunSummary && (
              <div className="card report" onClick={g.dismissSummary}>{s.lastRunSummary}</div>
            )}
            <Meter label="🗺 next waypoint" value={s.deepest % B.WAYPOINT_STEP} max={B.WAYPOINT_STEP} note={`depth ${s.deepest} → ${Math.floor(s.deepest / B.WAYPOINT_STEP) * B.WAYPOINT_STEP + B.WAYPOINT_STEP}`} />
            <h2>Waypoint</h2>
            <div className="wprow">
              {s.waypoints.map((w) => (
                <button key={w} className={`wp ${s.startFloor === w ? 'sel' : ''}`} onClick={() => g.setStartFloor(w)}>{w}</button>
              ))}
            </div>
            <h2>Loadout</h2>
            <div className="loadout">
              {s.loadout.map((id, slot) => (
                <select key={slot} value={id ?? ''} onChange={(e) => g.setLoadout(slot, (e.target.value || null) as SupplyId | null)}>
                  <option value="">— empty —</option>
                  {(Object.keys(B.SUPPLIES) as SupplyId[]).map((sid) => (
                    <option key={sid} value={sid} disabled={s.supplies[sid] < 1 && id !== sid}>
                      {B.SUPPLIES[sid].name} ×{s.supplies[sid]}
                    </option>
                  ))}
                </select>
              ))}
            </div>
            <button className="big go" onClick={g.startRun}>Begin the Descent — floor {s.startFloor}</button>
            <p className="dim smallnote">5:00 · auto-extract at the bell · dying forfeits the satchel</p>
          </>
        )}

        {tab === 'gear' && (
          <>
            {SLOTS.map((slot) => {
              const it = s.equipment[slot]
              return it ? (
                <ItemCard key={slot} it={it}>
                  {it.tier < tierFor(s.deepest) && (
                    <div className="evchoices">
                      <button className="buy" disabled={s.shards < B.TIERUP_SHARDS || s.gold < B.TIERUP_GOLD} onClick={() => g.craftTierUp(it.id)}>
                        Tier up {B.TIERUP_SHARDS}🔷+{B.TIERUP_GOLD}g
                      </button>
                    </div>
                  )}
                </ItemCard>
              ) : (
                <div key={slot} className="item r-common empty">
                  <div className="iname">{SLOT_ICON[slot]} <span className="dim">empty {slot}</span></div>
                </div>
              )
            })}
            {s.stash.length > 0 && <><h2>Stash</h2><Meter label="🎒 capacity" value={s.stash.length} max={B.STASH_CAP} color="#b07cf0" /></>}
            {s.stash.map((it) => (
              <ItemCard key={it.id} it={it} compare={it.unid ? undefined : s.equipment[it.slot]}>
                <div className="evchoices">
                  {it.unid ? (
                    <button className="buy" disabled={s.gold < B.IDENTIFY_COST} onClick={() => g.identify(it.id)}>ID {B.IDENTIFY_COST}g</button>
                  ) : (
                    <>
                      <button className="buy" onClick={() => g.equipItem(it.id)}>Equip</button>
                      {(it.rarity === 'magic' || it.rarity === 'rare') && (
                        <button className="buy" disabled={s.shards < B.REROLL_SHARDS} onClick={() => g.craftReroll(it.id)}>Reroll {B.REROLL_SHARDS}🔷</button>
                      )}
                    </>
                  )}
                  <button className="buy" onClick={() => g.shatterItem(it.id)}>Shatter</button>
                </div>
              </ItemCard>
            ))}
          </>
        )}

        {tab === 'skills' && (
          <div className="shop">
            {(Object.keys(B.SKILLS) as SkillId[]).map((id) => {
              const lvl = s.skills[id]
              const cost = B.skillCost(lvl)
              const maxed = lvl >= B.MAX_SKILL
              return (
                <button key={id} className="buy col" disabled={maxed || s.xp < cost} onClick={() => g.learnSkill(id)}>
                  <div className="buyrow">{B.SKILLS[id].name} <b>{B.SKILLS[id].desc(Math.max(1, lvl + (maxed ? 0 : 1)))}</b><span className="price">{maxed ? 'MAX' : `${cost}xp`}</span></div>
                  <Meter label="level" value={lvl} max={B.MAX_SKILL} color="#59b380" />
                  {!maxed && <Meter label="xp" value={Math.min(s.xp, cost)} max={cost} />}
                </button>
              )
            })}
          </div>
        )}

        {tab === 'shop' && (
          <>
            <h2>Supplies</h2>
            <div className="shop">
              {(Object.keys(B.SUPPLIES) as SupplyId[]).map((id) => (
                <button key={id} className="buy col" disabled={s.gold < B.supplyPrice(id, s.deepest)} onClick={() => g.buySupply(id)}>
                  <div className="buyrow">{B.SUPPLIES[id].name} ×{s.supplies[id]} <b>{B.SUPPLIES[id].desc}</b><span className="price">{B.supplyPrice(id, s.deepest)}g</span></div>
                  <Meter label="gold" value={Math.min(s.gold, B.supplyPrice(id, s.deepest))} max={B.supplyPrice(id, s.deepest)} color="#e0a33e" />
                </button>
              ))}
            </div>
            <h2>Gamble — 🔷{B.GAMBLE_COST} per unid rare</h2>
            <Meter label="🔷 shards" value={Math.min(s.shards, B.GAMBLE_COST)} max={B.GAMBLE_COST} color="#5bc8ef" />
            <div className="gamblerow">
              {SLOTS.map((slot) => (
                <button key={slot} className="buy" disabled={s.shards < B.GAMBLE_COST} onClick={() => g.gamble(slot)}>{SLOT_ICON[slot]}</button>
              ))}
            </div>
            <h2>Fuse — 3 unids → 1 better, 🔷{B.FUSE_SHARDS}</h2>
            <div className="shop">
              {['common', 'magic', 'rare'].map((rar) => {
                const n = s.stash.filter((i) => i.unid && i.rarity === rar).length
                return (
                  <button key={rar} className="buy col" disabled={n < 3 || s.shards < B.FUSE_SHARDS} onClick={() => g.craftFuse(rar)}>
                    <div className="buyrow">{rar} → {NEXT_RARITY[rar]}</div>
                    <Meter label="unids" value={Math.min(n, 3)} max={3} color="#b07cf0" />
                  </button>
                )
              })}
            </div>
          </>
        )}

        {tab === 'log' && (
          <div className="logbox">
            {s.log.map((l, i) => (
              <div key={s.log.length - i} className="logline">{l}</div>
            ))}
          </div>
        )}
      </div>

      <nav className="tabbar">
        {TABS.map(([id, icon, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            <span className="ticon">{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}

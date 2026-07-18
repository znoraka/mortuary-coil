import { useEffect, useRef } from 'react'
import { useGame, save } from './game/store'
import * as B from './game/balance'
import { bandFor } from './game/bands'
import { statsOf, tierFor, NEXT_RARITY } from './game/loot'
import type { Item, Direction, SkillId, Slot, SupplyId } from './game/types'

const SLOTS: Slot[] = ['weapon', 'armor', 'helm', 'boots', 'charm']
const SLOT_ICON: Record<Slot, string> = { weapon: '🗡️', armor: '🛡️', helm: '⛑️', boots: '🥾', charm: '🧿' }
const AFF_ICON: Record<string, string> = { gold: '💰', xp: '📖', loot: '🎁', none: '💀' }

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
        <span className="islot">{SLOT_ICON[it.slot]} T{it.tier}{it.rarity === 'rare' && !it.unid ? ` ${it.base}` : ''}</span>
      </div>
      {!it.unid && (
        <ul className="stats">
          <li className="implicit">{it.implicit.label}</li>
          {it.affixes.map((a, i) => (
            <li key={i}>{a.label}</li>
          ))}
        </ul>
      )}
      {!it.unid && compare !== undefined && (
        <div className="cmp">{compare ? `score ${it.score} vs equipped ${compare.score}` : `score ${it.score} — slot empty`}</div>
      )}
      {children}
    </div>
  )
}

function fmt(sec: number) {
  const s = Math.max(0, Math.ceil(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function App() {
  useGameLoop()
  const s = useGame((g) => g.state)
  const g = useGame()
  const stats = statsOf(s.equipment)

  // ---------- DESCENT ----------
  if (s.run) {
    const r = s.run
    const band = bandFor(r.floor)
    const hpPct = Math.max(0, (r.hp / B.MAX_HP) * 100)
    const dirs: [Direction, string][] = [['up', '▲ Up'], ['down', '▼ Down'], ['farm', '■ Farm']]
    return (
      <div className="app">
        <header>
          <span>FLOOR {r.floor}</span>
          <span className="dim">{AFF_ICON[band.affinity]} {band.name}{band.affinity === 'loot' ? ` +${band.mult}% MF` : band.affinity !== 'none' ? ` ×${band.mult}` : ''}{r.alarm ? ` · 🔔${r.alarm}` : ''}</span>
        </header>

        <div className="lifebox">
          <div className="lifelabel">
            <span>⏱ {fmt(r.timeLeft)}</span>
            <span className="dim">{r.plungeFloors > 0 ? `PLUNGE ×2 · escape ${Math.round((0.9 - B.PLUNGE_RISK * r.plungeFloors) * 100)}%` : 'auto-extract at 0:00'}</span>
          </div>
          <div className="track"><div className="fill tfill" style={{ width: `${(r.timeLeft / B.RUN_SECONDS) * 100}%` }} /></div>
          <div className="lifelabel" style={{ marginTop: 8 }}>
            <span>❤️ {Math.ceil(r.hp)}</span>
            <span className="dim">{r.transitionLeft > 0 ? 'moving between floors…' : `clearing floor (${B.KILLS_PER_FLOOR + r.floor} kills)`}</span>
          </div>
          <div className="track life"><div className="fill" style={{ width: `${hpPct}%`, background: hpPct < 25 ? '#e0645c' : '#c94f8c' }} /></div>
          <div className="track" style={{ marginTop: 8 }}><div className="fill act" style={{ width: `${r.progress * 100}%` }} /></div>
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
          <span>🎒 {r.satchel.length}/{B.BASE_SATCHEL + s.skills.packrat}</span>
        </div>

        {r.undo && (
          <div className={`undo ${r.undo.kind}`}>
            {r.undo.kind === 'kept' ? `Kept ${r.undo.item.name}` : `Shattered ${r.undo.item.name}`}
            {r.undo.replaced ? ` (over ${r.undo.replaced.name})` : ''}
            <button onClick={g.undoDrop}>Undo</button>
          </div>
        )}

        <section className="logbox">
          <h2>The record</h2>
          {s.log.map((l, i) => (
            <div key={s.log.length - i} className="logline">{l}</div>
          ))}
        </section>
      </div>
    )
  }

  // ---------- PREPARATION ----------
  return (
    <div className="app">
      <header>
        <span>OSSUARY DEPTHS</span>
        <span className="dim">depth {s.deepest} · {s.deaths}☠ · {s.runsDone} runs</span>
      </header>

      {s.lastRunSummary && (
        <div className="card report" onClick={g.dismissSummary}>{s.lastRunSummary} <span className="dim">(tap to dismiss)</span></div>
      )}

      <div className="chips">
        <span>💰 {s.gold}g</span>
        <span>🔷 {s.shards}</span>
        <span>📖 {s.xp} xp</span>
        <span>⚔ {stats.dmg} · 🛡 {stats.armor + 4 * s.skills.skin} · 🔮 {stats.mf}%</span>
      </div>

      <section>
        <h2>Descent — 5:00, then the Spindle spits you out</h2>
        <div className="wprow">
          {s.waypoints.map((w) => (
            <button key={w} className={`wp ${s.startFloor === w ? 'sel' : ''}`} onClick={() => g.setStartFloor(w)}>{w}</button>
          ))}
        </div>
        <div className="loadout">
          {s.loadout.map((id, slot) => (
            <select key={slot} value={id ?? ''} onChange={(e) => g.setLoadout(slot, (e.target.value || null) as SupplyId | null)}>
              <option value="">— empty slot —</option>
              {(Object.keys(B.SUPPLIES) as SupplyId[]).map((sid) => (
                <option key={sid} value={sid} disabled={s.supplies[sid] < 1 && id !== sid}>
                  {B.SUPPLIES[sid].name} (×{s.supplies[sid]})
                </option>
              ))}
            </select>
          ))}
        </div>
        <button className="big go" onClick={g.startRun}>Begin the Descent — floor {s.startFloor}</button>
      </section>

      <section>
        <h2>Skills — 📖 {s.xp} xp</h2>
        <div className="shop">
          {(Object.keys(B.SKILLS) as SkillId[]).map((id) => {
            const lvl = s.skills[id]
            const cost = B.skillCost(lvl)
            const maxed = lvl >= B.MAX_SKILL
            return (
              <button key={id} className="buy" disabled={maxed || s.xp < cost} onClick={() => g.learnSkill(id)}>
                {B.SKILLS[id].name} {lvl > 0 && `L${lvl}`} <b>{B.SKILLS[id].desc(Math.max(1, lvl + (maxed ? 0 : 1)))}</b>
                <span className="price">{maxed ? 'MAX' : `${cost}xp`}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h2>Supplies</h2>
        <div className="shop">
          {(Object.keys(B.SUPPLIES) as SupplyId[]).map((id) => (
            <button key={id} className="buy" disabled={s.gold < B.supplyPrice(id, s.deepest)} onClick={() => g.buySupply(id)}>
              {B.SUPPLIES[id].name} ×{s.supplies[id]} <b>{B.SUPPLIES[id].desc}</b>
              <span className="price">{B.supplyPrice(id, s.deepest)}g</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Equipment</h2>
        {SLOTS.map((slot) => {
          const it = s.equipment[slot]
          return it ? (
            <ItemCard key={slot} it={it}>
              {it.tier < tierFor(s.deepest) && (
                <div className="evchoices">
                  <button className="buy" disabled={s.shards < B.TIERUP_SHARDS || s.gold < B.TIERUP_GOLD} onClick={() => g.craftTierUp(it.id)}>
                    Tier up ({B.TIERUP_SHARDS}🔷+{B.TIERUP_GOLD}g)
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
      </section>

      {s.stash.length > 0 && (
        <section>
          <h2>Stash ({s.stash.length}/{B.STASH_CAP})</h2>
          {s.stash.map((it) => (
            <ItemCard key={it.id} it={it} compare={it.unid ? undefined : s.equipment[it.slot]}>
              <div className="evchoices">
                {it.unid ? (
                  <button className="buy" disabled={s.gold < B.IDENTIFY_COST} onClick={() => g.identify(it.id)}>Identify ({B.IDENTIFY_COST}g)</button>
                ) : (
                  <>
                    <button className="buy" onClick={() => g.equipItem(it.id)}>Equip</button>
                    {(it.rarity === 'magic' || it.rarity === 'rare') && (
                      <button className="buy" disabled={s.shards < B.REROLL_SHARDS} onClick={() => g.craftReroll(it.id)}>Reroll ({B.REROLL_SHARDS}🔷)</button>
                    )}
                  </>
                )}
                <button className="buy" onClick={() => g.shatterItem(it.id)}>Shatter</button>
              </div>
            </ItemCard>
          ))}
        </section>
      )}

      <section>
        <h2>Gamble &amp; Fuse</h2>
        <div className="gamblerow">
          {SLOTS.map((slot) => (
            <button key={slot} className="buy" disabled={s.shards < B.GAMBLE_COST} onClick={() => g.gamble(slot)} title={`unid rare ${slot}`}>
              {SLOT_ICON[slot]}
            </button>
          ))}
        </div>
        <p className="dim smallnote">🔷{B.GAMBLE_COST} per unidentified rare of that slot</p>
        <div className="evchoices">
          {['common', 'magic', 'rare'].map((rar) => {
            const n = s.stash.filter((i) => i.unid && i.rarity === rar).length
            return (
              <button key={rar} className="buy" disabled={n < 3 || s.shards < B.FUSE_SHARDS} onClick={() => g.craftFuse(rar)}>
                Fuse 3 {rar} → 1 {NEXT_RARITY[rar]} ({n}/3)
              </button>
            )
          })}
        </div>
      </section>

      <section className="logbox">
        <h2>The record</h2>
        {s.log.map((l, i) => (
          <div key={s.log.length - i} className="logline">{l}</div>
        ))}
      </section>
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { useGame, save } from './game/store'
import * as B from './game/balance'
import { statsOf } from './game/loot'
import type { Item, RouteId, Slot } from './game/types'

const SLOTS: Slot[] = ['weapon', 'armor', 'helm', 'boots', 'charm']
const SLOT_ICON: Record<Slot, string> = { weapon: '🗡️', armor: '🛡️', helm: '⛑️', boots: '🥾', charm: '🧿' }

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
        {it.unid ? '❓ Unidentified' : it.name}
        <span className="islot">{SLOT_ICON[it.slot]} {it.rarity}{it.rarity === 'rare' && !it.unid ? ` ${it.base}` : ''}</span>
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

export default function App() {
  useGameLoop()
  const s = useGame((g) => g.state)
  const g = useGame()
  const stats = statsOf(s.equipment)

  // ---------- RUN SCREEN ----------
  if (s.run) {
    const r = s.run
    const route = B.ROUTES[r.routeId]
    const hpPct = Math.max(0, (r.hp / B.MAX_HP) * 100)
    return (
      <div className="app">
        <header>
          <span>FLOOR {r.floor}{route.bossAt === r.floor ? ' — THE BARON' : ''}</span>
          <span className="dim">{route.name}</span>
        </header>

        <div className="lifebox">
          <div className="lifelabel">
            <span>❤️ {Math.ceil(r.hp)}</span>
            <span className="dim">draining −{(B.BASE_DRAIN + B.DRAIN_PER_FLOOR * r.floor).toFixed(1)}/s</span>
          </div>
          <div className="track life">
            <div className="fill" style={{ width: `${hpPct}%`, background: hpPct < 25 ? '#e0645c' : '#c94f8c' }} />
          </div>
        </div>

        <div className="chips">
          <span>💰 {r.goldFound}g</span>
          <span>🔷 {r.shardsFound}</span>
          <span>🎒 {r.satchel.length}/{B.SATCHEL_SIZE}</span>
          <span>⚔ {Math.floor(r.kills)}</span>
        </div>

        {r.pendingDrop ? (
          <section className="event">
            <h2>Loot!</h2>
            <ItemCard it={r.pendingDrop} compare={s.equipment[r.pendingDrop.slot]}>
              <div className="evchoices">
                <button className="buy" onClick={g.keepDrop}>Keep</button>
                <button className="buy" onClick={g.shatterDrop}>Shatter (+{B.SHATTER_VALUE[r.pendingDrop.rarity]}🔷)</button>
              </div>
            </ItemCard>
            <p className="dim smallnote">your heart keeps draining while you dither</p>
          </section>
        ) : r.awaitingDescend ? (
          <section className="event contract">
            <h2>Floor {r.floor} cleared</h2>
            <p className="evtext">{r.bossFloor ? 'Something large rearranges bones below.' : `Floor ${r.floor + 1} waits below, at −${(B.BASE_DRAIN + B.DRAIN_PER_FLOOR * (r.floor + 1)).toFixed(1)}/s and worse company.`}</p>
            <div className="evchoices">
              <button className="buy" onClick={g.descend}>Descend</button>
              <button className="buy" onClick={g.extract}>Extract (bank it all)</button>
            </div>
          </section>
        ) : (
          <section>
            <h2>Clearing floor {r.floor}</h2>
            <div className="track">
              <div className="fill act" style={{ width: `${r.progress * 100}%` }} />
            </div>
          </section>
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

  // ---------- TOWN SCREEN ----------
  return (
    <div className="app">
      <header>
        <span>OSSUARY DEPTHS</span>
        <span className="dim">depth record {s.deepest} · {s.deaths}☠</span>
      </header>

      {s.lastRunSummary && (
        <div className="card report" onClick={g.dismissSummary}>
          {s.lastRunSummary} <span className="dim">(tap to dismiss)</span>
        </div>
      )}

      <div className="chips">
        <span>💰 {s.gold}g</span>
        <span>🔷 {s.shards} shards</span>
        <span>⚔ +{stats.dmg} · 🛡 {stats.armor} · 🍷 {stats.vamp} · 🔮 {stats.mf}%</span>
      </div>

      <section>
        <h2>Descend</h2>
        <div className="shop">
          {(Object.keys(B.ROUTES) as RouteId[]).map((id) => {
            const rt = B.ROUTES[id]
            const locked = s.deepest < rt.unlock
            return (
              <button key={id} className="buy" disabled={locked} onClick={() => g.startRun(id)}>
                🕳️ {rt.name} <b>{locked ? `reach depth ${rt.unlock}` : rt.blurb}</b>
                <span className="price">go</span>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h2>Equipment</h2>
        {SLOTS.map((slot) => {
          const it = s.equipment[slot]
          return it ? (
            <ItemCard key={slot} it={it} />
          ) : (
            <div key={slot} className="item r-common empty">
              <div className="iname">{SLOT_ICON[slot]} <span className="dim">empty {slot}</span></div>
            </div>
          )
        })}
      </section>

      {s.unids.length > 0 && (
        <section>
          <h2>The bench ({s.unids.length})</h2>
          {s.unids.map((it) => (
            <ItemCard key={it.id} it={it} compare={it.unid ? undefined : s.equipment[it.slot]}>
              <div className="evchoices">
                {it.unid ? (
                  <button className="buy" disabled={s.gold < B.IDENTIFY_COST} onClick={() => g.identify(it.id)}>
                    Identify ({B.IDENTIFY_COST}g)
                  </button>
                ) : (
                  <button className="buy" onClick={() => g.equipFromSatchelOrUnids(it.id)}>Equip</button>
                )}
                <button className="buy" onClick={() => g.shatterItem(it.id)}>Shatter</button>
              </div>
            </ItemCard>
          ))}
        </section>
      )}

      <section>
        <h2>Gamble — 🔷{B.GAMBLE_COST} for an unidentified rare</h2>
        <div className="gamblerow">
          {SLOTS.map((slot) => (
            <button key={slot} className="buy" disabled={s.shards < B.GAMBLE_COST} onClick={() => g.gamble(slot)}>
              {SLOT_ICON[slot]}
            </button>
          ))}
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

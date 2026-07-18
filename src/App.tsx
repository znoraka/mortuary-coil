import { useEffect, useRef, useState } from 'react'
import { useGame, save, BOONS } from './game/store'
import * as B from './game/balance'
import { ZONES, EVENTS } from './game/data'
import type { ActivityId } from './game/types'

const ACTIVITIES: { id: ActivityId; icon: string; name: string; blurb: string }[] = [
  { id: 'slay', icon: '⚔️', name: 'Slay', blurb: 'gold & legacy — costs blood' },
  { id: 'train', icon: '💪', name: 'Train', blurb: 'survive deeper zones' },
  { id: 'contemplate', icon: '🕯️', name: 'Contemplate', blurb: 'pure legacy, no gold' },
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
    const saver = setInterval(persist, 10000)
    document.addEventListener('visibilitychange', persist)
    return () => {
      clearInterval(id)
      clearInterval(saver)
      document.removeEventListener('visibilitychange', persist)
    }
  }, [advance])
}

export default function App() {
  useGameLoop()
  const s = useGame((g) => g.state)
  const g = useGame()
  const [pickedBoon, setPickedBoon] = useState<string>(BOONS[0].id)

  const lifePct = (s.heartbeats / s.maxHeartbeats) * 100
  const drainPerSec = (B.drainAt(s.ticksLived, s.wounds) * 1000) / B.TICK_MS
  const tombPrice = B.TOMB_BASE_PRICE * (s.tombLevel + 1)
  const mult = B.legacyMult(s.totalLegacy)
  const eventDef = s.pendingEvent ? EVENTS.find((e) => e.id === s.pendingEvent!.defId) : null

  if (s.dead) {
    const tombBonus = 1 + s.tombLevel * B.TOMB_LEGACY_BONUS
    const banked = Math.floor(s.legacy * tombBonus * (s.reaperDebt > 0 ? B.DEBT_LEGACY_CUT : 1))
    return (
      <div className="app death">
        <h1>☠️ You Have Died</h1>
        <p className="deadline">{s.causeOfDeath}</p>
        <div className="card">
          <p>
            Incarnation {s.incarnation} — {s.kills} slain, {s.legacy} Legacy earned → <b>{banked} banked</b>
            {s.tombLevel > 0 && <> (tomb +{s.tombLevel * 25}%)</>}
            {s.reaperDebt > 0 && (
              <>
                <br />
                <span className="warn">The Reaper takes 25%, plus {s.reaperDebt} heartbeats off your next life.</span>
              </>
            )}
          </p>
        </div>
        <h2 className="boonhead">Choose a boon for your next incarnation</h2>
        <div className="boons">
          {BOONS.map((b) => (
            <button key={b.id} className={`boon ${pickedBoon === b.id ? 'sel' : ''}`} onClick={() => setPickedBoon(b.id)}>
              <b>{b.name}</b>
              <span>{b.desc}</span>
            </button>
          ))}
        </div>
        <button className="big reborn" onClick={() => g.rebirth(pickedBoon)}>
          Be Reborn
        </button>
      </div>
    )
  }

  return (
    <div className="app">
      <header>
        <span>MORTUARY COIL</span>
        <span className="dim">
          life #{s.incarnation} · legacy ×{mult.toFixed(2)}
          {s.boon ? ` · ${BOONS.find((b) => b.id === s.boon)?.name ?? ''}` : ''}
        </span>
      </header>

      <div className="lifebox">
        <div className="lifelabel">
          <span>
            ❤️ {Math.ceil(s.heartbeats).toLocaleString()} <span className="dim">−{drainPerSec.toFixed(1)}/s</span>
          </span>
          <span>
            {s.wounds > 0 && <span className="warn">🩸×{s.wounds} </span>}
            {s.reaperDebt > 0 && <span className="warn">☠ {s.reaperDebt}</span>}
          </span>
        </div>
        <div className="track life">
          <div className="fill" style={{ width: `${lifePct}%`, background: lifePct < 20 ? '#e0645c' : '#c94f8c' }} />
        </div>
      </div>

      <div className="chips">
        <span>💰 {s.gold}g</span>
        <span>🏺 {s.legacy}</span>
        <span>⚡ {s.power}</span>
        <span>⚔ {s.kills}</span>
      </div>

      {eventDef && (
        <section className="event">
          <h2>A decision presents itself</h2>
          <p className="evtext">{eventDef.text}</p>
          <div className="evchoices">
            {eventDef.choices.map((c, i) => (
              <button key={i} className="buy" disabled={!!c.gold && c.gold < 0 && s.gold < -c.gold} onClick={() => g.chooseEvent(i)}>
                {c.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {s.contractOffer && (
        <section className="event contract">
          <h2>Contract offer</h2>
          <p className="evtext">
            {s.contractOffer.text} <b>+{s.contractOffer.rewardLegacy} Legacy</b> — deadline{' '}
            {Math.round((s.contractOffer.kills * 90 * B.TICK_MS) / 1000)}s.
          </p>
          <div className="evchoices">
            <button className="buy" onClick={g.acceptContract}>Sign</button>
            <button className="buy" onClick={g.declineContract}>Decline</button>
          </div>
        </section>
      )}

      {s.contract && (
        <div className="contractbar">
          <span>
            📜 {s.contract.done}/{s.contract.kills} kills
          </span>
          <span className={s.contract.deadline - s.ticksLived < 200 ? 'warn' : 'dim'}>
            {Math.max(0, Math.round(((s.contract.deadline - s.ticksLived) * B.TICK_MS) / 1000))}s left · +{s.contract.rewardLegacy} 🏺
          </span>
        </div>
      )}

      <section>
        <h2>Hunting ground</h2>
        <div className="zones">
          {ZONES.map((z) => {
            const outmatched = s.power < z.minPower
            return (
              <button key={z.id} className={`zone ${s.zoneId === z.id ? 'sel' : ''}`} onClick={() => g.setZone(z.id)}>
                <b>{z.name}</b>
                <span className={outmatched ? 'warn' : 'dim'}>
                  ×{z.rewardMult} loot · {outmatched ? `wants ${z.minPower}⚡` : 'manageable'}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h2>Spend your heartbeats on…</h2>
        {ACTIVITIES.map((a) => (
          <button key={a.id} className={`activity ${s.activity === a.id ? 'active' : ''}`} onClick={() => g.setActivity(a.id)}>
            <div className="actrow">
              <span>
                {a.icon} {a.name}
              </span>
              <span className="dim">{a.blurb}</span>
            </div>
            <div className="track">
              <div className="fill act" style={{ width: s.activity === a.id ? `${s.bar * 100}%` : '0%' }} />
            </div>
          </button>
        ))}
      </section>

      <section>
        <h2>Spend your gold on…</h2>
        <div className="shop">
          <button className="buy" disabled={s.gold < s.bandagePrice || s.wounds < 1} onClick={g.buyBandage}>
            🩹 Bandage <b>close 1 wound</b>
            <span className="price">{s.bandagePrice}g</span>
          </button>
          <button className="buy" disabled={s.gold < s.elixirPrice} onClick={g.buyElixir}>
            🧪 Elixir <b>+{B.ELIXIR_BEATS} beats</b>
            <span className="price">{s.elixirPrice}g</span>
          </button>
          <button className="buy" disabled={s.gold < tombPrice} onClick={g.buyTomb}>
            🪦 Vanity Tomb <b>+25% legacy at death</b>
            <span className="price">{tombPrice}g</span>
          </button>
          <button className="buy loan" onClick={g.takeLoan}>
            ☠️ Reaper Loan <b>+{B.LOAN_BEATS} beats now</b>
            <span className="price">−{B.LOAN_OWED} next life</span>
          </button>
        </div>
      </section>

      <section className="logbox">
        <h2>The record</h2>
        {s.log.map((l, i) => (
          <div key={s.log.length - i} className="logline">
            {l}
          </div>
        ))}
      </section>
    </div>
  )
}

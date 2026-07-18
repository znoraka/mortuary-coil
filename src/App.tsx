import { useEffect, useRef } from 'react'
import { useGame, save } from './game/store'
import * as B from './game/balance'
import type { ActivityId } from './game/types'

const ACTIVITIES: { id: ActivityId; icon: string; name: string; blurb: string }[] = [
  { id: 'slay', icon: '⚔️', name: 'Slay', blurb: 'gold & a little legacy' },
  { id: 'train', icon: '💪', name: 'Train', blurb: 'slay faster' },
  { id: 'contemplate', icon: '🕯️', name: 'Contemplate', blurb: 'pure legacy' },
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
  const { setActivity, buyHealer, buyTomb, takeLoan, rebirth } = useGame()

  const lifePct = (s.heartbeats / s.maxHeartbeats) * 100
  const tombPrice = B.TOMB_BASE_PRICE * (s.tombLevel + 1)
  const mult = B.legacyMult(s.totalLegacy)

  if (s.dead) {
    return (
      <div className="app death">
        <h1>☠️ You Have Died</h1>
        <p className="deadline">Your heart has completed its contractual obligations.</p>
        <div className="card">
          <p>
            Incarnation {s.incarnation} — {s.kills} slain, {s.legacy} Legacy earned
            {s.tombLevel > 0 && <>, tomb tier {s.tombLevel} (+{s.tombLevel * 25}%)</>}
            {s.reaperDebt > 0 && (
              <>
                <br />
                <span className="warn">
                  The Reaper takes his 25% cut, and {s.reaperDebt} heartbeats off your next life.
                </span>
              </>
            )}
          </p>
        </div>
        <button className="big reborn" onClick={rebirth}>
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
        </span>
      </header>

      <div className="lifebox">
        <div className="lifelabel">
          <span>❤️ {Math.ceil(s.heartbeats).toLocaleString()} heartbeats remain</span>
          {s.reaperDebt > 0 && <span className="warn">☠ owes {s.reaperDebt}</span>}
        </div>
        <div className="track life">
          <div
            className="fill"
            style={{ width: `${lifePct}%`, background: lifePct < 20 ? '#e0645c' : '#c94f8c' }}
          />
        </div>
      </div>

      <div className="chips">
        <span>💰 {s.gold}g</span>
        <span>🏺 {s.legacy} legacy</span>
        <span>⚡ power {s.power}</span>
        <span>⚔ {s.kills} slain</span>
      </div>

      <section>
        <h2>Spend your heartbeats on…</h2>
        {ACTIVITIES.map((a) => (
          <button
            key={a.id}
            className={`activity ${s.activity === a.id ? 'active' : ''}`}
            onClick={() => setActivity(a.id)}
          >
            <div className="actrow">
              <span>
                {a.icon} {a.name}
              </span>
              <span className="dim">{a.blurb}</span>
            </div>
            <div className="track">
              <div
                className="fill act"
                style={{ width: s.activity === a.id ? `${s.bar * 100}%` : '0%' }}
              />
            </div>
          </button>
        ))}
      </section>

      <section>
        <h2>Spend your gold on…</h2>
        <div className="shop">
          <button className="buy" disabled={s.gold < s.healerPrice} onClick={buyHealer}>
            🧪 Healer <b>+{B.HEALER_BEATS} beats</b>
            <span className="price">{s.healerPrice}g</span>
          </button>
          <button className="buy" disabled={s.gold < tombPrice} onClick={buyTomb}>
            🪦 Vanity Tomb <b>+25% legacy at death</b>
            <span className="price">{tombPrice}g</span>
          </button>
          <button className="buy loan" onClick={takeLoan}>
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

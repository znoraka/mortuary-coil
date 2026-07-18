export const MONSTERS = [
  'Moderately Damp Ghoul',
  'Passive-Aggressive Wraith',
  'Unlicensed Bone Merchant',
  'Clerical-Error Demon',
  'Free-Range Skeleton',
  'Probate Lich',
  'Load-Bearing Mimic',
  'Gently Used Mummy',
]

export const DEATH_LINES = [
  'You die as you lived: slightly too deep.',
  'The floor claims another optimist.',
  'Your satchel is redistributed to local skeletons.',
  'An actuary somewhere nods, vindicated.',
]

export const EXTRACT_LINES = [
  'You surface, blinking, richer and only mildly haunted.',
  'The portal fee was worth it. Probably.',
  'Daylight. Loot. A functioning pulse. A good day.',
]

export const BOSS_INTRO = 'The Bonepile Baron rises, adjusting his cravat of vertebrae.'

export const ELITE_PREFIXES = ['Gilded', 'Ravenous', 'Thrice-Buried', 'Litigious', 'Incandescent', 'Unionized']

import type { GameState, RunState, ShrineChoice } from './types'
import * as B from './balance'

interface ShrineDef {
  id: string
  text: string
  choices: ShrineChoice[]
  apply: ((s: GameState, r: RunState, rng: () => number) => void)[]
}

export const SHRINES: ShrineDef[] = [
  {
    id: 'blood',
    text: 'A Blood Shrine gurgles invitingly.',
    choices: [
      { label: 'Bleed (−25 HP)', outcome: 'gold burst' },
      { label: 'Refuse', outcome: '' },
    ],
    apply: [
      (s, r) => {
        r.hp -= 25
        const g = Math.round(30 * Math.pow(B.REWARD_GROWTH, r.floor))
        r.goldFound += g
        s.log = [`The shrine drinks. It tips ${g}g. Fair trade, probably.`, ...s.log].slice(0, 60)
      },
      () => {},
    ],
  },
  {
    id: 'gilded',
    text: 'A Gilded Shrine hums with acquisitive energy.',
    choices: [
      { label: 'Tithe 30% of run gold', outcome: '+60% MF, 60s' },
      { label: 'Keep the gold', outcome: '' },
    ],
    apply: [
      (s, r) => {
        r.goldFound = Math.floor(r.goldFound * 0.7)
        r.mfBuffUntil = r.timeLeft - 60
        r.suppliesUsed = { ...r.suppliesUsed, torch: true }
        s.log = ['The shrine accepts your tithe. Your eyes glitter unnaturally (+MF).', ...s.log].slice(0, 60)
      },
      () => {},
    ],
  },
  {
    id: 'whisper',
    text: 'A Whispering Skull offers tutoring.',
    choices: [
      { label: 'Listen (+alarm)', outcome: 'xp burst' },
      { label: 'Plug ears', outcome: '' },
    ],
    apply: [
      (s, r) => {
        const xp = Math.round(25 * Math.pow(B.REWARD_GROWTH, r.floor))
        r.xpFound += xp
        r.alarm = Math.min(B.MAX_ALARM, r.alarm + 2)
        s.log = [`The skull lectures loudly. +${xp}xp, and everything heard it.`, ...s.log].slice(0, 60)
      },
      () => {},
    ],
  },
  {
    id: 'gambler',
    text: 'A skeletal hand emerges from the wall, holding dice.',
    choices: [
      { label: 'Roll (10🔷 stake)', outcome: 'triple or nothing' },
      { label: 'Decline', outcome: '' },
    ],
    apply: [
      (s, r, rng) => {
        if (r.shardsFound < 10) return
        r.shardsFound -= 10
        if (rng() < 0.45) {
          r.shardsFound += 30
          s.log = ['The dice come up skulls. +30🔷. The hand seems annoyed.', ...s.log].slice(0, 60)
        } else {
          s.log = ['The dice come up ribs. The hand waves goodbye with your shards.', ...s.log].slice(0, 60)
        }
      },
      () => {},
    ],
  },
  {
    id: 'mercy',
    text: 'A Shrine of Dubious Mercy glows softly.',
    choices: [
      { label: 'Pray (−15% run gold)', outcome: 'full heal' },
      { label: 'Stay proud', outcome: '' },
    ],
    apply: [
      (s, r) => {
        r.goldFound = Math.floor(r.goldFound * 0.85)
        r.hp = B.MAX_HP
        s.log = ['Mercy granted, invoice attached. Full HP.', ...s.log].slice(0, 60)
      },
      () => {},
    ],
  },
]

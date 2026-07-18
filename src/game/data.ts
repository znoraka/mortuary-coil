export interface ZoneDef {
  id: string
  name: string
  minPower: number // matched power → modest damage; below → maulings
  rewardMult: number // gold & legacy multiplier
  danger: number // base heartbeat damage per exchange
}

export const ZONES: ZoneDef[] = [
  { id: 'vestibule', name: 'Mossy Vestibule', minPower: 0, rewardMult: 1, danger: 6 },
  { id: 'ossuary', name: 'Sunken Ossuary', minPower: 18, rewardMult: 2.2, danger: 40 },
  { id: 'galleries', name: 'Marrow Galleries', minPower: 45, rewardMult: 4.5, danger: 120 },
  { id: 'waitingroom', name: "The Reaper's Waiting Room", minPower: 90, rewardMult: 9, danger: 320 },
]

export interface EventChoice {
  label: string
  // flat deltas applied on pick
  gold?: number
  beats?: number
  legacy?: number
  wounds?: number
  power?: number
  outcome: string
}

export interface EventDef {
  id: string
  text: string
  choices: EventChoice[]
}

export const EVENTS: EventDef[] = [
  {
    id: 'relic',
    text: 'A cursed relic hums in the rubble. It promises wealth and radiates tetanus.',
    choices: [
      { label: 'Grab it', gold: 90, wounds: 1, outcome: 'Wealth acquired. Also lockjaw (+1 wound).' },
      { label: 'Leave it', legacy: 3, outcome: 'Restraint. Very legacy-core of you.' },
    ],
  },
  {
    id: 'beggar',
    text: 'A skeletal beggar rattles a cup. He claims to be "between hauntings."',
    choices: [
      { label: 'Give 50g', gold: -50, legacy: 8, outcome: 'He blesses your obituary (+8 Legacy).' },
      { label: 'Refuse', outcome: 'He writes your name in a small, ominous book.' },
    ],
  },
  {
    id: 'shortcut',
    text: 'A tunnel marked "SHORTCUT (structurally optimistic)".',
    choices: [
      { label: 'Take it', beats: 250, wounds: 1, outcome: 'You save time and a ceiling finds you (+250 beats, +1 wound).' },
      { label: 'Go around', beats: -60, outcome: 'The long way. Your knees file a report (−60 beats).' },
    ],
  },
  {
    id: 'quack',
    text: 'A back-alley chirurgeon offers "experimental cardio." His apron is concerning.',
    choices: [
      { label: 'Pay 80g', gold: -80, beats: 500, outcome: 'Unlicensed, effective (+500 beats).' },
      { label: 'Pay in blood', beats: 350, wounds: 2, outcome: 'He takes "a sample" (+350 beats, +2 wounds).' },
      { label: 'Decline', outcome: 'He shrugs and reorganizes his saws.' },
    ],
  },
  {
    id: 'gambler',
    text: 'A ghost proposes cards. He is transparent about everything except the odds.',
    choices: [
      { label: 'Bet 100g', gold: 120, outcome: 'You win! He pays in slightly haunted coins (+120g net).' },
      { label: 'Bet your vigor', power: -8, gold: 200, outcome: 'You win gold, lose form (−8 power, +200g).' },
      { label: 'Fold', legacy: 1, outcome: 'The wisest hand is the one not played (+1 Legacy).' },
    ],
  },
  {
    id: 'trainer',
    text: 'A retired mercenary offers a masterclass: "Stabbing: Theory and Practice."',
    choices: [
      { label: 'Pay 70g', gold: -70, power: 6, outcome: 'Tuition hurts less than swords (+6 power).' },
      { label: 'Spar instead', power: 4, wounds: 1, outcome: 'Practical exam (+4 power, +1 wound).' },
    ],
  },
  {
    id: 'tax',
    text: 'The Necropolis Revenue Service materializes. You are being audited posthumously in advance.',
    choices: [
      { label: 'Pay 60g', gold: -60, outcome: 'Compliance. The stamp is skull-shaped.' },
      { label: 'Contest it', beats: -180, outcome: 'You win, eventually. The queue costs 180 beats.' },
    ],
  },
  {
    id: 'muse',
    text: 'A muse offers to embellish your legend. Artistic license included.',
    choices: [
      { label: 'Commission (120g)', gold: -120, legacy: 15, outcome: 'Your deeds, now 40% more heroic (+15 Legacy).' },
      { label: 'Live authentically', outcome: 'Honesty. History will misquote you anyway.' },
    ],
  },
]

export interface ContractDef {
  kills: number
  deadlineTicks: number
  rewardLegacy: number
  text: string
}

#!/usr/bin/env node
'use strict'

/**
 * Simulation RTP — ways243 slot
 * Usage : node scripts/simulateRTP.js [nb_spins]
 * Exemple : node scripts/simulateRTP.js 5000000
 *
 * Note : utilise Math.random (pas crypto) pour la vitesse.
 *        Le RTP est identique ; seule la sécurité cryptographique change.
 */

const path   = require('path')
const config = require(path.join(__dirname, '../config/slotConfig'))
const { PAYING_SYMBOLS, PAYTABLE, REEL_STRIPS, ONI_JUMEAUX } = config

const N   = parseInt(process.argv[2] || '5000000', 10)
const BET = 243  // mise normalisée pour que bet/243 = 1 → lisibilité des mults

// ── Moteur de simulation (Math.random pour la vitesse) ───────────────────────

function spinReel(strip) {
  const pos = Math.floor(Math.random() * strip.length)
  return [
    strip[pos],
    strip[(pos + 1) % strip.length],
    strip[(pos + 2) % strip.length],
  ]
}

function pickOniJumeaux() {
  if (Math.random() >= ONI_JUMEAUX.triggerProb) return null
  const totalWeight = ONI_JUMEAUX.variants.reduce((s, v) => s + v.weight, 0)
  let pick = Math.random() * totalWeight
  let count = ONI_JUMEAUX.variants[0].count
  for (const v of ONI_JUMEAUX.variants) {
    if (pick < v.weight) { count = v.count; break }
    pick -= v.weight
  }
  const maxStart = 5 - count
  const start    = Math.floor(Math.random() * (maxStart + 1))
  return Array.from({ length: count }, (_, i) => start + i)
}

function generateGrid(oniReels) {
  const grid = []
  let twinColumn = null
  for (let r = 0; r < 5; r++) {
    if (oniReels && oniReels.includes(r)) {
      if (twinColumn === null) twinColumn = spinReel(REEL_STRIPS[r])
      grid.push([...twinColumn])
    } else {
      grid.push(spinReel(REEL_STRIPS[r]))
    }
  }
  return grid
}

function evaluateWin(grid, bet) {
  let total = 0
  const symbolWins = {}

  for (const sym of PAYING_SYMBOLS) {
    const countPerReel = grid.map(col =>
      col.filter(c => c === sym || c === 'WILD').length
    )
    let reelsCount = 0, ways = 1
    for (let r = 0; r < 5; r++) {
      if (countPerReel[r] === 0) break
      reelsCount++
      ways *= countPerReel[r]
    }
    if (reelsCount >= 3 && PAYTABLE[sym]?.[reelsCount]) {
      const payout = Math.floor((bet / 243) * PAYTABLE[sym][reelsCount] * ways)
      if (payout > 0) {
        symbolWins[sym] = (symbolWins[sym] || 0) + payout
        total += payout
      }
    }
  }
  return { total, symbolWins }
}

// ── Statistiques ──────────────────────────────────────────────────────────────

let totalBet = 0
let totalWin = 0
let hits     = 0
let oniCount = 0

// Distribution des gains (en multiples de mise)
const buckets = {
  '0':        0,
  '0-0.5x':   0,
  '0.5-1x':   0,
  '1-2x':     0,
  '2-5x':     0,
  '5-10x':    0,
  '10-20x':   0,
  '20-50x':   0,
  '50x+':     0,
}

// Contribution par symbole
const symContrib = {}
for (const s of PAYING_SYMBOLS) symContrib[s] = 0

// Pour la variance
let sumWin2 = 0

const STEP = Math.max(1, Math.floor(N / 40))
const start = Date.now()

process.stdout.write('\n')

for (let i = 0; i < N; i++) {
  if (i % STEP === 0) {
    const pct = Math.round(i / N * 100)
    const bar = '█'.repeat(Math.floor(pct / 2.5)).padEnd(40, '░')
    process.stdout.write(`\r  [${bar}] ${pct}%  `)
  }

  const oniReels = pickOniJumeaux()
  if (oniReels) oniCount++

  const grid = generateGrid(oniReels)
  const { total, symbolWins } = evaluateWin(grid, BET)

  totalBet += BET
  totalWin += total
  sumWin2  += total * total

  if (total > 0) hits++

  for (const [s, v] of Object.entries(symbolWins)) {
    symContrib[s] = (symContrib[s] || 0) + v
  }

  const mult = total / BET
  if      (total === 0)   buckets['0']++
  else if (mult < 0.5)    buckets['0-0.5x']++
  else if (mult < 1)      buckets['0.5-1x']++
  else if (mult < 2)      buckets['1-2x']++
  else if (mult < 5)      buckets['2-5x']++
  else if (mult < 10)     buckets['5-10x']++
  else if (mult < 20)     buckets['10-20x']++
  else if (mult < 50)     buckets['20-50x']++
  else                    buckets['50x+']++
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1)

// ── Résultats ─────────────────────────────────────────────────────────────────

const rtp     = (totalWin / totalBet) * 100
const hitFreq = (hits / N) * 100
const meanWin = totalWin / N
const meanBet = BET
// Variance = E[X²] - E[X]²  (X = win)
const variance = sumWin2 / N - (meanWin * meanWin)
const stdDev   = Math.sqrt(variance)
const volatility = stdDev / meanBet  // coefficient de variation

console.log('\n\n' + '═'.repeat(56))
console.log('  🎰  RÉSULTATS SIMULATION — ways243')
console.log('═'.repeat(56))
console.log(`  Spins simulés       : ${N.toLocaleString('fr-FR')}  (${elapsed}s)`)
console.log(`  RTP                 : ${rtp.toFixed(3)}%  ${rtp >= 90.5 && rtp <= 91.5 ? '✅' : rtp < 90 ? '⬇  trop bas' : '⬆  trop haut'}`)
console.log(`  Fréquence de hit    : ${hitFreq.toFixed(2)}%  ${hitFreq >= 25 && hitFreq <= 35 ? '✅' : '⚠'}`)
console.log(`  Déclenchements Oni  : ${(oniCount / N * 100).toFixed(2)}%  (cible ~15%)`)
console.log(`  Volatilité (σ/mise) : ${volatility.toFixed(2)}`)
console.log()

console.log('  Distribution des gains :')
const maxBar = Math.max(...Object.values(buckets))
for (const [label, count] of Object.entries(buckets)) {
  const pct    = count / N * 100
  const barLen = Math.round(count / maxBar * 30)
  const bar    = '█'.repeat(barLen).padEnd(30, '░')
  console.log(`    ${label.padEnd(9)} ${bar}  ${pct.toFixed(2).padStart(6)}%  (${count.toLocaleString('fr-FR')})`)
}

console.log()
console.log('  Contribution RTP par symbole :')
const totalContrib = Object.values(symContrib).reduce((a, b) => a + b, 0)
const symSorted = Object.entries(symContrib).sort((a, b) => b[1] - a[1])
for (const [sym, contrib] of symSorted) {
  const pct      = (contrib / totalBet * 100).toFixed(3)
  const ofTotal  = totalContrib > 0 ? (contrib / totalContrib * 100).toFixed(1) : '0.0'
  console.log(`    ${sym.padEnd(10)} ${pct.padStart(7)}%  (${ofTotal}% du total des gains)`)
}

console.log()
console.log('  Paliers :')
const bigWin  = Object.entries(buckets).filter(([k]) => ['10-20x','20-50x','50x+'].includes(k)).reduce((s,[,v])=>s+v,0)
const megaWin = Object.entries(buckets).filter(([k]) => ['20-50x','50x+'].includes(k)).reduce((s,[,v])=>s+v,0)
const jackpot = buckets['50x+']
console.log(`    BIG WIN  (8x+)  : ${bigWin.toLocaleString('fr-FR')}  (1/${Math.round(N/bigWin) || '∞'})`)
console.log(`    MEGA WIN (20x+) : ${megaWin.toLocaleString('fr-FR')}  (1/${Math.round(N/megaWin) || '∞'})`)
console.log(`    JACKPOT  (50x+) : ${jackpot.toLocaleString('fr-FR')}  (1/${Math.round(N/jackpot) || '∞'})`)
console.log('═'.repeat(56))
console.log()

if (rtp < 90.5 || rtp > 91.5) {
  const diff = 91 - rtp
  console.log(`  ⚙  Ajustement suggéré : RTP à ${rtp.toFixed(2)}%, écart ${diff > 0 ? '+' : ''}${diff.toFixed(2)}pp`)
  if (rtp < 90.5) console.log('     → Augmenter les multiplicateurs (surtout KUNAI/MASQUE 3x et 4x)')
  if (rtp > 91.5) console.log('     → Réduire les multiplicateurs ou augmenter les fréquences basses')
}

'use strict'

const { randomInt } = require('crypto')
const db = require('../db')
const {
  PAYING_SYMBOLS, PAYTABLE, REEL_STRIPS, ONI_JUMEAUX,
  MISE_MIN, MISE_MAX, GAIN_JOURNALIER_MAX, BIG_WIN_TIERS,
} = require('../config/slotConfig')
const { hasMalchance, getMalchanceProb, logMalchance } = require('./malchanceService')

const ROWS  = 3
const REELS = 5

// ── RNG ───────────────────────────────────────────────────────────────────────

// Tire 3 symboles consécutifs depuis une position aléatoire du strip
function spinReel(strip) {
  const pos = randomInt(0, strip.length)
  return [
    strip[pos],
    strip[(pos + 1) % strip.length],
    strip[(pos + 2) % strip.length],
  ]
}

// ── Oni Jumeaux ───────────────────────────────────────────────────────────────

// Retourne un tableau d'indices de rouleaux jumeaux, ou null si pas déclenché
function pickOniJumeaux() {
  // triggerProb avec crypto (entier sur 10 000)
  if (randomInt(0, 10000) >= Math.round(ONI_JUMEAUX.triggerProb * 10000)) return null

  // Sélectionner le variant par poids
  const totalWeight = ONI_JUMEAUX.variants.reduce((s, v) => s + v.weight, 0)
  let pick = randomInt(0, totalWeight)
  let count = ONI_JUMEAUX.variants[0].count
  for (const v of ONI_JUMEAUX.variants) {
    if (pick < v.weight) { count = v.count; break }
    pick -= v.weight
  }

  // Choisir le rouleau de départ
  const maxStart = REELS - count
  const start    = randomInt(0, maxStart + 1)
  return Array.from({ length: count }, (_, i) => start + i)
}

// ── Génération de grille ──────────────────────────────────────────────────────

// Retourne grid[reel][row] = symbole
function generateGrid(oniReels) {
  const grid = []
  let twinColumn = null

  for (let r = 0; r < REELS; r++) {
    if (oniReels && oniReels.includes(r)) {
      // Premier rouleau du groupe : spin normal avec son propre strip
      if (twinColumn === null) {
        twinColumn = spinReel(REEL_STRIPS[r])
      }
      grid.push([...twinColumn])
    } else {
      grid.push(spinReel(REEL_STRIPS[r]))
    }
  }
  return grid
}

// ── Évaluation 243 Ways ───────────────────────────────────────────────────────

function evaluateWays(grid, mise) {
  const wins = []

  for (const sym of PAYING_SYMBOLS) {
    // Compter les occurrences du symbole (+ WILD en substitut) par rouleau
    const countPerReel = grid.map(col =>
      col.filter(cell => cell === sym || cell === 'WILD').length
    )

    // Rouleaux consécutifs depuis le rouleau 0
    let reelsCount = 0
    let ways       = 1
    for (let r = 0; r < REELS; r++) {
      if (countPerReel[r] === 0) break
      reelsCount++
      ways *= countPerReel[r]
    }

    if (reelsCount >= 3 && PAYTABLE[sym]?.[reelsCount]) {
      const payout = Math.floor((mise / 243) * PAYTABLE[sym][reelsCount] * ways)
      if (payout > 0) {
        wins.push({
          symbol:     sym,
          reelsCount,
          ways,
          payout,
          // Positions des cellules gagnantes (pour animation frontend)
          positions: grid.map((col, ri) =>
            ri < reelsCount
              ? col.reduce((acc, cell, row) => {
                  if (cell === sym || cell === 'WILD') acc.push(row)
                  return acc
                }, [])
              : []
          ),
        })
      }
    }
  }

  return wins
}

// ── Palier Big Win ────────────────────────────────────────────────────────────

function getBigWinTier(totalWin, mise) {
  if (mise === 0) return null
  const mult = totalWin / mise
  for (const tier of BIG_WIN_TIERS) {
    if (mult >= tier.minMult) return tier.name
  }
  return null
}

// ── Spin principal (transaction atomique) ─────────────────────────────────────

const _spin = db.transaction((userId, mise) => {
  // Vérifs
  const user = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId)
  if (!user)             throw new Error('Utilisateur introuvable.')
  if (user.solde < mise) throw new Error('Solde insuffisant.')

  // Limite gain journalier
  const gainJour = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN gain_net > 0 THEN gain_net ELSE 0 END), 0) as total
    FROM game_rounds
    WHERE user_id = ? AND jeu = 'ways243'
      AND created_at >= datetime('now', 'start of day')
  `).get(userId).total

  const solde_avant = user.solde
  db.prepare('UPDATE users SET solde = solde - ? WHERE id = ?').run(mise, userId)

  // Malchance
  const isMalchance = hasMalchance(userId) &&
    randomInt(0, 10000) < Math.round(getMalchanceProb(userId) * 10000)
  if (isMalchance) logMalchance(userId, 'ways243')

  // Oni Jumeaux
  const oniReels = pickOniJumeaux()

  // Génération + évaluation
  let grid, winningWays, totalWin

  if (isMalchance) {
    // Forcer une grille perdante (jusqu'à 20 tentatives)
    let essais = 0
    do {
      grid        = generateGrid(oniReels)
      winningWays = evaluateWays(grid, mise)
      totalWin    = winningWays.reduce((s, w) => s + w.payout, 0)
      essais++
    } while (totalWin > 0 && essais < 20)
    if (totalWin > 0) { winningWays = []; totalWin = 0 }
  } else {
    grid        = generateGrid(oniReels)
    winningWays = evaluateWays(grid, mise)
    totalWin    = winningWays.reduce((s, w) => s + w.payout, 0)
  }

  // Plafonnement gain journalier
  if (gainJour + totalWin > GAIN_JOURNALIER_MAX) {
    const plafond = Math.max(0, GAIN_JOURNALIER_MAX - gainJour)
    if (totalWin > plafond) {
      const ratio = plafond / totalWin
      winningWays = winningWays.map(w => ({ ...w, payout: Math.floor(w.payout * ratio) }))
      totalWin    = winningWays.reduce((s, w) => s + w.payout, 0)
    }
  }

  // Crédit
  if (totalWin > 0) {
    db.prepare('UPDATE users SET solde = solde + ? WHERE id = ?').run(totalWin, userId)
  }

  const gainNet    = totalWin - mise
  const solde_apres = solde_avant - mise + totalWin

  // Log
  db.prepare(`
    INSERT INTO game_rounds (user_id, jeu, mise, resultat, gain_net, solde_avant, solde_apres)
    VALUES (?, 'ways243', ?, ?, ?, ?, ?)
  `).run(
    userId, mise,
    JSON.stringify({ grid, winsCount: winningWays.length, oniReels }),
    gainNet, solde_avant, solde_apres,
  )

  const newBalance = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId).solde

  return {
    grid,
    winningWays,
    totalWin,
    twinReels:   oniReels,
    newBalance,
    bigWinTier:  getBigWinTier(totalWin, mise),
  }
})

function spin(userId, mise) { return _spin(userId, mise) }

module.exports = { spin, evaluateWays, generateGrid, pickOniJumeaux }

'use strict'

const db = require('../db')
const { hasMalchance, getMalchanceProb, logMalchance } = require('./malchanceService')

// ── Paytable ──────────────────────────────────────────────────────────────────
// [3x, 4x, 5x] multipliers
const PAYTABLE = {
  DEMON:  [10,   50,  200],
  KNIGHT: [5,    20,  80],
  MAGE:   [3,    12,  40],
  MINION: [2,    8,   25],
  LOW1:   [1,    4,   12],
  LOW2:   [0.5,  2,   8],
  LOW3:   [0.3,  0.8, 2],
}

// Symboles qui ne participent pas aux wins classiques
const NO_PAY_SYMS = new Set(['FLAME', 'SKULL'])

// ── Strip de 26 — ~35% house edge ────────────────────────────────────────────
// DEMON:1 KNIGHT:2 MAGE:2 MINION:2 LOW1:5 LOW2:6 FLAME:2 SKULL:1 LOW3:5 = 26
function buildStrip() {
  return [
    'DEMON',
    'KNIGHT', 'KNIGHT',
    'MAGE',   'MAGE',
    'MINION', 'MINION',
    'LOW1',   'LOW1',   'LOW1',   'LOW1',   'LOW1',
    'LOW2',   'LOW2',   'LOW2',   'LOW2',   'LOW2',   'LOW2',
    'FLAME',  'FLAME',
    'SKULL',
    'LOW3',   'LOW3',   'LOW3',   'LOW3',   'LOW3',
  ]
}

function spinReel() {
  const strip = buildStrip()
  const start = Math.floor(Math.random() * strip.length)
  return [0, 1, 2].map(i => strip[(start + i) % strip.length])
}

// ── Calcul wins 243 ways ──────────────────────────────────────────────────────
// grid : [[sym,sym,sym], ...] — 5 colonnes × 3 rangées
// heldPositions : [{reel, row, multiplier}] — positions WILD (ex-FLAME) bloquées
function calcWins(grid, mise, heldPositions = []) {
  const wins = []
  const heldSet = {}
  for (const hp of heldPositions) {
    if (!heldSet[hp.reel]) heldSet[hp.reel] = {}
    heldSet[hp.reel][hp.row] = hp.multiplier
  }

  // Résoudre la grille avec wilds : pour chaque position tenue, son symbole est WILD
  // Pour les pays : une position WILD peut matcher n'importe quel symbole
  const effectiveGrid = grid.map((col, r) =>
    col.map((sym, row) => {
      if (heldSet[r] && heldSet[r][row] !== undefined) return 'WILD'
      return sym
    })
  )

  for (const sym of Object.keys(PAYTABLE)) {
    // Compter les occurrences par rouleau (WILD compte aussi)
    const counts = effectiveGrid.map(col =>
      col.filter(s => s === sym || s === 'WILD').length
    )

    if (counts[0] === 0) continue

    let combos = counts[0]
    let reelsInWin = 1

    for (let r = 1; r < 5; r++) {
      if (counts[r] === 0) break
      combos *= counts[r]
      reelsInWin++
    }

    if (reelsInWin < 3) continue

    const payIdx = reelsInWin - 3  // 3→0, 4→1, 5→2
    const pay = PAYTABLE[sym][payIdx]

    // Multiplicateur des wilds : on prend le MAX de tous les wilds présents
    // dans les rouleaux gagnants — pas de produit, pas d'exponentielle
    const allMults = []
    for (let r = 0; r < reelsInWin; r++) {
      if (!heldSet[r]) continue
      Object.values(heldSet[r]).forEach(m => allMults.push(m))
    }
    const wildMult = allMults.length > 0 ? Math.max(...allMults) : 1

    // Plafond par combinaison : 30× la mise
    const amount = Math.min(Math.floor(pay * mise * combos * wildMult), mise * 30)
    wins.push({ sym, reels: reelsInWin, count: combos, amount })
  }

  // Plafond total du spin : 60× la mise (évite que tous les symboles hitent simultanément)
  const totalRaw = wins.reduce((s, w) => s + w.amount, 0)
  if (totalRaw > mise * 60) {
    const ratio = (mise * 60) / totalRaw
    wins.forEach(w => { w.amount = Math.floor(w.amount * ratio) })
  }

  return wins
}

// ── Helpers session ───────────────────────────────────────────────────────────

function getState(userId) {
  let sess = db.prepare('SELECT * FROM demons_gate_sessions WHERE user_id = ?').get(userId)
  if (!sess) {
    db.prepare(`
      INSERT INTO demons_gate_sessions (user_id) VALUES (?)
    `).run(userId)
    sess = db.prepare('SELECT * FROM demons_gate_sessions WHERE user_id = ?').get(userId)
  }
  sess.respin_held = JSON.parse(sess.respin_held || '[]')
  const user = db.prepare('SELECT solde, COALESCE(bonbons,0) as bonbons FROM users WHERE id = ?').get(userId)
  return { ...sess, solde: user?.solde ?? 0, bonbons: user?.bonbons ?? 0 }
}

function saveSession(userId, fields) {
  const set = Object.keys(fields).map(k => `${k} = ?`).join(', ')
  const vals = Object.values(fields)
  db.prepare(`UPDATE demons_gate_sessions SET ${set}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`)
    .run(...vals, userId)
}

// ── Générer les multiplicateurs selon le gate_level ───────────────────────────

function randMult(gateLevel) {
  switch (gateLevel) {
    case 1: return Math.floor(Math.random() * 3) + 1  // 1-3
    case 2: return Math.floor(Math.random() * 3) + 2  // 2-4
    case 3: return Math.floor(Math.random() * 4) + 3  // 3-6
    default: return 1
  }
}

// ── Taux de conversion crédits ────────────────────────────────────────────────
const CREDIT_RATE = 10  // 1 crédit = 10 ¥

// ── buyCreditsDG ──────────────────────────────────────────────────────────────
const _buyCredits = db.transaction((userId, montantYen, currency = 'yens') => {
  const soldeCol = currency === 'bonbons' ? 'bonbons' : 'solde'
  const sym      = currency === 'bonbons' ? 'B' : '¥'
  const user = db.prepare(`SELECT id, ${soldeCol} as solde_cur FROM users WHERE id = ?`).get(userId)
  if (!user) throw new Error('Utilisateur introuvable.')
  if (montantYen <= 0 || montantYen % CREDIT_RATE !== 0)
    throw new Error(`Le montant doit être un multiple de ${CREDIT_RATE} ${sym}.`)
  if (user.solde_cur < montantYen) throw new Error('Solde insuffisant.')

  // Interdit si partie en cours
  const sess = db.prepare('SELECT respin_active, free_spins_remaining FROM demons_gate_sessions WHERE user_id = ?').get(userId)
  if (sess && (sess.respin_active || sess.free_spins_remaining > 0))
    throw new Error('Impossible d\'acheter des crédits pendant une partie en cours.')

  const credits = montantYen / CREDIT_RATE
  db.prepare(`UPDATE users SET ${soldeCol} = ${soldeCol} - ? WHERE id = ?`).run(montantYen, userId)

  // Upsert session + crédits
  db.prepare(`
    INSERT INTO demons_gate_sessions (user_id, credits) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET credits = credits + excluded.credits, updated_at = CURRENT_TIMESTAMP
  `).run(userId, credits)

  const newSoldeRow = db.prepare(`SELECT ${soldeCol} as cur FROM users WHERE id = ?`).get(userId)
  const newSolde    = newSoldeRow.cur
  const newCredits  = db.prepare('SELECT credits FROM demons_gate_sessions WHERE user_id = ?').get(userId).credits
  db.prepare(`
    INSERT INTO dg_credits_logs (user_id, type, credits, montant_yen, solde_avant, solde_apres)
    VALUES (?, 'buy', ?, ?, ?, ?)
  `).run(userId, credits, montantYen, user.solde_cur, newSolde)
  return { solde: newSolde, credits: newCredits, currency }
})

// ── cashoutDG ─────────────────────────────────────────────────────────────────
const _cashout = db.transaction((userId, currency = 'yens') => {
  const soldeCol = currency === 'bonbons' ? 'bonbons' : 'solde'
  const sess = db.prepare('SELECT * FROM demons_gate_sessions WHERE user_id = ?').get(userId)
  if (!sess || sess.credits <= 0) throw new Error('Aucun crédit à encaisser.')
  if (sess.respin_active || sess.free_spins_remaining > 0)
    throw new Error('Impossible d\'encaisser pendant une partie en cours.')

  const soldeBefore = db.prepare(`SELECT ${soldeCol} as cur FROM users WHERE id = ?`).get(userId).cur
  const montantYen  = sess.credits * CREDIT_RATE
  db.prepare(`UPDATE users SET ${soldeCol} = ${soldeCol} + ? WHERE id = ?`).run(montantYen, userId)
  db.prepare('UPDATE demons_gate_sessions SET credits = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(userId)

  const newSolde = db.prepare(`SELECT ${soldeCol} as cur FROM users WHERE id = ?`).get(userId).cur
  db.prepare(`
    INSERT INTO dg_credits_logs (user_id, type, credits, montant_yen, solde_avant, solde_apres)
    VALUES (?, 'cashout', ?, ?, ?, ?)
  `).run(userId, sess.credits, montantYen, soldeBefore, newSolde)
  return { solde: newSolde, credits: 0, montantYen, currency }
})

// ── spin ──────────────────────────────────────────────────────────────────────

const _spin = db.transaction((userId, miseCredits) => {
  if (miseCredits <= 0) throw new Error('Mise invalide.')

  const user = db.prepare('SELECT id, solde FROM users WHERE id = ?').get(userId)
  if (!user) throw new Error('Utilisateur introuvable.')

  let sess = db.prepare('SELECT * FROM demons_gate_sessions WHERE user_id = ?').get(userId)
  if (!sess) {
    db.prepare('INSERT INTO demons_gate_sessions (user_id) VALUES (?)').run(userId)
    sess = db.prepare('SELECT * FROM demons_gate_sessions WHERE user_id = ?').get(userId)
  }

  const isFreeSpins = sess.free_spins_remaining > 0

  // Tout se passe en crédits — vérification avant de débiter
  if (!isFreeSpins) {
    if ((sess.credits ?? 0) < miseCredits)
      throw new Error('Crédits insuffisants. Rechargez pour continuer.')
    db.prepare('UPDATE demons_gate_sessions SET credits = credits - ? WHERE user_id = ?')
      .run(miseCredits, userId)
  }

  // Générer la grille
  const grid = Array.from({ length: 5 }, () => spinReel())

  const flamesLanded = []
  let scatterCount = 0
  for (let r = 0; r < 5; r++) {
    for (let row = 0; row < 3; row++) {
      if (grid[r][row] === 'FLAME') flamesLanded.push({ reel: r, row })
      if (grid[r][row] === 'SKULL') scatterCount++
    }
  }

  let flameCount = sess.flame_count + flamesLanded.length
  let gateLevel  = sess.gate_level

  const malchance = hasMalchance(userId) && Math.random() < getMalchanceProb(userId)
  if (malchance) {
    logMalchance(userId, 'demons_gate')
    gateLevel  = 1
    flameCount = Math.min(flameCount, 5)
  }

  const gateBlowTriggered = flameCount >= 6
  let freeSpinsTriggered  = false
  let freeSpinsRemaining  = sess.free_spins_remaining

  if (scatterCount >= 3 && freeSpinsRemaining === 0) {
    freeSpinsTriggered = true
    freeSpinsRemaining = 10
  }

  // Wins en crédits
  const wins     = calcWins(grid, miseCredits)
  const totalWin = wins.reduce((s, w) => s + w.amount, 0)

  if (totalWin > 0) {
    db.prepare('UPDATE demons_gate_sessions SET credits = credits + ? WHERE user_id = ?')
      .run(totalWin, userId)
  }

  if (isFreeSpins) freeSpinsRemaining = sess.free_spins_remaining - 1

  const creditsNow = db.prepare('SELECT credits FROM demons_gate_sessions WHERE user_id = ?').get(userId).credits

  saveSession(userId, {
    flame_count:          gateBlowTriggered ? flameCount - 6 : flameCount,
    gate_level:           gateLevel,
    free_spins_remaining: freeSpinsTriggered ? 10 : freeSpinsRemaining,
    respin_active:        gateBlowTriggered ? 1 : 0,
    respin_held:          gateBlowTriggered
      ? JSON.stringify(flamesLanded.map(f => ({ ...f, multiplier: randMult(gateLevel) })))
      : '[]',
    current_mise:         miseCredits,
    solde_avant:          user.solde,
    fs_mult_accumulated:  isFreeSpins ? sess.fs_mult_accumulated : 1,
  })

  // game_rounds : on enregistre en ¥ équivalent pour les logs admin
  if (!gateBlowTriggered) {
    const gainNetYen = (totalWin - (isFreeSpins ? 0 : miseCredits)) * CREDIT_RATE
    db.prepare(`
      INSERT INTO game_rounds (user_id, jeu, mise, resultat, gain_net, solde_avant, solde_apres)
      VALUES (?, 'demons_gate', ?, ?, ?, ?, ?)
    `).run(userId, miseCredits * CREDIT_RATE, JSON.stringify({ wins }), gainNetYen, user.solde, user.solde)
  }

  return {
    grid, wins, totalWin,
    flamesLanded,
    flameCount:         gateBlowTriggered ? flameCount - 6 : flameCount,
    gateBlowTriggered,
    gateLevel,
    scatterCount,
    freeSpinsTriggered,
    freeSpinsRemaining: freeSpinsTriggered ? 10 : freeSpinsRemaining,
    credits:            creditsNow,
    solde:              user.solde,
    statut:             gateBlowTriggered ? 'gate_blow' : freeSpinsTriggered ? 'free_spins' : 'en_cours',
  }
})

// ── respin ────────────────────────────────────────────────────────────────────

const _respin = db.transaction((userId) => {
  let sess = db.prepare('SELECT * FROM demons_gate_sessions WHERE user_id = ?').get(userId)
  if (!sess || !sess.respin_active) throw new Error('Aucun respin en cours.')

  const mise = sess.current_mise
  const heldPositions = JSON.parse(sess.respin_held || '[]')
  const gateLevel = sess.gate_level
  const isFreeSpins = sess.free_spins_remaining > 0

  // Positions tenues (index reel+row) pour ne pas re-spinner ces positions
  const heldMap = {}
  for (const hp of heldPositions) {
    if (!heldMap[hp.reel]) heldMap[hp.reel] = {}
    heldMap[hp.reel][hp.row] = hp.multiplier
  }

  // Générer la grille de respin : positions tenues gardées, le reste respun
  const grid = Array.from({ length: 5 }, (_, r) => {
    const col = spinReel()
    return col.map((sym, row) => {
      if (heldMap[r] && heldMap[r][row] !== undefined) return 'FLAME' // afficher comme FLAME (held)
      return sym
    })
  })

  // Trouver nouvelles FLAME sur les positions non-tenues
  const newFlames = []
  for (let r = 0; r < 5; r++) {
    for (let row = 0; row < 3; row++) {
      if (heldMap[r] && heldMap[r][row] !== undefined) continue
      if (grid[r][row] === 'FLAME') newFlames.push({ reel: r, row })
    }
  }

  // Accumuler les nouvelles flames dans les held positions
  const newHeld = [...heldPositions, ...newFlames.map(f => ({ ...f, multiplier: randMult(gateLevel) }))]
  let flameCount = sess.flame_count + newFlames.length
  const chainCount = (sess.chain_count || 0) + 1
  const chainContinues = newFlames.length > 0 && chainCount < 3  // max 2 respins chaînés

  // Calcul wins avec les positions tenues comme WILD
  const wins = calcWins(grid, mise, newHeld)
  const totalWin = wins.reduce((s, w) => s + w.amount, 0)

  // Gains en crédits
  if (totalWin > 0) {
    db.prepare('UPDATE demons_gate_sessions SET credits = credits + ? WHERE user_id = ?')
      .run(totalWin, userId)
  }

  let newGateLevel = gateLevel
  if (!chainContinues) newGateLevel = (gateLevel % 3) + 1

  const creditsNow = db.prepare('SELECT credits FROM demons_gate_sessions WHERE user_id = ?').get(userId).credits
  const user       = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId)

  if (chainContinues) {
    saveSession(userId, {
      respin_active: 1,
      respin_held:   JSON.stringify(newHeld),
      flame_count:   flameCount >= 6 ? flameCount - 6 : flameCount,
      gate_level:    gateLevel,
    })
    db.prepare('UPDATE demons_gate_sessions SET chain_count = ? WHERE user_id = ?').run(chainCount, userId)
  } else {
    db.prepare('UPDATE demons_gate_sessions SET chain_count = 0 WHERE user_id = ?').run(userId)
    saveSession(userId, {
      respin_active: 0,
      respin_held:   '[]',
      flame_count:   flameCount >= 6 ? flameCount - 6 : flameCount,
      gate_level:    newGateLevel,
    })
    // Enregistrer en ¥ équivalent pour les logs admin
    db.prepare(`
      INSERT INTO game_rounds (user_id, jeu, mise, resultat, gain_net, solde_avant, solde_apres)
      VALUES (?, 'demons_gate', ?, ?, ?, ?, ?)
    `).run(userId, mise * CREDIT_RATE, JSON.stringify({ wins, gateLevel }),
       (totalWin - mise) * CREDIT_RATE, user.solde, user.solde)
  }

  return {
    grid,
    heldPositions: newHeld,
    wins,
    totalWin,
    flamesLanded:  newFlames,
    flameCount:    flameCount >= 6 ? flameCount - 6 : flameCount,
    chainContinues,
    gateLevel:     chainContinues ? gateLevel : newGateLevel,
    credits:       creditsNow,
    solde:         user.solde,
  }
})

function spin(userId, mise)  { return _spin(userId, mise) }
function respin(userId)      { return _respin(userId) }
function buyCredits(userId, montantYen, currency = 'yens') { return _buyCredits(userId, montantYen, currency) }
function cashout(userId, currency = 'yens')     { return _cashout(userId, currency) }

module.exports = { getState, spin, respin, buyCredits, cashout, CREDIT_RATE }

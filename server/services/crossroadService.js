const db      = require('../db')
const discord = require('./discordService')

// Multiplicateurs par ruelle (maison ~5% d'avantage, prob bust 12%/ruelle)
const MULT      = [1.08, 1.23, 1.39, 1.58, 1.80, 2.04, 2.32, 2.64, 3.00, 3.41]
const MAX_LANES = MULT.length
const BUST_PROB = 0.12

function getBustLane() {
  for (let i = 0; i < MAX_LANES; i++) {
    if (Math.random() < BUST_PROB) return i + 1
  }
  return null // survie totale possible
}

// ── newGame ───────────────────────────────────────────────────────────────────

const _newGame = db.transaction((userId, mise) => {
  const user = db.prepare('SELECT id, solde FROM users WHERE id = ?').get(userId)
  if (!user) throw new Error('Utilisateur introuvable.')
  if (mise <= 0) throw new Error('Mise invalide.')
  if (user.solde < mise) throw new Error('Solde insuffisant.')

  // Terminer toute partie en cours (abandon)
  db.prepare("UPDATE crossroad_games SET statut = 'fini' WHERE user_id = ? AND statut = 'en_cours'").run(userId)

  const solde_avant = user.solde
  const lane_mort   = getBustLane()

  db.prepare('UPDATE users SET solde = solde - ? WHERE id = ?').run(mise, userId)
  db.prepare(`
    INSERT INTO crossroad_games (user_id, statut, mise, lane_actuelle, lane_mort, solde_avant, gain_net)
    VALUES (?, 'en_cours', ?, 0, ?, ?, 0)
  `).run(userId, mise, lane_mort, solde_avant)

  return { statut: 'en_cours', lane_actuelle: 0, mult_actuel: null, solde: solde_avant - mise }
})

// ── avancer ───────────────────────────────────────────────────────────────────

const _avancer = db.transaction((userId) => {
  const game = db.prepare("SELECT * FROM crossroad_games WHERE user_id = ? AND statut = 'en_cours'").get(userId)
  if (!game) throw new Error('Aucune partie en cours.')

  const nextLane = game.lane_actuelle + 1
  if (nextLane > MAX_LANES) throw new Error('Toutes les ruelles sont traversées.')

  // Bust ?
  if (game.lane_mort !== null && nextLane >= game.lane_mort) {
    db.prepare("UPDATE crossroad_games SET statut = 'fini', lane_actuelle = ?, gain_net = ? WHERE id = ?")
      .run(nextLane, -game.mise, game.id)
    const solde = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId).solde
    return { statut: 'bust', lane_actuelle: nextLane, gain_net: -game.mise, solde }
  }

  // Survie
  const mult = MULT[nextLane - 1]
  db.prepare('UPDATE crossroad_games SET lane_actuelle = ? WHERE id = ?').run(nextLane, game.id)
  const solde = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId).solde

  // Dernière ruelle → victoire totale automatique
  if (nextLane === MAX_LANES) {
    const gain_brut = Math.floor(game.mise * mult)
    const gain_net  = gain_brut - game.mise
    db.prepare('UPDATE users SET solde = solde + ? WHERE id = ?').run(gain_brut, userId)
    db.prepare("UPDATE crossroad_games SET statut = 'fini', gain_net = ? WHERE id = ?").run(gain_net, game.id)
    const soldeFinal = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId).solde
    return { statut: 'victoire_totale', lane_actuelle: nextLane, mult_actuel: mult, gain_net, solde: soldeFinal }
  }

  return { statut: 'en_cours', lane_actuelle: nextLane, mult_actuel: mult, solde }
})

// ── encaisser ─────────────────────────────────────────────────────────────────

const _encaisser = db.transaction((userId) => {
  const game = db.prepare("SELECT * FROM crossroad_games WHERE user_id = ? AND statut = 'en_cours'").get(userId)
  if (!game) throw new Error('Aucune partie en cours.')
  if (game.lane_actuelle === 0) throw new Error("Traversez au moins une ruelle d'abord.")

  const mult     = MULT[game.lane_actuelle - 1]
  const gain_brut = Math.floor(game.mise * mult)
  const gain_net  = gain_brut - game.mise

  db.prepare('UPDATE users SET solde = solde + ? WHERE id = ?').run(gain_brut, userId)
  db.prepare("UPDATE crossroad_games SET statut = 'fini', gain_net = ? WHERE id = ?").run(gain_net, game.id)

  const solde = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId).solde
  return { statut: 'fini', lane_actuelle: game.lane_actuelle, mult_actuel: mult, gain_net, solde }
})

// ── notifications ─────────────────────────────────────────────────────────────

function notify(userId, r, detail) {
  if (r.gain_net <= 0) return
  const user = db.prepare('SELECT nom, identifiant FROM users WHERE id = ?').get(userId)
  discord.logGameWin('crossroad', {
    playerName:        user?.nom || '?',
    playerIdentifiant: user?.identifiant || '',
    gain_net:          r.gain_net,
    solde:             r.solde,
    detail,
  })
}

function newGame(userId, mise) { return _newGame(userId, mise) }

function avancer(userId) {
  const r = _avancer(userId)
  if (r.statut === 'victoire_totale')
    notify(userId, r, `Toutes les ruelles traversées — ×${r.mult_actuel.toFixed(2)}`)
  return r
}

function encaisser(userId) {
  const r = _encaisser(userId)
  notify(userId, r, `Encaissé après **${r.lane_actuelle}** ruelles — ×${r.mult_actuel.toFixed(2)}`)
  return r
}

module.exports = { newGame, avancer, encaisser, MULT, MAX_LANES }

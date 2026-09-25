const db      = require('../db')
const discord = require('./discordService')

const MAX_LANES  = 20
const HOUSE_EDGE = 0.01  // 1% — standard casino en ligne (RTP 99%)

function getBustProb() {
  try {
    const row = db.prepare('SELECT crossroad_bust_prob FROM slots_config WHERE id = 1').get()
    return row?.crossroad_bust_prob ?? 0.12
  } catch { return 0.12 }
}

// Multiplicateurs calculés dynamiquement depuis le taux configuré en admin
function getMultArray() {
  const p = getBustProb()
  return Array.from({ length: MAX_LANES }, (_, i) =>
    Math.round(Math.pow(1 / (1 - p), i + 1) * (1 - HOUSE_EDGE) * 100) / 100
  )
}

function getBustLane() {
  const p = getBustProb()
  for (let i = 0; i < MAX_LANES; i++) {
    if (Math.random() < p) return i + 1
  }
  return null
}

// ── newGame ───────────────────────────────────────────────────────────────────

const _newGame = db.transaction((userId, mise) => {
  const user = db.prepare('SELECT id, solde FROM users WHERE id = ?').get(userId)
  if (!user) throw new Error('Utilisateur introuvable.')
  if (mise <= 0) throw new Error('Mise invalide.')
  if (user.solde < mise) throw new Error('Solde insuffisant.')

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

  if (game.lane_mort !== null && nextLane >= game.lane_mort) {
    db.prepare("UPDATE crossroad_games SET statut = 'fini', lane_actuelle = ?, gain_net = ? WHERE id = ?")
      .run(nextLane, -game.mise, game.id)
    const solde = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId).solde
    return { statut: 'bust', lane_actuelle: nextLane, gain_net: -game.mise, solde }
  }

  const mult = getMultArray()[nextLane - 1]
  db.prepare('UPDATE crossroad_games SET lane_actuelle = ? WHERE id = ?').run(nextLane, game.id)
  const solde = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId).solde

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

  const mult      = getMultArray()[game.lane_actuelle - 1]
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

module.exports = { newGame, avancer, encaisser, getMultArray, MAX_LANES }

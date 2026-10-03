'use strict'

const db      = require('../db')
const discord = require('./discordService')

// ── Niveaux de difficulté ─────────────────────────────────────────────────────
const DIFFICULTIES = {
  initie:      { label: 'Facile',         pump_step: 0.08, house_edge: 0.15, bust_cap: 20  },
  demoniaque:  { label: 'Difficile',      pump_step: 0.12, house_edge: 0.25, bust_cap: 8   },
  experimente: { label: 'Très difficile', pump_step: 0.20, house_edge: 0.45, bust_cap: 3.5 },
}
const DEFAULT_DIFF = 'demoniaque'

function getDiff(key) {
  return DIFFICULTIES[key] || DIFFICULTIES[DEFAULT_DIFF]
}

// Distribution de Pareto : bust_mult = (1 - house_edge) / (1 - U)
function newBustMult(house_edge, bust_cap) {
  const raw = (1 - house_edge) / (1 - Math.random())
  return Math.min(raw, bust_cap)
}

function currentMult(pumps, pump_step) {
  return parseFloat((1 + pumps * pump_step).toFixed(2))
}

// ── start ─────────────────────────────────────────────────────────────────────

const _start = db.transaction((userId, mise, difficulte) => {
  const user = db.prepare('SELECT id, solde FROM users WHERE id = ?').get(userId)
  if (!user) throw new Error('Utilisateur introuvable.')
  if (user.solde < mise) throw new Error('Solde insuffisant.')

  const diff = getDiff(difficulte)

  // Clore toute partie en cours sans remboursement (abandon)
  const existing = db.prepare("SELECT * FROM corps_games WHERE user_id = ? AND statut = 'en_cours'").get(userId)
  if (existing) {
    db.prepare("UPDATE corps_games SET statut = 'rupture' WHERE id = ?").run(existing.id)
  }

  const bust_mult   = newBustMult(diff.house_edge, diff.bust_cap)
  const solde_avant = user.solde

  db.prepare('UPDATE users SET solde = solde - ? WHERE id = ?').run(mise, userId)
  db.prepare(`
    INSERT INTO corps_games (user_id, statut, mise, pumps_done, bust_mult, pump_step, difficulte, solde_avant, gain_net)
    VALUES (?, 'en_cours', ?, 0, ?, ?, ?, ?, 0)
  `).run(userId, mise, bust_mult, diff.pump_step, difficulte || DEFAULT_DIFF, solde_avant)

  return {
    statut:     'en_cours',
    pumps:      0,
    mult:       1.0,
    pump_step:  diff.pump_step,
    difficulte: difficulte || DEFAULT_DIFF,
    solde:      solde_avant - mise,
  }
})

// ── pump ──────────────────────────────────────────────────────────────────────

const _pump = db.transaction((userId) => {
  const game = db.prepare("SELECT * FROM corps_games WHERE user_id = ? AND statut = 'en_cours'").get(userId)
  if (!game) throw new Error('Aucune infusion en cours.')

  const pump_step = game.pump_step || 0.12
  const pumps     = game.pumps_done + 1
  const mult      = currentMult(pumps, pump_step)

  if (mult >= game.bust_mult) {
    db.prepare("UPDATE corps_games SET statut = 'rupture', pumps_done = ?, gain_net = -? WHERE id = ?")
      .run(pumps, game.mise, game.id)

    const solde = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId).solde
    db.prepare(`
      INSERT INTO game_rounds (user_id, jeu, mise, resultat, gain_net, solde_avant, solde_apres)
      VALUES (?, 'corps_demoniaque', ?, ?, ?, ?, ?)
    `).run(
      userId,
      game.mise,
      JSON.stringify({ pumps, mult, bust_mult: parseFloat(game.bust_mult.toFixed(2)), difficulte: game.difficulte, resultat: 'rupture' }),
      -game.mise,
      game.solde_avant,
      solde,
    )

    return {
      statut:    'rupture',
      pumps,
      mult,
      pump_step,
      bust_mult: parseFloat(game.bust_mult.toFixed(2)),
      gain_net:  -game.mise,
      solde,
    }
  }

  db.prepare('UPDATE corps_games SET pumps_done = ? WHERE id = ?').run(pumps, game.id)
  const solde = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId).solde

  return { statut: 'en_cours', pumps, mult, pump_step, solde }
})

// ── sceller ───────────────────────────────────────────────────────────────────

const _sceller = db.transaction((userId) => {
  const game = db.prepare("SELECT * FROM corps_games WHERE user_id = ? AND statut = 'en_cours'").get(userId)
  if (!game) throw new Error('Aucune infusion en cours.')
  if (game.pumps_done === 0) throw new Error('Amplifiez au moins une fois avant de sceller.')

  const pump_step = game.pump_step || 0.12
  const mult      = currentMult(game.pumps_done, pump_step)
  const gain_brut = Math.floor(game.mise * mult)
  const gain_net  = gain_brut - game.mise

  db.prepare('UPDATE users SET solde = solde + ? WHERE id = ?').run(gain_brut, userId)
  db.prepare("UPDATE corps_games SET statut = 'scelle', gain_net = ? WHERE id = ?").run(gain_net, game.id)

  const solde = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId).solde
  db.prepare(`
    INSERT INTO game_rounds (user_id, jeu, mise, resultat, gain_net, solde_avant, solde_apres)
    VALUES (?, 'corps_demoniaque', ?, ?, ?, ?, ?)
  `).run(
    userId,
    game.mise,
    JSON.stringify({ pumps: game.pumps_done, mult, difficulte: game.difficulte, resultat: 'scelle' }),
    gain_net,
    game.solde_avant,
    solde,
  )

  return { statut: 'scelle', pumps: game.pumps_done, mult, pump_step, gain_net, solde }
})

// ── getState ──────────────────────────────────────────────────────────────────

function getState(userId) {
  const game  = db.prepare("SELECT * FROM corps_games WHERE user_id = ? AND statut = 'en_cours'").get(userId)
  const solde = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId)?.solde ?? 0
  if (!game) return { statut: 'idle', solde }
  const pump_step = game.pump_step || 0.12
  return {
    statut:     'en_cours',
    pumps:      game.pumps_done,
    mult:       currentMult(game.pumps_done, pump_step),
    pump_step,
    difficulte: game.difficulte || DEFAULT_DIFF,
    solde,
  }
}

// ── notifications ─────────────────────────────────────────────────────────────

function notify(userId, r) {
  if (!r.gain_net || r.gain_net <= 0) return
  const user = db.prepare('SELECT nom, identifiant FROM users WHERE id = ?').get(userId)
  discord.logGameWin('corps_demoniaque', {
    playerName:        user?.nom || '?',
    playerIdentifiant: user?.identifiant || '',
    gain_net:          r.gain_net,
    solde:             r.solde,
    detail:            `Scellé à ×${r.mult} après ${r.pumps} amplifications [${r.difficulte || '?'}]`,
  })
}

function start(userId, mise, difficulte)  { return _start(userId, mise, difficulte) }
function pump(userId)                     { return _pump(userId) }
function sceller(userId)                  { const r = _sceller(userId); notify(userId, r); return r }

module.exports = { start, pump, sceller, getState, DIFFICULTIES }

'use strict'

const db      = require('../db')
const discord = require('./discordService')

// ── Niveaux de difficulté ─────────────────────────────────────────────────────
const DIFFICULTIES = {
  initie:      { label: 'Facile',         pump_step: 0.08, house_edge: 0.35, bust_cap: 20  },
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

const _start = db.transaction((userId, mise, difficulte, currency = 'yens') => {
  const soldeCol = currency === 'bonbons' ? 'bonbons' : 'solde'
  const user = db.prepare(`SELECT id, ${soldeCol} as solde_cur FROM users WHERE id = ?`).get(userId)
  if (!user) throw new Error('Utilisateur introuvable.')
  if (user.solde_cur < mise) throw new Error('Solde insuffisant.')

  const diff = getDiff(difficulte)

  // Clore toute partie en cours sans remboursement (abandon)
  const existing = db.prepare("SELECT * FROM corps_games WHERE user_id = ? AND statut = 'en_cours'").get(userId)
  if (existing) {
    db.prepare("UPDATE corps_games SET statut = 'rupture' WHERE id = ?").run(existing.id)
  }

  // Bonbons : 90% de générer un bust très bas (éclate presque immédiatement)
  let bust_mult = newBustMult(diff.house_edge, diff.bust_cap)
  if (currency === 'bonbons' && Math.random() < 0.9) {
    bust_mult = 1.0 + Math.random() * diff.pump_step * 1.5
  }
  const solde_avant = user.solde_cur

  db.prepare(`UPDATE users SET ${soldeCol} = ${soldeCol} - ? WHERE id = ?`).run(mise, userId)
  db.prepare(`
    INSERT INTO corps_games (user_id, statut, mise, pumps_done, bust_mult, pump_step, difficulte, solde_avant, gain_net, currency)
    VALUES (?, 'en_cours', ?, 0, ?, ?, ?, ?, 0, ?)
  `).run(userId, mise, bust_mult, diff.pump_step, difficulte || DEFAULT_DIFF, solde_avant, currency)

  const retval = {
    statut:     'en_cours',
    pumps:      0,
    mult:       1.0,
    pump_step:  diff.pump_step,
    difficulte: difficulte || DEFAULT_DIFF,
    currency,
  }
  if (currency === 'bonbons') retval.bonbons = solde_avant - mise
  else retval.solde = solde_avant - mise
  return retval
})

// ── pump ──────────────────────────────────────────────────────────────────────

const _pump = db.transaction((userId) => {
  const game = db.prepare("SELECT * FROM corps_games WHERE user_id = ? AND statut = 'en_cours'").get(userId)
  if (!game) throw new Error('Aucune infusion en cours.')

  const currency = game.currency || 'yens'
  const soldeCol = currency === 'bonbons' ? 'bonbons' : 'solde'
  const pump_step = game.pump_step || 0.12
  const pumps     = game.pumps_done + 1
  const mult      = currentMult(pumps, pump_step)

  if (mult >= game.bust_mult) {
    db.prepare("UPDATE corps_games SET statut = 'rupture', pumps_done = ?, gain_net = -? WHERE id = ?")
      .run(pumps, game.mise, game.id)

    const soldeCur = db.prepare(`SELECT ${soldeCol} as cur FROM users WHERE id = ?`).get(userId).cur
    db.prepare(`
      INSERT INTO game_rounds (user_id, jeu, mise, resultat, gain_net, solde_avant, solde_apres, currency)
      VALUES (?, 'corps_demoniaque', ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      game.mise,
      JSON.stringify({ pumps, mult, bust_mult: parseFloat(game.bust_mult.toFixed(2)), difficulte: game.difficulte, resultat: 'rupture' }),
      -game.mise,
      game.solde_avant,
      soldeCur,
      currency,
    )

    const retval = {
      statut:    'rupture',
      pumps,
      mult,
      pump_step,
      bust_mult: parseFloat(game.bust_mult.toFixed(2)),
      gain_net:  -game.mise,
      currency,
    }
    if (currency === 'bonbons') retval.bonbons = soldeCur
    else retval.solde = soldeCur
    return retval
  }

  db.prepare('UPDATE corps_games SET pumps_done = ? WHERE id = ?').run(pumps, game.id)
  const soldeCur = db.prepare(`SELECT ${soldeCol} as cur FROM users WHERE id = ?`).get(userId).cur

  const retval = { statut: 'en_cours', pumps, mult, pump_step, currency }
  if (currency === 'bonbons') retval.bonbons = soldeCur
  else retval.solde = soldeCur
  return retval
})

// ── sceller ───────────────────────────────────────────────────────────────────

const _sceller = db.transaction((userId) => {
  const game = db.prepare("SELECT * FROM corps_games WHERE user_id = ? AND statut = 'en_cours'").get(userId)
  if (!game) throw new Error('Aucune infusion en cours.')
  if (game.pumps_done === 0) throw new Error('Amplifiez au moins une fois avant de sceller.')

  const currency = game.currency || 'yens'
  const soldeCol = currency === 'bonbons' ? 'bonbons' : 'solde'
  const pump_step = game.pump_step || 0.12
  const mult      = currentMult(game.pumps_done, pump_step)
  const gain_brut = Math.floor(game.mise * mult)
  const gain_net  = gain_brut - game.mise

  db.prepare(`UPDATE users SET ${soldeCol} = ${soldeCol} + ? WHERE id = ?`).run(gain_brut, userId)
  db.prepare("UPDATE corps_games SET statut = 'scelle', gain_net = ? WHERE id = ?").run(gain_net, game.id)

  const soldeCur = db.prepare(`SELECT ${soldeCol} as cur FROM users WHERE id = ?`).get(userId).cur
  db.prepare(`
    INSERT INTO game_rounds (user_id, jeu, mise, resultat, gain_net, solde_avant, solde_apres, currency)
    VALUES (?, 'corps_demoniaque', ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    game.mise,
    JSON.stringify({ pumps: game.pumps_done, mult, difficulte: game.difficulte, resultat: 'scelle' }),
    gain_net,
    game.solde_avant,
    soldeCur,
    currency,
  )

  const retval = { statut: 'scelle', pumps: game.pumps_done, mult, pump_step, gain_net, currency }
  if (currency === 'bonbons') retval.bonbons = soldeCur
  else retval.solde = soldeCur
  return retval
})

// ── getState ──────────────────────────────────────────────────────────────────

function getState(userId) {
  const game    = db.prepare("SELECT * FROM corps_games WHERE user_id = ? AND statut = 'en_cours'").get(userId)
  const userRow = db.prepare('SELECT solde, COALESCE(bonbons,0) as bonbons FROM users WHERE id = ?').get(userId)
  const solde   = userRow?.solde ?? 0
  const bonbons = userRow?.bonbons ?? 0
  if (!game) return { statut: 'idle', solde, bonbons }
  const pump_step = game.pump_step || 0.12
  const currency  = game.currency || 'yens'
  return {
    statut:     'en_cours',
    pumps:      game.pumps_done,
    mult:       currentMult(game.pumps_done, pump_step),
    pump_step,
    difficulte: game.difficulte || DEFAULT_DIFF,
    currency,
    solde,
    bonbons,
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

function start(userId, mise, difficulte, currency = 'yens')  { return _start(userId, mise, difficulte, currency) }
function pump(userId)                     { return _pump(userId) }
function sceller(userId)                  { const r = _sceller(userId); notify(userId, r); return r }

module.exports = { start, pump, sceller, getState, DIFFICULTIES }

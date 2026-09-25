const db = require('../db')

const TOTAL      = 25
const HOUSE_EDGE = 0.04

// ── Formule multiplicateur (identique Stake) ──────────────────────────────────

function getMult(nbMines, nbRevealed) {
  if (nbRevealed === 0) return 1
  let mult = 1
  for (let i = 0; i < nbRevealed; i++) {
    mult *= (TOTAL - i) / (TOTAL - nbMines - i)
  }
  return Math.round(mult * (1 - HOUSE_EDGE) * 100) / 100
}

// ── Shuffle Fisher-Yates ──────────────────────────────────────────────────────

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ── newGame ───────────────────────────────────────────────────────────────────

const _newGame = db.transaction((userId, mise, nbMines) => {
  if (mise <= 0)      throw new Error('Mise invalide.')
  if (nbMines < 3 || nbMines > 24) throw new Error('Nombre de mines invalide (3–24).')

  const user = db.prepare('SELECT id, solde FROM users WHERE id = ?').get(userId)
  if (!user)             throw new Error('Utilisateur introuvable.')
  if (user.solde < mise) throw new Error('Solde insuffisant.')

  // Abandonner toute partie en cours
  db.prepare("UPDATE mines_games SET statut = 'fini' WHERE user_id = ? AND statut = 'en_cours'").run(userId)

  // Générer positions mines
  const positions   = Array.from({ length: TOTAL }, (_, i) => i)
  const shuffled    = shuffle(positions)
  const minePos     = shuffled.slice(0, nbMines)
  const solde_avant = user.solde

  db.prepare('UPDATE users SET solde = solde - ? WHERE id = ?').run(mise, userId)
  db.prepare(`
    INSERT INTO mines_games (user_id, statut, mise, nb_mines, mines_positions, revealed_positions, solde_avant, gain_net)
    VALUES (?, 'en_cours', ?, ?, ?, '[]', ?, 0)
  `).run(userId, mise, nbMines, JSON.stringify(minePos), solde_avant)

  return {
    statut:    'en_cours',
    nb_mines:  nbMines,
    revealed:  [],
    mult:      1,
    solde:     solde_avant - mise,
  }
})

// ── reveal ────────────────────────────────────────────────────────────────────

const _reveal = db.transaction((userId, position) => {
  if (position < 0 || position > 24) throw new Error('Position invalide (0–24).')

  const game = db.prepare("SELECT * FROM mines_games WHERE user_id = ? AND statut = 'en_cours'").get(userId)
  if (!game) throw new Error('Aucune partie en cours.')

  const mines    = JSON.parse(game.mines_positions)
  const revealed = JSON.parse(game.revealed_positions)
  const nbGems   = TOTAL - game.nb_mines  // cases sûres totales

  if (revealed.includes(position)) throw new Error('Position déjà révélée.')
  if (revealed.length >= nbGems)   throw new Error('Toutes les gemmes sont déjà révélées.')

  // ── MINE ──────────────────────────────────────────────────────────────────
  if (mines.includes(position)) {
    db.prepare(`
      UPDATE mines_games SET statut = 'fini', gain_net = ? WHERE id = ?
    `).run(-game.mise, game.id)

    const solde = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId).solde
    return {
      statut:   'bust',
      position,
      mines,
      gain_net: -game.mise,
      solde,
    }
  }

  // ── SAFE ──────────────────────────────────────────────────────────────────
  const newRevealed = [...revealed, position]
  const mult        = getMult(game.nb_mines, newRevealed.length)

  db.prepare('UPDATE mines_games SET revealed_positions = ? WHERE id = ?')
    .run(JSON.stringify(newRevealed), game.id)

  // Victoire totale si toutes les gemmes révélées
  if (newRevealed.length >= nbGems) {
    const payout   = Math.floor(game.mise * mult)
    const gain_net = payout - game.mise

    db.prepare('UPDATE users SET solde = solde + ? WHERE id = ?').run(payout, userId)
    db.prepare("UPDATE mines_games SET statut = 'fini', gain_net = ? WHERE id = ?")
      .run(gain_net, game.id)

    const solde = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId).solde
    return {
      statut:   'victoire_totale',
      position,
      mines,
      mult,
      gain_net,
      solde,
    }
  }

  const solde = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId).solde
  return {
    statut:             'en_cours',
    position,
    mult,
    gain_net_potentiel: Math.floor(game.mise * mult) - game.mise,
    solde,
  }
})

// ── cashout ───────────────────────────────────────────────────────────────────

const _cashout = db.transaction((userId) => {
  const game = db.prepare("SELECT * FROM mines_games WHERE user_id = ? AND statut = 'en_cours'").get(userId)
  if (!game) throw new Error('Aucune partie en cours.')

  const revealed = JSON.parse(game.revealed_positions)
  if (revealed.length === 0) throw new Error('Révélez au moins une gemme avant d\'encaisser.')

  const mult     = getMult(game.nb_mines, revealed.length)
  const payout   = Math.floor(game.mise * mult)
  const gain_net = payout - game.mise

  db.prepare('UPDATE users SET solde = solde + ? WHERE id = ?').run(payout, userId)
  db.prepare("UPDATE mines_games SET statut = 'fini', gain_net = ? WHERE id = ?")
    .run(gain_net, game.id)

  const solde = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId).solde
  return { statut: 'fini', mult, gain_net, solde }
})

// ── Wrappers publics ──────────────────────────────────────────────────────────

function newGame(userId, mise, nbMines) { return _newGame(userId, mise, nbMines) }
function reveal(userId, position)       { return _reveal(userId, position) }
function cashout(userId)                { return _cashout(userId) }

module.exports = { newGame, reveal, cashout, getMult, TOTAL }

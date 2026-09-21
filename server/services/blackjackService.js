const db = require('../db')

const SUITS  = ['S','H','D','C']
const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']

function createDeck(nDecks = 6) {
  const deck = []
  for (let d = 0; d < nDecks; d++)
    for (const s of SUITS)
      for (const v of VALUES)
        deck.push({ s, v })
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

function cardVal(card) {
  if (card.v === 'A') return 11
  if (['J','Q','K'].includes(card.v)) return 10
  return parseInt(card.v)
}

function handTotal(cards) {
  let total = 0, aces = 0
  for (const c of cards) {
    total += cardVal(c)
    if (c.v === 'A') aces++
  }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return total
}

function isSoft17(cards) {
  // true if hand is a soft 17 (dealer must hit)
  let total = 0, aces = 0
  for (const c of cards) {
    total += cardVal(c)
    if (c.v === 'A') aces++
  }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return total === 17 && aces > 0
}

function dealerPlay(cards, deck) {
  const hand = [...cards]
  while (true) {
    const t = handTotal(hand)
    if (t > 17) break
    if (t === 17 && !isSoft17(hand)) break
    if (deck.length === 0) break
    hand.push(deck.pop())
  }
  return hand
}

function _resoudrePartie(game, mainJoueur, mainDealer, miseTotale) {
  const pTotal = handTotal(mainJoueur)
  const dTotal = handTotal(mainDealer)

  let resultat, gain_brut
  if (pTotal > 21) {
    resultat = 'defaite'; gain_brut = 0
  } else if (dTotal > 21 || pTotal > dTotal) {
    resultat = 'victoire'; gain_brut = miseTotale * 2
  } else if (pTotal === dTotal) {
    resultat = 'egalite'; gain_brut = miseTotale
  } else {
    resultat = 'defaite'; gain_brut = 0
  }

  const gain_net = gain_brut - miseTotale
  if (gain_brut > 0)
    db.prepare('UPDATE users SET solde = solde + ? WHERE id = ?').run(gain_brut, game.user_id)

  const solde_apres = db.prepare('SELECT solde FROM users WHERE id = ?').get(game.user_id).solde
  db.prepare(`
    INSERT INTO game_rounds (user_id, jeu, mise, resultat, gain_net, solde_avant, solde_apres)
    VALUES (?, 'blackjack', ?, ?, ?, ?, ?)
  `).run(
    game.user_id, miseTotale,
    JSON.stringify({ pTotal, dTotal, resultat }),
    gain_net, game.solde_avant, solde_apres
  )
  db.prepare('UPDATE blackjack_games SET statut=?, resultat=?, gain_net=?, main_dealer=? WHERE id=?')
    .run('fini', resultat, gain_net, JSON.stringify(mainDealer), game.id)

  return { statut: 'fini', resultat, gain_net, solde: solde_apres, pTotal, dTotal, mainJoueur, mainDealer }
}

// ── newGame ───────────────────────────────────────────────────────────────────

const _newGame = db.transaction((userId, mise) => {
  const user = db.prepare('SELECT id, solde FROM users WHERE id = ?').get(userId)
  if (!user) throw new Error('Utilisateur introuvable.')
  if (mise <= 0) throw new Error('Mise invalide.')
  if (user.solde < mise) throw new Error('Solde insuffisant.')

  // Terminer toute partie en cours (abandon)
  const prev = db.prepare("SELECT id, mise FROM blackjack_games WHERE user_id = ? AND statut = 'en_cours'").get(userId)
  if (prev) {
    db.prepare("UPDATE blackjack_games SET statut = 'fini', resultat = 'defaite' WHERE id = ?").run(prev.id)
  }

  const deck        = createDeck(6)
  const mainJoueur  = [deck.pop(), deck.pop()]
  const mainDealer  = [deck.pop(), deck.pop()]
  const solde_avant = user.solde

  db.prepare('UPDATE users SET solde = solde - ? WHERE id = ?').run(mise, userId)

  const pTotal     = handTotal(mainJoueur)
  const dTotal     = handTotal(mainDealer)
  const pBlackjack = pTotal === 21
  const dBlackjack = dTotal === 21

  if (pBlackjack || dBlackjack) {
    let resultat, gain_brut
    if (pBlackjack && dBlackjack) {
      resultat = 'egalite'; gain_brut = mise
    } else if (pBlackjack) {
      resultat = 'blackjack'; gain_brut = Math.floor(mise * 2.5)
    } else {
      resultat = 'defaite'; gain_brut = 0
    }
    const gain_net = gain_brut - mise
    if (gain_brut > 0)
      db.prepare('UPDATE users SET solde = solde + ? WHERE id = ?').run(gain_brut, userId)

    const solde_apres = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId).solde
    db.prepare(`
      INSERT INTO game_rounds (user_id, jeu, mise, resultat, gain_net, solde_avant, solde_apres)
      VALUES (?, 'blackjack', ?, ?, ?, ?, ?)
    `).run(userId, mise, JSON.stringify({ pTotal, dTotal, resultat }), gain_net, solde_avant, solde_apres)

    db.prepare(`
      INSERT INTO blackjack_games (user_id, statut, mise, mise_double, solde_avant, main_joueur, main_dealer, deck, resultat, gain_net)
      VALUES (?, 'fini', ?, 0, ?, ?, ?, ?, ?, ?)
    `).run(userId, mise, solde_avant, JSON.stringify(mainJoueur), JSON.stringify(mainDealer), JSON.stringify(deck), resultat, gain_net)

    return { statut: 'fini', resultat, gain_net, solde: solde_apres, pTotal, dTotal, mainJoueur, mainDealer }
  }

  db.prepare(`
    INSERT INTO blackjack_games (user_id, statut, mise, mise_double, solde_avant, main_joueur, main_dealer, deck)
    VALUES (?, 'en_cours', ?, 0, ?, ?, ?, ?)
  `).run(userId, mise, solde_avant, JSON.stringify(mainJoueur), JSON.stringify(mainDealer), JSON.stringify(deck))

  return {
    statut: 'en_cours', pTotal, dTotal: null,
    mainJoueur, mainDealer: [mainDealer[0], { hidden: true }],
    canDouble: true,
    solde: solde_avant - mise,
  }
})

// ── hit ───────────────────────────────────────────────────────────────────────

const _hit = db.transaction((userId) => {
  const game = db.prepare("SELECT * FROM blackjack_games WHERE user_id = ? AND statut = 'en_cours'").get(userId)
  if (!game) throw new Error('Aucune partie en cours.')

  const mainJoueur = JSON.parse(game.main_joueur)
  const mainDealer = JSON.parse(game.main_dealer)
  const deck       = JSON.parse(game.deck)

  if (deck.length === 0) throw new Error('Plus de cartes.')
  mainJoueur.push(deck.pop())
  const pTotal = handTotal(mainJoueur)
  const miseTotale = game.mise + game.mise_double

  db.prepare('UPDATE blackjack_games SET main_joueur = ?, deck = ? WHERE id = ?')
    .run(JSON.stringify(mainJoueur), JSON.stringify(deck), game.id)

  if (pTotal > 21) {
    // Bust — résoudre immédiatement
    return _resoudrePartie(game, mainJoueur, mainDealer, miseTotale)
  }

  if (pTotal === 21) {
    // 21 automatique → dealer joue
    const finalDealer = dealerPlay(mainDealer, deck)
    db.prepare('UPDATE blackjack_games SET deck = ? WHERE id = ?').run(JSON.stringify(deck), game.id)
    return _resoudrePartie(game, mainJoueur, finalDealer, miseTotale)
  }

  return {
    statut: 'en_cours', pTotal, dTotal: null,
    mainJoueur, mainDealer: [mainDealer[0], { hidden: true }],
    canDouble: false,
    solde: db.prepare('SELECT solde FROM users WHERE id = ?').get(userId).solde,
  }
})

// ── stand ─────────────────────────────────────────────────────────────────────

const _stand = db.transaction((userId) => {
  const game = db.prepare("SELECT * FROM blackjack_games WHERE user_id = ? AND statut = 'en_cours'").get(userId)
  if (!game) throw new Error('Aucune partie en cours.')

  const mainJoueur = JSON.parse(game.main_joueur)
  const mainDealer = JSON.parse(game.main_dealer)
  const deck       = JSON.parse(game.deck)
  const miseTotale = game.mise + game.mise_double

  const finalDealer = dealerPlay(mainDealer, deck)
  db.prepare('UPDATE blackjack_games SET deck = ? WHERE id = ?').run(JSON.stringify(deck), game.id)

  return _resoudrePartie(game, mainJoueur, finalDealer, miseTotale)
})

// ── double ────────────────────────────────────────────────────────────────────

const _double = db.transaction((userId) => {
  const game = db.prepare("SELECT * FROM blackjack_games WHERE user_id = ? AND statut = 'en_cours'").get(userId)
  if (!game) throw new Error('Aucune partie en cours.')

  const mainJoueur = JSON.parse(game.main_joueur)
  if (mainJoueur.length !== 2) throw new Error('Double uniquement sur 2 cartes.')

  const user = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId)
  if (user.solde < game.mise) throw new Error('Solde insuffisant pour doubler.')

  db.prepare('UPDATE users SET solde = solde - ? WHERE id = ?').run(game.mise, userId)
  db.prepare('UPDATE blackjack_games SET mise_double = ? WHERE id = ?').run(game.mise, game.id)

  const mainDealer = JSON.parse(game.main_dealer)
  const deck       = JSON.parse(game.deck)
  const miseTotale = game.mise * 2

  if (deck.length > 0) mainJoueur.push(deck.pop())
  db.prepare('UPDATE blackjack_games SET main_joueur = ?, deck = ? WHERE id = ?')
    .run(JSON.stringify(mainJoueur), JSON.stringify(deck), game.id)

  const finalDealer = dealerPlay(mainDealer, deck)
  db.prepare('UPDATE blackjack_games SET deck = ? WHERE id = ?').run(JSON.stringify(deck), game.id)

  return _resoudrePartie({ ...game, mise_double: game.mise }, mainJoueur, finalDealer, miseTotale)
})

function newGame(userId, mise) { return _newGame(userId, mise) }
function hit(userId)           { return _hit(userId) }
function stand(userId)         { return _stand(userId) }
function doubleDown(userId)    { return _double(userId) }

module.exports = { newGame, hit, stand, double: doubleDown }

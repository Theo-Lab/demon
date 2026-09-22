const db = require('../db')
const { createDeck, handTotal, isSoft17, dealerPlay } = require('./blackjackService')

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTableState(tableId) {
  const table = db.prepare('SELECT * FROM bj_tables WHERE id = ?').get(tableId)
  if (!table) throw new Error('Table introuvable.')
  const sieges = db.prepare('SELECT * FROM bj_sieges WHERE table_id = ? ORDER BY numero').all(tableId)
  return {
    table: {
      ...table,
      deck: JSON.parse(table.deck),
      main_dealer: JSON.parse(table.main_dealer),
    },
    sieges: sieges.map(s => ({
      ...s,
      main: JSON.parse(s.main),
    })),
  }
}

function getAllTables() {
  const tables = db.prepare('SELECT * FROM bj_tables ORDER BY id').all()
  return tables.map(t => {
    const sieges = db.prepare('SELECT * FROM bj_sieges WHERE table_id = ? ORDER BY numero').all(t.id)
    return {
      ...t,
      deck: undefined,
      main_dealer: JSON.parse(t.main_dealer),
      sieges: sieges.map(s => ({ ...s, main: JSON.parse(s.main) })),
    }
  })
}

// ── prendreSiege ──────────────────────────────────────────────────────────────

const _prendreSiege = db.transaction((tableId, siegeNumero, userId, userNom, mise) => {
  const table = db.prepare('SELECT * FROM bj_tables WHERE id = ?').get(tableId)
  if (!table) throw new Error('Table introuvable.')
  if (table.statut !== 'attente') throw new Error('La partie est déjà en cours.')

  const siege = db.prepare('SELECT * FROM bj_sieges WHERE table_id = ? AND numero = ?').get(tableId, siegeNumero)
  if (!siege) throw new Error('Siège introuvable.')
  if (siege.statut !== 'vide') throw new Error('Ce siège est déjà occupé.')

  // Vérifier que le joueur n'est pas déjà assis quelque part
  const dejaAssis = db.prepare(
    "SELECT s.id FROM bj_sieges s JOIN bj_tables t ON t.id = s.table_id WHERE s.user_id = ? AND s.statut != 'vide' AND t.statut = 'attente'"
  ).get(userId)
  if (dejaAssis) throw new Error('Vous êtes déjà assis à une table.')

  // Vérifier aussi en cours
  const dejaEnCours = db.prepare(
    "SELECT s.id FROM bj_sieges s JOIN bj_tables t ON t.id = s.table_id WHERE s.user_id = ? AND t.statut = 'en_cours'"
  ).get(userId)
  if (dejaEnCours) throw new Error('Vous êtes déjà dans une partie en cours.')

  if (mise <= 0) throw new Error('Mise invalide.')

  const user = db.prepare('SELECT id, solde FROM users WHERE id = ?').get(userId)
  if (!user) throw new Error('Utilisateur introuvable.')
  if (user.solde < mise) throw new Error('Solde insuffisant.')

  db.prepare('UPDATE users SET solde = solde - ? WHERE id = ?').run(mise, userId)
  db.prepare(
    "UPDATE bj_sieges SET user_id = ?, user_nom = ?, mise = ?, statut = 'assis', main = '[]', resultat = NULL, gain_net = 0 WHERE table_id = ? AND numero = ?"
  ).run(userId, userNom, mise, tableId, siegeNumero)

  const solde = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId).solde
  return { solde }
})

function prendreSiege(tableId, siegeNumero, userId, userNom, mise) {
  return _prendreSiege(tableId, siegeNumero, userId, userNom, mise)
}

// ── quitterSiege ──────────────────────────────────────────────────────────────

const _quitterSiege = db.transaction((tableId, userId) => {
  const table = db.prepare('SELECT * FROM bj_tables WHERE id = ?').get(tableId)
  if (!table) throw new Error('Table introuvable.')
  if (table.statut !== 'attente') throw new Error('Impossible de quitter une partie en cours.')

  const siege = db.prepare("SELECT * FROM bj_sieges WHERE table_id = ? AND user_id = ? AND statut != 'vide'").get(tableId, userId)
  if (!siege) throw new Error('Vous n\'êtes pas assis à cette table.')

  // Rembourser
  if (siege.mise > 0) {
    db.prepare('UPDATE users SET solde = solde + ? WHERE id = ?').run(siege.mise, userId)
  }
  db.prepare(
    "UPDATE bj_sieges SET user_id = NULL, user_nom = NULL, mise = 0, statut = 'vide', main = '[]', resultat = NULL, gain_net = 0 WHERE id = ?"
  ).run(siege.id)

  const solde = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId).solde
  return { solde }
})

function quitterSiege(tableId, userId) {
  return _quitterSiege(tableId, userId)
}

// ── demarrerPartie ────────────────────────────────────────────────────────────

const _demarrerPartie = db.transaction((tableId) => {
  const table = db.prepare('SELECT * FROM bj_tables WHERE id = ?').get(tableId)
  if (!table) throw new Error('Table introuvable.')
  if (table.statut !== 'attente') throw new Error('La partie a déjà démarré.')

  const siegesOccupes = db.prepare("SELECT * FROM bj_sieges WHERE table_id = ? AND statut = 'assis' ORDER BY numero").all(tableId)
  if (siegesOccupes.length === 0) throw new Error('Aucun joueur assis.')

  const deck = createDeck(6)

  // Distribuer 2 cartes à chaque joueur assis + 2 au dealer
  const mainDealer = [deck.pop(), deck.pop()]

  for (const siege of siegesOccupes) {
    const main = [deck.pop(), deck.pop()]
    db.prepare(
      "UPDATE bj_sieges SET main = ?, statut = 'en_jeu' WHERE id = ?"
    ).run(JSON.stringify(main), siege.id)
  }

  const premierSiege = siegesOccupes[0]

  db.prepare(
    "UPDATE bj_tables SET statut = 'en_cours', deck = ?, main_dealer = ?, siege_actif = ? WHERE id = ?"
  ).run(JSON.stringify(deck), JSON.stringify(mainDealer), premierSiege.numero, tableId)
})

function demarrerPartie(tableId) {
  return _demarrerPartie(tableId)
}

// ── avancerTour ───────────────────────────────────────────────────────────────

// Returns { action: 'next', siegeActif } | { action: 'dealer' }
function avancerTour(tableId) {
  const table = db.prepare('SELECT * FROM bj_tables WHERE id = ?').get(tableId)
  const sieges = db.prepare("SELECT * FROM bj_sieges WHERE table_id = ? AND statut IN ('en_jeu','fini') ORDER BY numero").all(tableId)

  // Trouver le prochain siège 'en_jeu' après le siège actif
  const siegesEnJeu = sieges.filter(s => s.statut === 'en_jeu')
  const courant = siegesEnJeu.find(s => s.numero === table.siege_actif)

  // Chercher les sièges 'en_jeu' avec un numero supérieur
  const restants = siegesEnJeu.filter(s => s.numero > table.siege_actif)

  if (restants.length > 0) {
    const prochain = restants[0]
    db.prepare('UPDATE bj_tables SET siege_actif = ? WHERE id = ?').run(prochain.numero, tableId)
    return { action: 'next', siegeActif: prochain.numero }
  } else {
    return { action: 'dealer' }
  }
}

// ── jouerAction ───────────────────────────────────────────────────────────────

const _jouerAction = db.transaction((tableId, userId, action) => {
  const table = db.prepare('SELECT * FROM bj_tables WHERE id = ?').get(tableId)
  if (!table) throw new Error('Table introuvable.')
  if (table.statut !== 'en_cours') throw new Error('Pas de partie en cours.')

  const siege = db.prepare(
    "SELECT * FROM bj_sieges WHERE table_id = ? AND user_id = ? AND statut = 'en_jeu'"
  ).get(tableId, userId)
  if (!siege) throw new Error('Ce n\'est pas votre tour ou vous n\'êtes pas en jeu.')
  if (siege.numero !== table.siege_actif) throw new Error('Ce n\'est pas votre tour.')

  const main = JSON.parse(siege.main)
  const deck = JSON.parse(table.deck)

  if (action === 'hit') {
    if (deck.length === 0) throw new Error('Plus de cartes.')
    main.push(deck.pop())
    db.prepare('UPDATE bj_sieges SET main = ? WHERE id = ?').run(JSON.stringify(main), siege.id)
    db.prepare('UPDATE bj_tables SET deck = ? WHERE id = ?').run(JSON.stringify(deck), tableId)

    const total = handTotal(main)
    if (total >= 21) {
      // Bust ou 21 → terminer ce siège
      db.prepare("UPDATE bj_sieges SET statut = 'fini' WHERE id = ?").run(siege.id)
      return { done: true, main, total }
    }
    return { done: false, main, total }

  } else if (action === 'stand') {
    db.prepare("UPDATE bj_sieges SET statut = 'fini' WHERE id = ?").run(siege.id)
    const total = handTotal(main)
    return { done: true, main, total }

  } else if (action === 'double') {
    if (main.length !== 2) throw new Error('Double uniquement sur 2 cartes.')
    const user = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId)
    if (user.solde < siege.mise) throw new Error('Solde insuffisant pour doubler.')

    db.prepare('UPDATE users SET solde = solde - ? WHERE id = ?').run(siege.mise, userId)
    const nouvelleMise = siege.mise * 2
    db.prepare('UPDATE bj_sieges SET mise = ? WHERE id = ?').run(nouvelleMise, siege.id)

    if (deck.length > 0) main.push(deck.pop())
    db.prepare('UPDATE bj_sieges SET main = ? WHERE id = ?').run(JSON.stringify(main), siege.id)
    db.prepare('UPDATE bj_tables SET deck = ? WHERE id = ?').run(JSON.stringify(deck), tableId)
    db.prepare("UPDATE bj_sieges SET statut = 'fini' WHERE id = ?").run(siege.id)

    const total = handTotal(main)
    const solde = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId).solde
    return { done: true, main, total, solde }

  } else {
    throw new Error('Action inconnue.')
  }
})

function jouerAction(tableId, userId, action) {
  return _jouerAction(tableId, userId, action)
}

// ── jouerDealer ───────────────────────────────────────────────────────────────

const _jouerDealer = db.transaction((tableId) => {
  const table = db.prepare('SELECT * FROM bj_tables WHERE id = ?').get(tableId)
  const mainDealer = JSON.parse(table.main_dealer)
  const deck = JSON.parse(table.deck)

  const finalDealer = dealerPlay(mainDealer, deck)

  db.prepare('UPDATE bj_tables SET main_dealer = ?, deck = ? WHERE id = ?')
    .run(JSON.stringify(finalDealer), JSON.stringify(deck), tableId)

  return { mainDealer: finalDealer, dTotal: handTotal(finalDealer) }
})

function jouerDealer(tableId) {
  return _jouerDealer(tableId)
}

// ── resoudrePartie ────────────────────────────────────────────────────────────

const _resoudrePartie = db.transaction((tableId) => {
  const table = db.prepare('SELECT * FROM bj_tables WHERE id = ?').get(tableId)
  const mainDealer = JSON.parse(table.main_dealer)
  const dTotal = handTotal(mainDealer)

  const sieges = db.prepare("SELECT * FROM bj_sieges WHERE table_id = ? AND statut = 'fini'").all(tableId)

  const resultats = []

  for (const siege of sieges) {
    if (!siege.user_id) continue
    const main = JSON.parse(siege.main)
    const pTotal = handTotal(main)
    const mise = siege.mise

    // Vérifier blackjack naturel (as + figure sur 2 cartes)
    const isBlackjack = main.length === 2 && pTotal === 21

    let resultat, gain_brut
    if (pTotal > 21) {
      resultat = 'defaite'; gain_brut = 0
    } else if (dTotal > 21 || pTotal > dTotal) {
      if (isBlackjack) {
        resultat = 'blackjack'; gain_brut = Math.floor(mise * 2.5)
      } else {
        resultat = 'victoire'; gain_brut = mise * 2
      }
    } else if (pTotal === dTotal) {
      resultat = 'egalite'; gain_brut = mise
    } else {
      resultat = 'defaite'; gain_brut = 0
    }

    const gain_net = gain_brut - mise

    // Récupérer solde avant (solde actuel avant crédit)
    const userBefore = db.prepare('SELECT solde FROM users WHERE id = ?').get(siege.user_id)
    const solde_avant = userBefore.solde

    if (gain_brut > 0) {
      db.prepare('UPDATE users SET solde = solde + ? WHERE id = ?').run(gain_brut, siege.user_id)
    }

    const solde_apres = db.prepare('SELECT solde FROM users WHERE id = ?').get(siege.user_id).solde

    db.prepare(`
      INSERT INTO game_rounds (user_id, jeu, mise, resultat, gain_net, solde_avant, solde_apres)
      VALUES (?, 'blackjack', ?, ?, ?, ?, ?)
    `).run(
      siege.user_id, mise,
      JSON.stringify({ pTotal, dTotal, resultat }),
      gain_net, solde_avant, solde_apres
    )

    db.prepare('UPDATE bj_sieges SET resultat = ?, gain_net = ? WHERE id = ?')
      .run(resultat, gain_net, siege.id)

    resultats.push({ siegeNumero: siege.numero, user_id: siege.user_id, resultat, gain_net, pTotal, solde: solde_apres })
  }

  db.prepare("UPDATE bj_tables SET statut = 'fini' WHERE id = ?").run(tableId)

  return { resultats, dTotal, mainDealer }
})

function resoudrePartie(tableId) {
  return _resoudrePartie(tableId)
}

// ── resetTable ────────────────────────────────────────────────────────────────

const _resetTable = db.transaction((tableId) => {
  // Garder les joueurs assis avec leur mise, juste remettre les mains à zéro
  db.prepare("UPDATE bj_sieges SET statut = 'assis', main = '[]', resultat = NULL, gain_net = 0 WHERE table_id = ? AND statut != 'vide'").run(tableId)
  db.prepare("UPDATE bj_tables SET statut = 'attente', deck = '[]', main_dealer = '[]', siege_actif = NULL WHERE id = ?").run(tableId)
})

function resetTable(tableId) {
  return _resetTable(tableId)
}

// ── nbJoueursAssis ────────────────────────────────────────────────────────────

function nbJoueursAssis(tableId) {
  const r = db.prepare("SELECT COUNT(*) as n FROM bj_sieges WHERE table_id = ? AND statut != 'vide'").get(tableId)
  return r.n
}

module.exports = {
  getTableState,
  getAllTables,
  prendreSiege,
  quitterSiege,
  demarrerPartie,
  jouerAction,
  avancerTour,
  jouerDealer,
  resoudrePartie,
  resetTable,
  nbJoueursAssis,
}

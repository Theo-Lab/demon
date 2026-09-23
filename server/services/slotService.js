const db = require('../db')

const JACKPOT_MULT_THRESHOLD = 30 // mult_3 >= ce seuil → jackpot visuel

// Tirage pondéré : plus le poids est élevé, plus le symbole apparaît fréquemment
function tirerSymbole(symboles) {
  const total = symboles.reduce((acc, s) => acc + s.poids, 0)
  let r = Math.random() * total
  for (const s of symboles) {
    r -= s.poids
    if (r <= 0) return s
  }
  return symboles[symboles.length - 1]
}

// Évaluation de la ligne de paiement avec support Wild
// Wild = joker, substitue n'importe quel symbole
// Règle : run consécutif depuis la gauche
function evaluerLigne(ligne) {
  if (ligne.length === 0) return { multiplicateur: 0, type: 'none', run: 0, winning_cols: [], near_miss: false, is_jackpot: false }

  // Trouver le premier symbole non-wild
  const firstReal = ligne.find(s => !s.is_wild)

  // Tous wilds → victoire maximale avec le mult du wild lui-même
  if (!firstReal) {
    return {
      multiplicateur: ligne[0].mult_3,
      type: 'jackpot',
      run: ligne.length,
      winning_cols: ligne.map((_, i) => i),
      near_miss: false,
      is_jackpot: true,
    }
  }

  // Run consécutif depuis la gauche (wild = joker)
  let run = 0
  let hasWild = false
  for (let i = 0; i < ligne.length; i++) {
    if (ligne[i].is_wild || ligne[i].id === firstReal.id) {
      run++
      if (ligne[i].is_wild) hasWild = true
    } else break
  }

  const wildSuffix = hasWild ? '_wild' : ''

  if (run >= 3) {
    const isJackpot = firstReal.mult_3 >= JACKPOT_MULT_THRESHOLD
    return {
      multiplicateur: firstReal.mult_3,
      type: isJackpot ? 'jackpot' : `three${wildSuffix}`,
      run,
      winning_cols: [0, 1, 2],
      near_miss: false,
      is_jackpot: isJackpot,
    }
  }

  if (run >= 2) {
    return {
      multiplicateur: firstReal.mult_2,
      type: `two${wildSuffix}`,
      run,
      winning_cols: [0, 1],
      near_miss: false,
      is_jackpot: false,
    }
  }

  // Pas de gain — near miss si 2+ du même symbole présents (peu importe la position)
  const counts = {}
  for (const s of ligne) {
    if (!s.is_wild) counts[s.id] = (counts[s.id] || 0) + 1
  }
  const nearMiss = Object.values(counts).some(c => c >= 2)

  return { multiplicateur: 0, type: 'none', run: 1, winning_cols: [], near_miss: nearMiss, is_jackpot: false }
}

// Transaction atomique complète :
// 1. Vérif config (mise_min/max)
// 2. Vérif solde
// 3. Tirage 3×3
// 4. Calcul gain sur ligne centrale (rangée du milieu)
// 5. Débit mise → crédit gain → log game_rounds
const _jouer = db.transaction((userId, mise) => {
  const config = db.prepare('SELECT * FROM slots_config WHERE id = 1').get()
  if (mise < config.mise_min || mise > config.mise_max) {
    throw new Error(`Mise invalide (min ${config.mise_min.toLocaleString()} ¥, max ${config.mise_max.toLocaleString()} ¥).`)
  }

  const user = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId)
  if (!user) throw new Error('Utilisateur introuvable.')
  if (user.solde < mise) throw new Error('Solde insuffisant.')

  const symboles = db.prepare('SELECT * FROM slots_symbols WHERE actif = 1').all()
  if (symboles.length < 2) throw new Error('Configuration insuffisante : au moins 2 symboles actifs requis.')

  const nb_colonnes = config.nb_colonnes ?? 3
  const grille = Array.from({ length: nb_colonnes * 3 }, () => tirerSymbole(symboles))

  const lignePayline = grille.slice(nb_colonnes, 2 * nb_colonnes)
  const { multiplicateur, type, run, winning_cols, near_miss, is_jackpot } = evaluerLigne(lignePayline)

  const gain      = Math.floor(mise * multiplicateur)
  const gain_net  = gain - mise
  const solde_avant = user.solde
  const solde_apres = solde_avant + gain_net

  db.prepare('UPDATE users SET solde = ? WHERE id = ?').run(solde_apres, userId)

  db.prepare(`
    INSERT INTO game_rounds (user_id, jeu, mise, resultat, gain_net, solde_avant, solde_apres)
    VALUES (?, 'slots', ?, ?, ?, ?, ?)
  `).run(
    userId,
    mise,
    JSON.stringify({
      nb_colonnes,
      grille: grille.map(s => ({ id: s.id, nom: s.nom, image_url: s.image_url, is_wild: !!s.is_wild })),
      ligne:  lignePayline.map(s => ({ id: s.id, nom: s.nom, image_url: s.image_url, is_wild: !!s.is_wild })),
      multiplicateur,
      type,
      run,
      winning_cols,
      near_miss,
      is_jackpot,
    }),
    gain_net,
    solde_avant,
    solde_apres
  )

  return {
    nb_colonnes,
    grille: grille.map(s => ({ id: s.id, nom: s.nom, image_url: s.image_url, is_wild: !!s.is_wild })),
    multiplicateur,
    type,
    run,
    winning_cols,
    near_miss,
    is_jackpot,
    gain,
    gain_net,
    solde: solde_apres,
  }
})

function jouer(userId, mise) {
  return _jouer(userId, mise)
}

module.exports = { jouer }

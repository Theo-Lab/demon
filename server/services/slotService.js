const db = require('../db')

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

// Évaluation de la ligne de paiement (N symboles de gauche à droite)
// Règle : run consécutif depuis la gauche — 3+ identiques → mult_3, 2 → mult_2, sinon 0
function evaluerLigne(ligne) {
  if (ligne.length === 0) return { multiplicateur: 0, type: 'none', run: 0 }
  let run = 1
  while (run < ligne.length && ligne[run].id === ligne[0].id) run++
  if (run >= 3) return { multiplicateur: ligne[0].mult_3, type: 'three', run }
  if (run >= 2) return { multiplicateur: ligne[0].mult_2, type: 'two',   run }
  return { multiplicateur: 0, type: 'none', run: 1 }
}

// Transaction atomique complète :
// 1. Vérif config (mise_min/max)
// 2. Vérif solde
// 3. Tirage 3×3
// 4. Calcul gain sur ligne centrale (rangée du milieu = indices 3,4,5)
// 5. Débit mise → crédit gain → log game_rounds
// Aucun état incohérent possible en cas d'erreur (SQLite rollback auto)
const _jouer = db.transaction((userId, mise) => {
  const config = db.prepare('SELECT * FROM slots_config WHERE id = 1').get()
  if (mise < config.mise_min || mise > config.mise_max) {
    throw new Error(`Mise invalide (min ${config.mise_min.toLocaleString()} ¥, max ${config.mise_max.toLocaleString()} ¥).`)
  }

  const user = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId)
  if (!user) throw new Error('Utilisateur introuvable.')
  if (user.solde < mise) throw new Error('Solde insuffisant.')

  const symboles    = db.prepare('SELECT * FROM slots_symbols WHERE actif = 1').all()
  if (symboles.length < 2) throw new Error('Configuration insuffisante : au moins 2 symboles actifs requis.')

  const nb_colonnes = config.nb_colonnes ?? 3
  // 3 rangées × nb_colonnes rouleaux, stockées rangée par rangée
  // rangée 0 : indices 0..nb_colonnes-1
  // rangée 1 (payline) : nb_colonnes..2*nb_colonnes-1
  // rangée 2 : 2*nb_colonnes..3*nb_colonnes-1
  const grille = Array.from({ length: nb_colonnes * 3 }, () => tirerSymbole(symboles))

  const lignePayline = grille.slice(nb_colonnes, 2 * nb_colonnes)
  const { multiplicateur, type, run } = evaluerLigne(lignePayline)

  const gain     = Math.floor(mise * multiplicateur)
  const gain_net = gain - mise
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
      grille: grille.map(s => ({ id: s.id, nom: s.nom, image_url: s.image_url })),
      ligne:  lignePayline.map(s => ({ id: s.id, nom: s.nom, image_url: s.image_url })),
      multiplicateur,
      type,
      run,
    }),
    gain_net,
    solde_avant,
    solde_apres
  )

  return {
    nb_colonnes,
    grille: grille.map(s => ({ id: s.id, nom: s.nom, image_url: s.image_url })),
    multiplicateur,
    type,
    run,
    gain,
    gain_net,
    solde: solde_apres,
  }
})

function jouer(userId, mise) {
  return _jouer(userId, mise)
}

module.exports = { jouer }

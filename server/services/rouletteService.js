const db      = require('../db')
const discord = require('./discordService')

// Roulette européenne : 0–36
const ROUGE = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])

function couleur(n) {
  if (n === 0) return 'vert'
  return ROUGE.has(n) ? 'rouge' : 'noir'
}

// Retourne le multiplicateur total (mise × mult = gain brut récupéré)
function evaluerMise(type, valeur, numero) {
  const n = numero
  switch (type) {
    case 'plein':      return parseInt(valeur) === n ? 36 : 0  // ×35 + mise
    case 'rouge':      return couleur(n) === 'rouge' ? 2 : 0
    case 'noir':       return couleur(n) === 'noir'  ? 2 : 0
    case 'pair':       return n !== 0 && n % 2 === 0 ? 2 : 0
    case 'impair':     return n !== 0 && n % 2 !== 0 ? 2 : 0
    case 'manque':     return n >= 1  && n <= 18     ? 2 : 0
    case 'passe':      return n >= 19 && n <= 36     ? 2 : 0
    case 'douzaine_1': return n >= 1  && n <= 12     ? 3 : 0
    case 'douzaine_2': return n >= 13 && n <= 24     ? 3 : 0
    case 'douzaine_3': return n >= 25 && n <= 36     ? 3 : 0
    case 'colonne_1':  return n !== 0 && n % 3 === 1 ? 3 : 0
    case 'colonne_2':  return n !== 0 && n % 3 === 2 ? 3 : 0
    case 'colonne_3':  return n !== 0 && n % 3 === 0 ? 3 : 0
    default: return 0
  }
}

// mises : [{ type, valeur, montant }]
const _jouer = db.transaction((userId, mises) => {
  const user = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId)
  if (!user) throw new Error('Utilisateur introuvable.')

  const mise_totale = mises.reduce((s, m) => s + m.montant, 0)
  if (mise_totale <= 0) throw new Error('Mise invalide.')
  if (user.solde < mise_totale) throw new Error('Solde insuffisant.')

  const numero = Math.floor(Math.random() * 37)
  const col    = couleur(numero)

  let gain_brut = 0
  const detail = mises.map(m => {
    const mult = evaluerMise(m.type, m.valeur, numero)
    const brut = m.montant * mult
    gain_brut += brut
    return { type: m.type, valeur: m.valeur, montant: m.montant, mult, gain: brut, net: brut - m.montant }
  })

  const gain_net    = gain_brut - mise_totale
  const solde_avant = user.solde
  const solde_apres = solde_avant + gain_net

  db.prepare('UPDATE users SET solde = ? WHERE id = ?').run(solde_apres, userId)
  db.prepare(`
    INSERT INTO game_rounds (user_id, jeu, mise, resultat, gain_net, solde_avant, solde_apres)
    VALUES (?, 'roulette', ?, ?, ?, ?, ?)
  `).run(
    userId, mise_totale,
    JSON.stringify({ numero, couleur: col, mises: detail }),
    gain_net, solde_avant, solde_apres
  )

  return { numero, couleur: col, mises: detail, gain_net, gain_brut, mise_totale, solde: solde_apres }
})

function jouer(userId, mises) {
  const result = _jouer(userId, mises)
  if (result.gain_net > 0) {
    const user = db.prepare('SELECT nom, identifiant FROM users WHERE id = ?').get(userId)
    const misesDesc = result.mises
      .filter(m => m.gain > 0)
      .map(m => m.type + (m.valeur ? ` ${m.valeur}` : ''))
      .join(', ')
    discord.logGameWin('roulette', {
      playerName:        user?.nom || '?',
      playerIdentifiant: user?.identifiant || '',
      gain_net:          result.gain_net,
      mise:              result.mise_totale,
      solde:             result.solde,
      detail:            `Numéro **${result.numero}** (${result.couleur}) — ${misesDesc}`,
    })
  }
  return result
}

module.exports = { jouer, ROUGE }

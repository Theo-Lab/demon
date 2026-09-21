const db = require('../db')

/**
 * Lance ou résout une expédition (loot).
 * La table de loot et les probabilités sont côté serveur uniquement.
 *
 * @param {number} userId
 * @param {string} expeditionId - Identifiant de l'expédition choisie
 * @returns {{ solde: number, gain_net: number, loot: object[] }}
 */
function lancer(userId, expeditionId) {
  // À implémenter : coût d'entrée, tirage loot table, calcul récompenses
  throw new Error('expeditionService.lancer() non implémenté')
}

module.exports = { lancer }

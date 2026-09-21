const express = require('express')
const db      = require('../db')
const { requireAuth } = require('../middleware/auth')
const rouletteService = require('../services/rouletteService')

const router = express.Router()

// POST /api/roulette/spin
// body: { mises: [{ type, valeur, montant }] }
router.post('/spin', requireAuth, (req, res) => {
  const { mises } = req.body
  if (!Array.isArray(mises) || mises.length === 0)
    return res.status(400).json({ message: 'Aucune mise fournie.' })

  for (const m of mises) {
    if (!m.type || m.montant == null || parseInt(m.montant) <= 0)
      return res.status(400).json({ message: 'Mise invalide.' })
  }

  const misesClean = mises.map(m => ({
    type:    String(m.type),
    valeur:  m.valeur != null ? String(m.valeur) : null,
    montant: parseInt(m.montant),
  }))

  try {
    const resultat = rouletteService.jouer(req.user.id, misesClean)
    res.json(resultat)
  } catch (e) {
    res.status(400).json({ message: e.message })
  }
})

// GET /api/roulette/historique — derniers tours du joueur connecté
router.get('/historique', requireAuth, (req, res) => {
  const rounds = db.prepare(`
    SELECT mise, resultat, gain_net, solde_apres, created_at
    FROM game_rounds
    WHERE user_id = ? AND jeu = 'roulette'
    ORDER BY id DESC LIMIT 20
  `).all(req.user.id)
  res.json({ rounds })
})

module.exports = router

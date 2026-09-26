const express      = require('express')
const { requireAuth } = require('../middleware/auth')
const { spin, MISE_MAX, OUTCOMES } = require('../services/wheelService')

const router = express.Router()

// GET /api/wheel/info — table des résultats + limites
router.get('/info', requireAuth, (_req, res) => {
  res.json({ MISE_MAX, OUTCOMES })
})

// POST /api/wheel/spin
router.post('/spin', requireAuth, (req, res) => {
  const mise = parseInt(req.body.mise)
  if (isNaN(mise)) return res.status(400).json({ message: 'Mise invalide.' })
  try {
    res.json(spin(req.user.id, mise))
  } catch (e) {
    res.status(400).json({ message: e.message })
  }
})

module.exports = router

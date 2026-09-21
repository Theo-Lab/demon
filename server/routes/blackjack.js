const express = require('express')
const { requireAuth } = require('../middleware/auth')
const bj = require('../services/blackjackService')

const router = express.Router()

// POST /api/blackjack/new  — démarrer une nouvelle partie
router.post('/new', requireAuth, (req, res) => {
  const mise = parseInt(req.body.mise)
  if (!mise || mise <= 0) return res.status(400).json({ message: 'Mise invalide.' })
  try {
    res.json(bj.newGame(req.user.id, mise))
  } catch (e) {
    res.status(400).json({ message: e.message })
  }
})

// POST /api/blackjack/hit
router.post('/hit', requireAuth, (req, res) => {
  try {
    res.json(bj.hit(req.user.id))
  } catch (e) {
    res.status(400).json({ message: e.message })
  }
})

// POST /api/blackjack/stand
router.post('/stand', requireAuth, (req, res) => {
  try {
    res.json(bj.stand(req.user.id))
  } catch (e) {
    res.status(400).json({ message: e.message })
  }
})

// POST /api/blackjack/double
router.post('/double', requireAuth, (req, res) => {
  try {
    res.json(bj.double(req.user.id))
  } catch (e) {
    res.status(400).json({ message: e.message })
  }
})

module.exports = router

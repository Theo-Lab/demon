'use strict'

const express    = require('express')
const { requireAuth } = require('../middleware/auth')
const corps      = require('../services/corpsService')

const router = express.Router()

const MISE_MIN = 100
const MISE_MAX = 50000

// GET /api/corps/state
router.get('/state', requireAuth, (req, res) => {
  try {
    res.json(corps.getState(req.user.id))
  } catch (e) {
    res.status(400).json({ message: e.message })
  }
})

// GET /api/corps/difficulties
router.get('/difficulties', requireAuth, (req, res) => {
  res.json(corps.DIFFICULTIES)
})

// POST /api/corps/start
router.post('/start', requireAuth, (req, res) => {
  try {
    const mise       = parseInt(req.body.mise)
    const difficulte = req.body.difficulte || 'demoniaque'
    if (!mise || isNaN(mise) || mise < MISE_MIN || mise > MISE_MAX) {
      return res.status(400).json({
        message: `Mise invalide. Min ${MISE_MIN.toLocaleString('fr-FR')} ¥ — Max ${MISE_MAX.toLocaleString('fr-FR')} ¥`,
      })
    }
    res.json(corps.start(req.user.id, mise, difficulte))
  } catch (e) {
    res.status(400).json({ message: e.message })
  }
})

// POST /api/corps/pump
router.post('/pump', requireAuth, (req, res) => {
  try {
    res.json(corps.pump(req.user.id))
  } catch (e) {
    res.status(400).json({ message: e.message })
  }
})

// POST /api/corps/sceller
router.post('/sceller', requireAuth, (req, res) => {
  try {
    res.json(corps.sceller(req.user.id))
  } catch (e) {
    res.status(400).json({ message: e.message })
  }
})

module.exports = router

'use strict'

const express    = require('express')
const { requireAuth } = require('../middleware/auth')
const ways243    = require('../services/ways243Service')
const { MISE_MIN, MISE_MAX } = require('../config/slotConfig')

const router = express.Router()

// POST /api/ways243/spin
router.post('/spin', requireAuth, (req, res) => {
  try {
    const mise = parseInt(req.body.mise)
    if (!mise || isNaN(mise) || mise < MISE_MIN || mise > MISE_MAX) {
      return res.status(400).json({
        message: `Mise invalide. Min ${MISE_MIN.toLocaleString('fr-FR')} ¥ — Max ${MISE_MAX.toLocaleString('fr-FR')} ¥`,
      })
    }
    const result = ways243.spin(req.user.id, mise)
    res.json(result)
  } catch (e) {
    res.status(400).json({ message: e.message })
  }
})

module.exports = router

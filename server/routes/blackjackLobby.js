const express = require('express')
const router = express.Router()
const { requireAuth } = require('../middleware/auth')
const { getAllTables } = require('../services/blackjackLobbyService')

// GET /api/blackjack-lobby/tables
router.get('/tables', requireAuth, (req, res) => {
  try {
    const tables = getAllTables()
    res.json({ tables })
  } catch (e) {
    res.status(500).json({ message: e.message })
  }
})

module.exports = router

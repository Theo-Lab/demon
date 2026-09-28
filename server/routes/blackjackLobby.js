const express = require('express')
const router = express.Router()
const db = require('../db')
const { requireAuth } = require('../middleware/auth')
const { getAllTables, closeTable } = require('../services/blackjackLobbyService')

function requireCasino(req, res, next) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id)
  if (!user || !['admin', 'groupier'].includes(user.role)) {
    return res.status(403).json({ message: 'Accès refusé.' })
  }
  next()
}

// GET /api/blackjack-lobby/tables
router.get('/tables', requireAuth, (req, res) => {
  try {
    const tables = getAllTables()
    res.json({ tables })
  } catch (e) {
    res.status(500).json({ message: e.message })
  }
})

// POST /api/blackjack-lobby/tables/:id/close
router.post('/tables/:id/close', requireAuth, requireCasino, (req, res) => {
  try {
    const tableId = parseInt(req.params.id)
    closeTable(tableId)
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ message: e.message })
  }
})

module.exports = router

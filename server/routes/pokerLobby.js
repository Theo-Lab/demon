const express = require('express')
const { requireAuth } = require('../middleware/auth')
const { createTable, listTables } = require('../services/pokerService')

const router = express.Router()

router.get('/tables', requireAuth, (_req, res) => {
  res.json(listTables())
})

router.post('/tables', requireAuth, (req, res) => {
  const { name, smallBlind, bigBlind, maxPlayers } = req.body
  if (!name?.trim()) return res.status(400).json({ message: 'Nom de table requis.' })
  try {
    const id = createTable({
      name: name.trim(),
      smallBlind: parseInt(smallBlind) || 500,
      bigBlind: parseInt(bigBlind) || 1000,
      maxPlayers: Math.min(8, Math.max(2, parseInt(maxPlayers) || 6)),
    })
    res.json({ id })
  } catch (e) {
    res.status(400).json({ message: e.message })
  }
})

module.exports = router

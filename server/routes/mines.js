const express = require('express')
const { requireAuth } = require('../middleware/auth')
const { newGame, reveal, cashout, TOTAL } = require('../services/minesService')

const HOUSE_EDGE = 0.04
const router = express.Router()

router.get('/info', requireAuth, (_req, res) => {
  res.json({ TOTAL, HOUSE_EDGE })
})

router.post('/new', requireAuth, (req, res) => {
  const mise      = parseInt(req.body.mise)
  const nb_mines  = parseInt(req.body.nb_mines)
  try { res.json(newGame(req.user.id, mise, nb_mines)) }
  catch (e) { res.status(400).json({ message: e.message }) }
})

router.post('/reveal', requireAuth, (req, res) => {
  const position = parseInt(req.body.position)
  try { res.json(reveal(req.user.id, position)) }
  catch (e) { res.status(400).json({ message: e.message }) }
})

router.post('/cashout', requireAuth, (req, res) => {
  try { res.json(cashout(req.user.id)) }
  catch (e) { res.status(400).json({ message: e.message }) }
})

module.exports = router

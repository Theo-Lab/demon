const express     = require('express')
const { requireAuth } = require('../middleware/auth')
const { newGame, avancer, encaisser, MULT, MAX_LANES } = require('../services/crossroadService')

const router = express.Router()

router.get('/info', requireAuth, (_req, res) => {
  res.json({ MULT, MAX_LANES })
})

router.post('/new', requireAuth, (req, res) => {
  const mise = parseInt(req.body.mise)
  if (!mise || mise <= 0) return res.status(400).json({ message: 'Mise invalide.' })
  try { res.json(newGame(req.user.id, mise)) }
  catch (e) { res.status(400).json({ message: e.message }) }
})

router.post('/avancer', requireAuth, (req, res) => {
  try { res.json(avancer(req.user.id)) }
  catch (e) { res.status(400).json({ message: e.message }) }
})

router.post('/encaisser', requireAuth, (req, res) => {
  try { res.json(encaisser(req.user.id)) }
  catch (e) { res.status(400).json({ message: e.message }) }
})

module.exports = router

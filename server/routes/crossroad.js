const express     = require('express')
const db          = require('../db')
const { requireAuth } = require('../middleware/auth')
const { newGame, avancer, encaisser, getMultArray, MAX_LANES } = require('../services/crossroadService')

const router = express.Router()

function requireCasino(req, res, next) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id)
  if (!user || !['admin', 'groupier'].includes(user.role)) return res.status(403).json({ message: 'Accès refusé.' })
  next()
}

router.get('/info', requireAuth, (_req, res) => {
  res.json({ MULT: getMultArray(), MAX_LANES })
})

router.get('/config', requireAuth, requireCasino, (_req, res) => {
  const row = db.prepare('SELECT crossroad_bust_prob FROM slots_config WHERE id = 1').get()
  res.json({ bust_prob: row?.crossroad_bust_prob ?? 0.12 })
})

router.post('/config', requireAuth, requireCasino, (req, res) => {
  const prob = parseFloat(req.body.bust_prob)
  if (isNaN(prob) || prob < 0.01 || prob > 0.99) return res.status(400).json({ message: 'Probabilité invalide (0.01–0.99).' })
  db.prepare('UPDATE slots_config SET crossroad_bust_prob = ? WHERE id = 1').run(prob)
  res.json({ bust_prob: prob })
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

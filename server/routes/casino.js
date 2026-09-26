const express = require('express')
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

function requireCasino(req, res, next) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id)
  if (!user || !['admin', 'groupier'].includes(user.role)) return res.status(403).json({ message: 'Accès refusé.' })
  next()
}

router.get('/games', requireAuth, (_req, res) => {
  const row = db.prepare('SELECT slots_actif, blackjack_actif, roulette_actif, crossroad_actif, mines_actif, wheel_actif FROM slots_config WHERE id = 1').get()
  res.json({
    slots:     !!row?.slots_actif,
    blackjack: !!row?.blackjack_actif,
    roulette:  !!row?.roulette_actif,
    crossroad: !!row?.crossroad_actif,
    mines:     !!row?.mines_actif,
    wheel:     !!row?.wheel_actif,
  })
})

router.post('/games', requireAuth, requireCasino, (req, res) => {
  const { slots, blackjack, roulette, crossroad, mines, wheel } = req.body
  db.prepare(`
    UPDATE slots_config
    SET slots_actif = ?, blackjack_actif = ?, roulette_actif = ?, crossroad_actif = ?, mines_actif = ?, wheel_actif = ?
    WHERE id = 1
  `).run(slots ? 1 : 0, blackjack ? 1 : 0, roulette ? 1 : 0, crossroad ? 1 : 0, mines ? 1 : 0, wheel ? 1 : 0)
  res.json({ ok: true })
})

module.exports = router

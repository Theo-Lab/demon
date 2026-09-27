const express = require('express')
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

function requireCasino(req, res, next) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id)
  if (!user || !['admin', 'groupier'].includes(user.role)) return res.status(403).json({ message: 'Accès refusé.' })
  next()
}

function requireAdmin(req, res, next) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id)
  if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Accès refusé.' })
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

// GET /api/casino/blackjack — limites (tout utilisateur connecté)
router.get('/blackjack', requireAuth, (req, res) => {
  const config = db.prepare('SELECT bj_solo_mise_min, bj_solo_mise_max FROM slots_config WHERE id = 1').get()
  const tables = db.prepare('SELECT id, mise_min, mise_max FROM bj_tables ORDER BY id').all()
  res.json({ soloMin: config?.bj_solo_mise_min ?? 500, soloMax: config?.bj_solo_mise_max ?? 500000, tables })
})

// POST /api/casino/blackjack — mise à jour des limites (casino/admin)
router.post('/blackjack', requireAuth, requireCasino, (req, res) => {
  const { soloMin, soloMax, tables } = req.body
  if (soloMin != null && soloMax != null) {
    db.prepare('UPDATE slots_config SET bj_solo_mise_min = ?, bj_solo_mise_max = ? WHERE id = 1')
      .run(parseInt(soloMin), parseInt(soloMax))
  }
  if (Array.isArray(tables)) {
    for (const t of tables) {
      db.prepare('UPDATE bj_tables SET mise_min = ?, mise_max = ? WHERE id = ?')
        .run(parseInt(t.mise_min), parseInt(t.mise_max), t.id)
    }
  }
  res.json({ ok: true })
})

// POST /api/casino/malchance/:userId — activer/désactiver la malchance + configurer le % (admin uniquement)
router.post('/malchance/:userId', requireAuth, requireAdmin, (req, res) => {
  const { actif, prob } = req.body
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.userId)
  if (!user) return res.status(404).json({ message: 'Joueur introuvable.' })
  if (actif !== undefined)
    db.prepare('UPDATE users SET malchance = ? WHERE id = ?').run(actif ? 1 : 0, req.params.userId)
  if (prob !== undefined) {
    const p = Math.max(0.01, Math.min(0.99, parseFloat(prob)))
    db.prepare('UPDATE users SET malchance_prob = ? WHERE id = ?').run(p, req.params.userId)
  }
  const updated = db.prepare('SELECT malchance, malchance_prob FROM users WHERE id = ?').get(req.params.userId)
  res.json({ ok: true, malchance: !!updated.malchance, malchance_prob: updated.malchance_prob ?? 0.60 })
})

// GET /api/casino/malchance-logs/:userId — historique des déclenchements (admin uniquement)
router.get('/malchance-logs/:userId', requireAuth, requireAdmin, (req, res) => {
  const logs = db.prepare(`
    SELECT id, jeu, created_at FROM malchance_logs
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.params.userId)
  res.json(logs)
})

module.exports = router

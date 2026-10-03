'use strict'

const express = require('express')
const multer  = require('multer')
const path    = require('path')
const { requireAuth } = require('../middleware/auth')
const demonsGate = require('../services/demonsGateService')
const db = require('../db')

const router = express.Router()

const MISE_MIN = 50
const MISE_MAX = 5000

const VALID_DG_SYMS = ['DEMON', 'KNIGHT', 'MAGE', 'MINION', 'LOW1', 'LOW2', 'LOW3', 'FLAME', 'SKULL']

function requireAdmin(req, res, next) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id)
  if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Accès refusé.' })
  next()
}

const dgStorage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png'
    cb(null, `dg_sym_${req.params.sym}${ext}`)
  },
})
const dgUpload = multer({
  storage: dgStorage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Image uniquement.'))
    cb(null, true)
  },
})

// GET /api/demons-gate/symbols
router.get('/symbols', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT sym, url, name FROM dg_symbols').all()
  const map = {}
  rows.forEach(r => { map[r.sym] = { url: r.url, name: r.name } })
  res.json(map)
})

// POST /api/demons-gate/symbols/:sym — upload image
router.post('/symbols/:sym', requireAuth, requireAdmin, (req, res) => {
  const { sym } = req.params
  if (!VALID_DG_SYMS.includes(sym)) return res.status(400).json({ message: 'Symbole invalide.' })
  dgUpload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message })
    if (!req.file) return res.status(400).json({ message: 'Aucun fichier reçu.' })
    const url = `/uploads/${req.file.filename}`
    db.prepare(`
      INSERT INTO dg_symbols (sym, url, name) VALUES (?, ?, '')
      ON CONFLICT(sym) DO UPDATE SET url = excluded.url
    `).run(sym, url)
    res.json({ ok: true, sym, url })
  })
})

// PATCH /api/demons-gate/symbols/:sym — modifier le nom
router.patch('/symbols/:sym', requireAuth, requireAdmin, (req, res) => {
  const { sym } = req.params
  if (!VALID_DG_SYMS.includes(sym)) return res.status(400).json({ message: 'Symbole invalide.' })
  const name = String(req.body.name ?? '').trim().slice(0, 40)
  db.prepare(`
    INSERT INTO dg_symbols (sym, url, name) VALUES (?, '', ?)
    ON CONFLICT(sym) DO UPDATE SET name = excluded.name
  `).run(sym, name)
  res.json({ ok: true, sym, name })
})

// GET /api/demons-gate/state
router.get('/state', requireAuth, (req, res) => {
  try {
    const state = demonsGate.getState(req.user.id)
    res.json(state)
  } catch (e) {
    res.status(400).json({ message: e.message })
  }
})

// POST /api/demons-gate/spin
router.post('/spin', requireAuth, (req, res) => {
  try {
    const mise = parseInt(req.body.mise)
    if (!mise || isNaN(mise) || mise < MISE_MIN || mise > MISE_MAX) {
      return res.status(400).json({
        message: `Mise invalide. Min ${MISE_MIN.toLocaleString('fr-FR')} ¥ — Max ${MISE_MAX.toLocaleString('fr-FR')} ¥`,
      })
    }
    const result = demonsGate.spin(req.user.id, mise)
    res.json(result)
  } catch (e) {
    res.status(400).json({ message: e.message })
  }
})

// POST /api/demons-gate/respin
router.post('/respin', requireAuth, (req, res) => {
  try {
    const result = demonsGate.respin(req.user.id)
    res.json(result)
  } catch (e) {
    res.status(400).json({ message: e.message })
  }
})

// GET /api/demons-gate/admin/logs — admin only
router.get('/admin/logs', requireAuth, requireAdmin, (req, res) => {
  const { joueur, date_from, date_to, limit: lim } = req.query
  const limit = Math.min(parseInt(lim) || 100, 500)

  const conditions = ["gr.jeu = 'demons_gate'"]
  const params     = []

  if (joueur) {
    conditions.push("u.nom LIKE ?")
    params.push(`%${joueur}%`)
  }
  if (date_from) { conditions.push("gr.created_at >= ?"); params.push(date_from) }
  if (date_to)   { conditions.push("gr.created_at <= ?"); params.push(date_to + ' 23:59:59') }

  const where = conditions.join(' AND ')

  const rounds = db.prepare(`
    SELECT gr.id, u.nom as user_nom, gr.mise, gr.gain_net, gr.resultat, gr.created_at
    FROM game_rounds gr
    JOIN users u ON u.id = gr.user_id
    WHERE ${where}
    ORDER BY gr.created_at DESC
    LIMIT ?
  `).all(...params, limit)

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_rounds,
      SUM(CASE WHEN gr.gain_net > 0 THEN 1 ELSE 0 END) as win_rounds,
      SUM(gr.mise) as total_wagered,
      SUM(CASE WHEN gr.gain_net > 0 THEN gr.gain_net ELSE 0 END) as total_paid_out,
      SUM(gr.mise + gr.gain_net) as total_net_house
    FROM game_rounds gr
    JOIN users u ON u.id = gr.user_id
    WHERE ${where}
  `).get(...params)

  res.json({ rounds, stats })
})

// GET /api/demons-gate/history
router.get('/history', requireAuth, (req, res) => {
  const userId = req.user.id
  const limit  = Math.min(parseInt(req.query.limit) || 30, 100)

  const rounds = db.prepare(`
    SELECT mise, gain_net, created_at
    FROM game_rounds
    WHERE user_id = ? AND jeu = 'demons_gate'
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, limit)

  const credits = db.prepare(`
    SELECT type, credits, montant_yen, solde_avant, solde_apres, created_at
    FROM dg_credits_logs
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, limit)

  res.json({ rounds, credits })
})

// POST /api/demons-gate/buy-credits
router.post('/buy-credits', requireAuth, (req, res) => {
  try {
    const montant = parseInt(req.body.montant)
    if (!montant || isNaN(montant) || montant <= 0) {
      return res.status(400).json({ message: 'Montant invalide.' })
    }
    const result = demonsGate.buyCredits(req.user.id, montant)
    res.json(result)
  } catch (e) {
    res.status(400).json({ message: e.message })
  }
})

// POST /api/demons-gate/cashout
router.post('/cashout', requireAuth, (req, res) => {
  try {
    const result = demonsGate.cashout(req.user.id)
    res.json(result)
  } catch (e) {
    res.status(400).json({ message: e.message })
  }
})

module.exports = router

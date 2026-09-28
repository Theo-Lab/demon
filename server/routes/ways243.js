'use strict'

const express    = require('express')
const multer     = require('multer')
const path       = require('path')
const { requireAuth } = require('../middleware/auth')
const ways243    = require('../services/ways243Service')
const { MISE_MIN, MISE_MAX } = require('../config/slotConfig')
const db         = require('../db')

const router = express.Router()

// ── Middleware admin ───────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id)
  if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Accès refusé.' })
  next()
}

// ── Multer pour upload symboles ────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png'
    cb(null, `oni_sym_${req.params.sym}${ext}`)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Image uniquement.'))
    cb(null, true)
  },
})

const VALID_SYMS = ['KUNAI', 'MASQUE', 'TALISMAN', 'FLEUR', 'HASHIRA', 'KATANA', 'DEMON', 'WILD']

// ── GET /api/ways243/symbols ───────────────────────────────────────────────────
router.get('/symbols', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT sym, url FROM oni_symbols').all()
  const map = {}
  rows.forEach(r => { map[r.sym] = r.url })
  res.json(map)
})

// ── POST /api/ways243/symbols/:sym ─────────────────────────────────────────────
router.post('/symbols/:sym', requireAuth, requireAdmin, (req, res) => {
  const { sym } = req.params
  if (!VALID_SYMS.includes(sym)) return res.status(400).json({ message: 'Symbole invalide.' })

  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message })
    if (!req.file) return res.status(400).json({ message: 'Aucun fichier reçu.' })
    const url = `/uploads/${req.file.filename}`
    db.prepare('INSERT OR REPLACE INTO oni_symbols (sym, url) VALUES (?, ?)').run(sym, url)
    res.json({ ok: true, sym, url })
  })
})

// ── POST /api/ways243/spin ─────────────────────────────────────────────────────
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

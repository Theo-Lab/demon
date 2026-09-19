const express = require('express')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const db = require('../db')

const router = express.Router()
const SECRET = process.env.JWT_SECRET || 'yugen_ordre_demoniaque_secret'

function auth(req, res, next) {
  const header = req.headers.authorization
  if (!header) return res.status(401).json({ message: 'Non authentifié.' })
  try {
    req.user = jwt.verify(header.split(' ')[1], SECRET)
    next()
  } catch {
    res.status(401).json({ message: 'Token invalide.' })
  }
}

// GET /api/parchemins — admin : tous, membre : les siens
router.get('/', auth, (req, res) => {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id)
  const parchemins = user.role === 'admin'
    ? db.prepare(`
        SELECT p.id, p.titre, p.doc_titre, p.contenu, p.token, p.created_at, u.nom as auteur_nom
        FROM parchemins p JOIN users u ON u.id = p.auteur_id
        ORDER BY p.created_at DESC
      `).all()
    : db.prepare(`
        SELECT id, titre, doc_titre, contenu, token, created_at
        FROM parchemins WHERE auteur_id = ?
        ORDER BY created_at DESC
      `).all(req.user.id)
  res.json({ parchemins })
})

// GET /api/parchemins/:token — public (quiconque avec le lien)
router.get('/:token', (req, res) => {
  const parchemin = db.prepare(`
    SELECT p.*, u.nom as auteur_nom
    FROM parchemins p
    JOIN users u ON u.id = p.auteur_id
    WHERE p.token = ?
  `).get(req.params.token)

  if (!parchemin) return res.status(404).json({ message: 'Parchemin introuvable.' })
  res.json({ parchemin })
})

// POST /api/parchemins — créer
router.post('/', auth, (req, res) => {
  const { titre, doc_titre, contenu } = req.body
  if (!titre || !doc_titre) return res.status(400).json({ message: 'Titre requis.' })

  const token = crypto.randomBytes(6).toString('hex')
  const result = db.prepare(`
    INSERT INTO parchemins (auteur_id, titre, doc_titre, contenu, token)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user.id, titre, doc_titre, contenu || '[]', token)

  const parchemin = db.prepare(`
    SELECT p.*, u.nom as auteur_nom FROM parchemins p
    JOIN users u ON u.id = p.auteur_id WHERE p.id = ?
  `).get(result.lastInsertRowid)

  res.status(201).json({ parchemin })
})

// PATCH /api/parchemins/:token — modifier (auteur seulement)
router.patch('/:token', auth, (req, res) => {
  const parchemin = db.prepare('SELECT * FROM parchemins WHERE token = ?').get(req.params.token)
  if (!parchemin) return res.status(404).json({ message: 'Parchemin introuvable.' })
  if (parchemin.auteur_id !== req.user.id) return res.status(403).json({ message: 'Accès refusé.' })

  const { titre, doc_titre, contenu } = req.body
  db.prepare(`
    UPDATE parchemins SET titre = ?, doc_titre = ?, contenu = ? WHERE token = ?
  `).run(titre ?? parchemin.titre, doc_titre ?? parchemin.doc_titre, contenu ?? parchemin.contenu, req.params.token)

  res.json({ message: 'Parchemin mis à jour.' })
})

// DELETE /api/parchemins/:token — auteur ou admin
router.delete('/:token', auth, (req, res) => {
  const parchemin = db.prepare('SELECT * FROM parchemins WHERE token = ?').get(req.params.token)
  if (!parchemin) return res.status(404).json({ message: 'Parchemin introuvable.' })
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id)
  if (parchemin.auteur_id !== req.user.id && user.role !== 'admin') return res.status(403).json({ message: 'Accès refusé.' })

  db.prepare('DELETE FROM parchemins WHERE token = ?').run(req.params.token)
  res.json({ message: 'Parchemin supprimé.' })
})

module.exports = router

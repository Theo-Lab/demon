const express = require('express')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const db = require('../db')

const router = express.Router()
const SECRET = process.env.JWT_SECRET || 'yugen_ordre_demoniaque_secret'

function newToken() {
  return crypto.randomBytes(6).toString('hex')
}

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

function requireAdmin(req, res, next) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id)
  if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Accès refusé.' })
  next()
}

// GET /api/rapports
// Admin : tous les rapports publiés + ses propres brouillons
// Membre : tous ses propres rapports (publiés + brouillons)
router.get('/', auth, (req, res) => {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id)

  let rapports
  if (user.role === 'admin') {
    rapports = db.prepare(`
      SELECT r.*, u.nom as auteur_nom, u.grade as auteur_grade, u.pouvoir_nom as auteur_pouvoir, u.signature as auteur_signature,
        (SELECT GROUP_CONCAT(s.nom, ' · ') FROM user_spheres us2 JOIN spheres s ON s.id = us2.sphere_id WHERE us2.user_id = u.id) as auteur_spheres
      FROM rapports r
      JOIN users u ON u.id = r.auteur_id
      WHERE r.brouillon = 0 OR r.auteur_id = ?
      ORDER BY r.created_at DESC
    `).all(req.user.id)
  } else {
    rapports = db.prepare(`
      SELECT r.*, u.nom as auteur_nom, u.grade as auteur_grade, u.pouvoir_nom as auteur_pouvoir, u.signature as auteur_signature,
        (SELECT GROUP_CONCAT(s.nom, ' · ') FROM user_spheres us2 JOIN spheres s ON s.id = us2.sphere_id WHERE us2.user_id = u.id) as auteur_spheres
      FROM rapports r
      JOIN users u ON u.id = r.auteur_id
      WHERE r.auteur_id = ?
      ORDER BY r.created_at DESC
    `).all(req.user.id)
  }

  res.json({ rapports })
})

// GET /api/rapports/:token — public (brouillons bloqués)
router.get('/:token', (req, res) => {
  const rapport = db.prepare(`
    SELECT r.*, u.nom as auteur_nom, u.grade as auteur_grade, u.pouvoir_nom as auteur_pouvoir, u.signature as auteur_signature,
      (SELECT GROUP_CONCAT(s.nom, ' · ') FROM user_spheres us2 JOIN spheres s ON s.id = us2.sphere_id WHERE us2.user_id = u.id) as auteur_spheres
    FROM rapports r
    JOIN users u ON u.id = r.auteur_id
    WHERE r.token = ?
  `).get(req.params.token)

  if (!rapport) return res.status(404).json({ message: 'Rapport introuvable.' })
  if (rapport.brouillon) return res.status(403).json({ message: 'Ce rapport est en brouillon.' })

  res.json({ rapport })
})

// POST /api/rapports
router.post('/', auth, (req, res) => {
  const { type, titre, contenu, brouillon } = req.body
  if (!type || !titre) return res.status(400).json({ message: 'Champs manquants.' })

  const token = newToken()
  const result = db.prepare(`
    INSERT INTO rapports (auteur_id, type, titre, contenu, token, brouillon)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.user.id, type, titre, contenu || '[]', token, brouillon ? 1 : 0)

  const rapport = db.prepare(`
    SELECT r.*, u.nom as auteur_nom
    FROM rapports r JOIN users u ON u.id = r.auteur_id
    WHERE r.id = ?
  `).get(result.lastInsertRowid)

  res.status(201).json({ rapport })
})

// PATCH /api/rapports/:token — édition contenu (auteur seulement)
router.patch('/:token', auth, (req, res) => {
  const rapport = db.prepare('SELECT * FROM rapports WHERE token = ?').get(req.params.token)
  if (!rapport) return res.status(404).json({ message: 'Rapport introuvable.' })
  if (rapport.auteur_id !== req.user.id) return res.status(403).json({ message: 'Accès refusé.' })

  const { type, titre, contenu, brouillon } = req.body

  db.prepare(`
    UPDATE rapports
    SET type = ?, titre = ?, contenu = ?, brouillon = ?
    WHERE token = ?
  `).run(
    type      ?? rapport.type,
    titre     ?? rapport.titre,
    contenu   ?? rapport.contenu,
    brouillon !== undefined ? (brouillon ? 1 : 0) : rapport.brouillon,
    req.params.token
  )

  const updated = db.prepare(`
    SELECT r.*, u.nom as auteur_nom
    FROM rapports r JOIN users u ON u.id = r.auteur_id
    WHERE r.token = ?
  `).get(req.params.token)

  res.json({ rapport: updated })
})

// PATCH /api/rapports/:token/statut — admin seulement
router.patch('/:token/statut', auth, requireAdmin, (req, res) => {
  const { statut } = req.body
  if (!['en_attente', 'valide', 'refuse'].includes(statut)) {
    return res.status(400).json({ message: 'Statut invalide.' })
  }

  const rapport = db.prepare('SELECT id FROM rapports WHERE token = ?').get(req.params.token)
  if (!rapport) return res.status(404).json({ message: 'Rapport introuvable.' })

  db.prepare('UPDATE rapports SET statut = ? WHERE token = ?').run(statut, req.params.token)
  res.json({ message: 'Statut mis à jour.' })
})

// DELETE /api/rapports/:token — auteur ou admin
router.delete('/:token', auth, (req, res) => {
  const rapport = db.prepare('SELECT * FROM rapports WHERE token = ?').get(req.params.token)
  if (!rapport) return res.status(404).json({ message: 'Rapport introuvable.' })

  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id)
  if (rapport.auteur_id !== req.user.id && user.role !== 'admin') {
    return res.status(403).json({ message: 'Accès refusé.' })
  }

  db.prepare('DELETE FROM rapports WHERE token = ?').run(req.params.token)
  res.json({ message: 'Rapport supprimé.' })
})

module.exports = router

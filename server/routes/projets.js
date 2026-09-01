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

// GET /api/projets — liste privée de l'auteur connecté
router.get('/', auth, (req, res) => {
  const projets = db.prepare(`
    SELECT id, titre, doc_titre, token, created_at
    FROM projets
    WHERE auteur_id = ?
    ORDER BY created_at DESC
  `).all(req.user.id)
  res.json({ projets })
})

// GET /api/projets/:token — public (quiconque avec le lien)
router.get('/:token', (req, res) => {
  const projet = db.prepare(`
    SELECT p.*, u.nom as auteur_nom
    FROM projets p
    JOIN users u ON u.id = p.auteur_id
    WHERE p.token = ?
  `).get(req.params.token)

  if (!projet) return res.status(404).json({ message: 'Projet introuvable.' })
  res.json({ projet })
})

// POST /api/projets — créer
router.post('/', auth, (req, res) => {
  const { titre, doc_titre, contenu } = req.body
  if (!titre || !doc_titre) return res.status(400).json({ message: 'Titre requis.' })

  const token = crypto.randomBytes(6).toString('hex')
  const result = db.prepare(`
    INSERT INTO projets (auteur_id, titre, doc_titre, contenu, token)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user.id, titre, doc_titre, contenu || '[]', token)

  const projet = db.prepare(`
    SELECT p.*, u.nom as auteur_nom FROM projets p
    JOIN users u ON u.id = p.auteur_id WHERE p.id = ?
  `).get(result.lastInsertRowid)

  res.status(201).json({ projet })
})

// PATCH /api/projets/:token — modifier (auteur seulement)
router.patch('/:token', auth, (req, res) => {
  const projet = db.prepare('SELECT * FROM projets WHERE token = ?').get(req.params.token)
  if (!projet) return res.status(404).json({ message: 'Projet introuvable.' })
  if (projet.auteur_id !== req.user.id) return res.status(403).json({ message: 'Accès refusé.' })

  const { titre, doc_titre, contenu } = req.body
  db.prepare(`
    UPDATE projets SET titre = ?, doc_titre = ?, contenu = ? WHERE token = ?
  `).run(titre ?? projet.titre, doc_titre ?? projet.doc_titre, contenu ?? projet.contenu, req.params.token)

  res.json({ message: 'Projet mis à jour.' })
})

// DELETE /api/projets/:token — auteur seulement
router.delete('/:token', auth, (req, res) => {
  const projet = db.prepare('SELECT * FROM projets WHERE token = ?').get(req.params.token)
  if (!projet) return res.status(404).json({ message: 'Projet introuvable.' })
  if (projet.auteur_id !== req.user.id) return res.status(403).json({ message: 'Accès refusé.' })

  db.prepare('DELETE FROM projets WHERE token = ?').run(req.params.token)
  res.json({ message: 'Projet supprimé.' })
})

module.exports = router

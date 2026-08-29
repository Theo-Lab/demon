const express = require('express')
const jwt = require('jsonwebtoken')
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

function requireAdmin(req, res, next) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id)
  if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Accès refusé.' })
  next()
}

function isChefOrAdmin(req, sphereId) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id)
  if (user?.role === 'admin') return true
  const sphere = db.prepare('SELECT chef_id FROM spheres WHERE id = ?').get(sphereId)
  return sphere?.chef_id === req.user.id
}

// GET /api/spheres — liste publique
router.get('/', (req, res) => {
  const spheres = db.prepare(`
    SELECT s.*, u.nom as chef_nom,
      (SELECT COUNT(*) FROM user_spheres us WHERE us.sphere_id = s.id) as nb_membres
    FROM spheres s
    LEFT JOIN users u ON u.id = s.chef_id
    ORDER BY s.nom ASC
  `).all()
  res.json({ spheres })
})

// GET /api/spheres/:id — détail avec membres
router.get('/:id', (req, res) => {
  const sphere = db.prepare(`
    SELECT s.*, u.nom as chef_nom
    FROM spheres s
    LEFT JOIN users u ON u.id = s.chef_id
    WHERE s.id = ?
  `).get(req.params.id)

  if (!sphere) return res.status(404).json({ message: 'Sphère introuvable.' })

  const membres = db.prepare(`
    SELECT u.id, u.nom, u.grade as grade_global, us.grade as grade_sphere
    FROM user_spheres us
    JOIN users u ON u.id = us.user_id
    WHERE us.sphere_id = ?
    ORDER BY u.nom ASC
  `).all(req.params.id)

  res.json({ sphere, membres })
})

// POST /api/spheres — admin seulement
router.post('/', auth, requireAdmin, (req, res) => {
  const { nom, description, chef_id } = req.body
  if (!nom) return res.status(400).json({ message: 'Nom requis.' })

  const existe = db.prepare('SELECT id FROM spheres WHERE nom = ?').get(nom)
  if (existe) return res.status(409).json({ message: 'Une sphère avec ce nom existe déjà.' })

  const result = db.prepare(`
    INSERT INTO spheres (nom, description, chef_id) VALUES (?, ?, ?)
  `).run(nom, description || '', chef_id || null)

  const sphere = db.prepare(`
    SELECT s.*, u.nom as chef_nom,
      0 as nb_membres
    FROM spheres s
    LEFT JOIN users u ON u.id = s.chef_id
    WHERE s.id = ?
  `).get(result.lastInsertRowid)

  res.status(201).json({ sphere })
})

// PATCH /api/spheres/:id — admin ou chef
router.patch('/:id', auth, (req, res) => {
  if (!isChefOrAdmin(req, req.params.id)) return res.status(403).json({ message: 'Accès refusé.' })

  const sphere = db.prepare('SELECT * FROM spheres WHERE id = ?').get(req.params.id)
  if (!sphere) return res.status(404).json({ message: 'Sphère introuvable.' })

  const { nom, description, chef_id } = req.body
  db.prepare(`
    UPDATE spheres SET
      nom = ?,
      description = ?,
      chef_id = ?
    WHERE id = ?
  `).run(
    nom ?? sphere.nom,
    description ?? sphere.description,
    chef_id !== undefined ? chef_id : sphere.chef_id,
    req.params.id
  )

  res.json({ message: 'Sphère mise à jour.' })
})

// DELETE /api/spheres/:id — admin seulement
router.delete('/:id', auth, requireAdmin, (req, res) => {
  const sphere = db.prepare('SELECT id FROM spheres WHERE id = ?').get(req.params.id)
  if (!sphere) return res.status(404).json({ message: 'Sphère introuvable.' })

  db.prepare('DELETE FROM user_spheres WHERE sphere_id = ?').run(req.params.id)
  db.prepare('DELETE FROM sphere_grades WHERE sphere_id = ?').run(req.params.id)
  db.prepare('DELETE FROM spheres WHERE id = ?').run(req.params.id)
  res.json({ message: 'Sphère supprimée.' })
})

// GET /api/spheres/:id/grades
router.get('/:id/grades', (req, res) => {
  const grades = db.prepare('SELECT * FROM sphere_grades WHERE sphere_id = ? ORDER BY ordre ASC, id ASC').all(req.params.id)
  res.json({ grades })
})

// POST /api/spheres/:id/grades — admin ou chef
router.post('/:id/grades', auth, (req, res) => {
  if (!isChefOrAdmin(req, req.params.id)) return res.status(403).json({ message: 'Accès refusé.' })

  const { nom, ordre } = req.body
  if (!nom) return res.status(400).json({ message: 'Nom requis.' })

  const result = db.prepare('INSERT INTO sphere_grades (sphere_id, nom, ordre) VALUES (?, ?, ?)').run(req.params.id, nom, ordre ?? 0)
  const grade = db.prepare('SELECT * FROM sphere_grades WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ grade })
})

// DELETE /api/spheres/:id/grades/:gradeId — admin ou chef
router.delete('/:id/grades/:gradeId', auth, (req, res) => {
  if (!isChefOrAdmin(req, req.params.id)) return res.status(403).json({ message: 'Accès refusé.' })

  db.prepare('DELETE FROM sphere_grades WHERE id = ? AND sphere_id = ?').run(req.params.gradeId, req.params.id)
  res.json({ message: 'Grade supprimé.' })
})

// POST /api/spheres/:id/membres — ajouter un membre (admin ou chef)
router.post('/:id/membres', auth, (req, res) => {
  if (!isChefOrAdmin(req, req.params.id)) return res.status(403).json({ message: 'Accès refusé.' })

  const { user_id, grade } = req.body
  if (!user_id) return res.status(400).json({ message: 'user_id requis.' })

  const user = db.prepare('SELECT id, nom FROM users WHERE id = ?').get(user_id)
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' })

  const deja = db.prepare('SELECT 1 FROM user_spheres WHERE user_id = ? AND sphere_id = ?').get(user_id, req.params.id)
  if (deja) return res.status(409).json({ message: 'Déjà membre de cette sphère.' })

  db.prepare('INSERT INTO user_spheres (user_id, sphere_id, grade) VALUES (?, ?, ?)').run(user_id, req.params.id, grade || '')

  res.status(201).json({ message: 'Membre ajouté.' })
})

// PATCH /api/spheres/:id/membres/:userId — modifier le grade (admin ou chef)
router.patch('/:id/membres/:userId', auth, (req, res) => {
  if (!isChefOrAdmin(req, req.params.id)) return res.status(403).json({ message: 'Accès refusé.' })

  const { grade } = req.body
  db.prepare('UPDATE user_spheres SET grade = ? WHERE user_id = ? AND sphere_id = ?').run(grade || '', req.params.userId, req.params.id)
  res.json({ message: 'Grade mis à jour.' })
})

// DELETE /api/spheres/:id/membres/:userId — retirer un membre (admin ou chef)
router.delete('/:id/membres/:userId', auth, (req, res) => {
  if (!isChefOrAdmin(req, req.params.id)) return res.status(403).json({ message: 'Accès refusé.' })

  db.prepare('DELETE FROM user_spheres WHERE user_id = ? AND sphere_id = ?').run(req.params.userId, req.params.id)
  res.json({ message: 'Membre retiré.' })
})

module.exports = router

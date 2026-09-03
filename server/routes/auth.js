const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const db = require('../db')

const router = express.Router()
const SECRET = process.env.JWT_SECRET || 'yugen_ordre_demoniaque_secret'

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { identifiant, mot_de_passe } = req.body

  if (!identifiant || !mot_de_passe) {
    return res.status(400).json({ message: 'Champs manquants.' })
  }

  const user = db.prepare('SELECT * FROM users WHERE identifiant = ?').get(identifiant)

  if (!user || !bcrypt.compareSync(mot_de_passe, user.mot_de_passe)) {
    return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' })
  }

  const token = jwt.sign({ id: user.id, identifiant: user.identifiant }, SECRET, { expiresIn: '7d' })

  res.json({
    token,
    user: {
      id: user.id,
      identifiant: user.identifiant,
      nom: user.nom,
      grade: user.grade,
      role: user.role,
    }
  })
})

// GET /api/auth/me  (token requis)
router.get('/me', (req, res) => {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ message: 'Non authentifié.' })

  try {
    const payload = jwt.verify(auth.split(' ')[1], SECRET)
    const user = db.prepare('SELECT id, identifiant, nom, grade, role, pouvoir_nom FROM users WHERE id = ?').get(payload.id)
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' })
    const spheres = db.prepare(`
      SELECT s.id, s.nom, us.grade as grade_sphere
      FROM user_spheres us
      JOIN spheres s ON s.id = us.sphere_id
      WHERE us.user_id = ?
      ORDER BY s.nom ASC
    `).all(payload.id)
    res.json({ user: { ...user, spheres } })
  } catch {
    res.status(401).json({ message: 'Token invalide.' })
  }
})

// PATCH /api/auth/profile — mise à jour profil (auth requise)
router.patch('/profile', (req, res) => {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ message: 'Non authentifié.' })

  try {
    const payload = jwt.verify(auth.split(' ')[1], SECRET)
    const { pouvoir_nom, grade, role } = req.body
    const current = db.prepare('SELECT pouvoir_nom, grade, role FROM users WHERE id = ?').get(payload.id)
    db.prepare('UPDATE users SET pouvoir_nom = ?, grade = ?, role = ? WHERE id = ?').run(
      pouvoir_nom !== undefined ? pouvoir_nom : current.pouvoir_nom,
      grade       !== undefined ? grade       : current.grade,
      role        !== undefined ? role        : current.role,
      payload.id
    )
    const user = db.prepare('SELECT id, identifiant, nom, grade, role, pouvoir_nom FROM users WHERE id = ?').get(payload.id)
    const spheres = db.prepare(`
      SELECT s.id, s.nom, us.grade as grade_sphere
      FROM user_spheres us
      JOIN spheres s ON s.id = us.sphere_id
      WHERE us.user_id = ?
      ORDER BY s.nom ASC
    `).all(payload.id)
    res.json({ user: { ...user, spheres } })
  } catch {
    res.status(401).json({ message: 'Token invalide.' })
  }
})

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { identifiant, nom, mot_de_passe } = req.body

  if (!identifiant || !nom || !mot_de_passe) {
    return res.status(400).json({ message: 'Champs manquants.' })
  }

  const existe = db.prepare('SELECT id FROM users WHERE identifiant = ?').get(identifiant)
  if (existe) {
    return res.status(409).json({ message: 'Cet identifiant est déjà utilisé.' })
  }

  const hash = bcrypt.hashSync(mot_de_passe, 10)
  const result = db.prepare(`
    INSERT INTO users (identifiant, mot_de_passe, nom, grade, role)
    VALUES (?, ?, ?, '', 'membre')
  `).run(identifiant, hash, nom)

  const user = db.prepare('SELECT id, identifiant, nom, grade, role FROM users WHERE id = ?').get(result.lastInsertRowid)
  const token = jwt.sign({ id: user.id, identifiant: user.identifiant }, SECRET, { expiresIn: '7d' })

  res.status(201).json({ token, user })
})

// GET /api/auth/users — liste des users (auth requise)
router.get('/users', (req, res) => {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ message: 'Non authentifié.' })
  try {
    jwt.verify(auth.split(' ')[1], SECRET)
    const users = db.prepare('SELECT id, nom, identifiant, grade FROM users ORDER BY nom ASC').all()
    res.json({ users })
  } catch {
    res.status(401).json({ message: 'Token invalide.' })
  }
})

module.exports = router

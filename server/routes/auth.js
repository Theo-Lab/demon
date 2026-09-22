const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()
const SECRET = process.env.JWT_SECRET || 'yugen_ordre_demoniaque_secret'

// Options communes pour tous les cookies auth
// sameSite:'lax' fonctionne sur localhost cross-port (5173 → 3001) et en prod
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}

function setAuthCookies(res, userId, identifiant) {
  // Access token court (15 min) : limiter la fenêtre d'exposition si volé
  const accessToken = jwt.sign({ id: userId, identifiant }, SECRET, { expiresIn: '15m' })

  // Refresh token opaque (random hex) stocké en DB pour pouvoir le révoquer (logout, ban)
  const refreshToken = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  db.prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(userId, refreshToken, expiresAt)

  res.cookie('access_token', accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 })
  res.cookie('refresh_token', refreshToken, { ...COOKIE_OPTS, maxAge: 7 * 24 * 60 * 60 * 1000 })
}

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

  setAuthCookies(res, user.id, user.identifiant)

  res.json({
    user: {
      id: user.id,
      identifiant: user.identifiant,
      nom: user.nom,
      grade: user.grade,
      role: user.role,
    },
  })
})

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { identifiant, nom, mot_de_passe } = req.body
  if (!identifiant || !nom || !mot_de_passe) {
    return res.status(400).json({ message: 'Champs manquants.' })
  }

  const existe = db.prepare('SELECT id FROM users WHERE identifiant = ?').get(identifiant)
  if (existe) return res.status(409).json({ message: 'Cet identifiant est déjà utilisé.' })

  const hash = bcrypt.hashSync(mot_de_passe, 10)
  const result = db.prepare(`
    INSERT INTO users (identifiant, mot_de_passe, nom, grade, role)
    VALUES (?, ?, ?, '', 'membre')
  `).run(identifiant, hash, nom)

  const user = db.prepare('SELECT id, identifiant, nom, grade, role FROM users WHERE id = ?').get(result.lastInsertRowid)

  setAuthCookies(res, user.id, user.identifiant)

  res.status(201).json({ user })
})

// POST /api/auth/refresh — échange le refresh token contre un nouvel access token
router.post('/refresh', (req, res) => {
  const refreshToken = req.cookies?.refresh_token
  if (!refreshToken) return res.status(401).json({ message: 'Non authentifié.' })

  const stored = db.prepare(`
    SELECT rt.user_id, u.identifiant
    FROM refresh_tokens rt
    JOIN users u ON u.id = rt.user_id
    WHERE rt.token = ? AND rt.expires_at > datetime('now')
  `).get(refreshToken)

  if (!stored) {
    res.clearCookie('refresh_token', COOKIE_OPTS)
    return res.status(401).json({ message: 'Session expirée.' })
  }

  const accessToken = jwt.sign({ id: stored.user_id, identifiant: stored.identifiant }, SECRET, { expiresIn: '15m' })
  res.cookie('access_token', accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 })
  res.json({ ok: true })
})

// POST /api/auth/logout — révoque le refresh token en DB et efface les cookies
router.post('/logout', (req, res) => {
  const refreshToken = req.cookies?.refresh_token
  if (refreshToken) {
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken)
  }
  res.clearCookie('access_token', COOKIE_OPTS)
  res.clearCookie('refresh_token', COOKIE_OPTS)
  res.json({ ok: true })
})

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, identifiant, nom, grade, role, pouvoir_nom, signature FROM users WHERE id = ?').get(req.user.id)
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' })

  const spheres = db.prepare(`
    SELECT s.id, s.nom, us.grade as grade_sphere
    FROM user_spheres us
    JOIN spheres s ON s.id = us.sphere_id
    WHERE us.user_id = ?
    ORDER BY s.nom ASC
  `).all(req.user.id)

  res.json({ user: { ...user, spheres } })
})

// PATCH /api/auth/profile
router.patch('/profile', requireAuth, (req, res) => {
  const { pouvoir_nom, grade, role, signature } = req.body
  const current = db.prepare('SELECT pouvoir_nom, grade, role, signature FROM users WHERE id = ?').get(req.user.id)

  db.prepare('UPDATE users SET pouvoir_nom = ?, grade = ?, role = ?, signature = ? WHERE id = ?').run(
    pouvoir_nom !== undefined ? pouvoir_nom : current.pouvoir_nom,
    grade       !== undefined ? grade       : current.grade,
    role        !== undefined ? role        : current.role,
    signature   !== undefined ? signature   : current.signature,
    req.user.id
  )

  const user = db.prepare('SELECT id, identifiant, nom, grade, role, pouvoir_nom, signature FROM users WHERE id = ?').get(req.user.id)
  const spheres = db.prepare(`
    SELECT s.id, s.nom, us.grade as grade_sphere
    FROM user_spheres us
    JOIN spheres s ON s.id = us.sphere_id
    WHERE us.user_id = ?
    ORDER BY s.nom ASC
  `).all(req.user.id)

  res.json({ user: { ...user, spheres } })
})

// POST /api/auth/spheres/:id/join
router.post('/spheres/:id/join', requireAuth, (req, res) => {
  const sphere = db.prepare('SELECT id FROM spheres WHERE id = ?').get(req.params.id)
  if (!sphere) return res.status(404).json({ message: 'Sphère introuvable.' })
  db.prepare('INSERT OR IGNORE INTO user_spheres (user_id, sphere_id, grade) VALUES (?, ?, ?)').run(req.user.id, sphere.id, '')
  res.json({ message: 'Rejoint.' })
})

// DELETE /api/auth/spheres/:id/leave
router.delete('/spheres/:id/leave', requireAuth, (req, res) => {
  db.prepare('DELETE FROM user_spheres WHERE user_id = ? AND sphere_id = ?').run(req.user.id, req.params.id)
  res.json({ message: 'Quitté.' })
})

// GET /api/auth/users
router.get('/users', requireAuth, (req, res) => {
  const users = db.prepare('SELECT id, nom, identifiant, grade, COALESCE(solde, 1000) as solde FROM users ORDER BY nom ASC').all()
  res.json({ users })
})

// PATCH /api/auth/users/:id — édition complète par un admin
router.patch('/users/:id', requireAuth, (req, res) => {
  const caller = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id)
  if (!caller || caller.role !== 'admin') return res.status(403).json({ message: 'Accès refusé.' })

  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!target) return res.status(404).json({ message: 'Utilisateur introuvable.' })

  const { nom, identifiant, mot_de_passe, grade, pouvoir_nom, role, signature } = req.body

  if (role && !['admin', 'groupier', 'membre'].includes(role))
    return res.status(400).json({ message: 'Rôle invalide.' })

  let password_hash = target.mot_de_passe
  if (mot_de_passe && mot_de_passe.trim()) {
    password_hash = bcrypt.hashSync(mot_de_passe.trim(), 10)
  }

  db.prepare(`
    UPDATE users SET
      nom         = ?,
      identifiant = ?,
      mot_de_passe = ?,
      grade       = ?,
      pouvoir_nom = ?,
      role        = ?,
      signature   = ?
    WHERE id = ?
  `).run(
    nom         !== undefined ? nom         : target.nom,
    identifiant !== undefined ? identifiant : target.identifiant,
    password_hash,
    grade       !== undefined ? grade       : target.grade,
    pouvoir_nom !== undefined ? pouvoir_nom : target.pouvoir_nom,
    role        !== undefined ? role        : target.role,
    signature   !== undefined ? signature   : target.signature,
    target.id
  )

  const updated = db.prepare('SELECT id, nom, identifiant, grade, pouvoir_nom, role, signature, COALESCE(solde,0) as solde FROM users WHERE id = ?').get(target.id)
  res.json({ user: updated })
})

// DELETE /api/auth/users/:id — réservé aux admins
router.delete('/users/:id', requireAuth, (req, res) => {
  const caller = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id)
  if (!caller || caller.role !== 'admin') return res.status(403).json({ message: 'Accès refusé.' })
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ message: 'Impossible de se supprimer soi-même.' })

  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id)
  if (!target) return res.status(404).json({ message: 'Utilisateur introuvable.' })

  db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(target.id)
  db.prepare('DELETE FROM user_spheres WHERE user_id = ?').run(target.id)
  db.prepare('DELETE FROM user_pouvoir WHERE user_id = ?').run(target.id)
  db.prepare('DELETE FROM game_rounds WHERE user_id = ?').run(target.id)
  db.prepare('DELETE FROM solde_logs WHERE user_id = ? OR admin_id = ?').run(target.id, target.id)
  db.prepare('DELETE FROM blackjack_games WHERE user_id = ?').run(target.id)
  db.prepare('UPDATE rapports SET auteur_id = NULL WHERE auteur_id = ?').run(target.id)
  db.prepare('UPDATE projets SET auteur_id = NULL WHERE auteur_id = ?').run(target.id)
  db.prepare('UPDATE parchemins SET auteur_id = NULL WHERE auteur_id = ?').run(target.id)
  db.prepare('DELETE FROM users WHERE id = ?').run(target.id)
  res.json({ ok: true })
})

// PATCH /api/auth/users/:id/role — réservé aux admins
router.patch('/users/:id/role', requireAuth, (req, res) => {
  const caller = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id)
  if (!caller || caller.role !== 'admin') return res.status(403).json({ message: 'Accès refusé.' })

  const { role } = req.body
  if (!['admin', 'groupier', 'membre'].includes(role)) return res.status(400).json({ message: 'Rôle invalide.' })

  const target = db.prepare('SELECT id, nom FROM users WHERE id = ?').get(req.params.id)
  if (!target) return res.status(404).json({ message: 'Utilisateur introuvable.' })

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, target.id)
  res.json({ ok: true, id: target.id, role })
})

module.exports = router

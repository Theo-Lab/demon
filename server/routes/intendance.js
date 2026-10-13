'use strict'

const express = require('express')
const router = express.Router()
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

function isDirigeant(userId) {
  const u = db.prepare('SELECT intendance_dirigeant FROM users WHERE id = ?').get(userId)
  return !!(u?.intendance_dirigeant)
}

function getIntendanceRole(userId) {
  return db.prepare('SELECT ir.* FROM intendance_membres im JOIN intendance_roles ir ON ir.id = im.role_id WHERE im.user_id = ?').get(userId) || null
}

function requireIntendance(req, res, next) {
  if (isDirigeant(req.user.id) || getIntendanceRole(req.user.id)) return next()
  return res.status(403).json({ message: 'Accès réservé aux membres de l\'Intendance.' })
}

function requireDirigeant(req, res, next) {
  if (!isDirigeant(req.user.id)) return res.status(403).json({ message: 'Réservé au Dirigeant.' })
  next()
}

function requireAdmin(req, res, next) {
  const u = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id)
  if (u?.role !== 'admin') return res.status(403).json({ message: 'Accès refusé.' })
  next()
}

// Admin : set/unset dirigeant
router.post('/admin/dirigeant', requireAuth, requireAdmin, (req, res) => {
  const { userId, actif } = req.body
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId)
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' })
  db.prepare('UPDATE users SET intendance_dirigeant = ? WHERE id = ?').run(actif ? 1 : 0, userId)
  res.json({ ok: true })
})

// Me
router.get('/me', requireAuth, requireIntendance, (req, res) => {
  const dirigeant = isDirigeant(req.user.id)
  const role = getIntendanceRole(req.user.id)
  res.json({ dirigeant, role })
})

// Membres
router.get('/membres', requireAuth, requireIntendance, (req, res) => {
  const membres = db.prepare(`
    SELECT im.user_id, u.nom, u.identifiant, im.joined_at,
           ir.id as role_id, ir.nom as role_nom, ir.couleur as role_couleur
    FROM intendance_membres im
    JOIN users u ON u.id = im.user_id
    LEFT JOIN intendance_roles ir ON ir.id = im.role_id
    ORDER BY u.nom
  `).all()
  res.json(membres)
})

router.post('/membres', requireAuth, requireDirigeant, (req, res) => {
  const { userId, roleId } = req.body
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId)
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' })
  db.prepare('INSERT OR REPLACE INTO intendance_membres (user_id, role_id, assigned_by) VALUES (?, ?, ?)').run(userId, roleId || null, req.user.id)
  res.json({ ok: true })
})

router.patch('/membres/:userId', requireAuth, requireDirigeant, (req, res) => {
  const targetId = parseInt(req.params.userId)
  const { roleId } = req.body
  const membre = db.prepare('SELECT user_id FROM intendance_membres WHERE user_id = ?').get(targetId)
  if (!membre) return res.status(404).json({ message: 'Membre introuvable.' })
  db.prepare('UPDATE intendance_membres SET role_id = ?, assigned_by = ? WHERE user_id = ?').run(roleId || null, req.user.id, targetId)
  res.json({ ok: true })
})

router.delete('/membres/:userId', requireAuth, requireDirigeant, (req, res) => {
  const targetId = parseInt(req.params.userId)
  db.prepare('DELETE FROM intendance_membres WHERE user_id = ?').run(targetId)
  res.json({ ok: true })
})

// Rôles
router.get('/roles', requireAuth, requireIntendance, (req, res) => {
  res.json(db.prepare('SELECT * FROM intendance_roles ORDER BY nom').all())
})

router.post('/roles', requireAuth, requireDirigeant, (req, res) => {
  const { nom, couleur, can_see_all, can_delete_others } = req.body
  if (!nom?.trim()) return res.status(400).json({ message: 'Nom requis.' })
  const info = db.prepare('INSERT INTO intendance_roles (nom, couleur, can_see_all, can_delete_others) VALUES (?, ?, ?, ?)').run(nom.trim(), couleur || '#ffffff', can_see_all ? 1 : 0, can_delete_others ? 1 : 0)
  res.json(db.prepare('SELECT * FROM intendance_roles WHERE id = ?').get(info.lastInsertRowid))
})

router.patch('/roles/:id', requireAuth, requireDirigeant, (req, res) => {
  const { nom, couleur, can_see_all, can_delete_others } = req.body
  const role = db.prepare('SELECT id FROM intendance_roles WHERE id = ?').get(req.params.id)
  if (!role) return res.status(404).json({ message: 'Rôle introuvable.' })
  db.prepare('UPDATE intendance_roles SET nom = ?, couleur = ?, can_see_all = ?, can_delete_others = ? WHERE id = ?')
    .run(nom?.trim() || role.nom, couleur || '#ffffff', can_see_all ? 1 : 0, can_delete_others ? 1 : 0, req.params.id)
  res.json(db.prepare('SELECT * FROM intendance_roles WHERE id = ?').get(req.params.id))
})

router.delete('/roles/:id', requireAuth, requireDirigeant, (req, res) => {
  db.prepare('UPDATE intendance_membres SET role_id = NULL WHERE role_id = ?').run(req.params.id)
  db.prepare('DELETE FROM intendance_roles WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// Users (pour dirigeant)
router.get('/users', requireAuth, requireDirigeant, (req, res) => {
  res.json(db.prepare('SELECT id, nom, identifiant FROM users ORDER BY nom').all())
})

// Activités
router.get('/activites/:id', requireAuth, requireIntendance, (req, res) => {
  const dirigeant = isDirigeant(req.user.id)
  const role = getIntendanceRole(req.user.id)
  const canSeeAll = dirigeant || !!(role?.can_see_all)
  const act = db.prepare(`
    SELECT ia.*, u.nom as auteur_nom
    FROM intendance_activites ia
    LEFT JOIN users u ON u.id = ia.created_by
    WHERE ia.id = ?
  `).get(req.params.id)
  if (!act) return res.status(404).json({ message: 'Activité introuvable.' })
  if (!canSeeAll && act.created_by !== req.user.id) return res.status(403).json({ message: 'Accès refusé.' })
  res.json(act)
})

router.get('/activites', requireAuth, requireIntendance, (req, res) => {
  const dirigeant = isDirigeant(req.user.id)
  const role = getIntendanceRole(req.user.id)
  const canSeeAll = dirigeant || !!(role?.can_see_all)
  let activites
  if (canSeeAll) {
    activites = db.prepare(`
      SELECT ia.*, u.nom as auteur_nom
      FROM intendance_activites ia
      LEFT JOIN users u ON u.id = ia.created_by
      ORDER BY ia.date_activite DESC, ia.created_at DESC
    `).all()
  } else {
    activites = db.prepare(`
      SELECT ia.*, u.nom as auteur_nom
      FROM intendance_activites ia
      LEFT JOIN users u ON u.id = ia.created_by
      WHERE ia.created_by = ?
      ORDER BY ia.date_activite DESC, ia.created_at DESC
    `).all(req.user.id)
  }
  res.json(activites)
})

router.post('/activites', requireAuth, requireIntendance, (req, res) => {
  const { titre, type, date_activite, nb_participants, participants, description, image_url } = req.body
  if (!titre?.trim()) return res.status(400).json({ message: 'Titre requis.' })
  const id = require('crypto').randomBytes(8).toString('hex')
  db.prepare('INSERT INTO intendance_activites (id, titre, type, date_activite, nb_participants, participants, description, image_url, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, titre.trim(), type || 'entrainement', date_activite || '', nb_participants || 0, participants || '', description || '', image_url || '', req.user.id)
  res.json(db.prepare('SELECT ia.*, u.nom as auteur_nom FROM intendance_activites ia LEFT JOIN users u ON u.id = ia.created_by WHERE ia.id = ?').get(id))
})

router.patch('/activites/:id', requireAuth, requireIntendance, (req, res) => {
  const act = db.prepare('SELECT * FROM intendance_activites WHERE id = ?').get(req.params.id)
  if (!act) return res.status(404).json({ message: 'Activité introuvable.' })
  if (act.created_by !== req.user.id && !isDirigeant(req.user.id)) return res.status(403).json({ message: 'Non autorisé.' })
  const fields = ['titre', 'type', 'date_activite', 'nb_participants', 'participants', 'description', 'image_url']
  const sets = [], vals = []
  for (const f of fields) {
    if (req.body[f] !== undefined) { sets.push(`${f}=?`); vals.push(req.body[f]) }
  }
  if (sets.length) db.prepare(`UPDATE intendance_activites SET ${sets.join(', ')} WHERE id=?`).run(...vals, req.params.id)
  res.json(db.prepare('SELECT ia.*, u.nom as auteur_nom FROM intendance_activites ia LEFT JOIN users u ON u.id = ia.created_by WHERE ia.id = ?').get(req.params.id))
})

router.delete('/activites/:id', requireAuth, requireIntendance, (req, res) => {
  const act = db.prepare('SELECT * FROM intendance_activites WHERE id = ?').get(req.params.id)
  if (!act) return res.status(404).json({ message: 'Activité introuvable.' })
  const role = getIntendanceRole(req.user.id)
  const canDeleteOthers = isDirigeant(req.user.id) || !!(role?.can_delete_others)
  if (act.created_by !== req.user.id && !canDeleteOthers) return res.status(403).json({ message: 'Non autorisé.' })
  db.prepare('DELETE FROM intendance_activites WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router

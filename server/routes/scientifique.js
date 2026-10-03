'use strict'

const express = require('express')
const { requireAuth } = require('../middleware/auth')
const db = require('../db')

const router = express.Router()

// ── Helpers ───────────────────────────────────────────────────────────────────

function isDirigeant(userId) {
  const u = db.prepare('SELECT sci_dirigeant FROM users WHERE id = ?').get(userId)
  return !!(u?.sci_dirigeant)
}

function getSciRole(userId) {
  return db.prepare(`
    SELECT sm.role_id, sr.nom as role_nom, sr.ordre,
           sr.can_create_items, sr.can_edit_items, sr.can_delete_items, sr.can_add_members
    FROM sci_membres sm
    JOIN sci_roles sr ON sr.id = sm.role_id
    WHERE sm.user_id = ?
  `).get(userId)
}

function requireSci(req, res, next) {
  if (isDirigeant(req.user.id) || getSciRole(req.user.id)) return next()
  return res.status(403).json({ message: 'Accès réservé aux membres de la Scientifique.' })
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

// ── Admin : set/unset dirigeant ───────────────────────────────────────────────

router.post('/admin/dirigeant', requireAuth, requireAdmin, (req, res) => {
  const { userId, actif } = req.body
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId)
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' })
  db.prepare('UPDATE users SET sci_dirigeant = ? WHERE id = ?').run(actif ? 1 : 0, userId)
  res.json({ ok: true })
})

// ── Me ────────────────────────────────────────────────────────────────────────

router.get('/me', requireAuth, requireSci, (req, res) => {
  const dirigeant = isDirigeant(req.user.id)
  const role = getSciRole(req.user.id)
  res.json({ dirigeant, role: role || null })
})

// ── Membres ───────────────────────────────────────────────────────────────────

router.get('/membres', requireAuth, requireSci, (req, res) => {
  const membres = db.prepare(`
    SELECT u.id, u.nom, u.grade, u.identifiant,
           sr.id as role_id, sr.nom as role_nom, sr.ordre
    FROM sci_membres sm
    JOIN users u ON u.id = sm.user_id
    JOIN sci_roles sr ON sr.id = sm.role_id
    ORDER BY sr.ordre DESC, u.nom ASC
  `).all()
  res.json(membres)
})

router.post('/membres', requireAuth, requireSci, (req, res) => {
  const { userId, roleId } = req.body
  if (!isDirigeant(req.user.id)) {
    const myRole = getSciRole(req.user.id)
    if (!myRole?.can_add_members) return res.status(403).json({ message: 'Permission refusée.' })
    const targetRole = db.prepare('SELECT ordre FROM sci_roles WHERE id = ?').get(roleId)
    if (!targetRole || targetRole.ordre >= myRole.ordre)
      return res.status(403).json({ message: 'Vous ne pouvez assigner qu\'un rôle inférieur au vôtre.' })
  }
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId)
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' })
  db.prepare('INSERT OR REPLACE INTO sci_membres (user_id, role_id, assigned_by) VALUES (?, ?, ?)').run(userId, roleId, req.user.id)
  res.json({ ok: true })
})

router.patch('/membres/:userId', requireAuth, requireSci, (req, res) => {
  const { roleId } = req.body
  const targetId = parseInt(req.params.userId)
  if (!isDirigeant(req.user.id)) {
    const myRole = getSciRole(req.user.id)
    if (!myRole?.can_add_members) return res.status(403).json({ message: 'Permission refusée.' })
    const targetRole = db.prepare('SELECT ordre FROM sci_roles WHERE id = ?').get(roleId)
    if (!targetRole || targetRole.ordre >= myRole.ordre)
      return res.status(403).json({ message: 'Vous ne pouvez assigner qu\'un rôle inférieur au vôtre.' })
    const memberRole = getSciRole(targetId)
    if (memberRole && memberRole.ordre >= myRole.ordre)
      return res.status(403).json({ message: 'Vous ne pouvez modifier que des membres inférieurs.' })
  }
  db.prepare('UPDATE sci_membres SET role_id = ?, assigned_by = ? WHERE user_id = ?').run(roleId, req.user.id, targetId)
  res.json({ ok: true })
})

router.delete('/membres/:userId', requireAuth, requireSci, (req, res) => {
  const targetId = parseInt(req.params.userId)
  if (!isDirigeant(req.user.id)) {
    const myRole = getSciRole(req.user.id)
    if (!myRole?.can_add_members) return res.status(403).json({ message: 'Permission refusée.' })
    const memberRole = getSciRole(targetId)
    if (memberRole && memberRole.ordre >= myRole.ordre)
      return res.status(403).json({ message: 'Vous ne pouvez retirer que des membres inférieurs.' })
  }
  db.prepare('DELETE FROM sci_membres WHERE user_id = ?').run(targetId)
  res.json({ ok: true })
})

// ── Rôles ─────────────────────────────────────────────────────────────────────

router.get('/roles', requireAuth, requireSci, (req, res) => {
  res.json(db.prepare('SELECT * FROM sci_roles ORDER BY ordre DESC, nom ASC').all())
})

router.post('/roles', requireAuth, requireDirigeant, (req, res) => {
  const { nom, ordre, can_create_items, can_edit_items, can_delete_items, can_add_members } = req.body
  if (!nom?.trim()) return res.status(400).json({ message: 'Nom requis.' })
  const result = db.prepare(`
    INSERT INTO sci_roles (nom, ordre, can_create_items, can_edit_items, can_delete_items, can_add_members)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(nom.trim(), ordre || 0, can_create_items ? 1 : 0, can_edit_items ? 1 : 0, can_delete_items ? 1 : 0, can_add_members ? 1 : 0)
  res.json(db.prepare('SELECT * FROM sci_roles WHERE id = ?').get(result.lastInsertRowid))
})

router.patch('/roles/:id', requireAuth, requireDirigeant, (req, res) => {
  const role = db.prepare('SELECT id FROM sci_roles WHERE id = ?').get(req.params.id)
  if (!role) return res.status(404).json({ message: 'Rôle introuvable.' })
  const { nom, ordre, can_create_items, can_edit_items, can_delete_items, can_add_members } = req.body
  db.prepare(`UPDATE sci_roles SET nom=?, ordre=?, can_create_items=?, can_edit_items=?, can_delete_items=?, can_add_members=? WHERE id=?`)
    .run(nom, ordre || 0, can_create_items ? 1 : 0, can_edit_items ? 1 : 0, can_delete_items ? 1 : 0, can_add_members ? 1 : 0, req.params.id)
  res.json(db.prepare('SELECT * FROM sci_roles WHERE id = ?').get(req.params.id))
})

router.delete('/roles/:id', requireAuth, requireDirigeant, (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as n FROM sci_membres WHERE role_id = ?').get(req.params.id)
  if (count.n > 0) return res.status(400).json({ message: `${count.n} membre(s) ont ce rôle. Réassignez-les d'abord.` })
  db.prepare('DELETE FROM sci_roles WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Catégories ────────────────────────────────────────────────────────────────

router.get('/categories', requireAuth, requireSci, (req, res) => {
  const cats = db.prepare('SELECT * FROM sci_categories ORDER BY ordre ASC, nom ASC').all()
  const champs = db.prepare('SELECT * FROM sci_champs ORDER BY ordre ASC').all()
  res.json(cats.map(c => ({ ...c, champs: champs.filter(ch => ch.categorie_id === c.id) })))
})

router.post('/categories', requireAuth, requireDirigeant, (req, res) => {
  const { nom, icone, ordre } = req.body
  if (!nom?.trim()) return res.status(400).json({ message: 'Nom requis.' })
  const result = db.prepare('INSERT INTO sci_categories (nom, icone, ordre) VALUES (?, ?, ?)').run(nom.trim(), icone || '', ordre || 0)
  res.json({ ...db.prepare('SELECT * FROM sci_categories WHERE id = ?').get(result.lastInsertRowid), champs: [] })
})

router.patch('/categories/:id', requireAuth, requireDirigeant, (req, res) => {
  const cat = db.prepare('SELECT id FROM sci_categories WHERE id = ?').get(req.params.id)
  if (!cat) return res.status(404).json({ message: 'Catégorie introuvable.' })
  const { nom, icone, ordre } = req.body
  db.prepare('UPDATE sci_categories SET nom=?, icone=?, ordre=? WHERE id=?').run(nom, icone || '', ordre || 0, req.params.id)
  const champs = db.prepare('SELECT * FROM sci_champs WHERE categorie_id = ? ORDER BY ordre ASC').all(req.params.id)
  res.json({ ...db.prepare('SELECT * FROM sci_categories WHERE id = ?').get(req.params.id), champs })
})

router.delete('/categories/:id', requireAuth, requireDirigeant, (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as n FROM sci_items WHERE categorie_id = ?').get(req.params.id)
  if (count.n > 0) return res.status(400).json({ message: `${count.n} fiche(s) dans cette catégorie. Supprimez-les d'abord.` })
  db.prepare('DELETE FROM sci_champs WHERE categorie_id = ?').run(req.params.id)
  db.prepare('DELETE FROM sci_categories WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Champs ────────────────────────────────────────────────────────────────────

router.post('/categories/:id/champs', requireAuth, requireDirigeant, (req, res) => {
  const cat = db.prepare('SELECT id FROM sci_categories WHERE id = ?').get(req.params.id)
  if (!cat) return res.status(404).json({ message: 'Catégorie introuvable.' })
  const { nom, type, options, requis, ordre } = req.body
  if (!nom?.trim()) return res.status(400).json({ message: 'Nom requis.' })
  const validTypes = ['texte', 'long', 'image', 'nombre', 'select']
  if (!validTypes.includes(type)) return res.status(400).json({ message: 'Type invalide.' })
  const result = db.prepare(`
    INSERT INTO sci_champs (categorie_id, nom, type, options, requis, ordre)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(parseInt(req.params.id), nom.trim(), type, JSON.stringify(options || []), requis ? 1 : 0, ordre || 0)
  res.json(db.prepare('SELECT * FROM sci_champs WHERE id = ?').get(result.lastInsertRowid))
})

router.patch('/champs/:id', requireAuth, requireDirigeant, (req, res) => {
  const champ = db.prepare('SELECT id FROM sci_champs WHERE id = ?').get(req.params.id)
  if (!champ) return res.status(404).json({ message: 'Champ introuvable.' })
  const { nom, type, options, requis, ordre } = req.body
  db.prepare('UPDATE sci_champs SET nom=?, type=?, options=?, requis=?, ordre=? WHERE id=?')
    .run(nom, type, JSON.stringify(options || []), requis ? 1 : 0, ordre || 0, req.params.id)
  res.json(db.prepare('SELECT * FROM sci_champs WHERE id = ?').get(req.params.id))
})

router.delete('/champs/:id', requireAuth, requireDirigeant, (req, res) => {
  db.prepare('DELETE FROM sci_item_valeurs WHERE champ_id = ?').run(req.params.id)
  db.prepare('DELETE FROM sci_champs WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Items ─────────────────────────────────────────────────────────────────────

function canCreate(userId) { return isDirigeant(userId) || !!(getSciRole(userId)?.can_create_items) }
function canEdit(userId)   { return isDirigeant(userId) || !!(getSciRole(userId)?.can_edit_items)   }
function canDelete(userId) { return isDirigeant(userId) || !!(getSciRole(userId)?.can_delete_items) }

router.get('/items', requireAuth, requireSci, (req, res) => {
  const { categorie_id } = req.query
  const sql = `SELECT i.*, u.nom as auteur FROM sci_items i LEFT JOIN users u ON u.id = i.created_by`
  const items = categorie_id
    ? db.prepare(sql + ' WHERE i.categorie_id = ? ORDER BY i.nom ASC').all(parseInt(categorie_id))
    : db.prepare(sql + ' ORDER BY i.categorie_id ASC, i.nom ASC').all()
  res.json(items)
})

router.get('/items/:id', requireAuth, requireSci, (req, res) => {
  const item = db.prepare('SELECT i.*, u.nom as auteur FROM sci_items i LEFT JOIN users u ON u.id = i.created_by WHERE i.id = ?').get(req.params.id)
  if (!item) return res.status(404).json({ message: 'Fiche introuvable.' })
  const valeurs = {}
  for (const v of db.prepare('SELECT champ_id, valeur FROM sci_item_valeurs WHERE item_id = ?').all(item.id)) {
    valeurs[v.champ_id] = v.valeur
  }
  res.json({ ...item, valeurs })
})

const _saveItem = db.transaction((itemId, valeurs, updatedBy) => {
  const stmt = db.prepare('INSERT OR REPLACE INTO sci_item_valeurs (item_id, champ_id, valeur) VALUES (?, ?, ?)')
  for (const [champId, valeur] of Object.entries(valeurs)) {
    stmt.run(itemId, parseInt(champId), String(valeur))
  }
  db.prepare('UPDATE sci_items SET updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(updatedBy, itemId)
})

router.post('/items', requireAuth, requireSci, (req, res) => {
  if (!canCreate(req.user.id)) return res.status(403).json({ message: 'Permission refusée.' })
  const { categorie_id, nom, valeurs } = req.body
  if (!nom?.trim()) return res.status(400).json({ message: 'Nom requis.' })
  if (!db.prepare('SELECT id FROM sci_categories WHERE id = ?').get(categorie_id))
    return res.status(404).json({ message: 'Catégorie introuvable.' })
  const result = db.prepare('INSERT INTO sci_items (categorie_id, nom, created_by, updated_by) VALUES (?, ?, ?, ?)').run(categorie_id, nom.trim(), req.user.id, req.user.id)
  if (valeurs && typeof valeurs === 'object') _saveItem(result.lastInsertRowid, valeurs, req.user.id)
  const item = db.prepare('SELECT * FROM sci_items WHERE id = ?').get(result.lastInsertRowid)
  const vals = {}
  for (const v of db.prepare('SELECT champ_id, valeur FROM sci_item_valeurs WHERE item_id = ?').all(item.id)) vals[v.champ_id] = v.valeur
  res.json({ ...item, valeurs: vals })
})

router.patch('/items/:id', requireAuth, requireSci, (req, res) => {
  if (!canEdit(req.user.id)) return res.status(403).json({ message: 'Permission refusée.' })
  const item = db.prepare('SELECT id FROM sci_items WHERE id = ?').get(req.params.id)
  if (!item) return res.status(404).json({ message: 'Fiche introuvable.' })
  const { nom, valeurs } = req.body
  if (nom) db.prepare('UPDATE sci_items SET nom=? WHERE id=?').run(nom.trim(), item.id)
  if (valeurs && typeof valeurs === 'object') _saveItem(item.id, valeurs, req.user.id)
  const updated = db.prepare('SELECT * FROM sci_items WHERE id = ?').get(item.id)
  const vals = {}
  for (const v of db.prepare('SELECT champ_id, valeur FROM sci_item_valeurs WHERE item_id = ?').all(item.id)) vals[v.champ_id] = v.valeur
  res.json({ ...updated, valeurs: vals })
})

router.delete('/items/:id', requireAuth, requireSci, (req, res) => {
  if (!canDelete(req.user.id)) return res.status(403).json({ message: 'Permission refusée.' })
  const item = db.prepare('SELECT id FROM sci_items WHERE id = ?').get(req.params.id)
  if (!item) return res.status(404).json({ message: 'Fiche introuvable.' })
  db.prepare('DELETE FROM sci_item_valeurs WHERE item_id = ?').run(item.id)
  db.prepare('DELETE FROM sci_items WHERE id = ?').run(item.id)
  res.json({ ok: true })
})

// ── Utilisateurs (pour assignation) ──────────────────────────────────────────

router.get('/users', requireAuth, requireSci, (req, res) => {
  if (!isDirigeant(req.user.id)) {
    const r = getSciRole(req.user.id)
    if (!r?.can_add_members) return res.status(403).json({ message: 'Permission refusée.' })
  }
  res.json(db.prepare('SELECT id, nom, identifiant, grade FROM users ORDER BY nom ASC').all())
})

module.exports = router

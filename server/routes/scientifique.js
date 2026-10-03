'use strict'

const express = require('express')
const crypto = require('crypto')
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

// ══════════════════════════════════════════════════════════════════════════════
// ── Encyclopédie Scientifique (/enc/...)  ────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ── Scientists ──────────────────────────────────────────────────────────────

router.get('/enc/scientists', requireAuth, requireSci, (req, res) => {
  res.json(db.prepare('SELECT * FROM sci_scientists ORDER BY nom ASC').all())
})

router.get('/enc/scientists/:id', requireAuth, requireSci, (req, res) => {
  const s = db.prepare('SELECT * FROM sci_scientists WHERE id = ?').get(req.params.id)
  if (!s) return res.status(404).json({ message: 'Scientifique introuvable.' })
  const potions = db.prepare('SELECT id, nom, statut, niveau_danger FROM sci_potions WHERE createur_id = ? ORDER BY nom ASC').all(s.id)
  const experiments = db.prepare('SELECT id, nom, statut FROM sci_experiments WHERE responsable_id = ? ORDER BY nom ASC').all(s.id)
  const projects = db.prepare('SELECT id, nom, statut, progression FROM sci_projects WHERE responsable_id = ? ORDER BY nom ASC').all(s.id)
  res.json({ ...s, potions, experiments, projects })
})

router.post('/enc/scientists', requireAuth, requireDirigeant, (req, res) => {
  const { nom, affinite, description, image_url } = req.body
  if (!nom?.trim()) return res.status(400).json({ message: 'Nom requis.' })
  const id = slugify(nom)
  if (db.prepare('SELECT id FROM sci_scientists WHERE id = ?').get(id)) return res.status(400).json({ message: 'Existe déjà.' })
  db.prepare('INSERT INTO sci_scientists (id, nom, affinite, description, image_url) VALUES (?, ?, ?, ?, ?)').run(id, nom.trim(), affinite || '', description || '', image_url || '')
  res.json(db.prepare('SELECT * FROM sci_scientists WHERE id = ?').get(id))
})

router.patch('/enc/scientists/:id', requireAuth, requireDirigeant, (req, res) => {
  const s = db.prepare('SELECT id FROM sci_scientists WHERE id = ?').get(req.params.id)
  if (!s) return res.status(404).json({ message: 'Scientifique introuvable.' })
  const { nom, affinite, description, image_url } = req.body
  db.prepare('UPDATE sci_scientists SET nom=COALESCE(?,nom), affinite=COALESCE(?,affinite), description=COALESCE(?,description), image_url=COALESCE(?,image_url) WHERE id=?')
    .run(nom ?? null, affinite ?? null, description ?? null, image_url ?? null, req.params.id)
  res.json(db.prepare('SELECT * FROM sci_scientists WHERE id = ?').get(req.params.id))
})

router.delete('/enc/scientists/:id', requireAuth, requireDirigeant, (req, res) => {
  const s = db.prepare('SELECT id FROM sci_scientists WHERE id = ?').get(req.params.id)
  if (!s) return res.status(404).json({ message: 'Scientifique introuvable.' })
  db.prepare('DELETE FROM sci_scientists WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Ingredients ─────────────────────────────────────────────────────────────

router.get('/enc/ingredients', requireAuth, requireSci, (req, res) => {
  const { categorie } = req.query
  if (categorie) {
    res.json(db.prepare('SELECT * FROM sci_ingredients WHERE categorie = ? ORDER BY nom ASC').all(categorie))
  } else {
    res.json(db.prepare('SELECT * FROM sci_ingredients ORDER BY categorie ASC, nom ASC').all())
  }
})

router.get('/enc/ingredients/:id', requireAuth, requireSci, (req, res) => {
  const i = db.prepare('SELECT * FROM sci_ingredients WHERE id = ?').get(req.params.id)
  if (!i) return res.status(404).json({ message: 'Ingrédient introuvable.' })
  const potions = db.prepare(`
    SELECT p.id, p.nom, p.statut, pi.quantite
    FROM sci_potion_ingredients pi
    JOIN sci_potions p ON p.id = pi.potion_id
    WHERE pi.ingredient_id = ?
    ORDER BY p.nom ASC
  `).all(i.id)
  res.json({ ...i, potions })
})

router.post('/enc/ingredients', requireAuth, requireDirigeant, (req, res) => {
  const { nom, categorie, description, proprietes, localisation, zone, obtention, danger, recette_rp, utilite_rp, effets_rp, image_url } = req.body
  if (!nom?.trim()) return res.status(400).json({ message: 'Nom requis.' })
  const id = slugify(nom)
  if (db.prepare('SELECT id FROM sci_ingredients WHERE id = ?').get(id)) return res.status(400).json({ message: 'Existe déjà.' })
  db.prepare('INSERT INTO sci_ingredients (id, nom, categorie, description, proprietes, localisation, zone, obtention, danger, recette_rp, utilite_rp, effets_rp, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, nom.trim(), categorie || 'plante', description || '', proprietes || '', localisation || '', zone || '', obtention || '', danger || 0, recette_rp || '', utilite_rp || '', effets_rp || '', image_url || '')
  res.json(db.prepare('SELECT * FROM sci_ingredients WHERE id = ?').get(id))
})

router.patch('/enc/ingredients/:id', requireAuth, requireDirigeant, (req, res) => {
  const i = db.prepare('SELECT id FROM sci_ingredients WHERE id = ?').get(req.params.id)
  if (!i) return res.status(404).json({ message: 'Ingrédient introuvable.' })
  const fields = ['nom','categorie','description','proprietes','localisation','zone','obtention','danger','recette_rp','utilite_rp','effets_rp','image_url']
  const sets = []; const vals = []
  for (const f of fields) {
    if (req.body[f] !== undefined) { sets.push(`${f}=?`); vals.push(req.body[f]) }
  }
  if (sets.length) db.prepare(`UPDATE sci_ingredients SET ${sets.join(', ')} WHERE id=?`).run(...vals, req.params.id)
  res.json(db.prepare('SELECT * FROM sci_ingredients WHERE id = ?').get(req.params.id))
})

router.delete('/enc/ingredients/:id', requireAuth, requireDirigeant, (req, res) => {
  const i = db.prepare('SELECT id FROM sci_ingredients WHERE id = ?').get(req.params.id)
  if (!i) return res.status(404).json({ message: 'Ingrédient introuvable.' })
  db.prepare('DELETE FROM sci_potion_ingredients WHERE ingredient_id = ?').run(req.params.id)
  db.prepare('DELETE FROM sci_ingredients WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Potions ─────────────────────────────────────────────────────────────────

router.get('/enc/potions', requireAuth, requireSci, (req, res) => {
  const potions = db.prepare('SELECT * FROM sci_potions ORDER BY nom ASC').all()
  const allIngredients = db.prepare(`
    SELECT pi.potion_id, pi.ingredient_id, pi.quantite, i.nom as ingredient_nom, i.categorie as ingredient_categorie
    FROM sci_potion_ingredients pi
    JOIN sci_ingredients i ON i.id = pi.ingredient_id
  `).all()
  const ingMap = {}
  for (const row of allIngredients) {
    if (!ingMap[row.potion_id]) ingMap[row.potion_id] = []
    ingMap[row.potion_id].push({ id: row.ingredient_id, nom: row.ingredient_nom, categorie: row.ingredient_categorie, quantite: row.quantite })
  }
  res.json(potions.map(p => ({ ...p, ingredients: ingMap[p.id] || [] })))
})

router.get('/enc/potions/:id', requireAuth, requireSci, (req, res) => {
  const p = db.prepare('SELECT * FROM sci_potions WHERE id = ?').get(req.params.id)
  if (!p) return res.status(404).json({ message: 'Potion introuvable.' })
  const ingredients = db.prepare(`
    SELECT pi.ingredient_id as id, pi.quantite, i.nom, i.categorie, i.proprietes, i.localisation, i.danger
    FROM sci_potion_ingredients pi
    JOIN sci_ingredients i ON i.id = pi.ingredient_id
    WHERE pi.potion_id = ?
    ORDER BY i.nom ASC
  `).all(p.id)
  const createur = p.createur_id ? db.prepare('SELECT id, nom, affinite FROM sci_scientists WHERE id = ?').get(p.createur_id) : null
  res.json({ ...p, ingredients, createur })
})

router.post('/enc/potions', requireAuth, requireSci, (req, res) => {
  if (!canCreate(req.user.id)) return res.status(403).json({ message: 'Permission refusée.' })
  const { nom, createur_id, createur_nom, description, effet_principal, effets_secondaires, materiel, etapes_preparation, jet_minimum, nb_fioles, statut, niveau_danger, notes, date_creation, image_url, ingredients } = req.body
  if (!nom?.trim()) return res.status(400).json({ message: 'Nom requis.' })
  const id = slugify(nom)
  if (db.prepare('SELECT id FROM sci_potions WHERE id = ?').get(id)) return res.status(400).json({ message: 'Existe déjà.' })
  db.prepare('INSERT INTO sci_potions (id, nom, createur_id, createur_nom, description, effet_principal, effets_secondaires, materiel, etapes_preparation, jet_minimum, nb_fioles, statut, niveau_danger, notes, date_creation, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, nom.trim(), createur_id || null, createur_nom || '', description || '', effet_principal || '', effets_secondaires || '', materiel || '', etapes_preparation || '', jet_minimum ?? null, nb_fioles ?? null, statut || 'theorique', niveau_danger || 0, notes || '', date_creation || '', image_url || '')
  if (Array.isArray(ingredients)) {
    const stmt = db.prepare('INSERT OR IGNORE INTO sci_potion_ingredients (potion_id, ingredient_id, quantite) VALUES (?, ?, ?)')
    for (const ing of ingredients) { if (ing.id) stmt.run(id, ing.id, ing.quantite || '') }
  }
  const potion = db.prepare('SELECT * FROM sci_potions WHERE id = ?').get(id)
  const ings = db.prepare('SELECT pi.ingredient_id as id, pi.quantite, i.nom, i.categorie FROM sci_potion_ingredients pi JOIN sci_ingredients i ON i.id = pi.ingredient_id WHERE pi.potion_id = ?').all(id)
  res.json({ ...potion, ingredients: ings })
})

router.patch('/enc/potions/:id', requireAuth, requireSci, (req, res) => {
  try {
    if (!canEdit(req.user.id)) return res.status(403).json({ message: 'Permission refusée.' })
    const p = db.prepare('SELECT id FROM sci_potions WHERE id = ?').get(req.params.id)
    if (!p) return res.status(404).json({ message: 'Potion introuvable.' })
    const fields = ['nom','createur_id','createur_nom','description','effet_principal','effets_secondaires','materiel','etapes_preparation','jet_minimum','nb_fioles','statut','niveau_danger','notes','date_creation','image_url']
    const fkFields = ['createur_id']
    const sets = []; const vals = []
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        sets.push(`${f}=?`)
        vals.push(fkFields.includes(f) && req.body[f] === '' ? null : req.body[f])
      }
    }
    if (sets.length) db.prepare(`UPDATE sci_potions SET ${sets.join(', ')} WHERE id=?`).run(...vals, req.params.id)
    if (Array.isArray(req.body.ingredients)) {
      db.prepare('DELETE FROM sci_potion_ingredients WHERE potion_id = ?').run(req.params.id)
      const stmt = db.prepare('INSERT INTO sci_potion_ingredients (potion_id, ingredient_id, quantite) VALUES (?, ?, ?)')
      for (const ing of req.body.ingredients) { if (ing.id) stmt.run(req.params.id, ing.id, ing.quantite || '') }
    }
    const potion = db.prepare('SELECT * FROM sci_potions WHERE id = ?').get(req.params.id)
    const ings = db.prepare('SELECT pi.ingredient_id as id, pi.quantite, i.nom, i.categorie FROM sci_potion_ingredients pi JOIN sci_ingredients i ON i.id = pi.ingredient_id WHERE pi.potion_id = ?').all(req.params.id)
    res.json({ ...potion, ingredients: ings })
  } catch(e) { console.error('PATCH potion error:', e.message); res.status(500).json({ message: e.message }) }
})

router.delete('/enc/potions/:id', requireAuth, requireSci, (req, res) => {
  if (!canDelete(req.user.id)) return res.status(403).json({ message: 'Permission refusée.' })
  const p = db.prepare('SELECT id FROM sci_potions WHERE id = ?').get(req.params.id)
  if (!p) return res.status(404).json({ message: 'Potion introuvable.' })
  db.prepare('DELETE FROM sci_potion_ingredients WHERE potion_id = ?').run(req.params.id)
  db.prepare('DELETE FROM sci_project_potions WHERE potion_id = ?').run(req.params.id)
  db.prepare('DELETE FROM sci_potions WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Experiments ─────────────────────────────────────────────────────────────

router.get('/enc/experiments', requireAuth, requireSci, (req, res) => {
  res.json(db.prepare('SELECT * FROM sci_experiments ORDER BY nom ASC').all())
})

router.get('/enc/experiments/:id', requireAuth, requireSci, (req, res) => {
  const e = db.prepare('SELECT * FROM sci_experiments WHERE id = ?').get(req.params.id)
  if (!e) return res.status(404).json({ message: 'Expérience introuvable.' })
  res.json(e)
})

router.post('/enc/experiments', requireAuth, requireSci, (req, res) => {
  if (!canCreate(req.user.id)) return res.status(403).json({ message: 'Permission refusée.' })
  const { nom, responsable_id, responsable_nom, participants, date, objectif, hypothese, sujet_teste, protocole, jets, observations, resultats, conclusion, statut, ressources_utilisees, potions_utilisees } = req.body
  if (!nom?.trim()) return res.status(400).json({ message: 'Nom requis.' })
  const id = slugify(nom)
  if (db.prepare('SELECT id FROM sci_experiments WHERE id = ?').get(id)) return res.status(400).json({ message: 'Existe déjà.' })
  db.prepare('INSERT INTO sci_experiments (id, nom, responsable_id, responsable_nom, participants, date, objectif, hypothese, sujet_teste, protocole, jets, observations, resultats, conclusion, statut, ressources_utilisees, potions_utilisees) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, nom.trim(), responsable_id || null, responsable_nom || '', participants ? JSON.stringify(participants) : '[]', date || '', objectif || '', hypothese || '', sujet_teste || '', protocole || '', jets || '', observations || '', resultats || '', conclusion || '', statut || 'proposition', ressources_utilisees ? JSON.stringify(ressources_utilisees) : '[]', potions_utilisees ? JSON.stringify(potions_utilisees) : '[]')
  res.json(db.prepare('SELECT * FROM sci_experiments WHERE id = ?').get(id))
})

router.patch('/enc/experiments/:id', requireAuth, requireSci, (req, res) => {
  if (!canEdit(req.user.id)) return res.status(403).json({ message: 'Permission refusée.' })
  const e = db.prepare('SELECT id FROM sci_experiments WHERE id = ?').get(req.params.id)
  if (!e) return res.status(404).json({ message: 'Expérience introuvable.' })
  const fields = ['nom','responsable_id','responsable_nom','date','objectif','hypothese','sujet_teste','protocole','jets','observations','resultats','conclusion','statut','image_url']
  const sets = []; const vals = []
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      sets.push(`${f}=?`)
      vals.push(f === 'responsable_id' && req.body[f] === '' ? null : req.body[f])
    }
  }
  if (req.body.participants !== undefined) { sets.push('participants=?'); vals.push(JSON.stringify(req.body.participants)) }
  if (req.body.ressources_utilisees !== undefined) { sets.push('ressources_utilisees=?'); vals.push(JSON.stringify(req.body.ressources_utilisees)) }
  if (req.body.potions_utilisees !== undefined) { sets.push('potions_utilisees=?'); vals.push(JSON.stringify(req.body.potions_utilisees)) }
  if (sets.length) db.prepare(`UPDATE sci_experiments SET ${sets.join(', ')} WHERE id=?`).run(...vals, req.params.id)
  res.json(db.prepare('SELECT * FROM sci_experiments WHERE id = ?').get(req.params.id))
})

router.delete('/enc/experiments/:id', requireAuth, requireSci, (req, res) => {
  if (!canDelete(req.user.id)) return res.status(403).json({ message: 'Permission refusée.' })
  const e = db.prepare('SELECT id FROM sci_experiments WHERE id = ?').get(req.params.id)
  if (!e) return res.status(404).json({ message: 'Expérience introuvable.' })
  db.prepare('DELETE FROM sci_project_experiments WHERE experiment_id = ?').run(req.params.id)
  db.prepare('DELETE FROM sci_experiments WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Projects ────────────────────────────────────────────────────────────────

router.get('/enc/projects', requireAuth, requireSci, (req, res) => {
  res.json(db.prepare('SELECT * FROM sci_projects ORDER BY nom ASC').all())
})

router.get('/enc/projects/:id', requireAuth, requireSci, (req, res) => {
  const p = db.prepare('SELECT * FROM sci_projects WHERE id = ?').get(req.params.id)
  if (!p) return res.status(404).json({ message: 'Projet introuvable.' })
  const experiments = db.prepare(`
    SELECT e.id, e.nom, e.statut
    FROM sci_project_experiments pe
    JOIN sci_experiments e ON e.id = pe.experiment_id
    WHERE pe.project_id = ?
  `).all(p.id)
  const potions = db.prepare(`
    SELECT pt.id, pt.nom, pt.statut
    FROM sci_project_potions pp
    JOIN sci_potions pt ON pt.id = pp.potion_id
    WHERE pp.project_id = ?
  `).all(p.id)
  res.json({ ...p, experiments, potions })
})

router.post('/enc/projects', requireAuth, requireDirigeant, (req, res) => {
  const { nom, responsable_id, responsable_nom, description, principe, architecture, objectifs, etapes, statut, progression, notes, experiment_ids, potion_ids } = req.body
  if (!nom?.trim()) return res.status(400).json({ message: 'Nom requis.' })
  const id = slugify(nom)
  if (db.prepare('SELECT id FROM sci_projects WHERE id = ?').get(id)) return res.status(400).json({ message: 'Existe déjà.' })
  db.prepare('INSERT INTO sci_projects (id, nom, responsable_id, responsable_nom, description, principe, architecture, objectifs, etapes, statut, progression, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, nom.trim(), responsable_id || null, responsable_nom || '', description || '', principe || '', architecture || '', objectifs ? JSON.stringify(objectifs) : '[]', etapes ? JSON.stringify(etapes) : '[]', statut || 'en_cours', progression || 0, notes || '')
  if (Array.isArray(experiment_ids)) {
    const stmt = db.prepare('INSERT OR IGNORE INTO sci_project_experiments (project_id, experiment_id) VALUES (?, ?)')
    for (const eid of experiment_ids) stmt.run(id, eid)
  }
  if (Array.isArray(potion_ids)) {
    const stmt = db.prepare('INSERT OR IGNORE INTO sci_project_potions (project_id, potion_id) VALUES (?, ?)')
    for (const pid of potion_ids) stmt.run(id, pid)
  }
  res.json(db.prepare('SELECT * FROM sci_projects WHERE id = ?').get(id))
})

router.patch('/enc/projects/:id', requireAuth, requireDirigeant, (req, res) => {
  const p = db.prepare('SELECT id FROM sci_projects WHERE id = ?').get(req.params.id)
  if (!p) return res.status(404).json({ message: 'Projet introuvable.' })
  const fields = ['nom','responsable_id','responsable_nom','description','principe','architecture','statut','progression','notes','image_url']
  const sets = []; const vals = []
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      sets.push(`${f}=?`)
      vals.push(f === 'responsable_id' && req.body[f] === '' ? null : req.body[f])
    }
  }
  if (req.body.objectifs !== undefined) { sets.push('objectifs=?'); vals.push(JSON.stringify(req.body.objectifs)) }
  if (req.body.etapes !== undefined) { sets.push('etapes=?'); vals.push(JSON.stringify(req.body.etapes)) }
  if (sets.length) db.prepare(`UPDATE sci_projects SET ${sets.join(', ')} WHERE id=?`).run(...vals, req.params.id)
  if (Array.isArray(req.body.experiment_ids)) {
    db.prepare('DELETE FROM sci_project_experiments WHERE project_id = ?').run(req.params.id)
    const stmt = db.prepare('INSERT INTO sci_project_experiments (project_id, experiment_id) VALUES (?, ?)')
    for (const eid of req.body.experiment_ids) stmt.run(req.params.id, eid)
  }
  if (Array.isArray(req.body.potion_ids)) {
    db.prepare('DELETE FROM sci_project_potions WHERE project_id = ?').run(req.params.id)
    const stmt = db.prepare('INSERT INTO sci_project_potions (project_id, potion_id) VALUES (?, ?)')
    for (const pid of req.body.potion_ids) stmt.run(req.params.id, pid)
  }
  res.json(db.prepare('SELECT * FROM sci_projects WHERE id = ?').get(req.params.id))
})

router.delete('/enc/projects/:id', requireAuth, requireDirigeant, (req, res) => {
  const p = db.prepare('SELECT id FROM sci_projects WHERE id = ?').get(req.params.id)
  if (!p) return res.status(404).json({ message: 'Projet introuvable.' })
  db.prepare('DELETE FROM sci_project_experiments WHERE project_id = ?').run(req.params.id)
  db.prepare('DELETE FROM sci_project_potions WHERE project_id = ?').run(req.params.id)
  db.prepare('DELETE FROM sci_projects WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Search ──────────────────────────────────────────────────────────────────

router.get('/enc/search', requireAuth, requireSci, (req, res) => {
  const q = `%${req.query.q || ''}%`
  const potions = db.prepare("SELECT id, nom, 'potion' as type FROM sci_potions WHERE nom LIKE ? OR effet_principal LIKE ? LIMIT 10").all(q, q)
  const ingredients = db.prepare("SELECT id, nom, categorie as type FROM sci_ingredients WHERE nom LIKE ? OR proprietes LIKE ? OR localisation LIKE ? LIMIT 10").all(q, q, q)
  const scientists = db.prepare("SELECT id, nom, 'scientifique' as type FROM sci_scientists WHERE nom LIKE ? LIMIT 10").all(q)
  res.json({ potions, ingredients, scientists })
})

// ── Effets Ressentis ─────────────────────────────────────────────────────────

// GET public — AUCUNE auth requise
router.get('/effets/public/:token', (req, res) => {
  const e = db.prepare('SELECT * FROM sci_effets WHERE token = ?').get(req.params.token)
  if (!e) return res.status(404).json({ message: 'Effet introuvable.' })
  if (!e.actif) return res.status(410).json({ message: 'Cet effet a expiré.' })
  res.json(e)
})

router.get('/effets', requireAuth, requireSci, (req, res) => {
  res.json(db.prepare('SELECT * FROM sci_effets ORDER BY created_at DESC').all())
})

router.post('/effets', requireAuth, requireSci, (req, res) => {
  if (!canCreate(req.user.id)) return res.status(403).json({ message: 'Permission refusée.' })
  const { titre, sous_titre, contenu, symptomes, duree, intensite, type, image_url } = req.body
  if (!titre?.trim()) return res.status(400).json({ message: 'Titre requis.' })
  const id = slugify(titre) + '-' + Date.now()
  const token = crypto.randomBytes(16).toString('hex')
  db.prepare('INSERT INTO sci_effets (id, token, titre, sous_titre, contenu, symptomes, duree, intensite, type, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, token, titre.trim(), sous_titre || '', contenu || '', symptomes || '', duree || '', intensite || 1, type || 'general', image_url || '')
  res.json(db.prepare('SELECT * FROM sci_effets WHERE id = ?').get(id))
})

router.patch('/effets/:id', requireAuth, requireSci, (req, res) => {
  if (!canEdit(req.user.id)) return res.status(403).json({ message: 'Permission refusée.' })
  const e = db.prepare('SELECT id FROM sci_effets WHERE id = ?').get(req.params.id)
  if (!e) return res.status(404).json({ message: 'Effet introuvable.' })
  const fields = ['titre', 'sous_titre', 'contenu', 'symptomes', 'duree', 'intensite', 'type', 'image_url', 'actif']
  const sets = []; const vals = []
  for (const f of fields) {
    if (req.body[f] !== undefined) { sets.push(`${f}=?`); vals.push(req.body[f]) }
  }
  if (sets.length) db.prepare(`UPDATE sci_effets SET ${sets.join(', ')} WHERE id=?`).run(...vals, req.params.id)
  res.json(db.prepare('SELECT * FROM sci_effets WHERE id = ?').get(req.params.id))
})

router.delete('/effets/:id', requireAuth, requireSci, (req, res) => {
  if (!canDelete(req.user.id)) return res.status(403).json({ message: 'Permission refusée.' })
  db.prepare('DELETE FROM sci_effets WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

module.exports = router

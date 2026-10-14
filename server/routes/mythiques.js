const express = require('express')
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// ── Helpers ───────────────────────────────────────────────────────────────────

function isDirigeant(userId) {
  const u = db.prepare('SELECT mythiques_dirigeant FROM users WHERE id = ?').get(userId)
  return !!u?.mythiques_dirigeant
}

function getMythiqueNiveau(userId) {
  if (isDirigeant(userId)) return 5
  const row = db.prepare('SELECT niveau FROM mythiques_membres WHERE user_id = ?').get(userId)
  return row ? (row.niveau || 1) : 0
}

function requireMythique(req, res, next) {
  if (isDirigeant(req.user.id)) { req.mythiqueNiveau = 5; return next() }
  const niveau = getMythiqueNiveau(req.user.id)
  if (niveau === 0) return res.status(403).json({ message: 'Accès réservé aux membres Mythiques.' })
  req.mythiqueNiveau = niveau
  next()
}

function requireNiveau5(req, res, next) {
  if (isDirigeant(req.user.id)) return next()
  const niveau = req.mythiqueNiveau || getMythiqueNiveau(req.user.id)
  if (niveau < 5) return res.status(403).json({ message: 'Accès réservé au niveau 5.' })
  next()
}

function parseObjet(row, userNiveau) {
  if (!row) return null
  const locked = row.min_level > userNiveau
  if (locked) {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      rarity: row.rarity,
      rarity_color: row.rarity_color,
      min_level: row.min_level,
      image_url: row.image_url,
      locked: true,
    }
  }
  let tags = []
  try { tags = JSON.parse(row.tags || '[]') } catch {}
  return { ...row, tags, locked: false }
}

// ── Routes membres ────────────────────────────────────────────────────────────

// GET /api/mythiques/membres
router.get('/membres', requireAuth, requireMythique, (req, res) => {
  const membres = db.prepare(`
    SELECT mm.user_id, mm.niveau, mm.photo_url, mm.description, mm.grade, u.nom, u.identifiant
    FROM mythiques_membres mm
    JOIN users u ON u.id = mm.user_id
    ORDER BY mm.niveau DESC, u.nom ASC
  `).all()
  res.json({ membres })
})

// GET /api/mythiques/me
router.get('/me', requireAuth, requireMythique, (req, res) => {
  const user = db.prepare('SELECT nom, identifiant FROM users WHERE id = ?').get(req.user.id)
  res.json({ niveau: req.mythiqueNiveau, nom: user.nom, identifiant: user.identifiant, dirigeant: isDirigeant(req.user.id) })
})

// GET /api/mythiques/config
router.get('/config', requireAuth, requireMythique, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM mythiques_config').all()
  const config = {}
  for (const r of rows) config[r.key] = r.value
  res.json(config)
})

// PATCH /api/mythiques/config (dirigeant only)
router.patch('/config', requireAuth, requireNiveau5, (req, res) => {
  const allowed = ['niveau_1', 'niveau_2', 'niveau_3', 'niveau_4', 'niveau_5', 'youtube_url']
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      const val = key === 'youtube_url' ? String(req.body[key] || '').trim() : (String(req.body[key]).trim() || key)
      db.prepare('INSERT OR REPLACE INTO mythiques_config (key, value) VALUES (?, ?)').run(key, val)
    }
  }
  const rows = db.prepare('SELECT key, value FROM mythiques_config').all()
  const config = {}
  for (const r of rows) config[r.key] = r.value
  res.json(config)
})

// GET /api/mythiques/stats
router.get('/stats', requireAuth, requireMythique, (req, res) => {
  const catalogues = db.prepare('SELECT COUNT(*) as n FROM mythiques_objets').get().n
  const acquis = db.prepare("SELECT COUNT(*) as n FROM mythiques_objets WHERE status = 'ACQUIS'").get().n
  const membres = db.prepare('SELECT COUNT(*) as n FROM mythiques_membres').get().n
  res.json({ catalogues, acquis, membres })
})

// GET /api/mythiques/objets
router.get('/objets', requireAuth, requireMythique, (req, res) => {
  const objets = db.prepare('SELECT * FROM mythiques_objets ORDER BY id ASC').all()
  res.json({ objets: objets.map(o => parseObjet(o, req.mythiqueNiveau)) })
})

// GET /api/mythiques/objets/:id
router.get('/objets/:id', requireAuth, requireMythique, (req, res) => {
  const row = db.prepare('SELECT * FROM mythiques_objets WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ message: 'Objet introuvable.' })
  if (row.min_level > req.mythiqueNiveau) {
    return res.status(403).json({ message: 'Niveau insuffisant pour accéder à cet artefact.' })
  }
  let tags = []
  try { tags = JSON.parse(row.tags || '[]') } catch {}
  res.json({ objet: { ...row, tags, locked: false } })
})

// ── Routes admin (niveau 5) ───────────────────────────────────────────────────

// GET /api/mythiques/admin/objets
router.get('/admin/objets', requireAuth, requireMythique, requireNiveau5, (req, res) => {
  const rows = db.prepare('SELECT * FROM mythiques_objets ORDER BY id ASC').all()
  const objets = rows.map(r => {
    let tags = []
    try { tags = JSON.parse(r.tags || '[]') } catch {}
    return { ...r, tags }
  })
  res.json({ objets })
})

// POST /api/mythiques/admin/objets
router.post('/admin/objets', requireAuth, requireMythique, requireNiveau5, (req, res) => {
  const {
    name, type = '', rarity = 'COMMUN', rarity_color = '#6b7280',
    status = 'INCONNU', status_color = '#6b7280', image_url = '',
    description = '', tags = [], location = '', acquired = '',
    notes = '', discovered_by = '', reference = '', discovery_method = '',
    danger = 'INCONNU', danger_color = '#6b7280', origin = '', min_level = 1,
  } = req.body

  if (!name) return res.status(400).json({ message: 'Le nom est requis.' })

  const result = db.prepare(`
    INSERT INTO mythiques_objets
      (name, type, rarity, rarity_color, status, status_color, image_url, description, tags,
       location, acquired, notes, discovered_by, reference, discovery_method,
       danger, danger_color, origin, min_level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name, type, rarity, rarity_color, status, status_color, image_url, description,
    JSON.stringify(Array.isArray(tags) ? tags : []),
    location, acquired, notes, discovered_by, reference, discovery_method,
    danger, danger_color, origin, parseInt(min_level) || 1
  )

  const created = db.prepare('SELECT * FROM mythiques_objets WHERE id = ?').get(result.lastInsertRowid)
  let parsedTags = []
  try { parsedTags = JSON.parse(created.tags || '[]') } catch {}
  res.status(201).json({ objet: { ...created, tags: parsedTags } })
})

// PATCH /api/mythiques/admin/objets/:id
router.patch('/admin/objets/:id', requireAuth, requireMythique, requireNiveau5, (req, res) => {
  const row = db.prepare('SELECT * FROM mythiques_objets WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ message: 'Objet introuvable.' })

  const fields = [
    'name', 'type', 'rarity', 'rarity_color', 'status', 'status_color', 'image_url',
    'description', 'location', 'acquired', 'notes', 'discovered_by', 'reference',
    'discovery_method', 'danger', 'danger_color', 'origin', 'min_level',
  ]

  const updates = {}
  for (const f of fields) {
    if (req.body[f] !== undefined) updates[f] = req.body[f]
  }
  if (req.body.tags !== undefined) {
    updates.tags = JSON.stringify(Array.isArray(req.body.tags) ? req.body.tags : [])
  }
  if (updates.min_level !== undefined) updates.min_level = parseInt(updates.min_level) || 1

  if (Object.keys(updates).length === 0) return res.json({ objet: row })

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ')
  const values = [...Object.values(updates), req.params.id]
  db.prepare(`UPDATE mythiques_objets SET ${setClauses} WHERE id = ?`).run(...values)

  const updated = db.prepare('SELECT * FROM mythiques_objets WHERE id = ?').get(req.params.id)
  let tags = []
  try { tags = JSON.parse(updated.tags || '[]') } catch {}
  res.json({ objet: { ...updated, tags } })
})

// DELETE /api/mythiques/admin/objets/:id
router.delete('/admin/objets/:id', requireAuth, requireMythique, requireNiveau5, (req, res) => {
  const row = db.prepare('SELECT id FROM mythiques_objets WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ message: 'Objet introuvable.' })
  db.prepare('DELETE FROM mythiques_objets WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// GET /api/mythiques/admin/membres
router.get('/admin/membres', requireAuth, requireMythique, requireNiveau5, (req, res) => {
  const membres = db.prepare(`
    SELECT mm.user_id, mm.niveau, mm.joined_at, mm.photo_url, mm.description, mm.grade, u.nom, u.identifiant
    FROM mythiques_membres mm
    JOIN users u ON u.id = mm.user_id
    ORDER BY mm.niveau DESC, u.nom ASC
  `).all()
  res.json({ membres })
})

// POST /api/mythiques/admin/membres
router.post('/admin/membres', requireAuth, requireMythique, requireNiveau5, (req, res) => {
  const { userId, niveau } = req.body
  if (!userId) return res.status(400).json({ message: 'userId requis.' })
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId)
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' })

  db.prepare(`
    INSERT INTO mythiques_membres (user_id, niveau) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET niveau = excluded.niveau
  `).run(userId, parseInt(niveau) || 1)

  res.json({ ok: true })
})

// PATCH /api/mythiques/admin/membres/:userId
router.patch('/admin/membres/:userId', requireAuth, requireMythique, requireNiveau5, (req, res) => {
  const { niveau, photo_url, description, grade } = req.body
  const row = db.prepare('SELECT user_id FROM mythiques_membres WHERE user_id = ?').get(req.params.userId)
  if (!row) return res.status(404).json({ message: 'Membre introuvable.' })

  const updates = []
  const values = []
  if (niveau !== undefined) { updates.push('niveau = ?'); values.push(parseInt(niveau) || 1) }
  if (photo_url !== undefined) { updates.push('photo_url = ?'); values.push(photo_url) }
  if (description !== undefined) { updates.push('description = ?'); values.push(description) }
  if (grade !== undefined) { updates.push('grade = ?'); values.push(grade) }

  if (updates.length > 0) {
    values.push(req.params.userId)
    db.prepare(`UPDATE mythiques_membres SET ${updates.join(', ')} WHERE user_id = ?`).run(...values)
  }
  res.json({ ok: true })
})

// DELETE /api/mythiques/admin/membres/:userId
router.delete('/admin/membres/:userId', requireAuth, requireMythique, requireNiveau5, (req, res) => {
  db.prepare('DELETE FROM mythiques_membres WHERE user_id = ?').run(req.params.userId)
  res.json({ ok: true })
})

// GET /api/mythiques/admin/users
router.get('/admin/users', requireAuth, requireMythique, requireNiveau5, (req, res) => {
  const users = db.prepare('SELECT id, nom, identifiant FROM users ORDER BY nom ASC').all()
  res.json({ users })
})

// GET /api/mythiques/admin/stats
router.get('/admin/stats', requireAuth, requireMythique, requireNiveau5, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as n FROM mythiques_objets').get().n
  const acquis = db.prepare("SELECT COUNT(*) as n FROM mythiques_objets WHERE status = 'ACQUIS'").get().n
  const membres = db.prepare('SELECT COUNT(*) as n FROM mythiques_membres').get().n

  const parRarity = db.prepare(`
    SELECT rarity, rarity_color, COUNT(*) as count
    FROM mythiques_objets
    GROUP BY rarity
    ORDER BY count DESC
  `).all()

  const parNiveau = db.prepare(`
    SELECT niveau, COUNT(*) as count
    FROM mythiques_membres
    GROUP BY niveau
    ORDER BY niveau ASC
  `).all()

  res.json({ total, acquis, membres, parRarity, parNiveau })
})

module.exports = router

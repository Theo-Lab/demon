'use strict'

const express = require('express')
const router = express.Router()
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

// ── Helpers de permissions ────────────────────────────────────────────────────

function getUser(userId) {
  return db.prepare('SELECT demons_acces, demons_dirigeant, role FROM users WHERE id = ?').get(userId)
}

function canAccess(userId) {
  const u = getUser(userId)
  return !!(u?.demons_acces || u?.demons_dirigeant || u?.role === 'admin')
}

function isDirigeant(userId) {
  const u = getUser(userId)
  return !!(u?.demons_dirigeant || u?.role === 'admin')
}

function requireAccess(req, res, next) {
  if (!canAccess(req.user.id)) return res.status(403).json({ message: 'Accès réservé au Registre des Démons.' })
  next()
}

function requireDirigeant(req, res, next) {
  if (!isDirigeant(req.user.id)) return res.status(403).json({ message: 'Accès réservé aux responsables du Registre.' })
  next()
}

function getDemonFull(id) {
  return db.prepare(`
    SELECT d.*,
      COALESCE(u_resp.nom, d.responsable_nom_libre, '') as responsable_nom,
      u_resp.grade as responsable_grade,
      u_linked.nom as user_nom,
      (SELECT COUNT(*) FROM demons_remarques r WHERE r.demon_id = d.id AND r.type = 'positive' AND r.archive = 0) as nb_positives,
      (SELECT COUNT(*) FROM demons_remarques r WHERE r.demon_id = d.id AND r.type = 'negative' AND r.archive = 0) as nb_negatives,
      (SELECT COUNT(*) FROM demons_remarques r WHERE r.demon_id = d.id AND r.type = 'neutre' AND r.archive = 0) as nb_neutres,
      (SELECT COUNT(*) FROM demons_objectifs o WHERE o.demon_id = d.id AND o.statut = 'termine') as nb_objectifs_termines,
      (SELECT COUNT(*) FROM demons_objectifs o WHERE o.demon_id = d.id AND o.statut IN ('a_faire','en_cours')) as nb_objectifs_cours,
      (SELECT MAX(created_at) FROM demons_remarques r WHERE r.demon_id = d.id AND r.archive = 0) as derniere_remarque,
      (SELECT MAX(r2.date_reunion) FROM demons_reunions r2 JOIN demons_reunion_participants rp ON rp.reunion_id = r2.id WHERE rp.demon_id = d.id AND rp.presence = 'present') as derniere_reunion
    FROM demons d
    LEFT JOIN users u_resp ON u_resp.id = d.responsable_id
    LEFT JOIN users u_linked ON u_linked.id = d.user_id
    WHERE d.id = ?
  `).get(id)
}

// ── Tableau de bord ────────────────────────────────────────────────────────────

router.get('/dashboard', requireAuth, requireAccess, (req, res) => {
  const stats = {
    total:              db.prepare("SELECT COUNT(*) as n FROM demons WHERE statut != 'archive'").get().n,
    faibles:            db.prepare("SELECT COUNT(*) as n FROM demons WHERE rang = 'Faible' AND statut != 'archive'").get().n,
    forts:              db.prepare("SELECT COUNT(*) as n FROM demons WHERE rang = 'Fort' AND statut != 'archive'").get().n,
    a_suivre:           db.prepare("SELECT COUNT(*) as n FROM demons WHERE statut = 'a_suivre'").get().n,
    positives:          db.prepare("SELECT COUNT(*) as n FROM demons_remarques WHERE type = 'positive' AND archive = 0").get().n,
    negatives:          db.prepare("SELECT COUNT(*) as n FROM demons_remarques WHERE type = 'negative' AND archive = 0").get().n,
    reunions:           db.prepare('SELECT COUNT(*) as n FROM demons_reunions').get().n,
    objectifs_en_cours: db.prepare("SELECT COUNT(*) as n FROM demons_objectifs WHERE statut IN ('a_faire', 'en_cours')").get().n,
  }

  const dernieres_remarques = db.prepare(`
    SELECT r.id, r.type, r.categorie, r.description, r.date_evenement, r.statut_suivi, r.created_at,
           d.id as demon_id, d.nom as demon_nom, d.prenom as demon_prenom,
           u.nom as auteur_nom, u.grade as auteur_grade
    FROM demons_remarques r
    JOIN demons d ON d.id = r.demon_id
    JOIN users u ON u.id = r.auteur_id
    WHERE r.archive = 0
    ORDER BY r.created_at DESC LIMIT 6
  `).all()

  const demons_a_suivre = db.prepare(`
    SELECT d.id, d.nom, d.prenom, d.rang, d.statut, u_resp.nom as responsable_nom
    FROM demons d
    LEFT JOIN users u_resp ON u_resp.id = d.responsable_id
    WHERE d.statut = 'a_suivre'
    ORDER BY d.nom
  `).all()

  const dernieres_activites = db.prepare(`
    SELECT dh.id, dh.action, dh.details, dh.created_at,
           u.nom as auteur_nom,
           COALESCE(d.nom || ' ' || d.prenom, '') as demon_label,
           dh.demon_id
    FROM demons_historique dh
    LEFT JOIN users u ON u.id = dh.auteur_id
    LEFT JOIN demons d ON d.id = dh.demon_id
    ORDER BY dh.created_at DESC LIMIT 10
  `).all()

  res.json({ stats, dernieres_remarques, demons_a_suivre, dernieres_activites })
})

// ── Liste des utilisateurs (pour liaison démon ↔ compte) ─────────────────────

router.get('/users', requireAuth, requireDirigeant, (req, res) => {
  const users = db.prepare('SELECT id, nom, identifiant, grade FROM users ORDER BY nom').all()
  res.json(users)
})

// ── Réunions (routes globales avant /:id) ─────────────────────────────────────

router.get('/reunions', requireAuth, requireAccess, (req, res) => {
  const reunions = db.prepare(`
    SELECT r.*, u.nom as responsable_nom,
      (SELECT COUNT(*) FROM demons_reunion_participants rp WHERE rp.reunion_id = r.id AND rp.presence = 'present') as nb_presents,
      (SELECT COUNT(*) FROM demons_reunion_participants rp WHERE rp.reunion_id = r.id) as nb_invites
    FROM demons_reunions r
    LEFT JOIN users u ON u.id = r.responsable_id
    ORDER BY r.date_reunion DESC, r.created_at DESC
  `).all()
  res.json(reunions)
})

router.post('/reunions', requireAuth, requireDirigeant, (req, res) => {
  const { titre, date_reunion, heure, responsable_id, description, ordre_du_jour, participants } = req.body
  if (!titre?.trim()) return res.status(400).json({ message: 'Titre requis.' })
  if (!date_reunion) return res.status(400).json({ message: 'Date requise.' })

  const info = db.prepare(`
    INSERT INTO demons_reunions (titre, date_reunion, heure, responsable_id, description, ordre_du_jour, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(titre.trim(), date_reunion, heure || '', responsable_id || req.user.id, description || '', ordre_du_jour || '', req.user.id)

  const reunion_id = info.lastInsertRowid

  if (Array.isArray(participants)) {
    for (const p of participants) {
      if (db.prepare('SELECT id FROM demons WHERE id = ?').get(p.demon_id)) {
        db.prepare('INSERT OR REPLACE INTO demons_reunion_participants (reunion_id, demon_id, presence) VALUES (?, ?, ?)')
          .run(reunion_id, p.demon_id, p.presence || 'present')
      }
    }
  }

  db.prepare('INSERT INTO demons_historique (action, details, auteur_id) VALUES (?, ?, ?)')
    .run('reunion_creee', JSON.stringify({ titre: titre.trim(), date: date_reunion }), req.user.id)

  res.json(db.prepare('SELECT r.*, u.nom as responsable_nom FROM demons_reunions r LEFT JOIN users u ON u.id = r.responsable_id WHERE r.id = ?').get(reunion_id))
})

router.get('/reunions/:reunionId', requireAuth, requireAccess, (req, res) => {
  const reunion = db.prepare(`
    SELECT r.*, u.nom as responsable_nom
    FROM demons_reunions r LEFT JOIN users u ON u.id = r.responsable_id WHERE r.id = ?
  `).get(req.params.reunionId)
  if (!reunion) return res.status(404).json({ message: 'Réunion introuvable.' })

  const participants = db.prepare(`
    SELECT rp.*, d.nom, d.prenom, d.rang
    FROM demons_reunion_participants rp
    JOIN demons d ON d.id = rp.demon_id
    WHERE rp.reunion_id = ? ORDER BY d.nom
  `).all(req.params.reunionId)

  res.json({ ...reunion, participants })
})

router.patch('/reunions/:reunionId', requireAuth, requireDirigeant, (req, res) => {
  if (!db.prepare('SELECT id FROM demons_reunions WHERE id = ?').get(req.params.reunionId))
    return res.status(404).json({ message: 'Réunion introuvable.' })

  const fields = ['titre', 'date_reunion', 'heure', 'responsable_id', 'description', 'ordre_du_jour', 'sujets_abordes', 'problemes', 'demandes', 'conseils', 'decisions', 'objectifs_fixes']
  const sets = [], vals = []
  for (const f of fields) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); vals.push(req.body[f]) }
  }
  if (sets.length) db.prepare(`UPDATE demons_reunions SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.params.reunionId)

  if (Array.isArray(req.body.participants)) {
    for (const p of req.body.participants) {
      db.prepare('INSERT OR REPLACE INTO demons_reunion_participants (reunion_id, demon_id, presence) VALUES (?, ?, ?)')
        .run(req.params.reunionId, p.demon_id, p.presence || 'present')
    }
  }

  res.json(db.prepare('SELECT r.*, u.nom as responsable_nom FROM demons_reunions r LEFT JOIN users u ON u.id = r.responsable_id WHERE r.id = ?').get(req.params.reunionId))
})

// ── Démons CRUD ───────────────────────────────────────────────────────────────

router.get('/', requireAuth, requireAccess, (req, res) => {
  const { q, rang, statut, archive, sort } = req.query
  const archiveVal = archive === '1' ? "'archive'" : "'archive'"
  const archiveCond = archive === '1' ? "d.statut = 'archive'" : "d.statut != 'archive'"
  let where = `WHERE ${archiveCond}`
  const params = []

  if (q) {
    where += ' AND (d.nom LIKE ? OR d.prenom LIKE ? OR d.pouvoir_sanguinaire LIKE ?)'
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  if (rang) { where += ' AND d.rang = ?'; params.push(rang) }
  if (statut && statut !== 'archive') { where += ' AND d.statut = ?'; params.push(statut) }

  let orderBy = 'd.nom ASC'
  if (sort === 'activite') orderBy = 'derniere_remarque DESC, d.nom ASC'
  if (sort === 'positives') orderBy = 'nb_positives DESC, d.nom ASC'
  if (sort === 'negatives') orderBy = 'nb_negatives DESC, d.nom ASC'

  const demons = db.prepare(`
    SELECT d.*,
      COALESCE(u_resp.nom, d.responsable_nom_libre, '') as responsable_nom,
      (SELECT COUNT(*) FROM demons_remarques r WHERE r.demon_id = d.id AND r.type = 'positive' AND r.archive = 0) as nb_positives,
      (SELECT COUNT(*) FROM demons_remarques r WHERE r.demon_id = d.id AND r.type = 'negative' AND r.archive = 0) as nb_negatives,
      (SELECT MAX(created_at) FROM demons_remarques r WHERE r.demon_id = d.id AND r.archive = 0) as derniere_remarque
    FROM demons d
    LEFT JOIN users u_resp ON u_resp.id = d.responsable_id
    ${where}
    ORDER BY ${orderBy}
  `).all(...params)
  res.json(demons)
})

router.post('/', requireAuth, requireDirigeant, (req, res) => {
  const { nom, prenom, pouvoir_sanguinaire, rang, statut, date_arrivee, responsable_id, responsable_nom_libre, user_id, notes_generales, objectifs_actuels, photo_url } = req.body
  if (!nom?.trim()) return res.status(400).json({ message: 'Nom requis.' })
  if (!['Faible', 'Fort'].includes(rang)) return res.status(400).json({ message: 'Rang invalide.' })

  if (db.prepare('SELECT id FROM demons WHERE nom = ?').get(nom.trim()))
    return res.status(409).json({ message: 'Un démon avec ce nom existe déjà.' })

  if (user_id && db.prepare('SELECT id FROM demons WHERE user_id = ?').get(user_id))
    return res.status(409).json({ message: 'Ce compte est déjà lié à un autre démon.' })

  const info = db.prepare(`
    INSERT INTO demons (nom, prenom, pouvoir_sanguinaire, rang, statut, date_arrivee, responsable_id, responsable_nom_libre, user_id, notes_generales, objectifs_actuels, photo_url, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(nom.trim(), prenom || '', pouvoir_sanguinaire || '', rang, statut || 'actif', date_arrivee || '', responsable_id || null, responsable_nom_libre || '', user_id || null, notes_generales || '', objectifs_actuels || '', photo_url || '', req.user.id)

  const demon_id = info.lastInsertRowid
  db.prepare('INSERT INTO demons_historique (demon_id, action, details, auteur_id) VALUES (?, ?, ?, ?)')
    .run(demon_id, 'creation', JSON.stringify({ nom: nom.trim(), prenom: prenom.trim(), rang }), req.user.id)

  res.json(getDemonFull(demon_id))
})

router.get('/:id', requireAuth, requireAccess, (req, res) => {
  const demon = getDemonFull(req.params.id)
  if (!demon) return res.status(404).json({ message: 'Démon introuvable.' })
  res.json(demon)
})

router.patch('/:id', requireAuth, requireDirigeant, (req, res) => {
  if (!db.prepare('SELECT id FROM demons WHERE id = ?').get(req.params.id))
    return res.status(404).json({ message: 'Démon introuvable.' })

  const fields = ['nom', 'prenom', 'pouvoir_sanguinaire', 'statut', 'date_arrivee', 'responsable_id', 'responsable_nom_libre', 'user_id', 'notes_generales', 'objectifs_actuels', 'photo_url']
  const sets = ['updated_at = CURRENT_TIMESTAMP'], vals = []
  for (const f of fields) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); vals.push(req.body[f]) }
  }
  db.prepare(`UPDATE demons SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.params.id)

  db.prepare('INSERT INTO demons_historique (demon_id, action, details, auteur_id) VALUES (?, ?, ?, ?)')
    .run(req.params.id, 'modification', JSON.stringify(Object.fromEntries(fields.filter(f => req.body[f] !== undefined).map(f => [f, req.body[f]]))), req.user.id)

  res.json(getDemonFull(req.params.id))
})

router.post('/:id/changer-rang', requireAuth, requireDirigeant, (req, res) => {
  const demon = db.prepare('SELECT id, rang FROM demons WHERE id = ?').get(req.params.id)
  if (!demon) return res.status(404).json({ message: 'Démon introuvable.' })
  const { nouveau_rang, motif } = req.body
  if (!['Faible', 'Fort'].includes(nouveau_rang)) return res.status(400).json({ message: 'Rang invalide.' })
  if (nouveau_rang === demon.rang) return res.status(400).json({ message: 'Le rang est identique.' })

  db.prepare('UPDATE demons SET rang = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nouveau_rang, req.params.id)
  db.prepare('INSERT INTO demons_changements_rang (demon_id, ancien_rang, nouveau_rang, responsable_id, motif) VALUES (?, ?, ?, ?, ?)')
    .run(req.params.id, demon.rang, nouveau_rang, req.user.id, motif || '')
  db.prepare('INSERT INTO demons_historique (demon_id, action, details, auteur_id) VALUES (?, ?, ?, ?)')
    .run(req.params.id, 'changement_rang', JSON.stringify({ ancien: demon.rang, nouveau: nouveau_rang }), req.user.id)

  res.json({ ok: true })
})

// ── Remarques ─────────────────────────────────────────────────────────────────

router.get('/:id/remarques', requireAuth, requireAccess, (req, res) => {
  const archiveFilter = req.query.archive === '1' ? 1 : 0
  res.json(db.prepare(`
    SELECT r.*, u.nom as auteur_nom, u.grade as auteur_grade
    FROM demons_remarques r JOIN users u ON u.id = r.auteur_id
    WHERE r.demon_id = ? AND r.archive = ?
    ORDER BY r.date_evenement DESC, r.created_at DESC
  `).all(req.params.id, archiveFilter))
})

router.post('/:id/remarques', requireAuth, requireAccess, (req, res) => {
  if (!db.prepare('SELECT id FROM demons WHERE id = ?').get(req.params.id))
    return res.status(404).json({ message: 'Démon introuvable.' })

  const { type, categorie, description, date_evenement, statut_suivi } = req.body
  if (!['positive', 'negative', 'neutre'].includes(type)) return res.status(400).json({ message: 'Type invalide.' })
  if (!description?.trim()) return res.status(400).json({ message: 'Description requise.' })
  if (!date_evenement) return res.status(400).json({ message: 'Date requise.' })

  const info = db.prepare(`
    INSERT INTO demons_remarques (demon_id, auteur_id, type, categorie, description, date_evenement, statut_suivi)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, req.user.id, type, categorie || 'Autre', description.trim(), date_evenement, statut_suivi || 'Information')

  const remarque_id = info.lastInsertRowid
  db.prepare('INSERT INTO demons_remarques_historique (remarque_id, action, nouveau_contenu, auteur_id) VALUES (?, ?, ?, ?)')
    .run(remarque_id, 'creation', JSON.stringify({ type, categorie, description: description.trim(), date_evenement, statut_suivi }), req.user.id)
  db.prepare('INSERT INTO demons_historique (demon_id, action, details, auteur_id) VALUES (?, ?, ?, ?)')
    .run(req.params.id, 'remarque_ajoutee', JSON.stringify({ type, categorie }), req.user.id)

  // Auto: passer le démon en a_suivre si remarque négative à surveiller
  if (type === 'negative' && statut_suivi === 'A_surveiller') {
    const d = db.prepare("SELECT statut FROM demons WHERE id = ?").get(req.params.id)
    if (d?.statut === 'actif') db.prepare("UPDATE demons SET statut = 'a_suivre', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id)
  }

  res.json(db.prepare('SELECT r.*, u.nom as auteur_nom, u.grade as auteur_grade FROM demons_remarques r JOIN users u ON u.id = r.auteur_id WHERE r.id = ?').get(remarque_id))
})

router.patch('/:id/remarques/:remarqueId', requireAuth, requireDirigeant, (req, res) => {
  const remarque = db.prepare('SELECT * FROM demons_remarques WHERE id = ? AND demon_id = ?').get(req.params.remarqueId, req.params.id)
  if (!remarque) return res.status(404).json({ message: 'Remarque introuvable.' })

  const ancien = { type: remarque.type, categorie: remarque.categorie, description: remarque.description, date_evenement: remarque.date_evenement, statut_suivi: remarque.statut_suivi }
  const fields = ['type', 'categorie', 'description', 'date_evenement', 'statut_suivi']
  const sets = [], vals = []
  for (const f of fields) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); vals.push(req.body[f]) }
  }
  if (sets.length) db.prepare(`UPDATE demons_remarques SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.params.remarqueId)

  db.prepare('INSERT INTO demons_remarques_historique (remarque_id, action, ancien_contenu, nouveau_contenu, auteur_id) VALUES (?, ?, ?, ?, ?)')
    .run(req.params.remarqueId, 'modification', JSON.stringify(ancien), JSON.stringify({ ...ancien, ...Object.fromEntries(fields.filter(f => req.body[f] !== undefined).map(f => [f, req.body[f]])) }), req.user.id)

  res.json(db.prepare('SELECT r.*, u.nom as auteur_nom, u.grade as auteur_grade FROM demons_remarques r JOIN users u ON u.id = r.auteur_id WHERE r.id = ?').get(req.params.remarqueId))
})

router.post('/:id/remarques/:remarqueId/archiver', requireAuth, requireDirigeant, (req, res) => {
  const remarque = db.prepare('SELECT * FROM demons_remarques WHERE id = ? AND demon_id = ?').get(req.params.remarqueId, req.params.id)
  if (!remarque) return res.status(404).json({ message: 'Remarque introuvable.' })
  db.prepare('UPDATE demons_remarques SET archive = 1 WHERE id = ?').run(req.params.remarqueId)
  db.prepare('INSERT INTO demons_remarques_historique (remarque_id, action, ancien_contenu, auteur_id) VALUES (?, ?, ?, ?)')
    .run(req.params.remarqueId, 'archivage', JSON.stringify({ type: remarque.type, description: remarque.description }), req.user.id)
  res.json({ ok: true })
})

// ── Objectifs ─────────────────────────────────────────────────────────────────

router.get('/:id/objectifs', requireAuth, requireAccess, (req, res) => {
  res.json(db.prepare(`
    SELECT o.*, u.nom as responsable_nom
    FROM demons_objectifs o LEFT JOIN users u ON u.id = o.responsable_id
    WHERE o.demon_id = ?
    ORDER BY CASE o.statut WHEN 'en_cours' THEN 1 WHEN 'a_faire' THEN 2 WHEN 'termine' THEN 3 ELSE 4 END, o.created_at DESC
  `).all(req.params.id))
})

router.post('/:id/objectifs', requireAuth, requireDirigeant, (req, res) => {
  if (!db.prepare('SELECT id FROM demons WHERE id = ?').get(req.params.id))
    return res.status(404).json({ message: 'Démon introuvable.' })

  const { titre, description, echeance, statut } = req.body
  if (!titre?.trim()) return res.status(400).json({ message: 'Titre requis.' })

  const info = db.prepare(`
    INSERT INTO demons_objectifs (demon_id, titre, description, responsable_id, echeance, statut)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, titre.trim(), description || '', req.user.id, echeance || '', statut || 'a_faire')

  db.prepare('INSERT INTO demons_historique (demon_id, action, details, auteur_id) VALUES (?, ?, ?, ?)')
    .run(req.params.id, 'objectif_cree', JSON.stringify({ titre: titre.trim() }), req.user.id)

  res.json(db.prepare('SELECT o.*, u.nom as responsable_nom FROM demons_objectifs o LEFT JOIN users u ON u.id = o.responsable_id WHERE o.id = ?').get(info.lastInsertRowid))
})

router.patch('/:id/objectifs/:objectifId', requireAuth, requireDirigeant, (req, res) => {
  if (!db.prepare('SELECT id FROM demons_objectifs WHERE id = ? AND demon_id = ?').get(req.params.objectifId, req.params.id))
    return res.status(404).json({ message: 'Objectif introuvable.' })

  const fields = ['titre', 'description', 'echeance', 'statut', 'note_suivi']
  const sets = ['updated_at = CURRENT_TIMESTAMP'], vals = []
  for (const f of fields) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); vals.push(req.body[f]) }
  }
  db.prepare(`UPDATE demons_objectifs SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.params.objectifId)
  res.json(db.prepare('SELECT o.*, u.nom as responsable_nom FROM demons_objectifs o LEFT JOIN users u ON u.id = o.responsable_id WHERE o.id = ?').get(req.params.objectifId))
})

// ── Réunions d'un démon ───────────────────────────────────────────────────────

router.get('/:id/reunions', requireAuth, requireAccess, (req, res) => {
  res.json(db.prepare(`
    SELECT r.*, rp.presence, u.nom as responsable_nom
    FROM demons_reunion_participants rp
    JOIN demons_reunions r ON r.id = rp.reunion_id
    LEFT JOIN users u ON u.id = r.responsable_id
    WHERE rp.demon_id = ? ORDER BY r.date_reunion DESC
  `).all(req.params.id))
})

// ── Historique d'évolution ────────────────────────────────────────────────────

router.get('/:id/historique', requireAuth, requireAccess, (req, res) => {
  const demon = db.prepare('SELECT * FROM demons WHERE id = ?').get(req.params.id)
  if (!demon) return res.status(404).json({ message: 'Démon introuvable.' })

  const events = []

  events.push({ type: 'creation', date: demon.created_at, label: "Arrivée dans l'Ordre", details: { rang: demon.rang } })

  const changementsRang = db.prepare(`
    SELECT cr.*, u.nom as responsable_nom
    FROM demons_changements_rang cr LEFT JOIN users u ON u.id = cr.responsable_id
    WHERE cr.demon_id = ? ORDER BY cr.created_at ASC
  `).all(req.params.id)
  for (const c of changementsRang) events.push({ type: 'changement_rang', date: c.created_at, label: `Passage au rang ${c.nouveau_rang}`, details: c })

  const remarquesImp = db.prepare(`
    SELECT r.*, u.nom as auteur_nom
    FROM demons_remarques r JOIN users u ON u.id = r.auteur_id
    WHERE r.demon_id = ? AND r.archive = 0
    AND (r.type = 'positive' OR r.statut_suivi IN ('A_surveiller','En_cours'))
    ORDER BY r.date_evenement DESC LIMIT 20
  `).all(req.params.id)
  for (const r of remarquesImp) events.push({ type: 'remarque', date: r.date_evenement || r.created_at, label: `Remarque ${r.type}`, details: r })

  const reunions = db.prepare(`
    SELECT r.id, r.titre, r.date_reunion, rp.presence
    FROM demons_reunion_participants rp JOIN demons_reunions r ON r.id = rp.reunion_id
    WHERE rp.demon_id = ? ORDER BY r.date_reunion DESC
  `).all(req.params.id)
  for (const r of reunions) events.push({ type: 'reunion', date: r.date_reunion, label: `Réunion : ${r.titre}`, details: r })

  const objectifsTermines = db.prepare(`
    SELECT o.*, u.nom as responsable_nom
    FROM demons_objectifs o LEFT JOIN users u ON u.id = o.responsable_id
    WHERE o.demon_id = ? AND o.statut = 'termine' ORDER BY o.updated_at DESC
  `).all(req.params.id)
  for (const o of objectifsTermines) events.push({ type: 'objectif_termine', date: o.updated_at || o.created_at, label: `Objectif accompli : ${o.titre}`, details: o })

  events.sort((a, b) => new Date(b.date) - new Date(a.date))
  res.json(events)
})

module.exports = router

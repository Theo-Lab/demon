'use strict'

const express = require('express')
const router = express.Router()
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSemaineKey(date) {
  const d = new Date(date || Date.now())
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  return monday.toISOString().split('T')[0] // "2026-10-12"
}

function isInscriptionOuverte() {
  const now = new Date()
  const day = now.getDay() // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
  if (day === 1 || day === 2) return true
  if (day === 3 && now.getHours() < 19) return true
  return false
}

function isIntendance(userId) {
  const u = db.prepare('SELECT intendance_dirigeant FROM users WHERE id = ?').get(userId)
  if (u?.intendance_dirigeant) return true
  const m = db.prepare('SELECT user_id FROM intendance_membres WHERE user_id = ?').get(userId)
  return !!m
}

function requireIntendance(req, res, next) {
  if (!isIntendance(req.user.id)) return res.status(403).json({ message: 'Réservé aux membres de l\'Intendance.' })
  next()
}

function getPoints(userId) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(
      CASE WHEN ep.role = 'participant' THEN s.multiplicateur
           WHEN ep.role = 'organisateur' THEN 2 * s.multiplicateur
           ELSE 0 END
    ), 0) as points
    FROM entrainement_participations ep
    JOIN entrainement_seances s ON s.id = ep.seance_id
    WHERE ep.user_id = ?
  `).get(userId)
  return row?.points || 0
}

// ── Me ────────────────────────────────────────────────────────────────────────

router.get('/me', requireAuth, (req, res) => {
  const semaine = getSemaineKey()
  const paye = !!db.prepare('SELECT id FROM entrainement_paiements WHERE user_id = ?').get(req.user.id)
  const inscrit = !!db.prepare('SELECT id FROM entrainement_inscriptions WHERE semaine = ? AND user_id = ?').get(semaine, req.user.id)
  const points = getPoints(req.user.id)
  const ouvert = isInscriptionOuverte()
  const intendance = isIntendance(req.user.id)
  res.json({ paye, inscrit, points, ouvert, semaine, intendance })
})

// ── Classement ────────────────────────────────────────────────────────────────

router.get('/classement', requireAuth, (req, res) => {
  const classement = db.prepare(`
    SELECT u.id, u.nom, u.identifiant, u.grade,
      COALESCE(SUM(
        CASE WHEN ep.role = 'participant' THEN s.multiplicateur
             WHEN ep.role = 'organisateur' THEN 2 * s.multiplicateur
             ELSE 0 END
      ), 0) as points
    FROM entrainement_paiements pay
    JOIN users u ON u.id = pay.user_id
    LEFT JOIN entrainement_participations ep ON ep.user_id = u.id
    LEFT JOIN entrainement_seances s ON s.id = ep.seance_id
    GROUP BY u.id
    ORDER BY points DESC, u.nom ASC
  `).all()
  res.json(classement)
})

// ── Semaine courante ──────────────────────────────────────────────────────────

router.get('/semaine', requireAuth, (req, res) => {
  const semaine = getSemaineKey()
  const inscriptions = db.prepare(`
    SELECT ei.user_id, u.nom, u.identifiant, ei.created_at
    FROM entrainement_inscriptions ei
    JOIN users u ON u.id = ei.user_id
    WHERE ei.semaine = ?
    ORDER BY u.nom ASC
  `).all(semaine)
  const seances = db.prepare(`
    SELECT es.*, u.nom as auteur_nom
    FROM entrainement_seances es
    LEFT JOIN users u ON u.id = es.created_by
    WHERE es.semaine = ?
    ORDER BY es.created_at ASC
  `).all(semaine)
  for (const s of seances) {
    s.participations = db.prepare(`
      SELECT ep.user_id, ep.role, u.nom, u.identifiant
      FROM entrainement_participations ep
      JOIN users u ON u.id = ep.user_id
      WHERE ep.seance_id = ?
      ORDER BY u.nom ASC
    `).all(s.id)
  }
  res.json({ semaine, inscriptions, seances, ouvert: isInscriptionOuverte() })
})

// ── Inscription (auto) ────────────────────────────────────────────────────────

router.post('/inscription', requireAuth, (req, res) => {
  const paye = db.prepare('SELECT id FROM entrainement_paiements WHERE user_id = ?').get(req.user.id)
  if (!paye) return res.status(403).json({ message: 'Vous devez avoir payé la contribution pour vous inscrire.' })
  if (!isInscriptionOuverte()) return res.status(403).json({ message: 'Les inscriptions sont fermées (délai : mercredi 19h00).' })
  const semaine = getSemaineKey()
  try {
    db.prepare('INSERT OR IGNORE INTO entrainement_inscriptions (semaine, user_id) VALUES (?, ?)').run(semaine, req.user.id)
  } catch {}
  res.json({ ok: true, semaine })
})

router.delete('/inscription', requireAuth, (req, res) => {
  if (!isInscriptionOuverte()) return res.status(403).json({ message: 'Les inscriptions sont fermées.' })
  const semaine = getSemaineKey()
  db.prepare('DELETE FROM entrainement_inscriptions WHERE semaine = ? AND user_id = ?').run(semaine, req.user.id)
  res.json({ ok: true })
})

// ── Paiements (intendance) ────────────────────────────────────────────────────

router.get('/paiements', requireAuth, requireIntendance, (req, res) => {
  const paiements = db.prepare(`
    SELECT ep.id, ep.user_id, u.nom, u.identifiant, ep.created_at
    FROM entrainement_paiements ep
    JOIN users u ON u.id = ep.user_id
    ORDER BY u.nom ASC
  `).all()
  res.json(paiements)
})

router.post('/paiements', requireAuth, requireIntendance, (req, res) => {
  const { userId } = req.body
  const user = db.prepare('SELECT id, nom, identifiant FROM users WHERE id = ?').get(userId)
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' })
  try {
    db.prepare('INSERT OR IGNORE INTO entrainement_paiements (user_id, added_by) VALUES (?, ?)').run(userId, req.user.id)
  } catch {}
  res.json({ ok: true, user })
})

router.delete('/paiements/:userId', requireAuth, requireIntendance, (req, res) => {
  db.prepare('DELETE FROM entrainement_paiements WHERE user_id = ?').run(parseInt(req.params.userId))
  res.json({ ok: true })
})

// ── Inscriptions admin (intendance) ───────────────────────────────────────────

router.post('/inscription/admin', requireAuth, requireIntendance, (req, res) => {
  const { userId, semaine } = req.body
  const s = semaine || getSemaineKey()
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId)
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' })
  db.prepare('INSERT OR IGNORE INTO entrainement_inscriptions (semaine, user_id) VALUES (?, ?)').run(s, userId)
  res.json({ ok: true })
})

router.delete('/inscription/admin/:userId', requireAuth, requireIntendance, (req, res) => {
  const semaine = req.query.semaine || getSemaineKey()
  db.prepare('DELETE FROM entrainement_inscriptions WHERE semaine = ? AND user_id = ?').run(semaine, parseInt(req.params.userId))
  res.json({ ok: true })
})

// ── Séances (intendance) ──────────────────────────────────────────────────────

router.post('/seances', requireAuth, requireIntendance, (req, res) => {
  const { titre, multiplicateur, semaine } = req.body
  if (!titre?.trim()) return res.status(400).json({ message: 'Titre requis.' })
  const s = semaine || getSemaineKey()
  const info = db.prepare('INSERT INTO entrainement_seances (semaine, titre, multiplicateur, created_by) VALUES (?, ?, ?, ?)').run(s, titre.trim(), multiplicateur || 1, req.user.id)
  const seance = db.prepare('SELECT es.*, u.nom as auteur_nom FROM entrainement_seances es LEFT JOIN users u ON u.id = es.created_by WHERE es.id = ?').get(info.lastInsertRowid)
  seance.participations = []
  res.json(seance)
})

router.patch('/seances/:id', requireAuth, requireIntendance, (req, res) => {
  const { titre, multiplicateur } = req.body
  const seance = db.prepare('SELECT id FROM entrainement_seances WHERE id = ?').get(req.params.id)
  if (!seance) return res.status(404).json({ message: 'Séance introuvable.' })
  if (titre !== undefined) db.prepare('UPDATE entrainement_seances SET titre = ? WHERE id = ?').run(titre.trim(), req.params.id)
  if (multiplicateur !== undefined) db.prepare('UPDATE entrainement_seances SET multiplicateur = ? WHERE id = ?').run(multiplicateur, req.params.id)
  const updated = db.prepare('SELECT es.*, u.nom as auteur_nom FROM entrainement_seances es LEFT JOIN users u ON u.id = es.created_by WHERE es.id = ?').get(req.params.id)
  updated.participations = db.prepare('SELECT ep.user_id, ep.role, u.nom, u.identifiant FROM entrainement_participations ep JOIN users u ON u.id = ep.user_id WHERE ep.seance_id = ? ORDER BY u.nom ASC').all(req.params.id)
  res.json(updated)
})

router.delete('/seances/:id', requireAuth, requireIntendance, (req, res) => {
  db.prepare('DELETE FROM entrainement_seances WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ── Participations (intendance) ───────────────────────────────────────────────

router.post('/seances/:id/participations', requireAuth, requireIntendance, (req, res) => {
  const { userId, role } = req.body
  const seance = db.prepare('SELECT id FROM entrainement_seances WHERE id = ?').get(req.params.id)
  if (!seance) return res.status(404).json({ message: 'Séance introuvable.' })
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId)
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' })
  const r = ['participant', 'organisateur'].includes(role) ? role : 'participant'
  db.prepare('INSERT OR REPLACE INTO entrainement_participations (seance_id, user_id, role) VALUES (?, ?, ?)').run(req.params.id, userId, r)
  res.json({ ok: true })
})

router.delete('/seances/:id/participations/:userId', requireAuth, requireIntendance, (req, res) => {
  db.prepare('DELETE FROM entrainement_participations WHERE seance_id = ? AND user_id = ?').run(req.params.id, parseInt(req.params.userId))
  res.json({ ok: true })
})

// ── Tous les users (pour autocomplete) ───────────────────────────────────────

router.get('/users', requireAuth, requireIntendance, (req, res) => {
  res.json(db.prepare('SELECT id, nom, identifiant FROM users ORDER BY nom').all())
})

module.exports = router

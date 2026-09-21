const express = require('express')
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

function requireAdmin(req, res, next) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id)
  if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Accès refusé.' })
  next()
}

function getPariComplet(id) {
  const pari = db.prepare('SELECT * FROM paris WHERE id = ?').get(id)
  if (!pari) return null
  pari.issues = db.prepare('SELECT * FROM paris_issues WHERE pari_id = ?').all(id)
  pari.mises = db.prepare(`
    SELECT pm.id, pm.pari_id, pm.joueur_nom, pm.montant, pi.label as issue_label, pi.cote, pi.id as issue_id
    FROM paris_mises pm
    JOIN paris_issues pi ON pi.id = pm.issue_id
    WHERE pm.pari_id = ?
  `).all(id)
  return pari
}

// GET /api/paris
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT id FROM paris ORDER BY created_at DESC').all()
  const paris = rows.map(r => getPariComplet(r.id))
  res.json({ paris })
})

// POST /api/paris — créer un pari
router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { titre, description = '', issues = [] } = req.body
  if (!titre) return res.status(400).json({ message: 'Titre requis.' })
  if (!issues.length) return res.status(400).json({ message: 'Au moins une issue requise.' })

  const insertPari = db.prepare('INSERT INTO paris (titre, description) VALUES (?, ?)')
  const insertIssue = db.prepare('INSERT INTO paris_issues (pari_id, label, cote) VALUES (?, ?, ?)')

  const result = db.transaction(() => {
    const { lastInsertRowid } = insertPari.run(titre, description)
    for (const issue of issues) {
      if (!issue.label || !issue.cote) throw new Error('Chaque issue doit avoir un label et une cote.')
      insertIssue.run(lastInsertRowid, issue.label, parseFloat(issue.cote))
    }
    return lastInsertRowid
  })()

  res.status(201).json({ pari: getPariComplet(result) })
})

// DELETE /api/paris/:id
router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const pari = db.prepare('SELECT id FROM paris WHERE id = ?').get(req.params.id)
  if (!pari) return res.status(404).json({ message: 'Pari introuvable.' })
  db.prepare('DELETE FROM paris_mises WHERE pari_id = ?').run(pari.id)
  db.prepare('DELETE FROM paris_issues WHERE pari_id = ?').run(pari.id)
  db.prepare('DELETE FROM paris WHERE id = ?').run(pari.id)
  res.json({ ok: true })
})

// POST /api/paris/:id/mises — ajouter une mise
router.post('/:id/mises', requireAuth, requireAdmin, (req, res) => {
  const pari = db.prepare('SELECT * FROM paris WHERE id = ?').get(req.params.id)
  if (!pari) return res.status(404).json({ message: 'Pari introuvable.' })
  if (pari.statut === 'resolu') return res.status(400).json({ message: 'Le pari est déjà résolu.' })

  const { joueur_nom, issue_id, montant } = req.body
  if (!joueur_nom || !issue_id || !montant) return res.status(400).json({ message: 'joueur_nom, issue_id et montant requis.' })

  const issue = db.prepare('SELECT id FROM paris_issues WHERE id = ? AND pari_id = ?').get(issue_id, pari.id)
  if (!issue) return res.status(400).json({ message: 'Issue invalide.' })

  const m = parseInt(montant)
  if (m <= 0) return res.status(400).json({ message: 'Montant invalide.' })

  db.prepare('INSERT INTO paris_mises (pari_id, joueur_nom, issue_id, montant) VALUES (?, ?, ?, ?)').run(pari.id, joueur_nom.trim(), issue_id, m)

  res.status(201).json({ pari: getPariComplet(pari.id) })
})

// DELETE /api/paris/:id/mises/:miseId — supprimer une mise
router.delete('/:id/mises/:miseId', requireAuth, requireAdmin, (req, res) => {
  const mise = db.prepare('SELECT * FROM paris_mises WHERE id = ? AND pari_id = ?').get(req.params.miseId, req.params.id)
  if (!mise) return res.status(404).json({ message: 'Mise introuvable.' })

  db.prepare('DELETE FROM paris_mises WHERE id = ?').run(mise.id)

  res.json({ pari: getPariComplet(parseInt(req.params.id)) })
})

// POST /api/paris/:id/resoudre — résoudre le pari
router.post('/:id/resoudre', requireAuth, requireAdmin, (req, res) => {
  const pari = db.prepare('SELECT * FROM paris WHERE id = ?').get(req.params.id)
  if (!pari) return res.status(404).json({ message: 'Pari introuvable.' })
  if (pari.statut === 'resolu') return res.status(400).json({ message: 'Pari déjà résolu.' })

  const { issue_gagnante_id } = req.body
  if (!issue_gagnante_id) return res.status(400).json({ message: 'issue_gagnante_id requis.' })

  const issue = db.prepare('SELECT * FROM paris_issues WHERE id = ? AND pari_id = ?').get(issue_gagnante_id, pari.id)
  if (!issue) return res.status(400).json({ message: 'Issue invalide.' })

  const mises = db.prepare('SELECT * FROM paris_mises WHERE pari_id = ? AND issue_id = ?').all(pari.id, issue.id)

  db.prepare('UPDATE paris SET statut = ?, issue_gagnante_id = ? WHERE id = ?').run('resolu', issue.id, pari.id)

  res.json({ pari: getPariComplet(pari.id) })
})

module.exports = router

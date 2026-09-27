const express = require('express')
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

function requireAdmin(req, res, next) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id)
  if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Accès refusé.' })
  next()
}

function isAdmin(userId) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId)
  return user?.role === 'admin'
}

function getPariComplet(id) {
  const pari = db.prepare('SELECT * FROM paris WHERE id = ?').get(id)
  if (!pari) return null
  pari.issues = db.prepare('SELECT * FROM paris_issues WHERE pari_id = ?').all(id)
  pari.mises = db.prepare(`
    SELECT pm.id, pm.pari_id, pm.user_id, pm.joueur_nom, pm.montant,
           pi.label as issue_label, pi.cote, pi.id as issue_id
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

// POST /api/paris — créer un pari (admin)
router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { titre, description = '', issues = [], mise_min = 100, mise_max = null } = req.body
  if (!titre) return res.status(400).json({ message: 'Titre requis.' })
  if (!issues.length) return res.status(400).json({ message: 'Au moins une issue requise.' })

  const insertPari = db.prepare('INSERT INTO paris (titre, description, mise_min, mise_max) VALUES (?, ?, ?, ?)')
  const insertIssue = db.prepare('INSERT INTO paris_issues (pari_id, label, cote) VALUES (?, ?, ?)')

  const result = db.transaction(() => {
    const { lastInsertRowid } = insertPari.run(titre, description, parseInt(mise_min) || 100, mise_max ? parseInt(mise_max) : null)
    for (const issue of issues) {
      if (!issue.label || !issue.cote) throw new Error('Chaque issue doit avoir un label et une cote.')
      insertIssue.run(lastInsertRowid, issue.label, parseFloat(issue.cote))
    }
    return lastInsertRowid
  })()

  res.status(201).json({ pari: getPariComplet(result) })
})

// DELETE /api/paris/:id (admin)
router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const pari = db.prepare('SELECT id FROM paris WHERE id = ?').get(req.params.id)
  if (!pari) return res.status(404).json({ message: 'Pari introuvable.' })
  db.prepare('DELETE FROM paris_mises WHERE pari_id = ?').run(pari.id)
  db.prepare('DELETE FROM paris_issues WHERE pari_id = ?').run(pari.id)
  db.prepare('DELETE FROM paris WHERE id = ?').run(pari.id)
  res.json({ ok: true })
})

// POST /api/paris/:id/mises — placer une mise (tout utilisateur connecté)
router.post('/:id/mises', requireAuth, (req, res) => {
  const pari = db.prepare('SELECT * FROM paris WHERE id = ?').get(req.params.id)
  if (!pari) return res.status(404).json({ message: 'Pari introuvable.' })
  if (pari.statut === 'resolu') return res.status(400).json({ message: 'Le pari est déjà résolu.' })

  const admin = isAdmin(req.user.id)
  let { joueur_nom, issue_id, montant } = req.body

  // Si admin avec joueur_nom explicite → mise manuelle, sinon → mise pour soi-même
  let userId = null
  if (admin && joueur_nom) {
    joueur_nom = joueur_nom.trim()
  } else {
    const me = db.prepare('SELECT id, nom FROM users WHERE id = ?').get(req.user.id)
    userId = me.id
    joueur_nom = me.nom
  }

  if (!issue_id || !montant) return res.status(400).json({ message: 'issue_id et montant requis.' })

  const issue = db.prepare('SELECT id FROM paris_issues WHERE id = ? AND pari_id = ?').get(issue_id, pari.id)
  if (!issue) return res.status(400).json({ message: 'Issue invalide.' })

  const m = parseInt(montant)
  if (isNaN(m) || m <= 0) return res.status(400).json({ message: 'Montant invalide.' })

  // Validation min/max
  if (pari.mise_min && m < pari.mise_min)
    return res.status(400).json({ message: `Mise minimum : ${pari.mise_min.toLocaleString()} ¥` })
  if (pari.mise_max && m > pari.mise_max)
    return res.status(400).json({ message: `Mise maximum : ${pari.mise_max.toLocaleString()} ¥` })

  // Un utilisateur connecté ne peut miser qu'une fois par pari
  if (userId) {
    const existante = db.prepare('SELECT id FROM paris_mises WHERE pari_id = ? AND user_id = ?').get(pari.id, userId)
    if (existante) return res.status(400).json({ message: 'Vous avez déjà une mise sur ce pari.' })

    // Vérifier et déduire le solde
    const user = db.prepare('SELECT solde FROM users WHERE id = ?').get(userId)
    if (user.solde < m) return res.status(400).json({ message: 'Solde insuffisant.' })
    db.prepare('UPDATE users SET solde = solde - ? WHERE id = ?').run(m, userId)
  }

  db.prepare('INSERT INTO paris_mises (pari_id, user_id, joueur_nom, issue_id, montant) VALUES (?, ?, ?, ?, ?)')
    .run(pari.id, userId, joueur_nom, issue_id, m)

  res.status(201).json({ pari: getPariComplet(pari.id) })
})

// DELETE /api/paris/:id/mises/:miseId — supprimer une mise (propriétaire ou admin)
router.delete('/:id/mises/:miseId', requireAuth, (req, res) => {
  const mise = db.prepare('SELECT * FROM paris_mises WHERE id = ? AND pari_id = ?').get(req.params.miseId, req.params.id)
  if (!mise) return res.status(404).json({ message: 'Mise introuvable.' })

  const admin = isAdmin(req.user.id)
  if (!admin && mise.user_id !== req.user.id)
    return res.status(403).json({ message: 'Accès refusé.' })

  // Vérifier que le pari est encore ouvert
  const pari = db.prepare('SELECT statut FROM paris WHERE id = ?').get(req.params.id)
  if (pari.statut !== 'ouvert')
    return res.status(400).json({ message: 'Impossible de retirer une mise sur un pari résolu.' })

  // Rembourser si mise liée à un utilisateur
  if (mise.user_id) {
    db.prepare('UPDATE users SET solde = solde + ? WHERE id = ?').run(mise.montant, mise.user_id)
  }

  db.prepare('DELETE FROM paris_mises WHERE id = ?').run(mise.id)
  res.json({ pari: getPariComplet(parseInt(req.params.id)) })
})

// POST /api/paris/:id/resoudre — résoudre le pari + créditer les gagnants (admin)
router.post('/:id/resoudre', requireAuth, requireAdmin, (req, res) => {
  const pari = db.prepare('SELECT * FROM paris WHERE id = ?').get(req.params.id)
  if (!pari) return res.status(404).json({ message: 'Pari introuvable.' })
  if (pari.statut === 'resolu') return res.status(400).json({ message: 'Pari déjà résolu.' })

  const { issue_gagnante_id } = req.body
  if (!issue_gagnante_id) return res.status(400).json({ message: 'issue_gagnante_id requis.' })

  const issue = db.prepare('SELECT * FROM paris_issues WHERE id = ? AND pari_id = ?').get(issue_gagnante_id, pari.id)
  if (!issue) return res.status(400).json({ message: 'Issue invalide.' })

  db.transaction(() => {
    db.prepare('UPDATE paris SET statut = ?, issue_gagnante_id = ? WHERE id = ?').run('resolu', issue.id, pari.id)

    // Créditer les gagnants qui ont un user_id
    const misesGagnantes = db.prepare('SELECT * FROM paris_mises WHERE pari_id = ? AND issue_id = ?').all(pari.id, issue.id)
    for (const mise of misesGagnantes) {
      if (mise.user_id) {
        const gain = Math.round(mise.montant * issue.cote)
        db.prepare('UPDATE users SET solde = solde + ? WHERE id = ?').run(gain, mise.user_id)
      }
    }
  })()

  res.json({ pari: getPariComplet(pari.id) })
})

module.exports = router

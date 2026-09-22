const express = require('express')
const multer  = require('multer')
const path    = require('path')
const crypto  = require('crypto')
const db      = require('../db')
const { requireAuth } = require('../middleware/auth')
const slotService = require('../services/slotService')

const router = express.Router()

function requireAdmin(req, res, next) {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id)
  if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Accès refusé.' })
  next()
}

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, 'slot_' + crypto.randomBytes(8).toString('hex') + ext)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Image uniquement.'))
    cb(null, true)
  },
})

// ── Routes publiques / joueur ───────────────────────────────────────────────

// GET /api/slots/config — config + symboles actifs (pour l'UI du jeu)
router.get('/config', (req, res) => {
  const config   = db.prepare('SELECT * FROM slots_config WHERE id = 1').get()
  const symboles = db.prepare('SELECT id, nom, image_url FROM slots_symbols WHERE actif = 1').all()
  res.json({ config, symboles })
})

// POST /api/slots/spin
router.post('/spin', requireAuth, (req, res) => {
  const mise = parseInt(req.body.mise)
  if (!mise || mise <= 0) return res.status(400).json({ message: 'Mise invalide.' })

  try {
    const resultat = slotService.jouer(req.user.id, mise)
    res.json(resultat)
  } catch (e) {
    res.status(400).json({ message: e.message })
  }
})

// ── Routes admin ────────────────────────────────────────────────────────────

// GET /api/slots/admin/symbols
router.get('/admin/symbols', requireAuth, requireAdmin, (req, res) => {
  const symboles = db.prepare('SELECT * FROM slots_symbols ORDER BY id ASC').all()
  res.json({ symboles })
})

// POST /api/slots/admin/symbols
router.post('/admin/symbols', requireAuth, requireAdmin, upload.single('image'), (req, res) => {
  const { nom, poids, mult_2, mult_3, actif } = req.body
  if (!nom) return res.status(400).json({ message: 'Nom requis.' })

  const image_url = req.file ? `/uploads/${req.file.filename}` : ''
  const result = db.prepare(`
    INSERT INTO slots_symbols (nom, image_url, poids, mult_2, mult_3, actif)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    nom.trim(),
    image_url,
    parseInt(poids) || 10,
    parseFloat(mult_2) || 2,
    parseFloat(mult_3) || 10,
    actif === '0' ? 0 : 1
  )

  const symbol = db.prepare('SELECT * FROM slots_symbols WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ symbol })
})

// PATCH /api/slots/admin/symbols/:id
router.patch('/admin/symbols/:id', requireAuth, requireAdmin, upload.single('image'), (req, res) => {
  const symbol = db.prepare('SELECT * FROM slots_symbols WHERE id = ?').get(req.params.id)
  if (!symbol) return res.status(404).json({ message: 'Symbole introuvable.' })

  const { nom, poids, mult_2, mult_3, actif } = req.body
  const image_url = req.file ? `/uploads/${req.file.filename}` : symbol.image_url

  db.prepare(`
    UPDATE slots_symbols SET nom = ?, image_url = ?, poids = ?, mult_2 = ?, mult_3 = ?, actif = ?
    WHERE id = ?
  `).run(
    nom       !== undefined ? nom.trim()          : symbol.nom,
    image_url,
    poids     !== undefined ? parseInt(poids)     : symbol.poids,
    mult_2    !== undefined ? parseFloat(mult_2)  : symbol.mult_2,
    mult_3    !== undefined ? parseFloat(mult_3)  : symbol.mult_3,
    actif     !== undefined ? (actif === '0' ? 0 : 1) : symbol.actif,
    req.params.id
  )

  const updated = db.prepare('SELECT * FROM slots_symbols WHERE id = ?').get(req.params.id)
  res.json({ symbol: updated })
})

// DELETE /api/slots/admin/symbols/:id
router.delete('/admin/symbols/:id', requireAuth, requireAdmin, (req, res) => {
  const symbol = db.prepare('SELECT id FROM slots_symbols WHERE id = ?').get(req.params.id)
  if (!symbol) return res.status(404).json({ message: 'Symbole introuvable.' })
  db.prepare('DELETE FROM slots_symbols WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// GET /api/slots/admin/joueurs
router.get('/admin/joueurs', requireAuth, requireAdmin, (req, res) => {
  const joueurs = db.prepare(`
    SELECT id, nom, identifiant, grade, role, COALESCE(solde, 0) as solde
    FROM users ORDER BY nom ASC
  `).all()
  res.json({ joueurs })
})

// PATCH /api/slots/admin/joueurs/:id/solde
// body: { montant, operation: 'add' | 'remove' | 'set' }
router.patch('/admin/joueurs/:id/solde', requireAuth, requireAdmin, (req, res) => {
  const user = db.prepare('SELECT id, nom, COALESCE(solde, 0) as solde FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ message: 'Joueur introuvable.' })

  const { montant, operation } = req.body
  const m = parseInt(montant)
  if (isNaN(m) || m < 0) return res.status(400).json({ message: 'Montant invalide.' })

  let newSolde
  if (operation === 'set')    newSolde = m
  else if (operation === 'add')    newSolde = user.solde + m
  else if (operation === 'remove') newSolde = Math.max(0, user.solde - m)
  else return res.status(400).json({ message: 'Opération invalide (add | remove | set).' })

  db.prepare('UPDATE users SET solde = ? WHERE id = ?').run(newSolde, user.id)
  db.prepare(`
    INSERT INTO solde_logs (user_id, admin_id, operation, montant, gain_net, solde_avant, solde_apres)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(user.id, req.user.id, operation, m, newSolde - user.solde, user.solde, newSolde)
  res.json({ joueur: { ...user, solde: newSolde } })
})

// GET /api/slots/admin/logs?limit=100&offset=0&joueur=
router.get('/admin/logs', requireAuth, requireAdmin, (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit)  || 100, 500)
  const offset = parseInt(req.query.offset) || 0
  const joueur = req.query.joueur ? `%${req.query.joueur}%` : null

  const filterClause = joueur ? 'AND (u.nom LIKE ? OR u.identifiant LIKE ?)' : ''
  const filterParams = joueur ? [joueur, joueur] : []

  const logs = db.prepare(`
    SELECT id, 'jeu' as source, jeu, mise, gain_net, solde_avant, solde_apres,
           resultat, NULL as operation, NULL as admin_nom, created_at,
           joueur_nom, joueur_identifiant
    FROM (
      SELECT g.id, g.jeu, g.mise, g.gain_net, g.solde_avant, g.solde_apres,
             g.resultat, g.created_at,
             u.nom as joueur_nom, u.identifiant as joueur_identifiant
      FROM game_rounds g
      JOIN users u ON u.id = g.user_id
      WHERE 1=1 ${filterClause}
    )
    UNION ALL
    SELECT id, 'admin' as source, 'admin' as jeu, montant as mise, gain_net, solde_avant, solde_apres,
           NULL as resultat, operation, admin_nom, created_at,
           joueur_nom, joueur_identifiant
    FROM (
      SELECT s.id, s.montant, s.gain_net, s.solde_avant, s.solde_apres,
             s.operation, s.created_at,
             u.nom as joueur_nom, u.identifiant as joueur_identifiant,
             a.nom as admin_nom
      FROM solde_logs s
      JOIN users u ON u.id = s.user_id
      JOIN users a ON a.id = s.admin_id
      WHERE 1=1 ${filterClause}
    )
    ORDER BY created_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(...filterParams, ...filterParams, limit, offset)

  const total = db.prepare(`
    SELECT (
      SELECT COUNT(*) FROM game_rounds g JOIN users u ON u.id = g.user_id WHERE 1=1 ${filterClause}
    ) + (
      SELECT COUNT(*) FROM solde_logs s JOIN users u ON u.id = s.user_id WHERE 1=1 ${filterClause}
    ) as n
  `).get(...filterParams, ...filterParams).n

  res.json({ logs, total })
})

// GET /api/slots/admin/config
router.get('/admin/config', requireAuth, requireAdmin, (req, res) => {
  const config = db.prepare('SELECT * FROM slots_config WHERE id = 1').get()
  res.json({ config })
})

// PATCH /api/slots/admin/config
router.patch('/admin/config', requireAuth, requireAdmin, (req, res) => {
  const { mise_min, mise_max, nb_colonnes } = req.body
  const current = db.prepare('SELECT * FROM slots_config WHERE id = 1').get()

  const newMin  = mise_min    !== undefined ? parseInt(mise_min)    : current.mise_min
  const newMax  = mise_max    !== undefined ? parseInt(mise_max)    : current.mise_max
  const newCols = nb_colonnes !== undefined ? parseInt(nb_colonnes) : current.nb_colonnes

  if (newMin <= 0 || newMax <= 0 || newMin >= newMax) {
    return res.status(400).json({ message: 'Valeurs invalides : mise_min doit être inférieure à mise_max.' })
  }
  if (newCols < 3 || newCols > 7) {
    return res.status(400).json({ message: 'Nombre de colonnes invalide (3 à 7).' })
  }

  db.prepare('UPDATE slots_config SET mise_min = ?, mise_max = ?, nb_colonnes = ? WHERE id = 1').run(newMin, newMax, newCols)
  const config = db.prepare('SELECT * FROM slots_config WHERE id = 1').get()
  res.json({ config })
})

// ── Stats globales casino ─────────────────────────────────────────────────────

router.get('/admin/stats', requireAuth, requireAdmin, (req, res) => {
  // ── Parties jouées ──────────────────────────────────────────────────────────
  // gain_net = ce que le joueur gagne net (négatif = il perd)
  // benefice_jeux = -SUM(gain_net) = ce que le casino garde sur les jeux
  const jeux = db.prepare(`
    SELECT
      COUNT(*)                          AS nb_parties,
      COALESCE(SUM(mise), 0)            AS total_mise,
      COALESCE(SUM(mise + gain_net), 0) AS total_redistribue,
      COALESCE(-SUM(gain_net), 0)       AS benefice_jeux,
      COUNT(DISTINCT user_id)           AS nb_joueurs
    FROM game_rounds
  `).get()

  // ── Opérations admin (dépôts / retraits manuels) ────────────────────────────
  // gain_net dans solde_logs = delta solde joueur
  // → positif = casino a donné de l'argent (dépôt)
  // → négatif = casino a récupéré (retrait)
  const admin = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN gain_net > 0 THEN  gain_net ELSE 0 END), 0) AS total_depots,
      COALESCE(SUM(CASE WHEN gain_net < 0 THEN -gain_net ELSE 0 END), 0) AS total_retraits,
      COALESCE(SUM(gain_net), 0) AS net_admin
    FROM solde_logs
  `).get()

  // ── Position réelle du casino ───────────────────────────────────────────────
  // = argent gagné sur les jeux  -  argent sorti via dépôts admin (net)
  const position_nette = jeux.benefice_jeux - admin.net_admin

  const global = { ...jeux, ...admin, position_nette }

  // ── Par jeu ─────────────────────────────────────────────────────────────────
  const parJeu = db.prepare(`
    SELECT
      jeu,
      COUNT(*)                          AS nb_parties,
      COALESCE(SUM(mise), 0)            AS total_mise,
      COALESCE(SUM(mise + gain_net), 0) AS total_redistribue,
      COALESCE(-SUM(gain_net), 0)       AS benefice_jeux
    FROM game_rounds
    GROUP BY jeu
    ORDER BY nb_parties DESC
  `).all()

  // ── Top joueurs ─────────────────────────────────────────────────────────────
  const topJoueurs = db.prepare(`
    SELECT
      u.nom,
      u.identifiant,
      u.solde,
      COUNT(gr.id)                   AS nb_parties,
      COALESCE(SUM(gr.mise), 0)      AS total_mise,
      COALESCE(-SUM(gr.gain_net), 0) AS pertes_nettes
    FROM game_rounds gr
    JOIN users u ON u.id = gr.user_id
    GROUP BY gr.user_id
    ORDER BY total_mise DESC
    LIMIT 10
  `).all()

  // ── Activité par jour (30 derniers jours) ───────────────────────────────────
  const parJour = db.prepare(`
    SELECT
      DATE(created_at)               AS jour,
      COUNT(*)                       AS nb_parties,
      COALESCE(SUM(mise), 0)         AS total_mise,
      COALESCE(-SUM(gain_net), 0)    AS benefice
    FROM game_rounds
    WHERE created_at >= DATE('now', '-30 days')
    GROUP BY DATE(created_at)
    ORDER BY jour ASC
  `).all()

  res.json({ global, parJeu, topJoueurs, parJour })
})

router.delete('/admin/stats', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM game_rounds').run()
  db.prepare('DELETE FROM solde_logs').run()
  res.json({ ok: true })
})

module.exports = router

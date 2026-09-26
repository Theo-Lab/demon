const db      = require('../db')
const discord  = require('./discordService')

const MISE_MAX      = 500_000
const GAIN_JOUR_MAX = 2_500_000

// ── Table de probabilités ─────────────────────────────────────────────────────
// RTP théorique = Σ(mult × prob) = 0.909 ≈ 90.9%
const OUTCOMES = [
  { mult: 0,   prob: 0.36  },
  { mult: 0.3, prob: 0.28  },
  { mult: 1,   prob: 0.18  },
  { mult: 2,   prob: 0.12  },
  { mult: 5,   prob: 0.045 },
  { mult: 10,  prob: 0.012 },
  { mult: 20,  prob: 0.003 },
]

// Seuils cumulatifs pré-calculés une seule fois au démarrage
const THRESHOLDS = (() => {
  let cumul = 0
  return OUTCOMES.map(o => {
    cumul += o.prob
    return { mult: o.mult, threshold: cumul }
  })
})()

// ── Tirage pondéré (weighted random par seuils cumulatifs) ───────────────────
function tirerResultat() {
  const r = Math.random()
  for (const { mult, threshold } of THRESHOLDS) {
    if (r < threshold) return mult
  }
  return OUTCOMES[OUTCOMES.length - 1].mult // fallback numérique (r === 1.0)
}

// ── Gains du joueur aujourd'hui ───────────────────────────────────────────────
function getGainJour(userId) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(gain_net), 0) as total
    FROM game_rounds
    WHERE user_id = ? AND jeu = 'wheel'
      AND date(created_at) = date('now')
      AND gain_net > 0
  `).get(userId)
  return row?.total ?? 0
}

// ── Spin (transaction atomique) ───────────────────────────────────────────────
const _spin = db.transaction((userId, mise) => {
  if (!mise || mise <= 0 || mise > MISE_MAX)
    throw new Error(`Mise invalide (1–${MISE_MAX.toLocaleString()} ¥).`)

  const user = db.prepare('SELECT id, solde FROM users WHERE id = ?').get(userId)
  if (!user)             throw new Error('Utilisateur introuvable.')
  if (user.solde < mise) throw new Error('Solde insuffisant.')

  if (getGainJour(userId) >= GAIN_JOUR_MAX)
    throw new Error('Limite de gains journalière atteinte (2 500 000 ¥).')

  const mult       = tirerResultat()
  const payout     = Math.floor(mise * mult)
  const gain_net   = payout - mise
  const solde_avant = user.solde
  const solde_apres = solde_avant + gain_net

  db.prepare('UPDATE users SET solde = solde + ? WHERE id = ?').run(gain_net, userId)
  db.prepare(`
    INSERT INTO game_rounds (user_id, jeu, mise, resultat, gain_net, solde_avant, solde_apres)
    VALUES (?, 'wheel', ?, ?, ?, ?, ?)
  `).run(userId, mise, JSON.stringify({ mult }), gain_net, solde_avant, solde_apres)

  return { mult, gain_net, solde: solde_apres }
})

// ── Wrapper public avec notification Discord ──────────────────────────────────
function spin(userId, mise) {
  const r = _spin(userId, mise)
  if (r.gain_net > 0) {
    try {
      const user = db.prepare('SELECT nom, identifiant FROM users WHERE id = ?').get(userId)
      discord.logGameWin('wheel', {
        playerName:        user?.nom || '?',
        playerIdentifiant: user?.identifiant || '',
        gain_net:          r.gain_net,
        mise,
        solde:             r.solde,
        detail:            `×${r.mult} — mise ${mise.toLocaleString()} ¥`,
      })
    } catch (_) {}
  }
  return r
}

// ── Outil dev : vérifie le RTP empirique ─────────────────────────────────────
// Usage : node -e "require('./services/wheelService').calculateWheelRTP(500000)"
function calculateWheelRTP(iterations = 100_000) {
  let totalMise   = 0
  let totalPayout = 0
  const dist = {}

  for (let i = 0; i < iterations; i++) {
    const mise = 1000
    const mult = tirerResultat()
    totalMise   += mise
    totalPayout += Math.floor(mise * mult)
    dist[mult]   = (dist[mult] ?? 0) + 1
  }

  const rtp = totalPayout / totalMise
  console.log(`\n=== Wheel RTP simulation (${iterations.toLocaleString()} spins) ===`)
  for (const [mult, count] of Object.entries(dist).sort((a, b) => +a[0] - +b[0])) {
    const freq     = (count / iterations * 100).toFixed(2)
    const theorique = ((OUTCOMES.find(o => String(o.mult) === mult)?.prob ?? 0) * 100).toFixed(2)
    console.log(`  ×${String(mult).padEnd(4)} : ${freq.padStart(6)}%  (théorique: ${theorique}%)`)
  }
  console.log(`  RTP empirique : ${(rtp * 100).toFixed(2)}%  (théorique: ~90.90%)`)
  console.log('========================================================\n')
  return rtp
}

module.exports = { spin, calculateWheelRTP, MISE_MAX, OUTCOMES }

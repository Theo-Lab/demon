const db = require('../db')

function hasMalchance(userId) {
  const user = db.prepare('SELECT malchance FROM users WHERE id = ?').get(userId)
  return !!user?.malchance
}

function getMalchanceProb(userId) {
  const user = db.prepare('SELECT malchance_prob FROM users WHERE id = ?').get(userId)
  return user?.malchance_prob ?? 0.60
}

function logMalchance(userId, jeu) {
  try {
    db.prepare('INSERT INTO malchance_logs (user_id, jeu) VALUES (?, ?)').run(userId, jeu)
  } catch {}
}

module.exports = { hasMalchance, getMalchanceProb, logMalchance }

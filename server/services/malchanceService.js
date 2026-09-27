const db = require('../db')

function hasMalchance(userId) {
  const user = db.prepare('SELECT malchance FROM users WHERE id = ?').get(userId)
  return !!user?.malchance
}

function getMalchanceProb(userId) {
  const user = db.prepare('SELECT malchance_prob FROM users WHERE id = ?').get(userId)
  return user?.malchance_prob ?? 0.60
}

module.exports = { hasMalchance, getMalchanceProb }

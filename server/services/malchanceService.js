const db = require('../db')

function hasMalchance(userId) {
  const user = db.prepare('SELECT malchance FROM users WHERE id = ?').get(userId)
  return !!user?.malchance
}

module.exports = { hasMalchance }

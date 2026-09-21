const jwt = require('jsonwebtoken')

const SECRET = process.env.JWT_SECRET || 'yugen_ordre_demoniaque_secret'

function requireAuth(req, res, next) {
  const token = req.cookies?.access_token
  if (!token) return res.status(401).json({ message: 'Non authentifié.' })
  try {
    req.user = jwt.verify(token, SECRET)
    next()
  } catch {
    res.status(401).json({ message: 'Session expirée.' })
  }
}

module.exports = { requireAuth }

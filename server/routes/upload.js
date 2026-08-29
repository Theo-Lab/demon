const express = require('express')
const multer = require('multer')
const path = require('path')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')

const router = express.Router()
const SECRET = process.env.JWT_SECRET || 'yugen_ordre_demoniaque_secret'

function auth(req, res, next) {
  const header = req.headers.authorization
  if (!header) return res.status(401).json({ message: 'Non authentifié.' })
  try {
    req.user = jwt.verify(header.split(' ')[1], SECRET)
    next()
  } catch {
    res.status(401).json({ message: 'Token invalide.' })
  }
}

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, crypto.randomBytes(8).toString('hex') + ext)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Fichier image uniquement.'))
    }
    cb(null, true)
  },
})

router.post('/', auth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Aucun fichier reçu.' })
  res.json({ url: `/uploads/${req.file.filename}` })
})

module.exports = router

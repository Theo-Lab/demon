const express = require('express')
const multer = require('multer')
const path = require('path')
const crypto = require('crypto')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

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

router.post('/', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Aucun fichier reçu.' })
  res.json({ url: `/uploads/${req.file.filename}` })
})

module.exports = router

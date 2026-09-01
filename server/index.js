require('dotenv').config()
const express = require('express')
const cors = require('cors')

const app = express()
const PORT = process.env.PORT || 3001
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json())

app.use('/api/auth', require('./routes/auth'))
app.use('/api/rapports', require('./routes/rapports'))
app.use('/api/upload', require('./routes/upload'))
app.use('/api/spheres', require('./routes/spheres'))
app.use('/api/projets', require('./routes/projets'))
app.use('/uploads', require('express').static('./uploads'))

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`)
})

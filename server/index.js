require('dotenv').config()
const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')

const app = express()
const PORT = process.env.PORT || 3001
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

app.use(cors({ origin: CORS_ORIGIN, credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.use('/api/auth', require('./routes/auth'))
app.use('/api/rapports', require('./routes/rapports'))
app.use('/api/upload', require('./routes/upload'))
app.use('/api/spheres', require('./routes/spheres'))
app.use('/api/projets', require('./routes/projets'))
app.use('/api/parchemins', require('./routes/parchemins'))
app.use('/api/paris', require('./routes/paris'))
app.use('/api/slots', require('./routes/slots'))
app.use('/api/roulette', require('./routes/roulette'))
app.use('/api/blackjack', require('./routes/blackjack'))
app.use('/uploads', require('express').static('./uploads'))

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`)
})

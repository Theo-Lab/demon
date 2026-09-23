require('dotenv').config()
const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { createServer } = require('http')
const { Server } = require('socket.io')
const jwt = require('jsonwebtoken')

const app = express()
const PORT = process.env.PORT || 3001
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'
const JWT_SECRET = process.env.JWT_SECRET || 'yugen_ordre_demoniaque_secret'

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
app.use('/api/blackjack-lobby', require('./routes/blackjackLobby'))
app.use('/uploads', require('express').static('./uploads'))

// ── HTTP + Socket.io ──────────────────────────────────────────────────────────

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
})

// ── Lobby state (en mémoire) ──────────────────────────────────────────────────

const {
  getTableState,
  prendreSiege,
  quitterSiege,
  demarrerPartie,
  jouerAction,
  avancerTour,
  jouerDealer,
  resoudrePartie,
  resetTable,
  nbJoueursAssis,
} = require('./services/blackjackLobbyService')

const db = require('./db')

// countdowns[tableId] = { interval, timeout, secondsLeft }
const countdowns = new Map()
// tourTimers[tableId] = timeout pour le tour en cours
const tourTimers = new Map()

function broadcastTableState(tableId) {
  try {
    const state = getTableState(tableId)
    io.to(`table_${tableId}`).emit('table_update', state)
  } catch (e) {
    console.error('broadcastTableState error:', e.message)
  }
}

function clearCountdown(tableId) {
  const cd = countdowns.get(tableId)
  if (cd) {
    clearInterval(cd.interval)
    clearTimeout(cd.timeout)
    countdowns.delete(tableId)
  }
}

function clearTourTimer(tableId) {
  const t = tourTimers.get(tableId)
  if (t) {
    clearTimeout(t)
    tourTimers.delete(tableId)
  }
}

function startCountdown(tableId) {
  clearCountdown(tableId)

  let secondsLeft = 15
  io.to(`table_${tableId}`).emit('countdown_tick', { secondsLeft, tableId })

  const interval = setInterval(() => {
    secondsLeft--
    io.to(`table_${tableId}`).emit('countdown_tick', { secondsLeft, tableId })
    if (secondsLeft <= 0) {
      clearInterval(interval)
    }
  }, 1000)

  const timeout = setTimeout(() => {
    clearInterval(interval)
    countdowns.delete(tableId)

    // Vérifier qu'il y a encore des joueurs
    const n = nbJoueursAssis(tableId)
    if (n === 0) return

    try {
      const bjResult = demarrerPartie(tableId)
      io.to(`table_${tableId}`).emit('game_start', { tableId })
      broadcastTableState(tableId)
      if (bjResult?.allBlackjack) {
        processNextTour(tableId)
      } else {
        startTourTimer(tableId)
      }
    } catch (e) {
      io.to(`table_${tableId}`).emit('error', { message: e.message })
    }
  }, 15000)

  countdowns.set(tableId, { interval, timeout, secondsLeft })
}

function startTourTimer(tableId) {
  clearTourTimer(tableId)
  const timer = setTimeout(() => {
    tourTimers.delete(tableId)
    // Auto-stand pour le joueur actif
    try {
      const state = getTableState(tableId)
      if (state.table.statut !== 'en_cours') return
      const siegeActif = state.sieges.find(s => s.numero === state.table.siege_actif && s.statut === 'en_jeu')
      if (!siegeActif || !siegeActif.user_id) return

      jouerAction(tableId, siegeActif.user_id, 'stand')
      broadcastTableState(tableId)
      processNextTour(tableId)
    } catch (e) {
      console.error('Auto-stand error:', e.message)
    }
  }, 20000)
  tourTimers.set(tableId, timer)
}

function processNextTour(tableId) {
  clearTourTimer(tableId)
  const result = avancerTour(tableId)
  if (result.action === 'next') {
    broadcastTableState(tableId)
    startTourTimer(tableId)
  } else {
    // Dealer joue
    try {
      jouerDealer(tableId)
      broadcastTableState(tableId)
      const resolution = resoudrePartie(tableId)
      broadcastTableState(tableId)
      io.to(`table_${tableId}`).emit('game_end', resolution)

      // Reset après 5 secondes
      setTimeout(() => {
        try {
          resetTable(tableId)
          broadcastTableState(tableId)
          io.to(`table_${tableId}`).emit('table_reset', { tableId })
          // Relancer le countdown si des joueurs sont encore assis
          const nb = nbJoueursAssis(tableId)
          if (nb > 0 && !countdowns.has(tableId)) {
            startCountdown(tableId)
          }
        } catch (e) {
          console.error('resetTable error:', e.message)
        }
      }, 5000)
    } catch (e) {
      console.error('processNextTour dealer error:', e.message)
    }
  }
}

// ── Middleware Socket auth ─────────────────────────────────────────────────────

io.use((socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie || ''
    const match = cookieHeader.match(/access_token=([^;]+)/)
    if (!match) return next(new Error('Non authentifié.'))
    const token = match[1]
    const user = jwt.verify(token, JWT_SECRET)
    socket.user = user
    next()
  } catch {
    next(new Error('Token invalide.'))
  }
})

// ── Gestion des events ────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  const userId = socket.user.id
  const db = require('./db')
  const userRow = db.prepare('SELECT nom FROM users WHERE id = ?').get(userId)
  const userNom = userRow?.nom ?? socket.user.identifiant

  // join_table
  socket.on('join_table', (tableId) => {
    tableId = parseInt(tableId)
    socket.join(`table_${tableId}`)
    try {
      const state = getTableState(tableId)
      socket.emit('table_update', state)
      // Envoyer le countdown actif si existant
      const cd = countdowns.get(tableId)
      if (cd) {
        socket.emit('countdown_tick', { secondsLeft: cd.secondsLeft })
      }
    } catch (e) {
      socket.emit('error', { message: e.message })
    }
  })

  // prendre_siege
  socket.on('prendre_siege', ({ tableId, siegeNumero, mise }) => {
    tableId = parseInt(tableId)
    siegeNumero = parseInt(siegeNumero)
    mise = parseInt(mise)
    console.log(`[prendre_siege] userId=${userId} userNom="${userNom}" table=${tableId} siege=${siegeNumero}`)
    try {
      const result = prendreSiege(tableId, siegeNumero, userId, userNom, mise)
      socket.emit('siege_pris', { solde: result.solde })
      broadcastTableState(tableId)

      // Démarrer le countdown si c'est le premier joueur
      const n = nbJoueursAssis(tableId)
      if (n === 1 && !countdowns.has(tableId)) {
        startCountdown(tableId)
      }
    } catch (e) {
      socket.emit('error', { message: e.message })
    }
  })

  // quitter_siege
  socket.on('quitter_siege', ({ tableId }) => {
    tableId = parseInt(tableId)
    try {
      const result = quitterSiege(tableId, userId)
      socket.emit('siege_quitte', { solde: result.solde })
      broadcastTableState(tableId)

      // Annuler le countdown si plus personne
      const n = nbJoueursAssis(tableId)
      if (n === 0) {
        clearCountdown(tableId)
        io.to(`table_${tableId}`).emit('countdown_cancelled', { tableId })
      }
    } catch (e) {
      socket.emit('error', { message: e.message })
    }
  })

  // action (hit / stand / double)
  socket.on('action', ({ tableId, action }) => {
    tableId = parseInt(tableId)
    try {
      const result = jouerAction(tableId, userId, action)
      clearTourTimer(tableId)
      broadcastTableState(tableId)
      if (result.done) {
        // Siège terminé (stand, double, bust ou 21) → passer au suivant
        processNextTour(tableId)
      } else {
        // Hit sans bust → le joueur peut encore jouer, relancer le timer
        startTourTimer(tableId)
      }
    } catch (e) {
      socket.emit('error', { message: e.message })
    }
  })

  socket.on('disconnect', () => {
    // Pas de cleanup auto — le joueur reste assis jusqu'à timeout ou fin de partie
  })
})

// ── Start ─────────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`)
})

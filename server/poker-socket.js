const {
  getTable, getTableState,
  joinTable, cashOut,
  startHand, playerAction, advancePhase, resolveHand, resetForNextHand,
} = require('./services/pokerService')

// tableId → { countdown: {interval, timeout, sLeft}, actionTimer: timeout }
const timers = new Map()

function getTimers(tableId) {
  if (!timers.has(tableId)) timers.set(tableId, {})
  return timers.get(tableId)
}

function clearCountdown(tableId) {
  const t = getTimers(tableId)
  if (t.countdown) {
    clearInterval(t.countdown.interval)
    clearTimeout(t.countdown.timeout)
    t.countdown = null
  }
}

function clearActionTimer(tableId) {
  const t = getTimers(tableId)
  if (t.actionTimer) { clearTimeout(t.actionTimer); t.actionTimer = null }
}

// Broadcast personalized state to each socket in the room
function broadcastTable(io, tableId) {
  try {
    const room = io.sockets.adapter.rooms.get(`poker_${tableId}`)
    if (!room) return
    for (const socketId of room) {
      const socket = io.sockets.sockets.get(socketId)
      if (socket) {
        const state = getTableState(tableId, socket.user?.id)
        socket.emit('poker_table_update', state)
      }
    }
  } catch {}
}

function startCountdown(io, tableId) {
  clearCountdown(tableId)
  let sLeft = 10
  io.to(`poker_${tableId}`).emit('poker_countdown', { sLeft })

  const interval = setInterval(() => {
    sLeft--
    io.to(`poker_${tableId}`).emit('poker_countdown', { sLeft })
    if (sLeft <= 0) clearInterval(interval)
  }, 1000)

  const timeout = setTimeout(() => {
    clearInterval(interval)
    timers.get(tableId).countdown = null
    try {
      const table = getTable(tableId)
      if (table.players.length < 2) return
      startHand(tableId)
      io.to(`poker_${tableId}`).emit('poker_hand_start', {})
      broadcastTable(io, tableId)
      startActionTimer(io, tableId)
    } catch (e) {
      io.to(`poker_${tableId}`).emit('poker_error', { message: e.message })
    }
  }, 10000)

  getTimers(tableId).countdown = { interval, timeout, sLeft }
}

function startActionTimer(io, tableId) {
  clearActionTimer(tableId)
  const timer = setTimeout(() => {
    getTimers(tableId).actionTimer = null
    try {
      const table = getTable(tableId)
      if (!['preflop','flop','turn','river'].includes(table.status)) return
      const active = table.players[table.actionIdx]
      if (!active) return
      // Auto-fold (or check if no bet needed)
      const act = active.bet >= table.currentBet ? 'check' : 'fold'
      const result = playerAction(tableId, active.userId, act)
      broadcastTable(io, tableId)
      handleActionResult(io, tableId, result)
    } catch {}
  }, 30000)
  getTimers(tableId).actionTimer = timer
}

function handleActionResult(io, tableId, { roundOver: over, onlyOneLeft }) {
  if (onlyOneLeft) {
    const result = resolveHand(tableId, true)
    broadcastTable(io, tableId)
    io.to(`poker_${tableId}`).emit('poker_hand_result', result)
    scheduleNextHand(io, tableId)
  } else if (over) {
    const phaseResult = advancePhase(tableId)
    broadcastTable(io, tableId)
    if (phaseResult && phaseResult.resolved !== false) {
      // resolveHand was called inside advancePhase
      io.to(`poker_${tableId}`).emit('poker_hand_result', phaseResult)
      scheduleNextHand(io, tableId)
    } else {
      startActionTimer(io, tableId)
    }
  } else {
    startActionTimer(io, tableId)
  }
}

function scheduleNextHand(io, tableId) {
  clearActionTimer(tableId)
  setTimeout(() => {
    try {
      const { busted } = resetForNextHand(tableId)
      broadcastTable(io, tableId)
      io.to(`poker_${tableId}`).emit('poker_reset', { busted })
      const table = getTable(tableId)
      if (table.players.length >= 2 && !getTimers(tableId).countdown) {
        startCountdown(io, tableId)
      }
    } catch {}
  }, 5000)
}

function registerPokerHandlers(io, socket) {
  const userId = socket.user.id
  const db = require('./db')
  const userRow = db.prepare('SELECT nom FROM users WHERE id = ?').get(userId)
  const nom = userRow?.nom ?? socket.user.identifiant

  // Join table room (spectate/reconnect)
  socket.on('poker_join', (tableId) => {
    tableId = parseInt(tableId)
    socket.join(`poker_${tableId}`)
    try {
      const state = getTableState(tableId, userId)
      socket.emit('poker_table_update', state)
      const cd = getTimers(tableId).countdown
      if (cd) socket.emit('poker_countdown', { sLeft: cd.sLeft })
    } catch (e) {
      socket.emit('poker_error', { message: e.message })
    }
  })

  // Buy in and sit
  socket.on('poker_sit', ({ tableId, buyIn }) => {
    tableId = parseInt(tableId)
    buyIn = parseInt(buyIn)
    try {
      const result = joinTable(tableId, userId, nom, buyIn)
      socket.emit('poker_sat', { solde: result.solde })
      broadcastTable(io, tableId)
      // Start countdown if now 2+ players and status waiting
      const table = getTable(tableId)
      if (table.players.length >= 2 && table.status === 'waiting' && !getTimers(tableId).countdown) {
        startCountdown(io, tableId)
      }
    } catch (e) {
      socket.emit('poker_error', { message: e.message })
    }
  })

  // Cash out and leave
  socket.on('poker_leave', ({ tableId }) => {
    tableId = parseInt(tableId)
    try {
      const result = cashOut(tableId, userId)
      socket.emit('poker_left', { solde: result.solde })
      socket.leave(`poker_${tableId}`)
      // broadcastTable might fail if table deleted
      try { broadcastTable(io, tableId) } catch {}
      // Cancel countdown if fewer than 2 players
      try {
        const table = getTable(tableId)
        if (table.players.length < 2) {
          clearCountdown(tableId)
          io.to(`poker_${tableId}`).emit('poker_countdown_cancel', {})
        }
      } catch {}
    } catch (e) {
      socket.emit('poker_error', { message: e.message })
    }
  })

  // Player action: fold / check / call / raise
  socket.on('poker_action', ({ tableId, action, amount }) => {
    tableId = parseInt(tableId)
    try {
      const result = playerAction(tableId, userId, action, amount)
      clearActionTimer(tableId)
      broadcastTable(io, tableId)
      handleActionResult(io, tableId, result)
    } catch (e) {
      socket.emit('poker_error', { message: e.message })
    }
  })

  // Disconnect: auto-fold if in active hand
  socket.on('disconnect', () => {
    try {
      const { tables } = require('./services/pokerService')
      for (const [tableId, table] of tables) {
        if (!['preflop','flop','turn','river'].includes(table.status)) continue
        const p = table.players.find(pl => pl.userId === userId)
        if (!p || p.status !== 'active') continue
        if (table.actionIdx >= 0 && table.players[table.actionIdx]?.userId === userId) {
          try {
            const result = playerAction(tableId, userId, 'fold')
            broadcastTable(io, tableId)
            handleActionResult(io, tableId, result)
          } catch {}
        }
      }
    } catch {}
  })
}

module.exports = { registerPokerHandlers }

<template>
  <div class="page">
    <AppNavbar />
    <div class="page-inner">

      <!-- Barre du haut -->
      <div class="top-bar">
        <RouterLink to="/poker" class="back-link">← Lobby</RouterLink>
        <div v-if="state" class="top-center">
          <span class="table-name-lbl">{{ state.name }}</span>
          <span class="blinds-lbl">{{ state.smallBlind.toLocaleString() }} / {{ state.bigBlind.toLocaleString() }} ¥</span>
        </div>
        <div class="top-right">
          <span class="my-chips-lbl" v-if="myPlayer">{{ myPlayer.chips.toLocaleString() }} ¥</span>
          <button
            v-if="state && state.status === 'waiting' && myPlayer"
            class="btn-leave"
            @click="partir"
          >Quitter</button>
        </div>
      </div>

      <!-- Countdown avant main -->
      <Transition name="fade">
        <div v-if="countdown != null" class="countdown-banner">
          <span class="countdown-num">{{ countdown }}</span>
          <span class="countdown-txt">La main commence dans…</span>
        </div>
      </Transition>

      <!-- Résultat de main -->
      <Transition name="fade">
        <div v-if="handResult" class="result-banner">
          <div v-for="w in handResult.winners" :key="w.userId" class="result-winner">
            <span class="result-crown">♛</span>
            <span class="result-nom">{{ w.nom }}</span>
            <span class="result-pot">remporte {{ handResult.pot.toLocaleString() }} ¥</span>
          </div>
          <div v-for="p in handResult.players.filter(p => p.handName)" :key="p.userId" class="result-hand">
            <span class="result-player-nom">{{ p.nom }}</span>
            <div class="result-cards">
              <span
                v-for="(c, i) in p.cards"
                :key="i"
                class="card"
                :class="c?.red ? 'card--red' : 'card--black'"
              >{{ c?.nom ?? '?' }}</span>
            </div>
            <span class="result-hand-name">{{ p.handName }}</span>
          </div>
        </div>
      </Transition>

      <!-- Table ovale -->
      <div v-if="state" class="arena">
        <div class="oval-table">
          <!-- Pot -->
          <div class="pot-display" v-if="state.pot > 0 || ['preflop','flop','turn','river'].includes(state.status)">
            <span class="pot-label">Pot</span>
            <span class="pot-value">{{ state.pot.toLocaleString() }} ¥</span>
          </div>

          <!-- Cartes communes -->
          <div class="community-cards" :class="`phase--${state.status}`">
            <span v-if="state.status === 'waiting'" class="phase-label">En attente</span>
            <template v-else>
              <span
                v-for="(c, i) in state.communityCards"
                :key="i"
                class="card card--community"
                :class="c.red ? 'card--red' : 'card--black'"
              >{{ c.nom }}</span>
              <span
                v-for="i in (5 - state.communityCards.length)"
                :key="`ph-${i}`"
                class="card card--placeholder"
              ></span>
            </template>
          </div>

          <!-- Phase -->
          <div class="phase-badge" v-if="!['waiting','showdown'].includes(state.status)">
            {{ phaseLabel }}
          </div>

          <!-- Joueurs autour de la table -->
          <div
            v-for="(seat, si) in orderedSeats"
            :key="seat.userId"
            class="seat"
            :style="seatStyle(si, orderedSeats.length)"
            :class="{
              'seat--active': seat.userId === state.activeUserId,
              'seat--folded': seat.status === 'folded',
              'seat--me': seat.userId === myUserId,
            }"
          >
            <!-- Boutons dealer / SB / BB -->
            <div class="seat-badges">
              <span v-if="seat.isDealer" class="badge badge--dealer">D</span>
              <span v-else-if="seat.isSB" class="badge badge--sb">SB</span>
              <span v-else-if="seat.isBB" class="badge badge--bb">BB</span>
            </div>

            <!-- Avatar + nom -->
            <div class="seat-avatar">{{ seat.nom[0]?.toUpperCase() }}</div>
            <div class="seat-nom">{{ seat.nom }}</div>
            <div class="seat-chips">{{ seat.chips.toLocaleString() }} ¥</div>

            <!-- Mise en cours -->
            <div v-if="seat.bet > 0" class="seat-bet">{{ seat.bet.toLocaleString() }} ¥</div>

            <!-- Cartes -->
            <div class="seat-cards" v-if="seat.cards?.length">
              <span
                v-for="(c, ci) in seat.cards"
                :key="ci"
                class="card"
                :class="c ? (c.red ? 'card--red' : 'card--black') : 'card--back'"
              >{{ c ? c.nom : '' }}</span>
            </div>

            <!-- Timer actif -->
            <div v-if="seat.userId === state.activeUserId && actionCountdown != null" class="action-timer">
              {{ actionCountdown }}s
            </div>
          </div>
        </div>
      </div>

      <!-- Zone d'action (mes boutons) -->
      <div v-if="isMyTurn" class="action-zone">
        <div class="action-info">
          <span v-if="state.currentBet > 0 && myPlayer.bet < state.currentBet">
            À suivre : {{ (state.currentBet - myPlayer.bet).toLocaleString() }} ¥
          </span>
          <span v-else>Votre tour</span>
        </div>
        <div class="action-buttons">
          <button class="btn-action btn-fold" @click="doAction('fold')">Se coucher</button>
          <button
            v-if="myPlayer.bet >= state.currentBet"
            class="btn-action btn-check"
            @click="doAction('check')"
          >Checker</button>
          <button
            v-if="myPlayer.bet < state.currentBet"
            class="btn-action btn-call"
            @click="doAction('call')"
          >Suivre {{ (state.currentBet - myPlayer.bet).toLocaleString() }} ¥</button>
          <div class="raise-wrap">
            <button class="btn-action btn-raise" @click="doAction('raise', raiseAmount)">
              Relancer
            </button>
            <div class="raise-input-wrap">
              <button class="raise-adj" @click="raiseAmount = Math.max(state.bigBlind, raiseAmount - state.bigBlind)">−</button>
              <span class="raise-val">{{ raiseAmount.toLocaleString() }} ¥</span>
              <button class="raise-adj" @click="raiseAmount += state.bigBlind">+</button>
            </div>
          </div>
        </div>
        <!-- Mes cartes -->
        <div class="my-cards" v-if="myPlayer?.cards?.length">
          <span
            v-for="(c, ci) in myPlayer.cards"
            :key="ci"
            class="card card--large"
            :class="c ? (c.red ? 'card--red' : 'card--black') : 'card--back'"
          >{{ c ? c.nom : '' }}</span>
        </div>
      </div>

      <!-- Mes cartes quand ce n'est pas mon tour (hors action) -->
      <div v-else-if="myPlayer?.cards?.length && ['preflop','flop','turn','river'].includes(state?.status)" class="my-cards-passive">
        <span
          v-for="(c, ci) in myPlayer.cards"
          :key="ci"
          class="card card--large"
          :class="c ? (c.red ? 'card--red' : 'card--black') : 'card--back'"
        >{{ c ? c.nom : '' }}</span>
      </div>

      <!-- Pas encore assis -->
      <div v-else-if="state && !myPlayer" class="spectate-info">
        <p>Vous observez la partie.</p>
        <RouterLink to="/poker" class="back-link">← Rejoindre une table</RouterLink>
      </div>

      <!-- Log d'actions -->
      <div class="action-log" v-if="log.length">
        <div v-for="(entry, i) in log.slice(-6)" :key="i" class="log-entry">{{ entry }}</div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppNavbar from './AppNavbar.vue'
import { io } from 'socket.io-client'
import { currentUser } from '../auth.js'

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:3001'

const route = useRoute()
const router = useRouter()
const tableId = parseInt(route.params.id)

const state = ref(null)
const countdown = ref(null)
const handResult = ref(null)
const log = ref([])
const raiseAmount = ref(0)
const actionCountdown = ref(null)

let socket = null
let actionTimer = null

const myUserId = computed(() => currentUser.value?.id)
const myPlayer = computed(() => state.value?.players.find(p => p.userId === myUserId.value))
const isMyTurn = computed(() =>
  state.value?.activeUserId === myUserId.value &&
  ['preflop','flop','turn','river'].includes(state.value?.status)
)

// Réordonne les sièges: le joueur actuel toujours en bas (index 0)
const orderedSeats = computed(() => {
  if (!state.value) return []
  const players = state.value.players
  const myIdx = players.findIndex(p => p.userId === myUserId.value)
  if (myIdx === -1) return players
  return [...players.slice(myIdx), ...players.slice(0, myIdx)]
})

const phaseLabel = computed(() => {
  const map = { preflop: 'Pré-flop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Showdown' }
  return map[state.value?.status] ?? ''
})

// Calcul de position des sièges autour de l'ovale
// Formule : angle = π/2 - (2π/n)*i (départ bas, sens horaire)
function seatStyle(i, n) {
  const angle = Math.PI / 2 - (2 * Math.PI / n) * i
  const left = 50 + 43 * Math.cos(angle)
  const top = 50 + 38 * Math.sin(angle)
  return {
    left: `${left}%`,
    top: `${top}%`,
    transform: 'translate(-50%, -50%)',
  }
}

let actionTimerInterval = null

function startActionCountdown() {
  clearActionCountdown()
  actionCountdown.value = 30
  actionTimerInterval = setInterval(() => {
    actionCountdown.value--
    if (actionCountdown.value <= 0) clearActionCountdown()
  }, 1000)
}

function clearActionCountdown() {
  if (actionTimerInterval) { clearInterval(actionTimerInterval); actionTimerInterval = null }
  actionCountdown.value = null
}

function doAction(act, amount) {
  if (!socket) return
  socket.emit('poker_action', { tableId, action: act, amount })
}

function partir() {
  if (!socket) return
  socket.emit('poker_leave', { tableId })
}

function addLog(msg) {
  log.value.push(msg)
  if (log.value.length > 30) log.value.shift()
}

onMounted(() => {
  socket = io(SOCKET_URL, { withCredentials: true })

  socket.on('connect', () => {
    socket.emit('poker_join', tableId)
  })

  socket.on('poker_table_update', (s) => {
    const wasMyTurn = state.value?.activeUserId === myUserId.value
    state.value = s
    if (s.activeUserId && s.activeUserId !== (wasMyTurn ? myUserId.value : null)) {
      startActionCountdown()
    }
    if (!['preflop','flop','turn','river'].includes(s.status)) {
      clearActionCountdown()
    }
    // Initialiser raiseAmount
    if (s.status !== 'waiting') {
      raiseAmount.value = s.bigBlind
    }
    handResult.value = s.handResult ?? null
  })

  socket.on('poker_countdown', ({ sLeft }) => {
    countdown.value = sLeft
    if (sLeft <= 0) setTimeout(() => { if (countdown.value === 0) countdown.value = null }, 600)
  })

  socket.on('poker_countdown_cancel', () => { countdown.value = null })

  socket.on('poker_hand_start', () => {
    countdown.value = null
    handResult.value = null
    addLog('— Nouvelle main —')
  })

  socket.on('poker_hand_result', (result) => {
    handResult.value = result
    clearActionCountdown()
    for (const w of result.winners) addLog(`${w.nom} remporte ${result.pot.toLocaleString()} ¥`)
    for (const p of result.players) if (p.handName) addLog(`  ${p.nom} : ${p.handName}`)
  })

  socket.on('poker_reset', () => {
    handResult.value = null
  })

  socket.on('poker_left', ({ solde }) => {
    socket.disconnect()
    router.push('/poker')
  })

  socket.on('poker_error', ({ message }) => {
    addLog(`⚠ ${message}`)
  })
})

onUnmounted(() => {
  clearActionCountdown()
  socket?.disconnect()
})

// Watch pour log des actions
watch(state, (newState, oldState) => {
  if (!oldState || !newState) return
  if (newState.activeUserId && newState.activeUserId !== oldState?.activeUserId) {
    const p = newState.players.find(p => p.userId === newState.activeUserId)
    if (p) addLog(`${p.nom} doit agir`)
  }
}, { deep: true })
</script>

<style scoped>
.page { min-height: 100vh; background: #090909; color: #fff; }
.page-inner { max-width: 900px; margin: 0 auto; padding: 24px 16px 80px; }

/* Top bar */
.top-bar {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16px;
}
.back-link {
  font-family: 'Cinzel', serif; font-size: 0.68rem;
  letter-spacing: 0.1em; color: rgba(255,255,255,0.3); text-decoration: none;
}
.back-link:hover { color: rgba(255,255,255,0.6); }
.top-center { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.table-name-lbl { font-family: 'Cinzel', serif; font-size: 0.82rem; letter-spacing: 0.08em; color: #d4cfc9; }
.blinds-lbl { font-size: 0.72rem; color: rgba(255,255,255,0.25); }
.top-right { display: flex; align-items: center; gap: 12px; }
.my-chips-lbl { font-family: 'Cinzel', serif; font-size: 0.82rem; color: #c9a84c; letter-spacing: 0.06em; }
.btn-leave {
  background: none; border: 1px solid rgba(255,255,255,0.12);
  border-radius: 4px; color: rgba(255,255,255,0.3);
  font-family: 'Cinzel', serif; font-size: 0.62rem; letter-spacing: 0.1em;
  padding: 6px 14px; cursor: pointer; transition: all 0.15s;
}
.btn-leave:hover { border-color: #8B1A1A; color: #e05555; }

/* Countdown */
.countdown-banner {
  display: flex; align-items: center; gap: 14px; justify-content: center;
  padding: 12px 20px; background: rgba(201,168,76,0.07);
  border: 1px solid rgba(201,168,76,0.2); border-radius: 6px;
  margin-bottom: 16px;
}
.countdown-num { font-family: 'Cinzel', serif; font-size: 1.4rem; color: #c9a84c; }
.countdown-txt { font-size: 0.82rem; color: rgba(255,255,255,0.4); }

/* Result banner */
.result-banner {
  background: rgba(16,16,18,0.97);
  border: 1px solid rgba(201,168,76,0.3);
  border-radius: 8px;
  padding: 20px 24px;
  margin-bottom: 16px;
  display: flex; flex-direction: column; gap: 10px;
}
.result-winner {
  display: flex; align-items: center; gap: 10px;
  font-family: 'Cinzel', serif;
}
.result-crown { color: #c9a84c; font-size: 1rem; }
.result-nom { font-size: 0.9rem; color: #fff; letter-spacing: 0.06em; }
.result-pot { font-size: 0.82rem; color: #c9a84c; }
.result-hand {
  display: flex; align-items: center; gap: 10px;
  padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05);
  flex-wrap: wrap;
}
.result-player-nom { font-family: 'Cinzel', serif; font-size: 0.72rem; color: rgba(255,255,255,0.5); min-width: 80px; }
.result-cards { display: flex; gap: 4px; }
.result-hand-name { font-size: 0.75rem; color: rgba(255,255,255,0.35); margin-left: 4px; }

/* Arena + oval table */
.arena {
  display: flex; justify-content: center;
  margin: 8px 0;
}

.oval-table {
  position: relative;
  width: min(680px, 95vw);
  aspect-ratio: 680 / 380;
  background: radial-gradient(ellipse at 50% 60%, #1d6b3c 0%, #0e4125 55%, #082c19 100%);
  border-radius: 50%;
  border: 6px solid #8B6914;
  box-shadow:
    0 0 0 2px #5a4510,
    0 0 40px rgba(0,0,0,0.8),
    inset 0 0 60px rgba(0,0,0,0.3);
}

/* Pot */
.pot-display {
  position: absolute;
  top: 30%; left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 2;
}
.pot-label {
  display: block; font-family: 'Cinzel', serif;
  font-size: 0.55rem; letter-spacing: 0.18em; color: rgba(255,255,255,0.3);
  text-transform: uppercase; margin-bottom: 3px;
}
.pot-value {
  font-family: 'Cinzel', serif; font-size: 1rem;
  color: #c9a84c; letter-spacing: 0.06em;
}

/* Cartes communes */
.community-cards {
  position: absolute;
  top: 55%; left: 50%;
  transform: translate(-50%, -50%);
  display: flex; gap: 6px; align-items: center;
  z-index: 2;
}
.phase-label {
  font-family: 'Cinzel', serif; font-size: 0.62rem;
  letter-spacing: 0.2em; color: rgba(255,255,255,0.2);
  text-transform: uppercase;
}

/* Phase badge */
.phase-badge {
  position: absolute; bottom: 12%; left: 50%;
  transform: translateX(-50%);
  font-family: 'Cinzel', serif; font-size: 0.55rem;
  letter-spacing: 0.2em; text-transform: uppercase;
  color: rgba(255,255,255,0.2);
}

/* Cartes */
.card {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 46px;
  background: #f5f0e8;
  border-radius: 4px;
  border: 1px solid rgba(0,0,0,0.15);
  font-size: 0.72rem; font-weight: 700;
  box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  flex-shrink: 0;
}
.card--red { color: #c0222a; }
.card--black { color: #111; }
.card--back {
  background: #1a2a5a;
  border-color: #2a3a7a;
  background-image: repeating-linear-gradient(
    45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 2px, transparent 2px, transparent 8px
  );
  width: 34px; height: 46px;
}
.card--community { width: 38px; height: 52px; font-size: 0.78rem; }
.card--placeholder {
  width: 38px; height: 52px;
  background: rgba(0,0,0,0.15);
  border-radius: 4px;
  border: 1px dashed rgba(255,255,255,0.08);
}
.card--large { width: 52px; height: 72px; font-size: 1rem; }

/* Sièges */
.seat {
  position: absolute;
  display: flex; flex-direction: column; align-items: center;
  gap: 3px;
  z-index: 5;
}

.seat-badges {
  display: flex; gap: 3px; margin-bottom: 1px; min-height: 14px;
}
.badge {
  font-family: 'Cinzel', serif; font-size: 0.52rem; font-weight: 700;
  letter-spacing: 0.05em; padding: 1px 5px; border-radius: 3px;
}
.badge--dealer { background: #c9a84c; color: #1a1200; }
.badge--sb { background: rgba(80,150,255,0.8); color: #fff; }
.badge--bb { background: rgba(200,80,80,0.8); color: #fff; }

.seat-avatar {
  width: 32px; height: 32px;
  background: rgba(255,255,255,0.08);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Cinzel', serif; font-size: 0.75rem;
  border: 2px solid rgba(255,255,255,0.12);
  transition: border-color 0.2s;
}
.seat--active .seat-avatar {
  border-color: #c9a84c;
  box-shadow: 0 0 10px rgba(201,168,76,0.5);
}
.seat--folded .seat-avatar {
  opacity: 0.35;
  border-color: rgba(255,255,255,0.05);
}
.seat--me .seat-avatar {
  background: rgba(139,26,26,0.25);
  border-color: rgba(139,26,26,0.6);
}

.seat-nom {
  font-family: 'Cinzel', serif; font-size: 0.6rem;
  letter-spacing: 0.06em; color: rgba(255,255,255,0.7);
  max-width: 80px; text-align: center;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.seat-chips { font-size: 0.62rem; color: rgba(255,255,255,0.35); }
.seat-bet {
  font-size: 0.65rem; color: #c9a84c;
  background: rgba(201,168,76,0.1);
  border-radius: 3px; padding: 1px 6px;
}
.seat-cards { display: flex; gap: 3px; margin-top: 2px; }
.seat--folded .seat-cards { opacity: 0.3; }

.action-timer {
  font-family: 'Cinzel', serif; font-size: 0.65rem;
  color: #c9a84c; background: rgba(0,0,0,0.6);
  border-radius: 8px; padding: 1px 6px;
}

/* Action zone */
.action-zone {
  margin-top: 16px;
  background: rgba(16,16,18,0.97);
  border: 1px solid rgba(201,168,76,0.25);
  border-radius: 8px;
  padding: 16px 20px;
  display: flex; flex-direction: column; gap: 12px;
}
.action-info {
  font-family: 'Cinzel', serif; font-size: 0.68rem;
  letter-spacing: 0.12em; color: rgba(255,255,255,0.35);
  text-transform: uppercase;
}
.action-buttons {
  display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
}
.btn-action {
  font-family: 'Cinzel', serif; font-size: 0.7rem;
  letter-spacing: 0.1em; text-transform: uppercase;
  border: none; border-radius: 4px; padding: 10px 18px;
  cursor: pointer; transition: background 0.15s;
}
.btn-fold { background: rgba(139,26,26,0.7); color: #ffaaaa; }
.btn-fold:hover { background: rgba(139,26,26,1); }
.btn-check { background: rgba(50,120,50,0.7); color: #aaffaa; }
.btn-check:hover { background: rgba(50,120,50,1); }
.btn-call { background: rgba(40,100,180,0.8); color: #aaccff; }
.btn-call:hover { background: rgba(40,100,180,1); }
.btn-raise { background: rgba(180,140,20,0.8); color: #fff5cc; }
.btn-raise:hover { background: rgba(180,140,20,1); }

.raise-wrap { display: flex; align-items: center; gap: 8px; }
.raise-input-wrap {
  display: flex; align-items: center; gap: 6px;
  background: rgba(255,255,255,0.05); border-radius: 4px; padding: 4px 8px;
}
.raise-adj {
  background: none; border: none; color: rgba(255,255,255,0.4);
  font-size: 1rem; cursor: pointer; padding: 0 4px; line-height: 1;
}
.raise-adj:hover { color: #fff; }
.raise-val { font-size: 0.8rem; color: #c9a84c; min-width: 80px; text-align: center; }

.my-cards {
  display: flex; gap: 8px; justify-content: center;
  padding-top: 4px;
}
.my-cards-passive {
  display: flex; gap: 8px; justify-content: center;
  margin: 12px 0;
}

/* Spectate */
.spectate-info {
  text-align: center;
  padding: 24px;
  color: rgba(255,255,255,0.3);
  font-size: 0.88rem;
}

/* Log */
.action-log {
  margin-top: 16px;
  background: rgba(0,0,0,0.3);
  border-radius: 6px; padding: 10px 14px;
  display: flex; flex-direction: column; gap: 4px;
}
.log-entry {
  font-size: 0.75rem; color: rgba(255,255,255,0.3);
  font-family: 'Cinzel', serif; letter-spacing: 0.05em;
}

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

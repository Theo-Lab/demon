<template>
  <div class="page" @click="resumeAudio">
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
      <Transition name="slide-down">
        <div v-if="countdown != null" class="countdown-banner">
          <span class="countdown-num">{{ countdown }}</span>
          <span class="countdown-txt">La main commence dans…</span>
        </div>
      </Transition>

      <!-- Table ovale -->
      <div v-if="state" class="arena">
        <div class="oval-table">

          <!-- Pot central -->
          <Transition name="pot-pop">
            <div
              v-if="state.pot > 0"
              class="pot-display"
              :class="{ 'pot-display--pulse': potPulse }"
              :key="potPulse ? 'p' : 'n'"
            >
              <div class="pot-chips-row">
                <div v-for="i in potChipCount" :key="i" class="chip-dot" :style="chipDotStyle(i)"></div>
              </div>
              <span class="pot-label">POT</span>
              <span class="pot-value">{{ state.pot.toLocaleString() }} ¥</span>
            </div>
          </Transition>

          <!-- Cartes communes -->
          <div class="community-cards">
            <span v-if="state.status === 'waiting'" class="phase-waiting-lbl">En attente de joueurs</span>
            <template v-else>
              <span
                v-for="(c, i) in state.communityCards"
                :key="`comm-${i}`"
                class="card card--community"
                :class="[
                  c.red ? 'card--red' : 'card--black',
                  animCommCards.has(i) ? 'card--flip-in' : '',
                ]"
                :style="animCommCards.has(i) ? { animationDelay: `${(i % 3) * 100}ms` } : {}"
              >{{ c.nom }}</span>
              <span
                v-for="i in (5 - state.communityCards.length)"
                :key="`ph-${i}`"
                class="card card--placeholder"
              ></span>
            </template>
          </div>

          <!-- Phase badge -->
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
              'seat--winner': winnerIds.has(seat.userId),
            }"
          >
            <!-- Badges dealer / SB / BB -->
            <div class="seat-badges">
              <span v-if="seat.isDealer" class="badge badge--dealer">D</span>
              <span v-else-if="seat.isSB" class="badge badge--sb">SB</span>
              <span v-else-if="seat.isBB" class="badge badge--bb">BB</span>
            </div>

            <!-- Avatar -->
            <div class="seat-avatar">{{ seat.nom[0]?.toUpperCase() }}</div>
            <div class="seat-nom">{{ seat.nom }}</div>
            <div class="seat-chips">{{ seat.chips.toLocaleString() }} ¥</div>

            <!-- Mise -->
            <Transition name="bet-pop">
              <div v-if="seat.bet > 0" class="seat-bet">
                <span class="seat-bet-chip"></span>
                {{ seat.bet.toLocaleString() }} ¥
              </div>
            </Transition>

            <!-- Cartes -->
            <div class="seat-cards" v-if="seat.cards?.length">
              <span
                v-for="(c, ci) in seat.cards"
                :key="ci"
                class="card"
                :class="[
                  c ? (c.red ? 'card--red' : 'card--black') : 'card--back',
                  justDealt ? 'card--deal-in' : '',
                ]"
                :style="justDealt ? { animationDelay: `${si * 80 + ci * 160}ms` } : {}"
              >{{ c ? c.nom : '' }}</span>
            </div>

            <!-- Timer barre -->
            <div
              v-if="seat.userId === state.activeUserId && actionCountdown != null"
              class="timer-bar-wrap"
            >
              <div class="timer-bar" :style="{ width: (actionCountdown / 30 * 100) + '%' }"></div>
              <span class="timer-num">{{ actionCountdown }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Résultat de main -->
      <Transition name="result-pop">
        <div v-if="handResult" class="result-banner">
          <div class="result-winners-row">
            <div v-for="w in handResult.winners" :key="w.userId" class="result-winner">
              <span class="result-crown">♛</span>
              <span class="result-nom">{{ w.nom }}</span>
              <span class="result-pot">remporte {{ handResult.pot.toLocaleString() }} ¥</span>
            </div>
          </div>
          <div v-if="handResult.players.some(p => p.handName)" class="result-hands-row">
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
        </div>
      </Transition>

      <!-- Zone d'action (mon tour) -->
      <Transition name="action-slide">
        <div v-if="isMyTurn" class="action-zone">
          <div class="action-info">
            <span class="action-info-turn">Votre tour</span>
            <span v-if="state.currentBet > 0 && myPlayer.bet < state.currentBet" class="action-info-call">
              À suivre : {{ (state.currentBet - myPlayer.bet).toLocaleString() }} ¥
            </span>
          </div>
          <div class="action-buttons">
            <button class="btn-action btn-fold" @click="doAction('fold')">
              <span class="btn-icon">✕</span> Se coucher
            </button>
            <button
              v-if="myPlayer.bet >= state.currentBet"
              class="btn-action btn-check"
              @click="doAction('check')"
            ><span class="btn-icon">✓</span> Checker</button>
            <button
              v-if="myPlayer.bet < state.currentBet"
              class="btn-action btn-call"
              @click="doAction('call')"
            ><span class="btn-icon">→</span> Suivre {{ (state.currentBet - myPlayer.bet).toLocaleString() }} ¥</button>
            <div class="raise-wrap">
              <button class="btn-action btn-raise" @click="doAction('raise', raiseAmount)">
                <span class="btn-icon">↑</span> Relancer
              </button>
              <div class="raise-input-wrap">
                <button class="raise-adj" @click="adjRaise(-1)">−</button>
                <span class="raise-val">{{ raiseAmount.toLocaleString() }} ¥</span>
                <button class="raise-adj" @click="adjRaise(1)">+</button>
              </div>
            </div>
          </div>
          <!-- Mes cartes dans la zone d'action -->
          <div class="my-cards" v-if="myPlayer?.cards?.length">
            <span
              v-for="(c, ci) in myPlayer.cards"
              :key="ci"
              class="card card--large"
              :class="c ? (c.red ? 'card--red' : 'card--black') : 'card--back'"
            >{{ c ? c.nom : '' }}</span>
          </div>
        </div>
      </Transition>

      <!-- Mes cartes quand ce n'est pas mon tour -->
      <div
        v-if="!isMyTurn && myPlayer?.cards?.length && ['preflop','flop','turn','river'].includes(state?.status)"
        class="my-cards-passive"
      >
        <span
          v-for="(c, ci) in myPlayer.cards"
          :key="ci"
          class="card card--large"
          :class="[
            c ? (c.red ? 'card--red' : 'card--black') : 'card--back',
            justDealt ? 'card--deal-in' : '',
          ]"
          :style="justDealt ? { animationDelay: `${ci * 160}ms` } : {}"
        >{{ c ? c.nom : '' }}</span>
      </div>

      <!-- Spectateur -->
      <div v-else-if="state && !myPlayer" class="spectate-info">
        <p>Vous observez la partie.</p>
        <RouterLink to="/poker" class="back-link-center">← Rejoindre une table</RouterLink>
      </div>

      <!-- Log d'actions -->
      <div class="action-log" v-if="log.length">
        <TransitionGroup name="log-slide" tag="div">
          <div v-for="(entry, i) in log.slice(-6)" :key="entry + i" class="log-entry">{{ entry }}</div>
        </TransitionGroup>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppNavbar from './AppNavbar.vue'
import { io } from 'socket.io-client'
import { currentUser } from '../auth.js'
import {
  resumeAudio, playDeal, playFlip, playChip, playChipStack,
  playFold, playYourTurn, playWin, playLose,
} from '../poker-audio.js'

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

// Animation state
const justDealt = ref(false)
const potPulse = ref(false)
const winnerIds = ref(new Set())
const animCommCards = ref(new Set())   // indices de cartes communes en cours d'animation

let socket = null
let actionTimerInterval = null

const myUserId = computed(() => currentUser.value?.id)
const myPlayer = computed(() => state.value?.players.find(p => p.userId === myUserId.value))
const isMyTurn = computed(() =>
  state.value?.activeUserId === myUserId.value &&
  ['preflop','flop','turn','river'].includes(state.value?.status)
)

const orderedSeats = computed(() => {
  if (!state.value) return []
  const players = state.value.players
  const myIdx = players.findIndex(p => p.userId === myUserId.value)
  if (myIdx === -1) return players
  return [...players.slice(myIdx), ...players.slice(0, myIdx)]
})

const phaseLabel = computed(() => ({
  preflop: 'Pré-flop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Showdown',
})[state.value?.status] ?? '')

// Nombre de jetons visuels dans le pot (1–5)
const potChipCount = computed(() => {
  if (!state.value || state.value.pot <= 0) return 0
  const bb = state.value.bigBlind
  return Math.min(5, Math.ceil(state.value.pot / (bb * 5)))
})

const CHIP_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12']
function chipDotStyle(i) {
  return { background: CHIP_COLORS[(i - 1) % CHIP_COLORS.length] }
}

// Position des sièges (ovale, sens horaire depuis bas)
function seatStyle(i, n) {
  const angle = Math.PI / 2 - (2 * Math.PI / n) * i
  return {
    left: `${50 + 43 * Math.cos(angle)}%`,
    top: `${50 + 38 * Math.sin(angle)}%`,
    transform: 'translate(-50%, -50%)',
  }
}

function adjRaise(dir) {
  if (!state.value) return
  raiseAmount.value = Math.max(state.value.bigBlind, raiseAmount.value + dir * state.value.bigBlind)
}

// Countdown d'action (timer barre)
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

// Pot pulse quand il augmente
let prevPot = 0
function triggerPotPulse() {
  potPulse.value = true
  setTimeout(() => { potPulse.value = false }, 500)
}

// Anim cartes communes
function animateNewCommunityCards(fromIdx, toIdx) {
  const newSet = new Set(animCommCards.value)
  for (let i = fromIdx; i < toIdx; i++) {
    newSet.add(i)
    playFlip((i - fromIdx) * 110)
  }
  animCommCards.value = newSet
  setTimeout(() => {
    const cleaned = new Set(animCommCards.value)
    for (let i = fromIdx; i < toIdx; i++) cleaned.delete(i)
    animCommCards.value = cleaned
  }, 700)
}

function doAction(act, amount) {
  if (!socket) return
  // Sons avant envoi
  if (act === 'fold') playFold()
  else if (act === 'call') playChip()
  else if (act === 'raise') playChipStack(3)
  socket.emit('poker_action', { tableId, action: act, amount })
}

function partir() {
  if (!socket) return
  socket.emit('poker_leave', { tableId })
}

function addLog(msg) {
  log.value.push(msg)
  if (log.value.length > 20) log.value.shift()
}

let prevCommLen = 0
let prevActiveUserId = null

onMounted(() => {
  socket = io(SOCKET_URL, { withCredentials: true })

  socket.on('connect', () => {
    socket.emit('poker_join', tableId)
  })

  socket.on('poker_table_update', (s) => {
    const prevState = state.value

    // Détecter nouvelles cartes communes
    const oldLen = prevState?.communityCards?.length ?? 0
    const newLen = s.communityCards?.length ?? 0
    if (newLen > oldLen) animateNewCommunityCards(oldLen, newLen)

    // Détecter changement de joueur actif
    const newActive = s.activeUserId
    if (newActive && newActive !== prevActiveUserId) {
      startActionCountdown()
      if (newActive === myUserId.value) playYourTurn()
    }
    prevActiveUserId = newActive

    // Détecter hausse du pot
    const newPot = s.pot ?? 0
    if (newPot > prevPot && prevPot >= 0) {
      triggerPotPulse()
      if (newPot > prevPot && prevPot > 0) playChip()
    }
    prevPot = newPot

    if (!['preflop','flop','turn','river'].includes(s.status)) clearActionCountdown()

    if (s.status !== 'waiting') raiseAmount.value = s.bigBlind
    handResult.value = s.handResult ?? null

    state.value = s
  })

  socket.on('poker_countdown', ({ sLeft }) => {
    countdown.value = sLeft
    if (sLeft <= 0) setTimeout(() => { countdown.value = null }, 600)
  })

  socket.on('poker_countdown_cancel', () => { countdown.value = null })

  socket.on('poker_hand_start', () => {
    countdown.value = null
    handResult.value = null
    winnerIds.value = new Set()
    prevPot = 0
    prevCommLen = 0
    prevActiveUserId = null
    addLog('─── Nouvelle main ───')

    // Animation distribution des cartes
    justDealt.value = true
    const n = state.value?.players.length ?? 2
    for (let i = 0; i < n * 2; i++) playDeal(i * 80)
    setTimeout(() => { justDealt.value = false }, 1200)
  })

  socket.on('poker_hand_result', (result) => {
    handResult.value = result
    clearActionCountdown()
    // Mettre en évidence les gagnants
    winnerIds.value = new Set(result.winners.map(w => w.userId))
    const iWon = result.winners.some(w => w.userId === myUserId.value)
    if (iWon) playWin(); else playLose()
    for (const w of result.winners) addLog(`♛ ${w.nom} remporte ${result.pot.toLocaleString()} ¥`)
    for (const p of result.players) if (p.handName) addLog(`  ${p.nom} : ${p.handName}`)
  })

  socket.on('poker_reset', () => {
    handResult.value = null
    winnerIds.value = new Set()
    prevPot = 0
  })

  socket.on('poker_left', () => {
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

// Log quand le joueur actif change
watch(() => state.value?.activeUserId, (newId, oldId) => {
  if (!newId || newId === oldId) return
  const p = state.value?.players.find(p => p.userId === newId)
  if (p) addLog(`→ ${p.nom}`)
})
</script>

<style scoped>
.page { min-height: 100vh; background: #090909; color: #fff; }
.page-inner { max-width: 900px; margin: 0 auto; padding: 24px 16px 80px; }

/* ── Top bar ── */
.top-bar {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
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

/* ── Countdown ── */
.countdown-banner {
  display: flex; align-items: center; gap: 14px; justify-content: center;
  padding: 10px 20px; background: rgba(201,168,76,0.07);
  border: 1px solid rgba(201,168,76,0.2); border-radius: 6px;
  margin-bottom: 12px;
}
.countdown-num { font-family: 'Cinzel', serif; font-size: 1.6rem; color: #c9a84c; line-height: 1; }
.countdown-txt { font-size: 0.78rem; color: rgba(255,255,255,0.35); }

/* ── Arena ── */
.arena { display: flex; justify-content: center; margin: 4px 0; }

.oval-table {
  position: relative;
  width: min(700px, 96vw);
  aspect-ratio: 700 / 390;
  background: radial-gradient(ellipse at 50% 55%, #1e7040 0%, #0f4526 50%, #072d18 100%);
  border-radius: 50%;
  border: 7px solid #8b6914;
  box-shadow:
    0 0 0 3px #5a4510,
    0 0 60px rgba(0,0,0,0.85),
    inset 0 0 80px rgba(0,0,0,0.35);
}

/* ── Pot ── */
.pot-display {
  position: absolute;
  top: 28%; left: 50%;
  transform: translate(-50%, -50%);
  text-align: center; z-index: 3;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}

.pot-chips-row {
  display: flex; gap: 4px; justify-content: center; margin-bottom: 2px;
}
.chip-dot {
  width: 12px; height: 12px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.25);
  box-shadow: 0 1px 4px rgba(0,0,0,0.5);
}

.pot-label {
  font-family: 'Cinzel', serif; font-size: 0.5rem;
  letter-spacing: 0.25em; color: rgba(255,255,255,0.3);
  text-transform: uppercase;
}
.pot-value {
  font-family: 'Cinzel', serif; font-size: 1.1rem;
  color: #c9a84c; letter-spacing: 0.06em;
  text-shadow: 0 0 12px rgba(201,168,76,0.5);
}

@keyframes potPulse {
  0% { transform: scale(1); }
  40% { transform: scale(1.18); }
  70% { transform: scale(0.96); }
  100% { transform: scale(1); }
}
.pot-display--pulse { animation: potPulse 0.4s ease-out; }

/* ── Cartes communes ── */
.community-cards {
  position: absolute;
  top: 56%; left: 50%;
  transform: translate(-50%, -50%);
  display: flex; gap: 6px; align-items: center; z-index: 2;
}
.phase-waiting-lbl {
  font-family: 'Cinzel', serif; font-size: 0.6rem;
  letter-spacing: 0.22em; color: rgba(255,255,255,0.18);
  text-transform: uppercase;
}

/* ── Phase badge ── */
.phase-badge {
  position: absolute; bottom: 10%; left: 50%;
  transform: translateX(-50%);
  font-family: 'Cinzel', serif; font-size: 0.52rem;
  letter-spacing: 0.22em; text-transform: uppercase;
  color: rgba(255,255,255,0.18);
}

/* ── Cartes ── */
.card {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 48px;
  background: #f5f0e8;
  border-radius: 4px; border: 1px solid rgba(0,0,0,0.12);
  font-size: 0.72rem; font-weight: 700;
  box-shadow: 0 2px 6px rgba(0,0,0,0.45);
  flex-shrink: 0;
  user-select: none;
}
.card--red  { color: #c0222a; }
.card--black { color: #111; }
.card--back {
  background: linear-gradient(135deg, #1c2d6a 0%, #142056 100%);
  border-color: #2a3a8a;
  background-image: repeating-linear-gradient(
    45deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 2px,
    transparent 2px, transparent 8px
  );
}
.card--community { width: 40px; height: 56px; font-size: 0.82rem; }
.card--placeholder {
  width: 40px; height: 56px;
  background: rgba(0,0,0,0.12);
  border-radius: 4px; border: 1px dashed rgba(255,255,255,0.07);
}
.card--large { width: 56px; height: 78px; font-size: 1.05rem; }

@keyframes cardDealIn {
  0%   { transform: translateY(-24px) scale(0.75) rotateY(80deg); opacity: 0; }
  60%  { transform: translateY(2px)   scale(1.04) rotateY(0deg);  opacity: 1; }
  100% { transform: translateY(0)     scale(1)    rotateY(0deg);  opacity: 1; }
}
.card--deal-in { animation: cardDealIn 0.38s ease-out both; }

@keyframes cardFlipIn {
  0%   { transform: scaleX(0); opacity: 0.4; }
  50%  { transform: scaleX(1.05); opacity: 1; }
  100% { transform: scaleX(1); opacity: 1; }
}
.card--flip-in { animation: cardFlipIn 0.32s ease-out both; }

/* ── Sièges ── */
.seat {
  position: absolute;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  z-index: 5;
}

.seat-badges { display: flex; gap: 3px; min-height: 16px; margin-bottom: 1px; }
.badge {
  font-family: 'Cinzel', serif; font-size: 0.5rem; font-weight: 700;
  letter-spacing: 0.05em; padding: 1px 5px; border-radius: 3px;
}
.badge--dealer { background: #c9a84c; color: #1a1200; }
.badge--sb     { background: rgba(80,150,255,0.85); color: #fff; }
.badge--bb     { background: rgba(200,80,80,0.85); color: #fff; }

.seat-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: rgba(255,255,255,0.07);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Cinzel', serif; font-size: 0.78rem;
  border: 2px solid rgba(255,255,255,0.1);
  transition: border-color 0.2s, box-shadow 0.2s;
}

@keyframes activePulse {
  0%, 100% { box-shadow: 0 0 8px rgba(201,168,76,0.5); }
  50%       { box-shadow: 0 0 18px rgba(201,168,76,0.9); }
}
.seat--active .seat-avatar {
  border-color: #c9a84c;
  animation: activePulse 1.2s ease-in-out infinite;
}
.seat--folded { opacity: 0.45; }
.seat--folded .seat-avatar { border-color: rgba(255,255,255,0.05); filter: grayscale(0.6); }
.seat--me .seat-avatar { background: rgba(139,26,26,0.3); border-color: rgba(139,26,26,0.7); }

@keyframes winnerGlow {
  0%, 100% { box-shadow: 0 0 10px rgba(201,168,76,0.6); border-color: #c9a84c; }
  50%       { box-shadow: 0 0 28px rgba(201,168,76,1), 0 0 50px rgba(201,168,76,0.4); border-color: #f0d070; }
}
.seat--winner .seat-avatar {
  border-color: #c9a84c;
  animation: winnerGlow 0.8s ease-in-out infinite;
}

.seat-nom {
  font-family: 'Cinzel', serif; font-size: 0.58rem; letter-spacing: 0.06em;
  color: rgba(255,255,255,0.7); max-width: 78px; text-align: center;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.seat-chips { font-size: 0.6rem; color: rgba(255,255,255,0.32); }

.seat-bet {
  display: flex; align-items: center; gap: 4px;
  font-size: 0.64rem; color: #c9a84c;
  background: rgba(0,0,0,0.55); border-radius: 3px; padding: 1px 6px;
}
.seat-bet-chip {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  background: #c9a84c; border: 1px solid rgba(255,255,255,0.3);
}

.seat-cards { display: flex; gap: 3px; margin-top: 2px; }

/* Timer barre */
.timer-bar-wrap {
  width: 44px; height: 4px;
  background: rgba(255,255,255,0.1); border-radius: 2px;
  position: relative; margin-top: 3px;
  display: flex; align-items: center;
}
.timer-bar {
  height: 100%; border-radius: 2px;
  background: linear-gradient(90deg, #e05555, #c9a84c);
  transition: width 1s linear;
}
.timer-num {
  position: absolute; right: -18px;
  font-size: 0.55rem; color: rgba(255,255,255,0.4);
  font-family: 'Cinzel', serif;
}

/* ── Résultat ── */
.result-banner {
  background: rgba(14,14,16,0.98);
  border: 1px solid rgba(201,168,76,0.35);
  border-radius: 8px; padding: 18px 22px;
  margin: 10px 0;
  display: flex; flex-direction: column; gap: 12px;
  box-shadow: 0 0 40px rgba(201,168,76,0.08);
}
.result-winners-row { display: flex; gap: 20px; flex-wrap: wrap; }
.result-winner { display: flex; align-items: center; gap: 8px; font-family: 'Cinzel', serif; }
.result-crown { color: #c9a84c; font-size: 1rem; }
.result-nom { font-size: 0.9rem; color: #fff; letter-spacing: 0.06em; }
.result-pot { font-size: 0.82rem; color: #c9a84c; }
.result-hands-row { display: flex; flex-direction: column; gap: 8px; }
.result-hand {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05);
}
.result-player-nom {
  font-family: 'Cinzel', serif; font-size: 0.7rem; color: rgba(255,255,255,0.45);
  min-width: 80px;
}
.result-cards { display: flex; gap: 4px; }
.result-hand-name { font-size: 0.75rem; color: rgba(201,168,76,0.6); margin-left: 2px; }

/* ── Zone d'action ── */
.action-zone {
  margin-top: 12px;
  background: rgba(14,14,16,0.98);
  border: 1px solid rgba(201,168,76,0.3);
  border-radius: 8px; padding: 16px 20px;
  display: flex; flex-direction: column; gap: 12px;
  box-shadow: 0 0 30px rgba(201,168,76,0.06);
}
.action-info { display: flex; align-items: center; gap: 12px; }
.action-info-turn {
  font-family: 'Cinzel', serif; font-size: 0.62rem;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: #c9a84c;
}
.action-info-call { font-size: 0.8rem; color: rgba(255,255,255,0.4); }

.action-buttons { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.btn-action {
  font-family: 'Cinzel', serif; font-size: 0.68rem; letter-spacing: 0.08em;
  text-transform: uppercase; border: none; border-radius: 5px;
  padding: 10px 16px; cursor: pointer; transition: all 0.15s;
  display: flex; align-items: center; gap: 6px;
}
.btn-icon { font-size: 0.8rem; opacity: 0.7; }
.btn-fold  { background: rgba(139,26,26,0.75); color: #ffbbbb; }
.btn-fold:hover  { background: rgba(180,30,30,1); transform: translateY(-1px); }
.btn-check { background: rgba(40,110,50,0.75); color: #aaffbb; }
.btn-check:hover { background: rgba(50,140,60,1); transform: translateY(-1px); }
.btn-call  { background: rgba(30,90,170,0.8);  color: #aaccff; }
.btn-call:hover  { background: rgba(40,110,200,1); transform: translateY(-1px); }
.btn-raise { background: rgba(160,120,15,0.85); color: #fff5cc; }
.btn-raise:hover { background: rgba(190,145,20,1); transform: translateY(-1px); }

.raise-wrap { display: flex; align-items: center; gap: 8px; }
.raise-input-wrap {
  display: flex; align-items: center; gap: 6px;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 4px; padding: 5px 8px;
}
.raise-adj {
  background: none; border: none; color: rgba(255,255,255,0.4);
  font-size: 1rem; cursor: pointer; padding: 0 2px; line-height: 1;
  transition: color 0.12s;
}
.raise-adj:hover { color: #c9a84c; }
.raise-val { font-size: 0.78rem; color: #c9a84c; min-width: 88px; text-align: center; }

.my-cards { display: flex; gap: 10px; justify-content: center; padding-top: 4px; }
.my-cards-passive { display: flex; gap: 10px; justify-content: center; margin: 12px 0; }

/* ── Spectateur ── */
.spectate-info { text-align: center; padding: 24px; color: rgba(255,255,255,0.3); font-size: 0.88rem; }
.back-link-center {
  display: block; margin-top: 10px;
  font-family: 'Cinzel', serif; font-size: 0.68rem;
  letter-spacing: 0.1em; color: rgba(255,255,255,0.3); text-decoration: none;
}

/* ── Log ── */
.action-log {
  margin-top: 12px; background: rgba(0,0,0,0.25);
  border-radius: 6px; padding: 10px 14px;
  display: flex; flex-direction: column; gap: 3px;
  max-height: 130px; overflow: hidden;
}
.log-entry {
  font-size: 0.72rem; color: rgba(255,255,255,0.28);
  font-family: 'Cinzel', serif; letter-spacing: 0.04em;
}
.log-entry:last-child { color: rgba(255,255,255,0.5); }

/* ── Transitions ── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-down-enter-active { transition: all 0.3s ease-out; }
.slide-down-leave-active { transition: all 0.25s ease-in; }
.slide-down-enter-from { opacity: 0; transform: translateY(-12px); }
.slide-down-leave-to   { opacity: 0; transform: translateY(-8px); }

.action-slide-enter-active { transition: all 0.28s cubic-bezier(0.22,1,0.36,1); }
.action-slide-leave-active { transition: all 0.2s ease-in; }
.action-slide-enter-from { opacity: 0; transform: translateY(16px); }
.action-slide-leave-to   { opacity: 0; transform: translateY(8px); }

.result-pop-enter-active { transition: all 0.35s cubic-bezier(0.22,1,0.36,1); }
.result-pop-leave-active { transition: opacity 0.25s; }
.result-pop-enter-from { opacity: 0; transform: scale(0.96) translateY(-8px); }
.result-pop-leave-to   { opacity: 0; }

.pot-pop-enter-active { transition: all 0.25s cubic-bezier(0.22,1,0.36,1); }
.pot-pop-enter-from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }

.bet-pop-enter-active { transition: all 0.2s cubic-bezier(0.22,1,0.36,1); }
.bet-pop-leave-active { transition: all 0.15s ease-in; }
.bet-pop-enter-from { opacity: 0; transform: scale(0.7) translateY(-4px); }
.bet-pop-leave-to   { opacity: 0; transform: scale(0.8); }

.log-slide-enter-active { transition: all 0.2s ease-out; }
.log-slide-enter-from   { opacity: 0; transform: translateX(-8px); }
</style>

<template>
  <div class="page" @click="resumeAudio">
    <AppNavbar />

    <!-- Top bar -->
    <div class="top-bar">
      <RouterLink to="/poker" class="back-link">← Lobby</RouterLink>
      <div v-if="state" class="top-center">
        <span class="table-name">{{ state.name }}</span>
        <span class="table-blinds">{{ state.smallBlind.toLocaleString() }} / {{ state.bigBlind.toLocaleString() }} ¥</span>
      </div>
      <div class="top-right">
        <span class="my-stack" v-if="myPlayer">{{ myPlayer.chips.toLocaleString() }} ¥</span>
        <button v-if="state?.status === 'waiting' && myPlayer" class="btn-leave" @click="partir">Quitter</button>
      </div>
    </div>

    <!-- Countdown toast -->
    <Transition name="toast">
      <div v-if="countdown != null" class="countdown-toast">
        <span class="toast-num">{{ countdown }}</span>
        <span class="toast-txt">La main commence dans…</span>
      </div>
    </Transition>

    <!-- Erreur flash -->
    <Transition name="toast">
      <div v-if="flashError" class="error-toast">{{ flashError }}</div>
    </Transition>

    <!-- Arena -->
    <div class="arena" v-if="state">
      <div class="oval-table">

        <!-- Overlay résultat sur la table -->
        <Transition name="overlay-pop">
          <div v-if="handResult" class="result-overlay">
            <div v-for="w in handResult.winners" :key="w.userId" class="result-winner-row">
              <span class="result-crown">♛</span>
              <span class="result-name">{{ w.nom }}</span>
              <span class="result-amount">{{ handResult.pot.toLocaleString() }} ¥</span>
            </div>
            <div v-if="handResult.players.some(p => p.handName)" class="result-hands">
              <div v-for="p in handResult.players.filter(x => x.handName)" :key="p.userId" class="result-hand-row">
                <span class="result-hand-name-lbl">{{ p.nom }}</span>
                <div class="result-hand-cards">
                  <span v-for="(c,i) in p.cards" :key="i" class="card card--sm" :class="c?.red ? 'card--red':'card--black'">{{ c?.nom ?? '?' }}</span>
                </div>
                <span class="result-hand-type">{{ p.handName }}</span>
              </div>
            </div>
          </div>
        </Transition>

        <!-- Centre de table : pot + cartes communes -->
        <div class="table-center">

          <!-- Pot -->
          <div v-if="state.pot > 0" class="pot-zone" :class="{ 'pot-zone--pulse': potPulse }">
            <div class="pot-chips">
              <span v-for="i in potChipCount" :key="i" class="pot-chip" :style="{ background: CHIP_COLORS[(i-1)%5] }"></span>
            </div>
            <span class="pot-lbl">POT</span>
            <span class="pot-val">{{ state.pot.toLocaleString() }} ¥</span>
          </div>

          <!-- Cartes communes -->
          <div class="community-tray">
            <template v-if="['preflop','flop','turn','river','showdown'].includes(state.status)">
              <span
                v-for="(c,i) in state.communityCards" :key="`c${i}`"
                class="card card--comm"
                :class="[c.red ? 'card--red':'card--black', animCommCards.has(i) ? 'card--flip-in':'']"
                :style="animCommCards.has(i) ? { animationDelay: `${(i%3)*100}ms` } : {}"
              >{{ c.nom }}</span>
              <span v-for="i in (5 - state.communityCards.length)" :key="`ph${i}`" class="card card--ph"></span>
            </template>
            <span v-else class="waiting-lbl">En attente de joueurs…</span>
          </div>

          <!-- Phase -->
          <span v-if="phaseLabel" class="phase-lbl" :key="phaseLabel">{{ phaseLabel }}</span>
        </div>

        <!-- Sièges -->
        <div
          v-for="(seat, si) in orderedSeats"
          :key="seat.userId"
          class="seat"
          :style="seatStyle(si, orderedSeats.length)"
          :class="{
            'seat--active': seat.userId === state.activeUserId,
            'seat--folded': seat.status === 'folded',
            'seat--me':     seat.userId === myUserId,
            'seat--winner': winnerIds.has(seat.userId),
          }"
        >
          <!-- Badges -->
          <div class="seat-badges">
            <span v-if="seat.isDealer" class="badge badge--d">D</span>
            <span v-else-if="seat.isSB"   class="badge badge--sb">SB</span>
            <span v-else-if="seat.isBB"   class="badge badge--bb">BB</span>
          </div>

          <!-- Avatar + timer circulaire -->
          <div class="avatar-wrap">
            <svg v-if="seat.userId === state.activeUserId && actionCountdown != null"
              class="timer-svg" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2.5"/>
              <circle cx="22" cy="22" r="18" fill="none"
                :stroke="actionCountdown <= 8 ? '#e05555' : '#c9a84c'"
                stroke-width="2.5" stroke-linecap="round"
                :stroke-dasharray="CIRC"
                :stroke-dashoffset="CIRC - (actionCountdown / 30) * CIRC"
                style="transform:rotate(-90deg);transform-origin:50% 50%;transition:stroke-dashoffset 1s linear,stroke 0.3s"
              />
            </svg>
            <div class="seat-avatar">{{ seat.nom[0]?.toUpperCase() }}</div>
          </div>

          <div class="seat-nom">{{ seat.nom }}</div>
          <div class="seat-stack">{{ seat.chips.toLocaleString() }} ¥</div>

          <!-- Cartes dans le siège -->
          <div v-if="seat.cards?.length" class="seat-cards">
            <span
              v-for="(c,ci) in seat.cards" :key="ci"
              class="card card--seat"
              :class="[
                c ? (c.red ? 'card--red':'card--black') : 'card--back',
                justDealt ? 'card--deal-in' : '',
              ]"
              :style="justDealt ? { animationDelay: `${si*80+ci*160}ms` } : {}"
            >{{ c ? c.nom : '' }}</span>
          </div>

          <!-- Mise (chip flottant vers le centre) -->
          <Transition name="bet-pop">
            <div v-if="seat.bet > 0" class="seat-bet">
              <span class="bet-chip"></span>{{ seat.bet.toLocaleString() }} ¥
            </div>
          </Transition>
        </div>

      </div>
    </div>

    <!-- Panneau joueur fixé en bas (ne bouge jamais) -->
    <div
      v-if="myPlayer?.cards?.length && ['preflop','flop','turn','river','showdown'].includes(state?.status)"
      class="player-panel"
    >
      <!-- Boutons d'action (glissement interne, layout stable) -->
      <Transition name="btns-slide">
        <div v-if="isMyTurn" class="action-btns-wrap">
          <div class="action-btns">
            <button class="btn btn--fold"  @click="doAction('fold')">Se coucher</button>
            <button v-if="myPlayer.bet >= state.currentBet"
              class="btn btn--check" @click="doAction('check')">Checker</button>
            <button v-else
              class="btn btn--call" @click="doAction('call')">
              Suivre&nbsp;<strong>{{ (state.currentBet - myPlayer.bet).toLocaleString() }} ¥</strong>
            </button>
            <div class="raise-group">
              <button class="btn btn--raise" @click="doAction('raise', raiseAmount)">Relancer</button>
              <div class="raise-ctrl">
                <button class="raise-adj" @click="adjRaise(-1)">−</button>
                <span class="raise-amount">{{ raiseAmount.toLocaleString() }} ¥</span>
                <button class="raise-adj" @click="adjRaise(1)">+</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Mes cartes (toujours visibles) -->
      <div class="my-hand">
        <span
          v-for="(c,ci) in myPlayer.cards" :key="ci"
          class="card card--lg"
          :class="[c ? (c.red ? 'card--red':'card--black') : 'card--back', justDealt ? 'card--deal-in':'']"
          :style="justDealt ? { animationDelay: `${ci*160}ms` } : {}"
        >{{ c ? c.nom : '' }}</span>
      </div>
    </div>

    <!-- Log -->
    <div class="log-zone" v-if="log.length">
      <TransitionGroup name="log-in" tag="div" class="log-inner">
        <div v-for="(e,i) in log.slice(-5)" :key="e+i" class="log-row" :class="{ 'log-row--last': i === log.slice(-5).length-1 }">{{ e }}</div>
      </TransitionGroup>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppNavbar from './AppNavbar.vue'
import { io } from 'socket.io-client'
import { currentUser } from '../auth.js'
import {
  resumeAudio, playDeal, playFlip, playChip, playChipStack,
  playFold, playYourTurn, playWin, playLose,
} from '../poker-audio.js'

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:3001'
const CIRC = 2 * Math.PI * 18   // circonférence cercle r=18
const CHIP_COLORS = ['#e74c3c','#3498db','#2ecc71','#9b59b6','#f39c12']

const route  = useRoute()
const router = useRouter()
const tableId = parseInt(route.params.id)

const state          = ref(null)
const countdown      = ref(null)
const handResult     = ref(null)
const log            = ref([])
const raiseAmount    = ref(0)
const actionCountdown = ref(null)
const flashError     = ref(null)

const justDealt     = ref(false)
const potPulse      = ref(false)
const winnerIds     = ref(new Set())
const animCommCards = ref(new Set())

let socket = null
let actionTimerInt = null
let prevPot = 0
let prevActiveId = null

const myUserId  = computed(() => currentUser.value?.id)
const myPlayer  = computed(() => state.value?.players.find(p => p.userId === myUserId.value))
const isMyTurn  = computed(() =>
  state.value?.activeUserId === myUserId.value &&
  ['preflop','flop','turn','river'].includes(state.value?.status)
)
const orderedSeats = computed(() => {
  if (!state.value) return []
  const ps = state.value.players
  const mi = ps.findIndex(p => p.userId === myUserId.value)
  return mi === -1 ? ps : [...ps.slice(mi), ...ps.slice(0, mi)]
})
const phaseLabel = computed(() => ({
  preflop:'Pré-flop', flop:'Flop', turn:'Turn', river:'River',
})[state.value?.status] ?? '')
const potChipCount = computed(() => {
  if (!state.value?.pot) return 0
  return Math.min(5, Math.ceil(state.value.pot / (state.value.bigBlind * 5)))
})

// Position sièges : ovale, sens horaire depuis bas (i=0 = joueur actuel)
function seatStyle(i, n) {
  const angle = Math.PI / 2 - (2 * Math.PI / n) * i
  return {
    left: `${50 + 42 * Math.cos(angle)}%`,
    top:  `${50 + 38 * Math.sin(angle)}%`,
    transform: 'translate(-50%, -50%)',
  }
}

function adjRaise(dir) {
  if (!state.value) return
  raiseAmount.value = Math.max(state.value.bigBlind, raiseAmount.value + dir * state.value.bigBlind)
}

function startActionCd() {
  clearActionCd()
  actionCountdown.value = 30
  actionTimerInt = setInterval(() => { if (--actionCountdown.value <= 0) clearActionCd() }, 1000)
}
function clearActionCd() {
  if (actionTimerInt) { clearInterval(actionTimerInt); actionTimerInt = null }
  actionCountdown.value = null
}

function triggerPotPulse() {
  potPulse.value = true
  setTimeout(() => { potPulse.value = false }, 500)
}

function animateComm(from, to) {
  const s = new Set(animCommCards.value)
  for (let i = from; i < to; i++) {
    s.add(i)
    playFlip((i - from) * 110)
  }
  animCommCards.value = s
  setTimeout(() => {
    const c = new Set(animCommCards.value)
    for (let i = from; i < to; i++) c.delete(i)
    animCommCards.value = c
  }, 700)
}

function showError(msg) {
  flashError.value = msg
  setTimeout(() => { flashError.value = null }, 2800)
}

function addLog(msg) {
  log.value.push(msg)
  if (log.value.length > 20) log.value.shift()
}

function doAction(act, amount) {
  if (!socket) return
  if (act === 'fold') playFold()
  else if (act === 'call') playChip()
  else if (act === 'raise') playChipStack(3)
  socket.emit('poker_action', { tableId, action: act, amount })
}

function partir() {
  socket?.emit('poker_leave', { tableId })
}

onMounted(() => {
  socket = io(SOCKET_URL, { withCredentials: true })

  socket.on('connect', () => socket.emit('poker_join', tableId))

  socket.on('poker_table_update', (s) => {
    const oldLen = state.value?.communityCards?.length ?? 0
    const newLen = s.communityCards?.length ?? 0
    if (newLen > oldLen) animateComm(oldLen, newLen)

    if (s.activeUserId && s.activeUserId !== prevActiveId) {
      startActionCd()
      if (s.activeUserId === myUserId.value) playYourTurn()
    }
    prevActiveId = s.activeUserId

    const newPot = s.pot ?? 0
    if (newPot > prevPot) { triggerPotPulse(); if (prevPot > 0) playChip() }
    prevPot = newPot

    if (!['preflop','flop','turn','river'].includes(s.status)) clearActionCd()
    if (s.status !== 'waiting') raiseAmount.value = s.bigBlind
    handResult.value = s.handResult ?? null
    state.value = s
  })

  socket.on('poker_countdown', ({ sLeft }) => {
    countdown.value = sLeft
    if (sLeft <= 0) setTimeout(() => { if (countdown.value === 0) countdown.value = null }, 600)
  })
  socket.on('poker_countdown_cancel', () => { countdown.value = null })

  socket.on('poker_hand_start', () => {
    countdown.value = null
    handResult.value = null
    winnerIds.value = new Set()
    prevPot = 0
    prevActiveId = null
    addLog('─── Nouvelle main ───')
    justDealt.value = true
    const n = state.value?.players.length ?? 2
    for (let i = 0; i < n * 2; i++) playDeal(i * 80)
    setTimeout(() => { justDealt.value = false }, 1200)
  })

  socket.on('poker_hand_result', (result) => {
    handResult.value = result
    clearActionCd()
    winnerIds.value = new Set(result.winners.map(w => w.userId))
    const iWon = result.winners.some(w => w.userId === myUserId.value)
    if (iWon) playWin(); else playLose()
    for (const w of result.winners) addLog(`♛ ${w.nom} — ${result.pot.toLocaleString()} ¥`)
    for (const p of result.players) if (p.handName) addLog(`  ${p.nom} : ${p.handName}`)
  })

  socket.on('poker_reset', () => { handResult.value = null; winnerIds.value = new Set(); prevPot = 0 })
  socket.on('poker_left',  () => { socket.disconnect(); router.push('/poker') })
  socket.on('poker_error', ({ message }) => { showError(message); addLog(`⚠ ${message}`) })
})

onUnmounted(() => { clearActionCd(); socket?.disconnect() })

watch(() => state.value?.activeUserId, (id, old) => {
  if (!id || id === old) return
  const p = state.value?.players.find(p => p.userId === id)
  if (p) addLog(`→ ${p.nom}`)
})
</script>

<style scoped>
/* ── Page ── */
.page {
  min-height: 100vh;
  background: #07080a;
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 180px; /* espace pour le panneau fixe */
}

/* ── Top bar ── */
.top-bar {
  width: 100%; max-width: 860px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px 10px;
  flex-shrink: 0;
}
.back-link {
  font-family: 'Cinzel', serif; font-size: 0.65rem; letter-spacing: 0.12em;
  color: rgba(255,255,255,0.25); text-decoration: none; transition: color 0.15s;
}
.back-link:hover { color: rgba(255,255,255,0.6); }
.top-center { display: flex; flex-direction: column; align-items: center; gap: 1px; }
.table-name  { font-family: 'Cinzel', serif; font-size: 0.85rem; letter-spacing: 0.08em; color: #d4cfc9; }
.table-blinds { font-size: 0.7rem; color: rgba(255,255,255,0.22); }
.top-right { display: flex; align-items: center; gap: 12px; }
.my-stack { font-family: 'Cinzel', serif; font-size: 0.85rem; color: #c9a84c; letter-spacing: 0.05em; }
.btn-leave {
  background: none; border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px; color: rgba(255,255,255,0.25);
  font-family: 'Cinzel', serif; font-size: 0.6rem; letter-spacing: 0.1em;
  padding: 5px 13px; cursor: pointer; transition: all 0.15s;
}
.btn-leave:hover { border-color: rgba(200,50,50,0.5); color: #e05555; }

/* ── Toasts ── */
.countdown-toast, .error-toast {
  position: fixed; top: 70px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 10px;
  padding: 10px 20px; border-radius: 8px; z-index: 100;
  pointer-events: none;
}
.countdown-toast {
  background: rgba(14,14,16,0.95);
  border: 1px solid rgba(201,168,76,0.25);
  box-shadow: 0 4px 24px rgba(0,0,0,0.6);
}
.error-toast {
  background: rgba(100,20,20,0.95); border: 1px solid rgba(220,80,80,0.3);
  font-size: 0.82rem; color: #ffaaaa;
}
.toast-num { font-family: 'Cinzel', serif; font-size: 1.5rem; color: #c9a84c; line-height: 1; }
.toast-txt { font-size: 0.78rem; color: rgba(255,255,255,0.35); }

/* ── Arena ── */
.arena {
  width: 100%; display: flex; justify-content: center;
  padding: 0 16px;
  flex: 1;
}

/* ── Oval table ── */
.oval-table {
  position: relative;
  width: min(780px, 100%);
  aspect-ratio: 780 / 430;
  border-radius: 50%;
  background:
    radial-gradient(ellipse at 50% 40%, rgba(40,110,65,0.6) 0%, transparent 55%),
    radial-gradient(ellipse at 50% 65%, #0f4526 0%, #082c18 55%, #041810 100%);
  border: 8px solid #7a5c10;
  box-shadow:
    0 0 0 3px #4a3808,
    0 0 0 5px rgba(201,168,76,0.08),
    0 8px 60px rgba(0,0,0,0.9),
    inset 0 2px 0 rgba(255,255,255,0.04),
    inset 0 0 80px rgba(0,0,0,0.4);
  overflow: visible;
  flex-shrink: 0;
}

/* ── Result overlay ── */
.result-overlay {
  position: absolute;
  inset: 12% 8%;
  background: rgba(8,12,8,0.94);
  border: 1px solid rgba(201,168,76,0.3);
  border-radius: 14px;
  z-index: 20;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px;
  padding: 20px;
  backdrop-filter: blur(4px);
  box-shadow: 0 0 60px rgba(0,0,0,0.8), 0 0 30px rgba(201,168,76,0.06);
}
.result-winner-row {
  display: flex; align-items: center; gap: 10px;
  font-family: 'Cinzel', serif;
}
.result-crown  { color: #c9a84c; font-size: 1.1rem; }
.result-name   { font-size: 1rem; color: #fff; letter-spacing: 0.06em; }
.result-amount { font-size: 1rem; color: #c9a84c; }
.result-hands  { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.result-hand-row {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.05);
}
.result-hand-name-lbl { font-family: 'Cinzel', serif; font-size: 0.68rem; color: rgba(255,255,255,0.4); min-width: 70px; }
.result-hand-cards { display: flex; gap: 3px; }
.result-hand-type { font-size: 0.72rem; color: rgba(201,168,76,0.65); }

/* ── Table center ── */
.table-center {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  z-index: 2;
  pointer-events: none;
}

/* ── Pot ── */
.pot-zone {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
}
.pot-chips { display: flex; gap: 4px; }
.pot-chip {
  width: 11px; height: 11px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.2);
  box-shadow: 0 1px 4px rgba(0,0,0,0.6);
}
.pot-lbl {
  font-family: 'Cinzel', serif; font-size: 0.5rem;
  letter-spacing: 0.28em; color: rgba(255,255,255,0.28);
  text-transform: uppercase;
}
.pot-val {
  font-family: 'Cinzel', serif; font-size: 1.05rem;
  color: #c9a84c; letter-spacing: 0.05em;
  text-shadow: 0 0 16px rgba(201,168,76,0.55);
}
@keyframes potPulse {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.2); }
  70%  { transform: scale(0.96); }
  100% { transform: scale(1); }
}
.pot-zone--pulse { animation: potPulse 0.38s ease-out; }

/* ── Community cards ── */
.community-tray {
  display: flex; gap: 5px; align-items: center;
  background: rgba(0,0,0,0.18); border-radius: 6px;
  padding: 7px 10px;
  border: 1px solid rgba(255,255,255,0.04);
}
.waiting-lbl {
  font-family: 'Cinzel', serif; font-size: 0.55rem;
  letter-spacing: 0.22em; color: rgba(255,255,255,0.16);
  text-transform: uppercase;
}

/* ── Phase label ── */
.phase-lbl {
  font-family: 'Cinzel', serif; font-size: 0.52rem;
  letter-spacing: 0.25em; text-transform: uppercase;
  color: rgba(255,255,255,0.2);
}

/* ── Cartes ── */
.card {
  display: inline-flex; align-items: center; justify-content: center;
  background: #f5f0e8; border-radius: 4px;
  border: 1px solid rgba(0,0,0,0.12);
  font-weight: 700; box-shadow: 0 2px 6px rgba(0,0,0,0.5);
  flex-shrink: 0; user-select: none;
}
.card--sm   { width: 30px; height: 42px; font-size: 0.65rem; }
.card--seat { width: 26px; height: 36px; font-size: 0.6rem; }
.card--comm { width: 38px; height: 54px; font-size: 0.8rem; }
.card--ph   {
  width: 38px; height: 54px;
  background: rgba(0,0,0,0.1); border: 1px dashed rgba(255,255,255,0.07); box-shadow: none;
}
.card--lg   { width: 58px; height: 80px; font-size: 1.05rem; }
.card--red   { color: #c0222a; }
.card--black { color: #111; }
.card--back  {
  background: linear-gradient(145deg, #1c2d6a 0%, #112050 100%);
  border-color: #2a3a8a;
  background-image: repeating-linear-gradient(45deg,
    rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 2px, transparent 2px, transparent 8px);
}

@keyframes dealIn {
  0%   { transform: translateY(-30px) scale(0.7) rotateY(70deg); opacity: 0; }
  60%  { transform: translateY(2px) scale(1.04) rotateY(0deg); opacity: 1; }
  100% { transform: none; opacity: 1; }
}
.card--deal-in { animation: dealIn 0.38s ease-out both; }

@keyframes flipIn {
  0%   { transform: scaleX(0.05); opacity: 0.5; }
  55%  { transform: scaleX(1.05); }
  100% { transform: scaleX(1); opacity: 1; }
}
.card--flip-in { animation: flipIn 0.3s ease-out both; }

/* ── Sièges ── */
.seat {
  position: absolute;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  z-index: 5;
  min-width: 74px;
  background: rgba(0,0,0,0.55);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 9px;
  padding: 5px 7px 6px;
  transition: border-color 0.2s, box-shadow 0.2s;
  backdrop-filter: blur(2px);
}
.seat--active {
  border-color: rgba(201,168,76,0.5);
  box-shadow: 0 0 0 1px rgba(201,168,76,0.15), 0 4px 20px rgba(0,0,0,0.6);
}
.seat--folded { opacity: 0.42; filter: grayscale(0.5); }
.seat--me { border-color: rgba(139,26,26,0.45); }

@keyframes winBorder {
  0%,100% { border-color: rgba(201,168,76,0.5); box-shadow: 0 0 10px rgba(201,168,76,0.3); }
  50%      { border-color: #f0d060; box-shadow: 0 0 24px rgba(201,168,76,0.8); }
}
.seat--winner { animation: winBorder 0.9s ease-in-out infinite; }

.seat-badges { display: flex; gap: 3px; min-height: 15px; }
.badge {
  font-family: 'Cinzel', serif; font-size: 0.48rem; font-weight: 700;
  padding: 1px 4px; border-radius: 3px; letter-spacing: 0.04em;
}
.badge--d  { background: #c9a84c; color: #1a1200; }
.badge--sb { background: rgba(60,130,240,0.85); color: #fff; }
.badge--bb { background: rgba(200,70,70,0.85); color: #fff; }

/* Avatar avec timer circulaire SVG */
.avatar-wrap {
  position: relative;
  width: 34px; height: 34px;
  display: flex; align-items: center; justify-content: center;
}
.timer-svg {
  position: absolute;
  inset: -6px;
  width: calc(100% + 12px); height: calc(100% + 12px);
  pointer-events: none;
}
.seat-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: rgba(255,255,255,0.07);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Cinzel', serif; font-size: 0.75rem;
  border: 2px solid rgba(255,255,255,0.1);
  transition: border-color 0.2s;
  position: relative; z-index: 1;
}
.seat--active .seat-avatar { border-color: rgba(201,168,76,0.6); }
.seat--me .seat-avatar { background: rgba(139,26,26,0.25); border-color: rgba(139,26,26,0.6); }

.seat-nom {
  font-family: 'Cinzel', serif; font-size: 0.58rem; letter-spacing: 0.05em;
  color: rgba(255,255,255,0.72); max-width: 72px; text-align: center;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.seat-stack { font-size: 0.58rem; color: rgba(255,255,255,0.28); }
.seat-cards { display: flex; gap: 2px; margin-top: 3px; }

/* Mise flottante */
.seat-bet {
  display: flex; align-items: center; gap: 3px;
  font-size: 0.62rem; color: #c9a84c;
  background: rgba(0,0,0,0.6); border-radius: 3px; padding: 1px 5px;
  margin-top: 2px;
}
.bet-chip {
  display: inline-block; width: 7px; height: 7px; border-radius: 50%;
  background: #c9a84c; border: 1px solid rgba(255,255,255,0.3); flex-shrink: 0;
}

/* ── Panneau joueur fixé en bas ── */
.player-panel {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 50;
  background: rgba(8,9,10,0.97);
  border-top: 1px solid rgba(201,168,76,0.15);
  box-shadow: 0 -4px 30px rgba(0,0,0,0.7);
  display: flex; flex-direction: column; align-items: center;
  padding: 0 20px 14px;
  gap: 0;
}
.action-btns-wrap {
  width: 100%; max-width: 760px;
  padding-top: 12px; padding-bottom: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.my-hand {
  display: flex; gap: 10px; justify-content: center;
  padding-top: 10px;
}
.action-btns { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; align-items: center; }

.btn {
  font-family: 'Cinzel', serif; font-size: 0.7rem; letter-spacing: 0.08em;
  text-transform: uppercase; border: none; border-radius: 6px;
  padding: 11px 20px; cursor: pointer; transition: all 0.15s;
  outline: none;
}
.btn--fold  { background: rgba(120,20,20,0.8);  color: #ffbbbb; border: 1px solid rgba(200,50,50,0.2); }
.btn--check { background: rgba(25,90,40,0.85);  color: #aaffbb; border: 1px solid rgba(50,160,80,0.2); }
.btn--call  { background: rgba(20,70,150,0.85); color: #aaccff; border: 1px solid rgba(60,130,220,0.2); }
.btn--raise { background: rgba(140,105,10,0.9); color: #fff5cc; border: 1px solid rgba(201,168,76,0.3); }
.btn:hover  { filter: brightness(1.2); transform: translateY(-1px); }
.btn:active { transform: translateY(0); filter: brightness(0.95); }

.raise-group { display: flex; align-items: center; gap: 8px; }
.raise-ctrl  {
  display: flex; align-items: center; gap: 6px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 5px; padding: 6px 9px;
}
.raise-adj {
  background: none; border: none; color: rgba(255,255,255,0.4);
  font-size: 1rem; cursor: pointer; padding: 0 3px; transition: color 0.12s;
}
.raise-adj:hover { color: #c9a84c; }
.raise-amount { font-size: 0.8rem; color: #c9a84c; min-width: 90px; text-align: center; }

/* ── Log ── */
.log-zone {
  width: 100%; max-width: 780px;
  margin-top: 10px; padding: 0 20px 20px;
}
.log-inner { display: flex; flex-direction: column; gap: 2px; }
.log-row {
  font-family: 'Cinzel', serif; font-size: 0.68rem; letter-spacing: 0.04em;
  color: rgba(255,255,255,0.2); padding: 1px 0;
}
.log-row--last { color: rgba(255,255,255,0.45); }

/* ── Transitions ── */
.toast-enter-active { transition: all 0.25s cubic-bezier(0.22,1,0.36,1); }
.toast-leave-active { transition: all 0.2s ease-in; }
.toast-enter-from   { opacity: 0; transform: translateX(-50%) translateY(-10px); }
.toast-leave-to     { opacity: 0; transform: translateX(-50%) translateY(-6px); }

.btns-slide-enter-active { transition: all 0.22s cubic-bezier(0.22,1,0.36,1); overflow: hidden; }
.btns-slide-leave-active { transition: all 0.18s ease-in; overflow: hidden; }
.btns-slide-enter-from   { opacity: 0; max-height: 0; }
.btns-slide-enter-to     { opacity: 1; max-height: 120px; }
.btns-slide-leave-from   { opacity: 1; max-height: 120px; }
.btns-slide-leave-to     { opacity: 0; max-height: 0; }

.overlay-pop-enter-active { transition: all 0.3s cubic-bezier(0.22,1,0.36,1); }
.overlay-pop-leave-active { transition: all 0.22s ease-in; }
.overlay-pop-enter-from   { opacity: 0; transform: scale(0.94); }
.overlay-pop-leave-to     { opacity: 0; }

.bet-pop-enter-active { transition: all 0.18s cubic-bezier(0.22,1,0.36,1); }
.bet-pop-leave-active { transition: all 0.14s ease-in; }
.bet-pop-enter-from   { opacity: 0; transform: scale(0.6) translateY(-4px); }
.bet-pop-leave-to     { opacity: 0; transform: scale(0.7); }

.log-in-enter-active { transition: all 0.2s ease-out; }
.log-in-enter-from   { opacity: 0; transform: translateX(-6px); }
</style>

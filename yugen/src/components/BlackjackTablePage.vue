<template>
  <div class="page">
    <AppNavbar />

    <div class="page-inner">
      <div class="top-bar">
        <RouterLink to="/blackjack/lobby" class="back-link">← Lobby</RouterLink>
        <div class="solde-badge">{{ fmtYen(solde) }}</div>
      </div>

      <h1 class="page-title">Table {{ tableId }}</h1>

      <!-- Countdown avant partie -->
      <Transition name="fade">
        <div v-if="countdown != null" class="countdown-banner">
          <span class="countdown-num">{{ countdown }}</span>
          <span class="countdown-txt">La partie commence dans…</span>
        </div>
      </Transition>

      <!-- ── Phase attente : sièges à prendre ── -->
      <div v-if="tableStatut === 'attente'" class="attente-wrap">

        <div class="casino-table">
          <div class="felt-top">
            <span class="dealer-lbl">Croupier</span>
            <div class="felt-inner"><span class="bj-lbl">Blackjack</span></div>
          </div>
          <div class="sieges-arc">
            <div
              v-for="siege in sieges"
              :key="siege.numero"
              class="siege-arc-slot"
              :class="{
                'siege-arc-slot--free':    siege.statut === 'vide',
                'siege-arc-slot--taken':   siege.statut !== 'vide',
                'siege-arc-slot--moi':     siege.user_id === currentUserId,
                'siege-arc-slot--clickable': siege.statut === 'vide' && !dejaAssis,
              }"
              @click="siege.statut === 'vide' && !dejaAssis && ouvrirModale(siege.numero)"
            >
              <template v-if="siege.statut === 'vide'">
                <span class="arc-plus">+</span>
                <span class="arc-num">{{ siege.numero }}</span>
              </template>
              <template v-else>
                <span class="arc-avatar">{{ siege.user_nom?.[0]?.toUpperCase() }}</span>
                <span class="arc-nom">{{ siege.user_nom }}</span>
                <span
                  class="arc-mise"
                  :class="{ 'arc-mise--moi': siege.user_id === currentUserId }"
                  @click.stop="siege.user_id === currentUserId && ouvrirModaleModif(siege.mise)"
                >{{ fmtYen(siege.mise) }} <span v-if="siege.user_id === currentUserId" class="arc-edit">✎</span></span>
                <button
                  v-if="siege.user_id === currentUserId"
                  class="btn-quitter"
                  @click.stop="socket.emit('quitter_siege', { tableId })"
                >✕</button>
              </template>
            </div>
          </div>
        </div>

        <p class="attente-hint">Cliquez sur un siège libre pour vous asseoir</p>
      </div>

      <!-- ── Phase jeu ── -->
      <div v-else class="tapis">

        <!-- Dealer -->
        <div class="dealer-zone">
          <div class="zone-label">
            Croupier
            <span
              v-if="tableStatut === 'fini' || dealerFini"
              class="zone-total"
              :class="totalClass(dTotal)"
            >{{ dTotal }}</span>
            <span v-else-if="mainDealer.length" class="zone-total dim">?</span>
          </div>
          <div class="hand dealer-hand">
            <TransitionGroup name="card-pop">
              <PlayingCard
                v-for="(c, i) in mainDealer"
                :key="`d${i}`"
                :card="c"
              />
            </TransitionGroup>
          </div>
        </div>

        <div class="divider" />

        <!-- Timer de tour -->
        <div v-if="tableStatut === 'en_cours' && monTour && !dealerFini" class="tour-timer">
          <div class="tour-timer-bar" :style="{ width: timerPct + '%' }"></div>
          <span class="tour-timer-txt">{{ timerSecondes }}s</span>
        </div>

        <!-- Sièges joueurs -->
        <div class="sieges-row">
          <div
            v-for="siege in sieges"
            :key="siege.numero"
            class="siege-slot"
            :class="{
              'siege-slot--actif': siege.numero === siegeActif && tableStatut === 'en_cours',
              'siege-slot--moi': siege.user_id === currentUserId,
              'siege-slot--fini': siege.statut === 'fini',
            }"
          >
            <template v-if="siege.statut !== 'vide'">
              <div class="siege-header">
                <span class="siege-nom">{{ siege.user_nom }}</span>
                <span class="siege-mise">{{ fmtYen(siege.mise) }}</span>
              </div>

              <div class="hand">
                <TransitionGroup name="card-pop">
                  <PlayingCard
                    v-for="(c, i) in siege.main"
                    :key="`s${siege.numero}_${i}`"
                    :card="c"
                  />
                </TransitionGroup>
              </div>

              <div v-if="siege.main.length" class="siege-total" :class="totalClass(handTotalFor(siege.main))">
                {{ handTotalFor(siege.main) }}
              </div>

              <!-- Résultat après partie -->
              <div v-if="siege.resultat" class="siege-resultat" :class="`res--${siege.resultat}`">
                {{ resultatLabel(siege.resultat) }}
                <span class="siege-gain" :class="siege.gain_net > 0 ? 'pos' : siege.gain_net < 0 ? 'neg' : ''">
                  {{ siege.gain_net > 0 ? '+' : '' }}{{ fmtYen(siege.gain_net) }}
                </span>
              </div>

              <!-- Indicateur tour actif -->
              <div v-if="siege.numero === siegeActif && tableStatut === 'en_cours' && !dealerFini" class="tour-badge">
                {{ siege.user_id === currentUserId ? 'Votre tour' : 'En attente…' }}
              </div>
            </template>
            <template v-else>
              <div class="siege-vide">Siège {{ siege.numero }}</div>
            </template>
          </div>
        </div>

      </div>

      <!-- Actions joueur -->
      <div v-if="monTour && tableStatut === 'en_cours' && !dealerFini" class="actions">
        <div class="btns">
          <button class="btn btn--hit" :disabled="actionLoading" @click="doAction('hit')">Tirer</button>
          <button class="btn btn--stand" :disabled="actionLoading" @click="doAction('stand')">Rester</button>
          <button
            v-if="monSiege && monSiege.main.length === 2"
            class="btn btn--double"
            :disabled="actionLoading || solde < monSiege.mise"
            @click="doAction('double')"
          >
            Doubler ×2
          </button>
        </div>
      </div>

      <!-- Fin de partie -->
      <Transition name="result-pop">
        <div v-if="tableStatut === 'fini'" class="fin-banner">
          <p class="fin-titre">Partie terminée</p>
          <p v-if="finCountdown > 0" class="fin-relance">Nouvelle partie dans {{ finCountdown }}…</p>
          <RouterLink to="/blackjack/lobby" class="btn btn--primary">Retour au lobby</RouterLink>
        </div>
      </Transition>

      <p v-if="erreur" class="erreur">{{ erreur }}</p>
    </div>

    <!-- Modale mise -->
    <Transition name="modal-fade">
      <div v-if="modale.ouverte" class="modal-overlay" @click.self="fermerModale">
        <div class="modal">
          <h2 class="modal-title">{{ modale.modif ? 'Modifier la mise' : 'Siège ' + modale.siegeNumero }}</h2>
          <p class="modal-sub">Solde : {{ fmtYen(solde) }}</p>
          <div class="modal-field">
            <label class="modal-label">Mise</label>
            <input v-model.number="modale.mise" type="number" class="modal-input" :min="100" :max="solde" step="100" @keydown.enter="confirmerSiege" />
          </div>
          <p v-if="modale.erreur" class="modal-erreur">{{ modale.erreur }}</p>
          <div class="modal-btns">
            <button class="btn btn--primary" @click="confirmerSiege">S'asseoir</button>
            <button class="btn btn--ghost"   @click="fermerModale">Annuler</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { io } from 'socket.io-client'
import AppNavbar from './AppNavbar.vue'
import PlayingCard from './PlayingCard.vue'
import { getMe } from '../api.js'
import {
  playDeal, playBust, playLose, playWin, playBlackjack, playChip, resumeAudio,
} from '../blackjack-audio.js'

const route  = useRoute()
const router = useRouter()
const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')

const tableId      = parseInt(route.params.id)

// ── State ─────────────────────────────────────────────────────────────────────

const solde         = ref(0)
const currentUserId = ref(null)
const sieges        = ref([])
const mainDealer    = ref([])
const dTotal        = ref(null)
const tableStatut   = ref('attente')
const siegeActif    = ref(null)
const countdown     = ref(null)
const dealerFini    = ref(false)
const erreur        = ref('')
const actionLoading = ref(false)
const finCountdown  = ref(0)
let finInterval     = null

// Modale prise de siège / modification mise
const modale = ref({ ouverte: false, siegeNumero: null, mise: 1000, erreur: '', modif: false })
const dejaAssis = computed(() => sieges.value.some(s => s.user_id === currentUserId.value && s.statut !== 'vide'))

function ouvrirModale(num) {
  modale.value = { ouverte: true, siegeNumero: num, mise: Math.min(1000, solde.value), erreur: '', modif: false }
}
function ouvrirModaleModif(miseCourante) {
  modale.value = { ouverte: true, siegeNumero: null, mise: miseCourante, erreur: '', modif: true }
}
function fermerModale() { modale.value.ouverte = false }
function confirmerSiege() {
  if (!modale.value.mise || modale.value.mise <= 0) { modale.value.erreur = 'Mise invalide.'; return }
  resumeAudio()
  if (modale.value.modif) {
    const monSiegeActuel = sieges.value.find(s => s.user_id === currentUserId.value)
    const diff = modale.value.mise - (monSiegeActuel?.mise ?? 0)
    if (diff > solde.value) { modale.value.erreur = 'Solde insuffisant.'; return }
    socket.emit('modifier_mise', { tableId, mise: modale.value.mise })
  } else {
    if (modale.value.mise > solde.value) { modale.value.erreur = 'Solde insuffisant.'; return }
    playChip()
    socket.emit('prendre_siege', { tableId, siegeNumero: modale.value.siegeNumero, mise: modale.value.mise })
  }
  fermerModale()
}

// Tour timer
const TOUR_DURATION   = 20
const timerSecondes   = ref(TOUR_DURATION)
const timerPct        = ref(100)
let timerInterval     = null

// ── Computed ──────────────────────────────────────────────────────────────────

const monSiege = computed(() => sieges.value.find(s => s.user_id === currentUserId.value))
const monTour  = computed(() => monSiege.value && monSiege.value.numero === siegeActif.value && monSiege.value.statut === 'en_jeu')

// ── Helpers ───────────────────────────────────────────────────────────────────

function handTotalFor(main) {
  if (!main || !main.length) return 0
  let total = 0, aces = 0
  for (const c of main) {
    if (c.hidden) continue
    const v = c.v
    if (v === 'A') { total += 11; aces++ }
    else if (['J','Q','K'].includes(v)) total += 10
    else total += parseInt(v)
  }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return total
}

function totalClass(t) {
  if (!t) return ''
  if (t > 21) return 'bust'
  if (t === 21) return 'vingt-et-un'
  return ''
}

function fmtYen(n) {
  if (n == null) return '—'
  return (n < 0 ? '-¥' : '¥') + Math.abs(n).toLocaleString('fr-FR')
}

function resultatLabel(r) {
  return { victoire: 'Victoire !', defaite: 'Défaite', egalite: 'Égalité', blackjack: 'Blackjack !' }[r] ?? r
}

function applyState(state, playSounds = false) {
  const t = state.table
  const prevSieges = sieges.value

  tableStatut.value = t.statut
  siegeActif.value  = t.siege_actif

  // Dealer : masquer la 2ème carte si partie en cours
  if (t.statut === 'en_cours' && !dealerFini.value) {
    const raw = t.main_dealer || []
    mainDealer.value = raw.map((c, i) => i === 1 ? { hidden: true } : c)
    dTotal.value = null
  } else {
    mainDealer.value = t.main_dealer || []
    if (mainDealer.value.length) {
      dTotal.value = handTotalFor(mainDealer.value)
    }
  }

  const newSieges = (state.sieges || []).map(s => ({ ...s, main: s.main || [] }))
  sieges.value = newSieges

  // Sons : détecter les nouvelles cartes tirées
  if (playSounds && t.statut === 'en_cours') {
    for (const newS of newSieges) {
      const prevS = prevSieges.find(s => s.numero === newS.numero)
      const prevLen = prevS?.main?.filter(c => !c.hidden).length ?? 0
      const newLen  = newS.main.filter(c => !c.hidden).length
      if (newLen > prevLen) {
        playDeal()
        if (newS.user_id === currentUserId.value && handTotalFor(newS.main) > 21) {
          setTimeout(playBust, 150)
        }
      }
    }
  }
}

// ── Timer de tour ─────────────────────────────────────────────────────────────

function resetTourTimer() {
  clearInterval(timerInterval)
  timerSecondes.value = TOUR_DURATION
  timerPct.value = 100
  if (monTour.value && tableStatut.value === 'en_cours') {
    timerInterval = setInterval(() => {
      timerSecondes.value--
      timerPct.value = (timerSecondes.value / TOUR_DURATION) * 100
      if (timerSecondes.value <= 0) clearInterval(timerInterval)
    }, 1000)
  }
}

watch([monTour, siegeActif], () => {
  resetTourTimer()
})

// ── Socket ────────────────────────────────────────────────────────────────────

let socket = null

function initSocket() {
  socket = io(SOCKET_URL, { withCredentials: true })

  socket.on('connect', () => {
    socket.emit('join_table', tableId)
  })

  socket.on('table_update', (state) => {
    applyState(state, true)
    actionLoading.value = false
  })

  socket.on('game_start', () => {
    dealerFini.value = false
    countdown.value  = null
    // Son de deal pour chaque carte distribuée (joueurs × 2 + dealer × 2)
    const nbJoueurs = sieges.value.filter(s => s.statut !== 'vide').length || 1
    const nbCartes  = (nbJoueurs + 1) * 2
    for (let i = 0; i < nbCartes; i++) setTimeout(playDeal, i * 130)
  })

  socket.on('game_end', (resolution) => {
    dealerFini.value = true
    clearInterval(timerInterval)
    // Compte à rebours avant relance
    finCountdown.value = 5
    clearInterval(finInterval)
    finInterval = setInterval(() => {
      finCountdown.value--
      if (finCountdown.value <= 0) clearInterval(finInterval)
    }, 1000)
    // Mise à jour des totaux dealer
    if (resolution.mainDealer) {
      mainDealer.value = resolution.mainDealer
      dTotal.value = resolution.dTotal
    }
    // Son de résultat + mise à jour solde
    const monRes = resolution.resultats?.find(r => r.user_id === currentUserId.value)
    if (monRes) {
      solde.value = monRes.solde
      const wasBust = handTotalFor(monSiege.value?.main || []) > 21
      if      (monRes.resultat === 'blackjack')              playBlackjack()
      else if (monRes.resultat === 'victoire')               playWin()
      else if (monRes.resultat === 'defaite' && !wasBust)    playLose()
      // bust : déjà joué pendant le hit
    }
  })

  socket.on('table_reset', () => {
    dealerFini.value = false
    dTotal.value = null
    countdown.value = null
    finCountdown.value = 0
    clearInterval(finInterval)
  })

  // Son quand le dealer révèle sa carte cachée
  watch(dealerFini, (val) => {
    if (val) playDeal()
  })

  socket.on('mise_modifiee', ({ solde: s }) => {
    solde.value = s
    playChip()
  })

  socket.on('countdown_tick', ({ secondsLeft }) => {
    countdown.value = secondsLeft
    if (secondsLeft <= 0) countdown.value = null
  })

  socket.on('countdown_cancelled', () => {
    countdown.value = null
  })

  socket.on('error', ({ message }) => {
    erreur.value = message
    actionLoading.value = false
    setTimeout(() => { erreur.value = '' }, 4000)
  })
}

// ── Actions ───────────────────────────────────────────────────────────────────

function doAction(action) {
  if (actionLoading.value) return
  actionLoading.value = true
  erreur.value = ''
  resumeAudio()
  socket.emit('action', { tableId, action })
}

// ── Mount ─────────────────────────────────────────────────────────────────────

onMounted(async () => {
  const me = await getMe()
  if (me) {
    solde.value = me.solde
    currentUserId.value = me.id
  }
  initSocket()
})

onUnmounted(() => {
  clearInterval(timerInterval)
  clearInterval(finInterval)
  if (socket) socket.disconnect()
})
</script>

<style scoped>
.page { min-height: 100vh; background: #090909; }

.page-inner {
  max-width: 960px;
  margin: 0 auto;
  padding: 2.5rem 2rem 6rem;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.back-link {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.3);
  text-decoration: none;
  transition: color 0.15s;
}
.back-link:hover { color: rgba(255,255,255,0.65); }

.solde-badge {
  font-family: 'Cinzel', serif;
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  color: #c9a84c;
  background: rgba(201,168,76,0.08);
  border: 1px solid rgba(201,168,76,0.2);
  padding: 5px 14px;
}

.page-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.5rem;
  font-weight: 400;
  letter-spacing: 0.1em;
  color: #fff;
  margin: 0 0 1.5rem;
  text-align: center;
}

/* ── Countdown ───────────────────────────────────────────── */

.countdown-banner {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 14px;
  margin-bottom: 1.5rem;
  padding: 16px;
  background: rgba(139,26,26,0.08);
  border: 1px solid rgba(139,26,26,0.3);
}

.countdown-num {
  font-family: 'Cinzel', serif;
  font-size: 2.5rem;
  color: #8b1a1a;
  font-weight: 700;
  line-height: 1;
}

.countdown-txt {
  font-family: 'Crimson Text', serif;
  font-style: italic;
  font-size: 1rem;
  color: rgba(255,255,255,0.4);
}

/* ── Attente ─────────────────────────────────────────────── */

.attente-msg {
  text-align: center;
  padding: 3rem;
  color: rgba(255,255,255,0.3);
  font-family: 'Crimson Text', serif;
  font-style: italic;
  font-size: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

/* ── Tapis ───────────────────────────────────────────────── */

.tapis {
  background: #0a140a;
  border: 1px solid rgba(255,255,255,0.07);
  padding: 28px 24px;
  min-height: 400px;
}

.dealer-zone {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 20px;
}

.divider {
  height: 1px;
  background: rgba(255,255,255,0.06);
  margin: 4px 0 20px;
}

.zone-label {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.22);
  display: flex;
  align-items: center;
  gap: 10px;
}

.zone-total {
  font-family: 'Cinzel', serif;
  font-size: 0.72rem;
  color: rgba(255,255,255,0.55);
}
.zone-total.bust { color: #c0392b; }
.zone-total.vingt-et-un { color: #c9a84c; }
.zone-total.dim { color: rgba(255,255,255,0.2); }

.hand {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: flex-start;
}

.dealer-hand {
  min-height: 90px;
}

/* ── Tour timer ──────────────────────────────────────────── */

.tour-timer {
  height: 4px;
  background: rgba(255,255,255,0.06);
  position: relative;
  margin-bottom: 16px;
  overflow: hidden;
}

.tour-timer-bar {
  height: 100%;
  background: #8b1a1a;
  transition: width 1s linear;
}

.tour-timer-txt {
  position: absolute;
  right: 0;
  top: 6px;
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  color: rgba(255,255,255,0.3);
  letter-spacing: 0.08em;
}

/* ── Sièges ──────────────────────────────────────────────── */

.sieges-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.siege-slot {
  background: #111;
  border: 1px solid rgba(255,255,255,0.06);
  padding: 14px 10px;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.siege-slot--actif {
  border-color: rgba(139,26,26,0.5);
  box-shadow: 0 0 16px rgba(139,26,26,0.12);
}

.siege-slot--moi {
  border-color: rgba(201,168,76,0.3);
}

.siege-slot--fini {
  opacity: 0.8;
}

.siege-vide {
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.12);
  text-align: center;
  margin: auto;
}

.siege-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 100%;
}

.siege-nom {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.65);
  text-align: center;
  word-break: break-all;
}

.siege-mise {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  color: #c9a84c;
  letter-spacing: 0.05em;
}

.siege-total {
  font-family: 'Cinzel', serif;
  font-size: 0.9rem;
  color: rgba(255,255,255,0.5);
  letter-spacing: 0.06em;
}
.siege-total.bust { color: #c0392b; }
.siege-total.vingt-et-un { color: #c9a84c; }

.siege-resultat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-top: auto;
  padding: 8px;
  width: 100%;
  text-align: center;
}

.res--victoire  { color: #c9a84c; }
.res--blackjack { color: #e2c97e; }
.res--egalite   { color: rgba(255,255,255,0.4); }
.res--defaite   { color: #8b1a1a; }

.siege-gain {
  font-size: 0.7rem;
  letter-spacing: 0.04em;
  font-family: 'Cinzel', serif;
}
.siege-gain.pos { color: #c9a84c; }
.siege-gain.neg { color: #8b1a1a; }

.tour-badge {
  font-family: 'Cinzel', serif;
  font-size: 0.52rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #8b1a1a;
  border: 1px solid rgba(139,26,26,0.4);
  padding: 3px 8px;
  animation: pulse 1.4s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

/* ── Actions ─────────────────────────────────────────────── */

.actions {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}

.btns {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.btn {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  padding: 11px 28px;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s, background 0.15s, transform 0.1s;
  text-decoration: none;
  display: inline-block;
  text-align: center;
}
.btn:active:not(:disabled) { transform: scale(0.97); }
.btn:disabled { opacity: 0.35; cursor: not-allowed; }

.btn--primary { background: #8b1a1a; color: #e8ddd0; }
.btn--primary:hover:not(:disabled) { background: #a01f1f; }

.btn--hit { background: rgba(201,168,76,0.14); color: #c9a84c; border: 1px solid rgba(201,168,76,0.3); }
.btn--hit:hover:not(:disabled) { background: rgba(201,168,76,0.24); }

.btn--stand { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.6); border: 1px solid rgba(255,255,255,0.1); }
.btn--stand:hover:not(:disabled) { background: rgba(255,255,255,0.1); }

.btn--double { background: rgba(139,26,26,0.14); color: #c0392b; border: 1px solid rgba(139,26,26,0.3); }
.btn--double:hover:not(:disabled) { background: rgba(139,26,26,0.24); }

.btn--ghost { background: transparent; color: rgba(255,255,255,0.3); border: 1px solid rgba(255,255,255,0.1); }
.btn--ghost:hover { color: rgba(255,255,255,0.55); }

/* ── Fin de partie ───────────────────────────────────────── */

.fin-banner {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px;
  border: 1px solid rgba(255,255,255,0.08);
}

.fin-titre {
  font-family: 'Cinzel', serif;
  font-size: 0.85rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  margin: 0;
}

.fin-relance {
  font-family: 'Crimson Text', serif;
  font-style: italic;
  font-size: 0.95rem;
  color: rgba(255,255,255,0.25);
  margin: 0;
}

/* ── Erreur ──────────────────────────────────────────────── */

.erreur {
  font-family: 'Crimson Text', serif;
  font-style: italic;
  color: #c0392b;
  text-align: center;
  margin-top: 14px;
  font-size: 0.95rem;
}

/* ── Transitions cartes ──────────────────────────────────── */

.card-pop-enter-active {
  transition: all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.card-pop-enter-from {
  opacity: 0;
  transform: translateY(-18px) rotate(-3deg) scale(0.84);
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.result-pop-enter-active { animation: result-in 0.32s ease both; }
.result-pop-leave-active { transition: opacity 0.18s; }
.result-pop-leave-to { opacity: 0; }

@keyframes result-in {
  0%   { opacity: 0; transform: translateY(8px) scale(0.94); }
  60%  { transform: translateY(-2px) scale(1.02); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

@media (max-width: 700px) {
  .sieges-row { grid-template-columns: repeat(2, 1fr); }
}

/* ── Phase attente ───────────────────────────────────────── */

.attente-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  margin-top: 8px;
}

.attente-hint {
  font-family: 'Crimson Text', serif;
  font-style: italic;
  font-size: 0.9rem;
  color: rgba(255,255,255,0.25);
  margin: 0;
}

.casino-table {
  width: 100%;
  max-width: 580px;
  background: #0b1f0e;
  border: 3px solid #1a4020;
  border-radius: 120px;
  padding: 20px 28px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: inset 0 0 50px rgba(0,0,0,0.4), 0 0 0 5px #0d0d0d, 0 0 0 7px rgba(255,255,255,0.04);
}

.felt-top {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding-bottom: 14px;
  width: 100%;
}

.dealer-lbl {
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.18);
}

.felt-inner {
  width: 140px;
  height: 44px;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bj-lbl {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  color: rgba(255,255,255,0.1);
}

.sieges-arc {
  display: flex;
  justify-content: center;
  gap: 12px;
  position: relative;
  bottom: -24px;
}

.siege-arc-slot {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  border: 2px dashed rgba(255,255,255,0.1);
  background: rgba(0,0,0,0.35);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  position: relative;
  transition: border-color 0.15s, background 0.15s, transform 0.15s;
  padding: 8px;
}

.siege-arc-slot--clickable {
  cursor: pointer;
  border-color: rgba(255,255,255,0.2);
}
.siege-arc-slot--clickable:hover {
  background: rgba(255,255,255,0.05);
  border-color: rgba(255,255,255,0.4);
  transform: translateY(-4px);
}

.siege-arc-slot--taken {
  border-style: solid;
  border-color: rgba(255,255,255,0.12);
  background: rgba(10,30,10,0.7);
}

.siege-arc-slot--moi {
  border-color: rgba(201,168,76,0.5);
  background: rgba(201,168,76,0.06);
}

.arc-plus { font-size: 1.3rem; color: rgba(255,255,255,0.18); line-height: 1; }
.arc-num  { font-family: 'Cinzel', serif; font-size: 0.5rem; letter-spacing: 0.12em; color: rgba(255,255,255,0.15); }

.arc-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(139,26,26,0.3);
  border: 1px solid rgba(139,26,26,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Cinzel', serif;
  font-size: 0.72rem;
  color: rgba(255,255,255,0.7);
}

.arc-nom  { font-family: 'Cinzel', serif; font-size: 0.5rem; letter-spacing: 0.08em; color: rgba(255,255,255,0.6); text-align: center; max-width: 72px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.arc-mise { font-family: 'Cinzel', serif; font-size: 0.48rem; color: #c9a84c; }
.arc-mise--moi { cursor: pointer; }
.arc-mise--moi:hover { color: #e2c97e; }
.arc-edit { opacity: 0.5; font-size: 0.42rem; }

.btn-quitter {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(139,26,26,0.4);
  border: none;
  color: rgba(255,255,255,0.5);
  font-size: 0.48rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-quitter:hover { background: rgba(139,26,26,0.8); color: #fff; }

/* ── Modale ──────────────────────────────────────────────── */

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal {
  background: #111;
  border: 1px solid rgba(255,255,255,0.1);
  padding: 36px 40px;
  min-width: 300px;
  max-width: 380px;
  width: 100%;
}

.modal-title {
  font-family: 'Cinzel', serif;
  font-size: 1rem;
  font-weight: 400;
  letter-spacing: 0.1em;
  color: #fff;
  margin: 0 0 6px;
}

.modal-sub {
  font-family: 'Crimson Text', serif;
  font-size: 0.9rem;
  color: rgba(255,255,255,0.35);
  margin: 0 0 22px;
}

.modal-field { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }

.modal-label {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.3);
  white-space: nowrap;
}

.modal-input {
  background: #0d0d0d;
  border: 1px solid rgba(255,255,255,0.12);
  color: #d4cfc9;
  font-family: 'Cinzel', serif;
  font-size: 0.88rem;
  padding: 8px 12px;
  flex: 1;
  outline: none;
}
.modal-input:focus { border-color: rgba(201,168,76,0.4); }

.modal-erreur { font-family: 'Crimson Text', serif; font-style: italic; color: #c0392b; font-size: 0.88rem; margin: 0 0 12px; }
.modal-btns { display: flex; gap: 10px; }

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.18s; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>

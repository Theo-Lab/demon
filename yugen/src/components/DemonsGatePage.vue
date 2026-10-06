<template>
  <!-- Particules (teleportées dans body) -->
  <Teleport to="body">
    <div class="dg-particles-layer" aria-hidden="true">
      <span
        v-for="p in particles"
        :key="p.id"
        :class="`dg-ptcl dg-ptcl--${p.shape}`"
        :style="p.style"
      ></span>
    </div>
  </Teleport>

  <div :class="['dg-page', shaking ? 'dg-page--shake' : '']">
    <AppNavbar />

    <div v-if="jeuIndisponible" class="jeu-indispo">
      <p class="jeu-indispo-title">Jeu indisponible</p>
      <p class="jeu-indispo-sub">Demon's Gate est temporairement fermé.</p>
      <RouterLink to="/casino" class="jeu-indispo-link">← Retour au casino</RouterLink>
    </div>

    <div v-if="!jeuIndisponible" class="dg-inner">

      <!-- En-tête -->
      <div class="dg-header">
        <RouterLink to="/casino" class="dg-back">← Casino</RouterLink>
        <div class="dg-header-center">
          <p class="dg-label">Casino de l'Ordre</p>
          <h1 class="dg-title">DEMON'S <span class="dg-title-accent">GATE</span></h1>
          <p class="dg-sub">Collect &amp; Blow · 243 Ways to Win</p>
        </div>
        <div class="dg-wallet-box">
          <div class="dg-currency-toggle">
            <button :class="['dg-cur-btn', currency === 'yens' ? 'dg-cur-btn--active' : '']" @click="currency = 'yens'">¥</button>
            <button :class="['dg-cur-btn', currency === 'bonbons' ? 'dg-cur-btn--active' : '']" @click="currency = 'bonbons'">🍬</button>
          </div>
          <div class="dg-credits-row">
            <span class="dg-credits-label">Crédits</span>
            <span class="dg-credits-value">{{ credits.toLocaleString('fr-FR') }} cr</span>
          </div>
          <div class="dg-solde-row">
            <span class="dg-solde-label">Solde</span>
            <span class="dg-solde-value">
              {{ currency === 'bonbons' ? soldeBonbons.toLocaleString('fr-FR') + ' 🍬' : solde.toLocaleString('fr-FR') + ' ¥' }}
            </span>
          </div>
          <div class="dg-wallet-actions">
            <button class="dg-btn-recharge" @click="showBuyIn = true" :disabled="spinning">+ Recharger</button>
            <button
              v-if="credits > 0"
              class="dg-btn-cashout"
              @click="handleCashout"
              :disabled="spinning || cashoutLoading"
            >{{ cashoutLoading ? '…' : 'Encaisser' }}</button>
            <button class="dg-btn-history" @click="openHistory">Historique</button>
          </div>
        </div>
      </div>

      <!-- Machine -->
      <div class="dg-machine-wrap">

        <!-- Flame counter + Gate Level -->
        <div class="dg-meta-row">
          <div class="dg-gate-info">
            <span class="dg-gate-icon" :class="`dg-gate-level-${gateLevel}`">⛩</span>
            <span class="dg-gate-label">Portail {{ GATE_NAMES[gateLevel] }}</span>
          </div>

          <div class="dg-flame-counter">
            <span class="dg-flame-title">Flammes</span>
            <div class="dg-flame-dots">
              <span
                v-for="i in 6"
                :key="i"
                :class="['dg-flame-dot', i <= flameCount ? 'dg-flame-dot--lit' : '']"
              >●</span>
            </div>
            <span class="dg-flame-num">{{ flameCount }}/6</span>
          </div>

          <div class="dg-fs-banner" v-if="freeSpinsRemaining > 0">
            🔥 FREE SPINS — {{ freeSpinsRemaining }} restants
          </div>
        </div>

        <!-- Cadre néon -->
        <div :class="[
          'dg-frame',
          spinning       ? 'dg-frame--spinning' : '',
          gateBlowActive ? 'dg-frame--gateblow'  : '',
          (bigWinActive && (bigWinTier === 'super' || bigWinTier === 'mega')) ? 'dg-frame--superwin' : '',
        ]">

          <!-- Grille 5 × 3 -->
          <div class="dg-reels-grid">
            <div
              v-for="(col, r) in grid"
              :key="r"
              :class="[
                'dg-reel-col',
                (spinning && r >= stoppedCols && r !== landingCol) ? 'dg-reel-col--spinning' : '',
                (r === landingCol) ? 'dg-reel-col--landing' : '',
                excitedReels ? 'dg-reel-col--excited' : '',
              ]"
            >
              <div
                v-for="(sym, row) in col"
                :key="row"
                :class="[
                  'dg-cell',
                  sym === 'FLAME' ? 'dg-cell--flame'   : '',
                  sym === 'SKULL' ? 'dg-cell--skull'   : '',
                  sym === 'DEMON' ? 'dg-cell--demon'   : '',
                  isHeld(r, row) ? 'dg-cell--held'    : '',
                  isWinCell(r, row) ? 'dg-cell--win'  : '',
                ]"
              >
                <!-- Symbole -->
                <img v-if="symImages[sym]" :src="symImages[sym]" class="dg-sym-img" :alt="sym" />
                <span v-else class="dg-sym-emoji">{{ SYM_EMOJI[sym] ?? sym }}</span>
                <span class="dg-sym-name">{{ symNames[sym] || SYM_NAMES[sym] || sym }}</span>

                <!-- Multiplicateur si tenu -->
                <span v-if="isHeld(r, row)" class="dg-held-mult">
                  ×{{ getHeldMult(r, row) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Gate Blow overlay -->
          <Transition name="dg-gateblow">
            <div v-if="gateBlowActive" class="dg-gateblow-overlay">
              <div class="dg-gateblow-text">GATE BLOW !</div>
              <div class="dg-gateblow-level">Portail {{ GATE_NAMES[gateLevel] }}</div>
            </div>
          </Transition>

          <!-- Gate Blow / Gate Break overlays uniquement -->

        </div>

        <!-- Banner big win — sous les rouleaux -->
        <Transition name="dg-bigwin">
          <div v-if="bigWinActive" :class="['dg-bigwin-banner', `dg-bigwin-banner--${bigWinTier}`]">
            <span class="dg-bigwin-label" :style="{ color: WIN_TIERS[bigWinTier]?.color }">
              {{ WIN_TIERS[bigWinTier]?.label }}
            </span>
            <span class="dg-bigwin-amount">{{ bigWinAmount.toLocaleString('fr-FR') }} cr</span>
          </div>
        </Transition>

        <!-- Gains et erreur -->
        <div class="dg-result-row" v-if="lastGain > 0 && !spinning">
          <span class="dg-gain-label">Gain</span>
          <span class="dg-gain-value">+{{ lastGain.toLocaleString('fr-FR') }} cr</span>
        </div>
        <div class="dg-error" v-if="error">{{ error }}</div>

        <!-- Contrôles -->
        <div class="dg-controls">
          <!-- Mise -->
          <div class="dg-mise-group">
            <button class="dg-btn-mise" @click="decreaseMise" :disabled="spinning">−</button>
            <div class="dg-mise-display">
              <span class="dg-mise-label">Mise</span>
              <span class="dg-mise-value">{{ mise.toLocaleString('fr-FR') }} cr</span>
            </div>
            <button class="dg-btn-mise" @click="increaseMise" :disabled="spinning">+</button>
          </div>

          <!-- Gain centre -->
          <div class="dg-gain-center">
            <span class="dg-gain-center-label">Gains</span>
            <span class="dg-gain-center-value">
              {{ lastGain > 0 ? '+' + lastGain.toLocaleString('fr-FR') + ' cr' : '—' }}
            </span>
          </div>

          <!-- Boutons SPIN + AUTO -->
          <div class="dg-spin-group">
            <button
              class="dg-btn-spin"
              @click="handleSpin"
              :disabled="busy || autoSpin"
            >
              <img
                src="/favicon.png"
                alt="spin"
                :class="['dg-spin-icon', spinning ? 'dg-spin-icon--spinning' : '']"
              />
              <span>{{ busy ? 'EN JEU…' : freeSpinsRemaining > 0 ? 'FREE SPIN' : 'SPIN' }}</span>
            </button>
            <button
              :class="['dg-btn-auto', autoSpin ? 'dg-btn-auto--on' : '']"
              @click="toggleAutoSpin"
              :disabled="busy && !autoSpin"
            >
              <span>{{ autoSpin ? '■ STOP' : '▶▶ AUTO' }}</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  </div>

  <!-- Modal historique -->
  <Transition name="dg-modal">
    <div v-if="showHistory" class="dg-modal-overlay" @click.self="showHistory = false">
      <div class="dg-modal-box dg-history-box">
        <h2 class="dg-modal-title">Historique</h2>

        <div v-if="historyLoading" class="dg-history-loading">Chargement…</div>

        <template v-else>
          <!-- Parties -->
          <div class="dg-history-section">
            <h3 class="dg-history-section-title">Parties</h3>
            <div v-if="historyRounds.length === 0" class="dg-history-empty">Aucune partie enregistrée.</div>
            <div v-else class="dg-history-table">
              <div class="dg-history-header">
                <span>Date</span>
                <span>Mise</span>
                <span>Résultat net</span>
              </div>
              <div
                v-for="r in historyRounds"
                :key="r.created_at + r.mise"
                :class="['dg-history-row', r.gain_net > 0 ? 'dg-history-row--win' : r.gain_net < 0 ? 'dg-history-row--lose' : '']"
              >
                <span class="dg-history-date">{{ formatDate(r.created_at) }}</span>
                <span class="dg-history-mise">{{ (r.mise / 10).toLocaleString('fr-FR') }} cr</span>
                <span class="dg-history-net">
                  {{ r.gain_net >= 0 ? '+' : '' }}{{ (r.gain_net / 10).toLocaleString('fr-FR') }} cr
                </span>
              </div>
            </div>
          </div>

          <!-- Opérations crédits -->
          <div class="dg-history-section">
            <h3 class="dg-history-section-title">Crédits</h3>
            <div v-if="historyCredits.length === 0" class="dg-history-empty">Aucune opération.</div>
            <div v-else class="dg-history-table">
              <div class="dg-history-header dg-history-header--4col">
                <span>Date</span>
                <span>Type</span>
                <span>Crédits</span>
                <span>¥</span>
              </div>
              <div
                v-for="c in historyCredits"
                :key="c.created_at + c.type"
                :class="['dg-history-row', c.type === 'buy' ? 'dg-history-row--buy' : 'dg-history-row--cashout']"
              >
                <span class="dg-history-date">{{ formatDate(c.created_at) }}</span>
                <span class="dg-history-type">{{ c.type === 'buy' ? 'Achat' : 'Encaissement' }}</span>
                <span class="dg-history-credits">
                  {{ c.type === 'buy' ? '+' : '-' }}{{ c.credits.toLocaleString('fr-FR') }} cr
                </span>
                <span class="dg-history-yen">
                  {{ c.type === 'buy' ? '-' : '+' }}{{ c.montant_yen.toLocaleString('fr-FR') }} ¥
                </span>
              </div>
            </div>
          </div>
        </template>

        <button class="dg-modal-close" @click="showHistory = false">Fermer</button>
      </div>
    </div>
  </Transition>

  <!-- Modal buy-in -->
  <Transition name="dg-modal">
    <div v-if="showBuyIn" class="dg-modal-overlay" @click.self="showBuyIn = false">
      <div class="dg-modal-box">
        <h2 class="dg-modal-title">Recharger des crédits</h2>
        <p class="dg-modal-sub">
          1 crédit = 10 {{ currency === 'bonbons' ? '🍬' : '¥' }} ·
          Solde : {{ currency === 'bonbons' ? soldeBonbons.toLocaleString('fr-FR') + ' 🍬' : solde.toLocaleString('fr-FR') + ' ¥' }}
        </p>

        <div class="dg-buyin-options">
          <button
            v-for="opt in [{ cr: 1000, yen: 10000 }, { cr: 5000, yen: 50000 }, { cr: 10000, yen: 100000 }]"
            :key="opt.cr"
            class="dg-buyin-btn"
            :disabled="buyInLoading || (currency === 'bonbons' ? soldeBonbons : solde) < opt.yen"
            @click="handleBuyIn(opt.yen)"
          >
            <span class="dg-buyin-cr">{{ opt.cr.toLocaleString('fr-FR') }} cr</span>
            <span class="dg-buyin-yen">{{ opt.yen.toLocaleString('fr-FR') }} ¥</span>
          </button>
        </div>

        <p v-if="error" class="dg-modal-error">{{ error }}</p>
        <button class="dg-modal-close" @click="showBuyIn = false">Annuler</button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppNavbar from './AppNavbar.vue'
import { demonsGateSpin, demonsGateRespin, demonsGateGetState, getDgSymbols, demonsGateBuyCredits, demonsGateCashout, demonsGateHistory, SERVER_URL, getCasinoGames } from '../api.js'
import {
  resumeAudio,
  playReelSpin,
  playReelStop,
  playFlameCollect,
  playGateBlow,
  playGateBreak,
  playWin,
  playBigWin,
  playMegaWin,
  playSuperWin,
  playFreeSpins,
} from '../demonsGate-audio.js'

// ── Constantes ────────────────────────────────────────────────────────────────

const SYM_EMOJI = {
  DEMON:  '👿',
  KNIGHT: '⚔️',
  MAGE:   '🔮',
  MINION: '👹',
  LOW1:   '💀',
  LOW2:   '🦴',
  LOW3:   '🩸',
  FLAME:  '🔥',
  SKULL:  '💎',
  WILD:   '⭐',
}

const SYM_NAMES = {
  DEMON:  'Démon',
  KNIGHT: 'Chevalier',
  MAGE:   'Mage',
  MINION: 'Sbire',
  LOW1:   'Crâne',
  LOW2:   'Os',
  LOW3:   'Sang',
  FLAME:  'Flamme',
  SKULL:  'Scatter',
  WILD:   'Wild',
}

const GATE_NAMES = {
  1: 'de Fer',
  2: 'de Pierre',
  3: 'd\'Obsidienne',
}

const MISE_STEPS = [50, 100, 200, 500, 1000]

// ── Refs ──────────────────────────────────────────────────────────────────────

const symImages = ref({})   // sym → url absolue
const symNames  = ref({})   // sym → nom custom

async function loadSymbols() {
  try {
    const data = await getDgSymbols()
    Object.entries(data).forEach(([sym, { url, name }]) => {
      if (url) symImages.value[sym] = SERVER_URL + url
      if (name) symNames.value[sym] = name
    })
  } catch {}
}

const grid            = ref(Array.from({ length: 5 }, () => Array(3).fill('LOW1')))
const spinning        = ref(false)
const stoppedCols     = ref(5)
const landingCol      = ref(-1)
const flameCount      = ref(0)
const gateLevel       = ref(1)
const heldPositions   = ref([])   // [{reel, row, multiplier}]
const gateBlowActive  = ref(false)
const freeSpinsRemaining = ref(0)
const mise            = ref(100)
const lastGain        = ref(0)
const solde           = ref(0)
const soldeBonbons    = ref(0)
const currency        = ref('yens')
const credits         = ref(0)
const busy            = ref(false)   // true pendant toute la séquence spin (incl. gate blow, big win)
const autoSpin        = ref(false)
const showBuyIn       = ref(false)
const showHistory     = ref(false)
const historyRounds   = ref([])
const historyCredits  = ref([])
const historyLoading  = ref(false)
const buyInLoading    = ref(false)
const cashoutLoading  = ref(false)
const particles       = ref([])
const shaking         = ref(false)
const bigWinActive    = ref(false)
const bigWinTier      = ref('')   // 'big' | 'mega' | 'super'
const bigWinAmount    = ref(0)
const excitedReels    = ref(false)
const winCells        = ref([])   // [{reel, row}]
const error           = ref('')

let particleId = 0

const WIN_TIERS = {
  win:   { label: 'VICTOIRE !',   color: '#ffd700' },
  big:   { label: 'BIG WIN !',    color: '#ff9020' },
  mega:  { label: 'MEGA WIN !!',  color: '#ff4040' },
  super: { label: 'SUPER WIN !!!',color: '#c040ff' },
}

function getWinTier(totalWin, mise) {
  const r = totalWin / mise
  if (r >= 50) return 'super'
  if (r >= 20) return 'mega'
  if (r >= 5)  return 'big'
  return 'win'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isHeld(r, row) {
  return heldPositions.value.some(h => h.reel === r && h.row === row)
}
function getHeldMult(r, row) {
  const h = heldPositions.value.find(h => h.reel === r && h.row === row)
  return h?.multiplier ?? 1
}
function isWinCell(r, row) {
  return winCells.value.some(w => w.reel === r && w.row === row)
}

function increaseMise() {
  const idx = MISE_STEPS.findIndex(s => s > mise.value)
  if (idx !== -1) mise.value = MISE_STEPS[idx]
}
function decreaseMise() {
  const idx = [...MISE_STEPS].reverse().findIndex(s => s < mise.value)
  if (idx !== -1) mise.value = [...MISE_STEPS].reverse()[idx]
}

// ── Particle configs ─────────────────────────────────────────────────────────

const PTCL_COLORS = {
  fire:  ['#ff2000', '#ff6020', '#ff9040', '#ffb060', '#fff0c0'],
  win:   ['#ffd700', '#ffaa20', '#ff8010', '#fff', '#ffcc00'],
  big:   ['#ffd700', '#ff9020', '#ff4040', '#fff', '#ff6020', '#ffcc00'],
  mega:  ['#ffd700', '#ff9020', '#ff2020', '#fff', '#ff6020', '#ff40ff', '#40ffff'],
  super: ['#ffd700', '#ff00ff', '#00ffff', '#ff4040', '#fff', '#c040ff', '#ffaa20'],
}
const PTCL_SHAPES = ['circle', 'diamond', 'square', 'star']
const PTCL_COUNTS = { fire: 20, win: 30, big: 55, mega: 85, super: 120 }

function spawnParticles(tier = 'fire') {
  const colors = PTCL_COLORS[tier] || PTCL_COLORS.fire
  const count  = PTCL_COUNTS[tier] || 20

  // Multi-burst : particules depuis plusieurs origines
  const origins = tier === 'super' || tier === 'mega'
    ? [25, 50, 75]        // 3 origines
    : tier === 'big'
    ? [35, 65]            // 2 origines
    : [50]                // 1 origine centrale

  const newP = []
  const perOrigin = Math.ceil(count / origins.length)

  for (const ox of origins) {
    for (let n = 0; n < perOrigin; n++) {
      const id    = particleId++
      const color = colors[Math.floor(Math.random() * colors.length)]
      const shape = PTCL_SHAPES[Math.floor(Math.random() * PTCL_SHAPES.length)]
      const sz    = 6 + Math.random() * (tier === 'super' ? 20 : tier === 'mega' ? 16 : 12)
      const tx    = (Math.random() - 0.5) * (tier === 'super' ? 700 : tier === 'mega' ? 500 : 320)
      const ty    = -(80 + Math.random() * (tier === 'super' ? 400 : tier === 'mega' ? 300 : 200))
      const dur   = 0.7 + Math.random() * (tier === 'super' ? 1.4 : tier === 'mega' ? 1.1 : 0.8)
      const delay = Math.random() * (tier === 'super' ? 0.5 : 0.25)
      const rot   = Math.floor(Math.random() * 1080 - 540)
      newP.push({
        id,
        shape,
        style: {
          left: `${ox + (Math.random() - 0.5) * 15}vw`,
          top:  `${35 + Math.random() * 25}vh`,
          width:  `${sz}px`,
          height: `${sz}px`,
          '--color': color,
          '--glow': `${sz * 0.6}px`,
          '--tx': `${tx}px`,
          '--ty': `${ty}px`,
          '--rot': `${rot}deg`,
          animation: `dg-ptcl-fly ${dur.toFixed(2)}s ${delay.toFixed(2)}s ease-out forwards`,
        },
      })
    }
  }

  particles.value = [...particles.value, ...newP]
  const maxDur = 0.5 + (tier === 'super' ? 2.2 : tier === 'mega' ? 1.8 : 1.3) * 1000
  setTimeout(() => {
    const ids = new Set(newP.map(p => p.id))
    particles.value = particles.value.filter(p => !ids.has(p.id))
  }, maxDur)
}

function triggerShake(duration = 600) {
  shaking.value = true
  setTimeout(() => { shaking.value = false }, duration)
}

// ── Buy-in / Cashout ──────────────────────────────────────────────────────────

async function openHistory() {
  showHistory.value = true
  historyLoading.value = true
  try {
    const data = await demonsGateHistory(30)
    historyRounds.value  = data.rounds
    historyCredits.value = data.credits
  } catch {}
  historyLoading.value = false
}

function formatDate(dt) {
  const d = new Date(dt)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
    + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

async function handleBuyIn(montantYen) {
  buyInLoading.value = true
  error.value = ''
  try {
    const result = await demonsGateBuyCredits(montantYen, currency.value)
    credits.value = result.credits
    if (currency.value === 'bonbons') {
      if (result.bonbons != null) soldeBonbons.value = result.bonbons
    } else {
      if (result.solde != null) solde.value = result.solde
    }
    showBuyIn.value = false
  } catch (e) {
    error.value = e.message
  } finally {
    buyInLoading.value = false
  }
}

async function handleCashout() {
  cashoutLoading.value = true
  error.value = ''
  try {
    const result = await demonsGateCashout(currency.value)
    credits.value = 0
    if (currency.value === 'bonbons') {
      if (result.bonbons != null) soldeBonbons.value = result.bonbons
    } else {
      if (result.solde != null) solde.value = result.solde
    }
  } catch (e) {
    error.value = e.message
  } finally {
    cashoutLoading.value = false
  }
}

// ── Animation de spin ─────────────────────────────────────────────────────────

async function animateSpin(finalGrid) {
  stoppedCols.value = 0
  landingCol.value  = -1
  spinning.value    = true
  playReelSpin()

  // Premier arrêt après 700ms, puis 220ms d'intervalle
  for (let r = 0; r < 5; r++) {
    await new Promise(resolve => setTimeout(resolve, r === 0 ? 700 : 220))

    // Afficher la colonne finale + déclencher landing
    grid.value       = grid.value.map((col, idx) => idx === r ? finalGrid[r] : col)
    landingCol.value = r
    playReelStop(r)

    // Attendre la durée de l'animation landing (300ms)
    await new Promise(resolve => setTimeout(resolve, 300))
    stoppedCols.value = r + 1
    landingCol.value  = -1
  }

  await new Promise(resolve => setTimeout(resolve, 80))
  spinning.value = false
}

// ── Afficher les wins ─────────────────────────────────────────────────────────

function showWins(wins, totalWin, currentMise) {
  winCells.value = []
  if (!wins || wins.length === 0) return

  const cells = []
  for (const win of wins) {
    for (let r = 0; r < win.reels; r++) {
      for (let row = 0; row < 3; row++) cells.push({ reel: r, row })
    }
  }
  winCells.value = cells

  const tier = getWinTier(totalWin, currentMise)

  // Son
  if      (tier === 'super') playSuperWin()
  else if (tier === 'mega')  playMegaWin()
  else if (tier === 'big')   playBigWin()
  else                       playWin(totalWin, currentMise)

  // Particules
  spawnParticles(tier === 'win' ? 'win' : tier)

  // Banner big+
  if (tier !== 'win') {
    bigWinTier.value   = tier
    bigWinAmount.value = totalWin
    bigWinActive.value = true
    const dur = tier === 'super' ? 5000 : tier === 'mega' ? 4000 : 3000

    // Rouleaux excités pour super/mega
    if (tier === 'super' || tier === 'mega') {
      excitedReels.value = true
      setTimeout(() => { excitedReels.value = false }, dur - 400)
    }

    setTimeout(() => { bigWinActive.value = false }, dur)
  }

  setTimeout(() => { winCells.value = [] }, 2000)
}

// ── Spin principal ────────────────────────────────────────────────────────────

async function handleSpin() {
  if (busy.value) return
  busy.value = true
  resumeAudio()
  error.value = ''
  lastGain.value = 0

  try {
    const result = await demonsGateSpin(mise.value)
    if (result.solde != null) solde.value = result.solde
    if (result.bonbons != null) soldeBonbons.value = result.bonbons
    credits.value = result.credits ?? credits.value
    flameCount.value = result.flameCount
    gateLevel.value = result.gateLevel
    freeSpinsRemaining.value = result.freeSpinsRemaining

    await animateSpin(result.grid)

    // Flammes collectées
    if (result.flamesLanded && result.flamesLanded.length > 0) {
      for (let i = 0; i < result.flamesLanded.length; i++) {
        setTimeout(() => playFlameCollect(), i * 120)
      }
    }

    // Gains réguliers
    if (result.totalWin > 0) {
      lastGain.value = result.totalWin
      showWins(result.wins, result.totalWin, mise.value)
      // Attendre la fin du banner big win avant de continuer (important pour l'auto-spin)
      if (bigWinActive.value) {
        const dur = bigWinTier.value === 'super' ? 5000 : bigWinTier.value === 'mega' ? 4000 : 3000
        await new Promise(r => setTimeout(r, dur + 200))
      }
    }

    // Free spins déclenchés
    if (result.freeSpinsTriggered) {
      playFreeSpins()
      spawnParticles('big')
    }

    // Gate Blow → respin chain (séquence complète bloquante)
    if (result.gateBlowTriggered) {
      await handleGateBlow()
    }

  } catch (e) {
    autoSpin.value = false   // stopper l'auto-spin sur erreur
    if (e.message && e.message.includes('Crédits insuffisants')) {
      showBuyIn.value = true
    } else {
      error.value = e.message
    }
    spinning.value = false
  } finally {
    busy.value = false
  }
}

// ── Auto-spin ─────────────────────────────────────────────────────────────────

async function runAutoSpin() {
  while (autoSpin.value) {
    if (credits.value < mise.value) {
      autoSpin.value = false
      showBuyIn.value = true
      break
    }
    await handleSpin()
    if (!autoSpin.value) break
    // Pause entre chaque spin
    await new Promise(r => setTimeout(r, 350))
  }
}

function toggleAutoSpin() {
  if (autoSpin.value) {
    autoSpin.value = false
  } else {
    autoSpin.value = true
    runAutoSpin()
  }
}

// ── Gate Blow + respin chain ──────────────────────────────────────────────────

async function handleGateBlow() {
  gateBlowActive.value = true
  playGateBlow()
  triggerShake(800)
  spawnParticles('fire')

  await new Promise(resolve => setTimeout(resolve, 1200))

  // Récupérer l'état de session pour les held positions
  const state = await demonsGateGetState()
  heldPositions.value = state.respin_held || []

  await new Promise(resolve => setTimeout(resolve, 400))
  gateBlowActive.value = false

  // Jouer le respin (et potentiellement chaîner)
  let chainCount = 0
  let chainContinues = true

  while (chainContinues && chainCount < 3) {
    playGateBreak()
    const respinResult = await demonsGateRespin()

    await animateSpin(respinResult.grid)

    if (respinResult.solde != null) solde.value = respinResult.solde
    if (respinResult.bonbons != null) soldeBonbons.value = respinResult.bonbons
    credits.value = respinResult.credits ?? credits.value
    flameCount.value = respinResult.flameCount
    gateLevel.value = respinResult.gateLevel
    heldPositions.value = respinResult.heldPositions || []

    if (respinResult.flamesLanded && respinResult.flamesLanded.length > 0) {
      for (let i = 0; i < respinResult.flamesLanded.length; i++) {
        setTimeout(() => playFlameCollect(), i * 120)
      }
    }

    if (respinResult.totalWin > 0) {
      lastGain.value = (lastGain.value || 0) + respinResult.totalWin
      showWins(respinResult.wins, respinResult.totalWin, mise.value)
    }

    chainContinues = respinResult.chainContinues
    chainCount++

    if (chainContinues) {
      gateBlowActive.value = true
      playGateBlow()
      triggerShake(600)
      spawnParticles('fire')
      await new Promise(resolve => setTimeout(resolve, 900))
      gateBlowActive.value = false
      await new Promise(resolve => setTimeout(resolve, 300))
    }
  }

  // Fin de chaîne : nettoyer les held
  heldPositions.value = []
}

// ── Init ──────────────────────────────────────────────────────────────────────

const jeuIndisponible = ref(false)

onMounted(async () => {
  try { const g = await getCasinoGames(); if (!g.demons_gate) jeuIndisponible.value = true } catch {}
  await loadSymbols()
  try {
    const state = await demonsGateGetState()
    solde.value        = state.solde
    soldeBonbons.value = state.bonbons ?? 0
    credits.value      = state.credits ?? 0
    flameCount.value = state.flame_count ?? 0
    gateLevel.value = state.gate_level ?? 1
    freeSpinsRemaining.value = state.free_spins_remaining ?? 0
    heldPositions.value = state.respin_held || []
    if (credits.value === 0) showBuyIn.value = true
  } catch {}
})
</script>

<style scoped>
.jeu-indispo { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:calc(100vh - 60px); gap:12px; text-align:center; padding:40px; }
.jeu-indispo-title { font-family:'Cinzel',serif; font-size:1.4rem; letter-spacing:0.06em; color:rgba(255,255,255,0.7); }
.jeu-indispo-sub { font-family:'Crimson Text',Georgia,serif; font-style:italic; color:rgba(255,255,255,0.3); font-size:1rem; }
.jeu-indispo-link { margin-top:16px; font-family:'Cinzel',serif; font-size:0.65rem; letter-spacing:0.15em; text-transform:uppercase; color:rgba(139,26,26,0.7); text-decoration:none; }
.jeu-indispo-link:hover { color:rgba(139,26,26,1); }

/* ── Base page ──────────────────────────────────────────────────────────────── */
.dg-page {
  min-height: 100vh;
  background: #080608;
  color: #e8d8c4;
}

.dg-page--shake {
  animation: dg-shake 0.6s ease-in-out;
}

@keyframes dg-shake {
  0%,100% { transform: translateX(0); }
  10% { transform: translateX(-8px) rotate(-0.5deg); }
  20% { transform: translateX(8px) rotate(0.5deg); }
  30% { transform: translateX(-6px) rotate(-0.3deg); }
  40% { transform: translateX(6px) rotate(0.3deg); }
  50% { transform: translateX(-4px); }
  60% { transform: translateX(4px); }
  70% { transform: translateX(-2px); }
  80% { transform: translateX(2px); }
  90% { transform: translateX(-1px); }
}

.dg-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 16px 60px;
  gap: 28px;
}

/* ── Header ──────────────────────────────────────────────────────────────────── */
.dg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 820px;
}

.dg-back {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: rgba(200,80,60,0.6);
  text-decoration: none;
}
.dg-back:hover { color: rgba(200,80,60,0.9); }

.dg-header-center {
  text-align: center;
}

.dg-label {
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: rgba(200,80,60,0.4);
  margin: 0 0 4px;
}

.dg-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: clamp(1.4rem, 3.5vw, 2.2rem);
  font-weight: 700;
  letter-spacing: 0.08em;
  margin: 0;
  color: #e8d8c4;
}

.dg-title-accent {
  color: #e84040;
  text-shadow: 0 0 18px rgba(232,64,40,0.55);
}

.dg-sub {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.85rem;
  font-style: italic;
  color: rgba(232,64,40,0.45);
  margin: 2px 0 0;
}

.dg-wallet-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.dg-currency-toggle {
  display: flex;
  gap: 3px;
  margin-bottom: 2px;
}

.dg-cur-btn {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(232,216,196,0.3);
  padding: 2px 7px;
  cursor: pointer;
  transition: all 0.12s;
  border-radius: 2px;
}
.dg-cur-btn:hover { border-color: rgba(255,255,255,0.22); color: rgba(232,216,196,0.6); }
.dg-cur-btn--active { border-color: rgba(255,200,80,0.4); color: #ffd060; background: rgba(255,200,60,0.06); }

.dg-credits-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.dg-credits-label {
  font-family: 'Cinzel', serif;
  font-size: 0.5rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(255,200,80,0.45);
}

.dg-credits-value {
  font-family: 'Cinzel', serif;
  font-size: 1.05rem;
  letter-spacing: 0.04em;
  color: #ffd060;
  text-shadow: 0 0 10px rgba(255,200,60,0.4);
}

.dg-solde-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.dg-solde-label {
  font-family: 'Cinzel', serif;
  font-size: 0.45rem;
  letter-spacing: 0.2em;
  color: rgba(255,255,255,0.18);
  text-transform: uppercase;
}

.dg-solde-value {
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  color: rgba(232,216,196,0.55);
}

.dg-wallet-actions {
  display: flex;
  gap: 6px;
  margin-top: 2px;
}

.dg-btn-recharge {
  padding: 4px 10px;
  font-family: 'Cinzel', serif;
  font-size: 0.52rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: rgba(80,20,80,0.5);
  border: 1px solid rgba(200,80,255,0.35);
  color: rgba(220,160,255,0.85);
  cursor: pointer;
  transition: background 0.15s;
}

.dg-btn-recharge:hover:not(:disabled) {
  background: rgba(120,30,140,0.65);
}

.dg-btn-recharge:disabled { opacity: 0.35; cursor: not-allowed; }

.dg-btn-cashout {
  padding: 4px 10px;
  font-family: 'Cinzel', serif;
  font-size: 0.52rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: rgba(20,60,20,0.5);
  border: 1px solid rgba(80,200,80,0.35);
  color: rgba(140,220,120,0.85);
  cursor: pointer;
  transition: background 0.15s;
}

.dg-btn-cashout:hover:not(:disabled) {
  background: rgba(30,90,30,0.65);
}

.dg-btn-cashout:disabled { opacity: 0.35; cursor: not-allowed; }

/* ── Machine wrap ────────────────────────────────────────────────────────────── */
.dg-machine-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  width: 100%;
  max-width: 820px;
}

/* ── Meta row (flames + gate) ────────────────────────────────────────────────── */
.dg-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 16px;
  background: rgba(20,8,8,0.8);
  border: 1px solid rgba(232,64,40,0.15);
  gap: 16px;
}

.dg-gate-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dg-gate-icon {
  font-size: 1.4rem;
  filter: drop-shadow(0 0 6px rgba(232,64,40,0.5));
  transition: color 0.3s;
}

.dg-gate-level-1 { color: #aaa; }
.dg-gate-level-2 { color: #c87840; }
.dg-gate-level-3 { color: #7040a0; text-shadow: 0 0 12px rgba(112,64,160,0.7); }

.dg-gate-label {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: rgba(232,180,100,0.7);
}

.dg-flame-counter {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dg-flame-title {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  color: rgba(255,255,255,0.3);
  text-transform: uppercase;
}

.dg-flame-dots {
  display: flex;
  gap: 4px;
}

.dg-flame-dot {
  font-size: 0.9rem;
  color: rgba(255,255,255,0.12);
  transition: color 0.2s, text-shadow 0.2s;
}

.dg-flame-dot--lit {
  color: #ff6020;
  text-shadow: 0 0 10px rgba(255,96,32,0.9);
  animation: dg-flame-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes dg-flame-pop {
  0%   { transform: scale(1); }
  50%  { transform: scale(2); }
  100% { transform: scale(1); }
}

.dg-flame-num {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  color: rgba(255,96,32,0.6);
}

.dg-fs-banner {
  font-family: 'Cinzel', serif;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  color: #ff9020;
  text-shadow: 0 0 12px rgba(255,144,32,0.6);
  animation: dg-pulse 1.4s ease-in-out infinite;
}

@keyframes dg-pulse {
  0%,100% { opacity: 1; }
  50%      { opacity: 0.55; }
}

/* ── Cadre néon ──────────────────────────────────────────────────────────────── */
.dg-frame {
  position: relative;
  background: #0d0508;
  border: 2px solid rgba(120,20,20,0.5);
  box-shadow:
    0 0 0 1px rgba(232,64,40,0.08),
    inset 0 0 40px rgba(80,10,10,0.5),
    0 0 60px rgba(80,10,10,0.25);
  padding: 12px;
  width: 100%;
  overflow: hidden;
  transition: box-shadow 0.3s;
}

.dg-frame--spinning {
  box-shadow:
    0 0 0 1px rgba(232,64,40,0.18),
    inset 0 0 40px rgba(80,10,10,0.5),
    0 0 80px rgba(160,30,20,0.3);
}

.dg-frame--gateblow {
  box-shadow:
    0 0 0 3px rgba(255,96,32,0.6),
    inset 0 0 60px rgba(160,40,10,0.7),
    0 0 100px rgba(255,80,20,0.5);
  animation: dg-gateblow-border 0.3s ease-in-out infinite alternate;
}

@keyframes dg-gateblow-border {
  from { box-shadow: 0 0 0 3px rgba(255,96,32,0.5), inset 0 0 60px rgba(160,40,10,0.6), 0 0 80px rgba(255,80,20,0.4); }
  to   { box-shadow: 0 0 0 5px rgba(255,140,60,0.8), inset 0 0 80px rgba(200,60,20,0.8), 0 0 140px rgba(255,100,40,0.7); }
}

/* ── Grille 5×3 ──────────────────────────────────────────────────────────────── */
.dg-reels-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.dg-reel-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Colonnes en rotation : défilement rapide flou */
.dg-reel-col--spinning .dg-cell {
  animation: dg-cell-scroll 0.13s linear infinite;
  pointer-events: none;
}

@keyframes dg-cell-scroll {
  0%   { transform: translateY(-16px); filter: blur(6px); opacity: 0.6; }
  100% { transform: translateY(16px);  filter: blur(6px); opacity: 0.6; }
}

/* Colonne en train de s'arrêter : snap avec rebond */
.dg-reel-col--landing .dg-cell {
  animation: dg-cell-snap 0.32s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
}

@keyframes dg-cell-snap {
  0%   { transform: translateY(-22px); filter: blur(5px); opacity: 0.5; }
  55%  { transform: translateY(8px);   filter: blur(0);   opacity: 1; }
  75%  { transform: translateY(-3px); }
  100% { transform: translateY(0);     filter: blur(0);   opacity: 1; }
}

/* ── Cellule ─────────────────────────────────────────────────────────────────── */
.dg-cell {
  position: relative;
  width: 110px;
  height: 110px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #12050a;
  border: 1px solid rgba(255,255,255,0.05);
  gap: 4px;
  transition: background 0.15s, border-color 0.15s;
  overflow: hidden;
}

.dg-cell--flame {
  background: rgba(100,20,5,0.6);
  border-color: rgba(255,80,20,0.4);
  box-shadow: inset 0 0 16px rgba(255,80,20,0.2);
}

.dg-cell--skull {
  background: rgba(60,20,80,0.5);
  border-color: rgba(160,80,200,0.35);
}

.dg-cell--demon {
  background: rgba(80,0,0,0.7);
  border-color: rgba(255,40,40,0.5);
  box-shadow: inset 0 0 20px rgba(200,20,20,0.25), 0 0 10px rgba(200,20,20,0.2);
}

.dg-cell--held {
  background: rgba(120,40,5,0.7);
  border-color: rgba(255,120,40,0.7);
  box-shadow: 0 0 16px rgba(255,100,30,0.5), inset 0 0 20px rgba(180,60,10,0.4);
  animation: dg-held-pulse 1.2s ease-in-out infinite;
}

@keyframes dg-held-pulse {
  0%,100% { box-shadow: 0 0 12px rgba(255,100,30,0.4), inset 0 0 16px rgba(180,60,10,0.3); }
  50%     { box-shadow: 0 0 24px rgba(255,140,60,0.7), inset 0 0 28px rgba(200,80,20,0.6); }
}

.dg-cell--win {
  background: rgba(40,60,10,0.7);
  border-color: rgba(140,220,60,0.5);
  box-shadow: 0 0 12px rgba(120,200,40,0.4);
  animation: dg-win-flash 0.5s ease-in-out 3;
}

@keyframes dg-win-flash {
  0%,100% { background: rgba(40,60,10,0.7); }
  50%     { background: rgba(80,120,20,0.85); }
}

.dg-sym-img {
  width: 60px;
  height: 60px;
  object-fit: contain;
  filter: drop-shadow(0 2px 6px rgba(0,0,0,0.7));
}

.dg-sym-emoji {
  font-size: 2.2rem;
  line-height: 1;
  filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6));
}

.dg-sym-name {
  font-family: 'Cinzel', serif;
  font-size: 0.42rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.3);
}

.dg-held-mult {
  position: absolute;
  bottom: 4px;
  right: 6px;
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  font-weight: 700;
  color: #ff9040;
  text-shadow: 0 0 8px rgba(255,140,40,0.8);
}

/* ── Gate Blow overlay ───────────────────────────────────────────────────────── */
.dg-gateblow-overlay {
  position: absolute;
  inset: 0;
  background: rgba(100,20,5,0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  z-index: 10;
}

.dg-gateblow-text {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: clamp(1.8rem, 5vw, 3rem);
  font-weight: 700;
  color: #ff6020;
  text-shadow: 0 0 30px rgba(255,96,32,0.9), 0 0 60px rgba(255,60,20,0.5);
  animation: dg-gateblow-text-pulse 0.4s ease-in-out infinite alternate;
}

@keyframes dg-gateblow-text-pulse {
  from { transform: scale(1);    text-shadow: 0 0 20px rgba(255,96,32,0.8); }
  to   { transform: scale(1.06); text-shadow: 0 0 40px rgba(255,140,60,1); }
}

.dg-gateblow-level {
  font-family: 'Cinzel', serif;
  font-size: 0.9rem;
  letter-spacing: 0.2em;
  color: rgba(255,200,100,0.8);
  text-transform: uppercase;
}

.dg-gateblow-enter-active { transition: opacity 0.15s, transform 0.22s cubic-bezier(0.34, 1.4, 0.64, 1); }
.dg-gateblow-leave-active { transition: opacity 0.3s, transform 0.3s ease-in; }
.dg-gateblow-enter-from  { opacity: 0; transform: scale(0.82); }
.dg-gateblow-leave-to    { opacity: 0; transform: scale(1.08); }

/* ── Résultat ────────────────────────────────────────────────────────────────── */
.dg-result-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.dg-gain-label {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.15em;
  color: rgba(255,255,255,0.25);
  text-transform: uppercase;
}

.dg-gain-value {
  font-family: 'Cinzel', serif;
  font-size: 1.1rem;
  color: #7ed44a;
  text-shadow: 0 0 10px rgba(126,212,74,0.5);
}

.dg-error {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  color: rgba(255,80,80,0.75);
  font-size: 0.9rem;
}

/* ── Contrôles ───────────────────────────────────────────────────────────────── */
.dg-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 16px;
  padding: 14px 16px;
  background: rgba(12,4,8,0.9);
  border: 1px solid rgba(120,20,20,0.3);
}

.dg-mise-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dg-btn-mise {
  width: 34px;
  height: 34px;
  background: rgba(80,10,10,0.6);
  border: 1px solid rgba(180,40,40,0.3);
  color: #e8d8c4;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.dg-btn-mise:hover:not(:disabled) {
  background: rgba(140,20,20,0.7);
}

.dg-btn-mise:disabled { opacity: 0.4; cursor: not-allowed; }

.dg-mise-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.dg-mise-label {
  font-family: 'Cinzel', serif;
  font-size: 0.5rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.25);
}

.dg-mise-value {
  font-family: 'Cinzel', serif;
  font-size: 0.9rem;
  color: #e8d8c4;
  min-width: 80px;
  text-align: center;
}

.dg-gain-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  flex: 1;
}

.dg-gain-center-label {
  font-family: 'Cinzel', serif;
  font-size: 0.5rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.2);
}

.dg-gain-center-value {
  font-family: 'Cinzel', serif;
  font-size: 1rem;
  color: #7ed44a;
}

/* ── Boutons SPIN + AUTO ─────────────────────────────────────────────────────── */
.dg-spin-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.dg-btn-spin {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 28px;
  background: linear-gradient(135deg, #6b0a0a 0%, #a01818 100%);
  border: 1px solid rgba(255,60,40,0.35);
  color: #e8d8c4;
  font-family: 'Cinzel', serif;
  font-size: 0.8rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
  box-shadow: 0 2px 18px rgba(180,20,20,0.35);
  flex-shrink: 0;
}

.dg-btn-spin:hover:not(:disabled) {
  background: linear-gradient(135deg, #8b1212 0%, #c02020 100%);
  box-shadow: 0 4px 28px rgba(200,30,30,0.5);
}

.dg-btn-spin:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dg-spin-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
  filter: drop-shadow(0 0 4px rgba(255,80,40,0.5));
}

.dg-spin-icon--spinning {
  animation: dg-icon-spin 0.5s linear infinite;
}

@keyframes dg-icon-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.dg-btn-auto {
  padding: 7px 16px;
  background: rgba(20,20,60,0.6);
  border: 1px solid rgba(100,120,255,0.35);
  color: rgba(160,180,255,0.75);
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.dg-btn-auto:hover:not(:disabled) {
  background: rgba(40,40,100,0.7);
  border-color: rgba(140,160,255,0.55);
}

.dg-btn-auto--on {
  background: rgba(80,10,10,0.7);
  border-color: rgba(255,60,60,0.6);
  color: rgba(255,120,100,0.9);
  animation: dg-auto-pulse 1.2s ease-in-out infinite;
}

@keyframes dg-auto-pulse {
  0%,100% { box-shadow: 0 0 6px rgba(255,60,60,0.2); }
  50%     { box-shadow: 0 0 18px rgba(255,60,60,0.5); }
}

.dg-btn-auto:disabled { opacity: 0.35; cursor: not-allowed; }

/* ── Big win banner (big) ────────────────────────────────────────────────────── */
.dg-bigwin-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 18px 48px;
  background: linear-gradient(135deg, rgba(10,4,16,0.97), rgba(40,10,40,0.97));
  border: 2px solid rgba(255,140,40,0.5);
  box-shadow: 0 0 60px rgba(255,80,20,0.5), inset 0 0 40px rgba(120,20,20,0.5);
  animation: dg-bigwin-glow 0.8s ease-in-out infinite alternate;
}


.dg-bigwin-banner--mega {
  border-color: rgba(255,60,60,0.8);
  box-shadow: 0 0 80px rgba(255,20,20,0.7), inset 0 0 60px rgba(180,0,0,0.5);
  background: linear-gradient(135deg, rgba(40,0,0,0.97), rgba(80,10,10,0.97));
}

.dg-bigwin-banner--super {
  border-color: rgba(200,80,255,0.9);
  box-shadow: 0 0 120px rgba(180,40,255,0.8), 0 0 40px rgba(255,100,255,0.4), inset 0 0 60px rgba(80,0,160,0.6);
  background: linear-gradient(135deg, rgba(20,0,40,0.98), rgba(60,0,80,0.98));
}

@keyframes dg-bigwin-glow {
  from { filter: brightness(1); }
  to   { filter: brightness(1.2) saturate(1.3); }
}


.dg-bigwin-label {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: clamp(1.8rem, 5vw, 3rem);
  font-weight: 700;
  text-shadow: 0 0 30px currentColor, 0 0 60px currentColor;
  letter-spacing: 0.06em;
  animation: dg-bigwin-text 0.5s ease-in-out infinite alternate;
}

@keyframes dg-bigwin-text {
  from { transform: scale(1);    letter-spacing: 0.06em; }
  to   { transform: scale(1.06); letter-spacing: 0.12em; }
}

.dg-bigwin-amount {
  font-family: 'Cinzel', serif;
  font-size: clamp(1.1rem, 3vw, 1.8rem);
  color: #ffe0a0;
  text-shadow: 0 0 12px rgba(255,220,100,0.7);
}

.dg-bigwin-enter-active { transition: opacity 0.15s, scale 0.22s cubic-bezier(0.34, 1.56, 0.64, 1); }
.dg-bigwin-leave-active { transition: opacity 0.4s, scale 0.4s ease-in; }
.dg-bigwin-enter-from  { opacity: 0; scale: 0.5; }
.dg-bigwin-leave-to    { opacity: 0; scale: 1.2; }

/* ── Frame en mode super win ──────────────────────────────────────────────────── */
.dg-frame--superwin {
  box-shadow:
    0 0 0 4px rgba(200,80,255,0.6),
    inset 0 0 80px rgba(120,0,180,0.5),
    0 0 140px rgba(180,40,255,0.5);
  animation: dg-superwin-border 0.4s ease-in-out infinite alternate;
}

@keyframes dg-superwin-border {
  from { box-shadow: 0 0 0 3px rgba(200,80,255,0.5), inset 0 0 60px rgba(100,0,160,0.4), 0 0 100px rgba(160,40,220,0.4); }
  to   { box-shadow: 0 0 0 6px rgba(255,140,255,0.9), inset 0 0 100px rgba(160,0,220,0.7), 0 0 200px rgba(200,60,255,0.8); }
}

/* ── Rouleaux excités (super/mega win) ───────────────────────────────────────── */
.dg-reel-col--excited .dg-cell {
  animation: dg-cell-excited 0.07s ease-in-out infinite alternate !important;
  filter: blur(2.5px) brightness(1.3);
}
.dg-reel-col--excited:nth-child(1) .dg-cell { animation-delay:  0ms  !important; }
.dg-reel-col--excited:nth-child(2) .dg-cell { animation-delay: 14ms  !important; }
.dg-reel-col--excited:nth-child(3) .dg-cell { animation-delay:  7ms  !important; }
.dg-reel-col--excited:nth-child(4) .dg-cell { animation-delay: 21ms  !important; }
.dg-reel-col--excited:nth-child(5) .dg-cell { animation-delay: 10ms  !important; }

@keyframes dg-cell-excited {
  0%   { transform: translateY(-10px) translateX(-2px) rotate(-1.5deg) scaleX(0.97); }
  100% { transform: translateY(10px)  translateX(2px)  rotate(1.5deg)  scaleX(1.03); }
}

/* ── Modal buy-in ────────────────────────────────────────────────────────────── */
.dg-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(4,0,8,0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dg-modal-box {
  background: linear-gradient(160deg, #100610 0%, #1a0a18 100%);
  border: 1px solid rgba(200,80,255,0.3);
  box-shadow: 0 0 60px rgba(160,40,200,0.35);
  padding: 36px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  max-width: 440px;
  width: 90%;
}

.dg-modal-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.3rem;
  font-weight: 700;
  color: #ffd060;
  text-shadow: 0 0 18px rgba(255,200,60,0.5);
  margin: 0;
  text-align: center;
}

.dg-modal-sub {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.9rem;
  color: rgba(232,216,196,0.5);
  margin: 0;
  text-align: center;
}

.dg-buyin-options {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.dg-buyin-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 16px 20px;
  background: rgba(40,8,50,0.7);
  border: 1px solid rgba(200,80,255,0.3);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
  min-width: 100px;
}

.dg-buyin-btn:hover:not(:disabled) {
  background: rgba(80,16,100,0.75);
  border-color: rgba(220,120,255,0.6);
  box-shadow: 0 0 20px rgba(180,60,220,0.35);
}

.dg-buyin-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.dg-buyin-cr {
  font-family: 'Cinzel', serif;
  font-size: 1rem;
  font-weight: 700;
  color: #ffd060;
  text-shadow: 0 0 8px rgba(255,200,60,0.5);
}

.dg-buyin-yen {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  color: rgba(232,216,196,0.45);
  letter-spacing: 0.05em;
}

.dg-modal-error {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  color: rgba(255,80,80,0.8);
  font-size: 0.9rem;
  margin: 0;
  text-align: center;
}

.dg-modal-close {
  padding: 8px 24px;
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.12);
  color: rgba(232,216,196,0.4);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.dg-modal-close:hover {
  border-color: rgba(255,255,255,0.3);
  color: rgba(232,216,196,0.7);
}

.dg-btn-history {
  padding: 4px 10px;
  font-family: 'Cinzel', serif;
  font-size: 0.52rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: rgba(20,20,50,0.5);
  border: 1px solid rgba(100,120,255,0.3);
  color: rgba(160,180,255,0.8);
  cursor: pointer;
  transition: background 0.15s;
}
.dg-btn-history:hover { background: rgba(40,40,100,0.6); }

.dg-history-box {
  max-width: 640px;
  max-height: 80vh;
  overflow-y: auto;
  gap: 14px;
}

.dg-history-loading {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  color: rgba(232,216,196,0.4);
  font-size: 0.9rem;
}

.dg-history-section { width: 100%; }

.dg-history-section-title {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,200,80,0.5);
  margin: 0 0 8px;
}

.dg-history-empty {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  color: rgba(232,216,196,0.3);
  font-size: 0.85rem;
}

.dg-history-table {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
}

.dg-history-header {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  padding: 4px 8px;
  font-family: 'Cinzel', serif;
  font-size: 0.48rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.2);
}

.dg-history-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  padding: 6px 8px;
  font-family: 'Cinzel', serif;
  font-size: 0.7rem;
  background: rgba(255,255,255,0.03);
  border-left: 2px solid transparent;
}

.dg-history-row--win  { border-left-color: rgba(100,220,60,0.6); }
.dg-history-row--lose { border-left-color: rgba(220,60,60,0.4); }
.dg-history-row--buy      { border-left-color: rgba(100,120,255,0.5); grid-template-columns: 1fr 1fr 1fr 1fr; }
.dg-history-row--cashout  { border-left-color: rgba(80,200,120,0.5); grid-template-columns: 1fr 1fr 1fr 1fr; }

.dg-history-header--4col {
  grid-template-columns: 1fr 1fr 1fr 1fr;
}

.dg-history-date  { color: rgba(232,216,196,0.35); font-size: 0.62rem; }
.dg-history-mise  { color: rgba(232,216,196,0.6); }
.dg-history-type  { color: rgba(232,216,196,0.6); }

.dg-history-net { font-weight: 600; }
.dg-history-row--win  .dg-history-net { color: #7ed44a; }
.dg-history-row--lose .dg-history-net { color: rgba(220,80,80,0.8); }

.dg-history-credits { color: rgba(180,200,255,0.8); }
.dg-history-yen     { color: rgba(255,200,80,0.7); }

.dg-modal-enter-active { transition: opacity 0.18s, scale 0.22s cubic-bezier(0.34, 1.4, 0.64, 1); }
.dg-modal-leave-active { transition: opacity 0.18s, scale 0.18s ease-in; }
.dg-modal-enter-from  { opacity: 0; scale: 0.92; }
.dg-modal-leave-to    { opacity: 0; scale: 0.96; }

/* ── Responsive ──────────────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .dg-cell { width: 62px; height: 62px; }
  .dg-sym-emoji { font-size: 1.5rem; }
  .dg-btn-spin { padding: 10px 18px; font-size: 0.7rem; }
  .dg-meta-row { flex-wrap: wrap; gap: 10px; }
  .dg-modal-box { padding: 28px 20px; }
  .dg-wallet-box { align-items: flex-start; }
}
</style>

<!-- Styles non-scoped pour Teleport (particules hors du composant) -->
<style>
.dg-particles-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  overflow: hidden;
}

.dg-ptcl {
  position: absolute;
  background: var(--color, #ffd700);
  box-shadow: 0 0 var(--glow, 8px) var(--color, #ffd700);
  opacity: 0;
  will-change: transform, opacity;
}

.dg-ptcl--circle  { border-radius: 50%; }
.dg-ptcl--square  { border-radius: 2px; }
.dg-ptcl--diamond { clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); }
.dg-ptcl--star    { clip-path: polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%); }

@keyframes dg-ptcl-fly {
  0%   { transform: translate(0,0) scale(1) rotate(0deg);                           opacity: 1; }
  80%  { opacity: 0.8; }
  100% { transform: translate(var(--tx),var(--ty)) scale(0.15) rotate(var(--rot)); opacity: 0; }
}
</style>

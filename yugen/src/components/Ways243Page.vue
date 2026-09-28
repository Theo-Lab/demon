<template>
  <!-- ── Particules (teleportées dans body) ──────────────────────────────────── -->
  <Teleport to="body">
    <div class="particles-layer" aria-hidden="true">
      <span
        v-for="p in particles"
        :key="p.id"
        class="ptcl"
        :style="p.style"
      >{{ p.icon }}</span>
    </div>
  </Teleport>

  <div :class="['page', bigWinActive ? 'page--bigwin' : '']">
    <AppNavbar />

    <div class="page-inner">

      <!-- ── En-tête ──────────────────────────────────────────────────────── -->
      <div class="page-header">
        <RouterLink to="/casino" class="back-link">← Casino</RouterLink>
        <div class="header-center">
          <p class="page-label">Casino de l'Ordre</p>
          <h1 class="page-title">Oni <span class="title-accent">243</span></h1>
          <p class="page-sub">243 Ways to Win · Rouleaux Jumeaux</p>
        </div>
        <div class="solde-box">
          <span class="solde-label">Solde</span>
          <span class="solde-value">{{ solde.toLocaleString('fr-FR') }} ¥</span>
        </div>
      </div>

      <!-- ── Machine ──────────────────────────────────────────────────────── -->
      <div class="machine-wrap">

        <!-- Cadre néon -->
        <div :class="[
          'machine-frame',
          spinning        ? 'machine-frame--spinning'  : '',
          bigWinActive    ? 'machine-frame--bigwin'     : '',
          shaking         ? 'machine-frame--shake'      : '',
          lossFlashing    ? 'machine-frame--loss'       : '',
        ]">

          <!-- Badge 243 Ways -->
          <div class="ways-badge ways-badge--left">243<br><span>WAYS</span></div>
          <div class="ways-badge ways-badge--right">243<br><span>WAYS</span></div>

          <!-- Grille 5 × 3 -->
          <div class="reels-grid">
            <div
              v-for="(col, r) in displayGrid"
              :key="r"
              :class="[
                'reel-col',
                twinReels && twinReels.includes(r) && !spinning ? 'reel-col--twin' : '',
                spinning && !colStopped[r] ? 'reel-col--spinning' : '',
                spinning && colStopped[r]  ? 'reel-col--landing' : '',
                nearMissActive && nearMissMatchedReels.includes(r) ? 'reel-col--nearmiss' : '',
                nearMissActive && !nearMissMatchedReels.includes(r) && !colStopped[r] ? 'reel-col--anticipation' : '',
              ]"
            >
              <div
                v-for="(sym, row) in col"
                :key="row"
                :class="[
                  'reel-cell',
                  sym === 'WILD'  ? 'reel-cell--wild' : '',
                  isWinCell(r, row) ? 'reel-cell--win'  : '',
                  spinning && !colStopped[r] ? 'reel-cell--blur' : '',
                ]"
              >
                <img
                  v-if="symImages[sym]"
                  :src="symImages[sym]"
                  class="sym-img"
                  :alt="sym"
                />
                <span v-else class="sym-emoji">{{ SYM_META[sym]?.emoji ?? '?' }}</span>
                <span v-if="!symImages[sym]" class="sym-name">{{ sym }}</span>
              </div>
            </div>
          </div>

          <!-- Near miss label -->
          <Transition name="fade">
            <div v-if="nearMissActive" class="nearmiss-badge">
              🔥 {{ nearMissMatchedReels.length }}× {{ nearMissSymbol }} — PROCHE…
            </div>
          </Transition>

          <!-- Indicateur ONI JUMEAUX -->
          <div v-if="twinReels && twinReels.length >= 2 && !spinning && !nearMissActive" class="oni-badge">
            ⚡ ONI JUMEAUX ×{{ twinReels.length }}
          </div>

        </div>

        <!-- ── Résultat big win ──────────────────────────────────────────── -->
        <Transition name="bigwin">
          <div
            v-if="bigWinActive && bigWinTier"
            :class="['bigwin-overlay', `bigwin-overlay--${bigWinTier.toLowerCase()}`]"
          >
            <span class="bigwin-text">{{ BIG_WIN_LABELS[bigWinTier] }}</span>
            <span class="bigwin-amount">{{ lastWin.toLocaleString('fr-FR') }} ¥</span>
          </div>
        </Transition>

        <!-- ── Gain normal ───────────────────────────────────────────────── -->
        <Transition name="winfade">
          <div
            v-if="lastWin > 0 && !spinning && !bigWinActive"
            class="win-banner"
          >
            + {{ displayedWin.toLocaleString('fr-FR') }} ¥
          </div>
        </Transition>

        <!-- ── Détail des combinaisons ────────────────────────────────────── -->
        <div v-if="winningWays && winningWays.length && !spinning" class="ways-detail">
          <div
            v-for="(w, i) in winningWays"
            :key="i"
            class="way-row"
            :style="{ animationDelay: `${i * 100}ms` }"
          >
            <span class="way-sym">
              <img v-if="symImages[w.symbol]" :src="symImages[w.symbol]" class="way-sym-img" />
              <span v-else>{{ SYM_META[w.symbol]?.emoji }}</span>
              {{ w.symbol }}
            </span>
            <span class="way-combo">{{ w.reelsCount }}× · {{ w.ways }} way{{ w.ways > 1 ? 's' : '' }}</span>
            <span class="way-pay">+{{ w.payout.toLocaleString('fr-FR') }} ¥</span>
          </div>
        </div>

        <!-- ── Contrôles ─────────────────────────────────────────────────── -->
        <div class="controls">
          <div class="bet-group">
            <button class="btn-step" @click="changeMise(-1)" :disabled="spinning">−</button>
            <div class="bet-display">
              <span class="bet-label">Mise</span>
              <span class="bet-value">{{ mise.toLocaleString('fr-FR') }} ¥</span>
            </div>
            <button class="btn-step" @click="changeMise(+1)" :disabled="spinning">+</button>
          </div>

          <button
            :class="['btn-spin', spinning ? 'btn-spin--spinning' : '']"
            @click="doSpin"
            :disabled="spinning || solde < mise"
          >
            <span v-if="!spinning">SPIN</span>
            <span v-else class="spin-loader">◈</span>
          </button>

          <div class="last-gain-box">
            <span class="bet-label">Gain</span>
            <span :class="['bet-value', lastWin > 0 ? 'bet-value--win' : lastWin < 0 ? 'bet-value--lose' : '']">
              {{ lastWin >= 0 ? '+' : '' }}{{ lastWin.toLocaleString('fr-FR') }} ¥
            </span>
          </div>
        </div>

        <div v-if="erreur" class="err-msg">{{ erreur }}</div>

        <!-- Paytable toggle -->
        <div class="paytable-toggle" @click="showPaytable = !showPaytable">
          {{ showPaytable ? '▲ Masquer le paiement' : '▼ Tableau des gains' }}
        </div>
        <div v-if="showPaytable" class="paytable">
          <table>
            <thead>
              <tr><th>Symbole</th><th>3×</th><th>4×</th><th>5×</th></tr>
            </thead>
            <tbody>
              <tr v-for="(row, sym) in PAYTABLE" :key="sym">
                <td>
                  <img v-if="symImages[sym]" :src="symImages[sym]" class="pay-sym-img" />
                  <span v-else>{{ SYM_META[sym]?.emoji }}</span>
                  {{ sym }}
                </td>
                <td>{{ row[3] }}u</td>
                <td>{{ row[4] }}u</td>
                <td>{{ row[5] }}u</td>
              </tr>
            </tbody>
          </table>
          <p class="paytable-note">Gain = (mise ÷ 243) × unité × ways · Wild sur rouleaux 2, 3, 4 uniquement</p>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppNavbar from './AppNavbar.vue'
import { spinWays243, getOniSymbols, SERVER_URL } from '../api.js'
import { currentUser } from '../auth.js'
import {
  resumeAudio, playSpinStart, playColStop,
  playWin, playBigWin, playMegaWin, playJackpot, playOniJumeaux,
  playLoss, playNearMissStart, playNearMissCrash,
} from '../ways243-audio.js'

const SYM_META = {
  KUNAI:    { emoji: '🗡️' },
  MASQUE:   { emoji: '🎭' },
  TALISMAN: { emoji: '📿' },
  FLEUR:    { emoji: '🌸' },
  HASHIRA:  { emoji: '⚔️' },
  KATANA:   { emoji: '🔱' },
  DEMON:    { emoji: '👹' },
  WILD:     { emoji: '⭐' },
}

const PAYTABLE = {
  DEMON:    { 3: 60,  4: 240, 5: 1600 },
  KATANA:   { 3: 40,  4: 160, 5: 800  },
  HASHIRA:  { 3: 24,  4: 100, 5: 400  },
  FLEUR:    { 3: 15,  4: 57,  5: 226  },
  TALISMAN: { 3: 12,  4: 40,  5: 160  },
  MASQUE:   { 3: 8,   4: 24,  5: 100  },
  KUNAI:    { 3: 4,   4: 16,  5: 60   },
}

const BIG_WIN_LABELS = {
  WIN:      '✨ WIN',
  BIG_WIN:  '🔥 BIG WIN',
  MEGA_WIN: '💥 MEGA WIN',
  JACKPOT:  '👹 JACKPOT',
}

const MISE_STEPS = [500, 1000, 2000, 5000, 10000, 25000, 50000, 100000, 250000, 500000]

// ── État ─────────────────────────────────────────────────────────────────────
const solde        = ref(currentUser.value?.solde ?? 0)
const mise         = ref(1000)
const spinning     = ref(false)
const erreur       = ref('')
const showPaytable = ref(false)
const symImages    = ref({})

const EMPTY_GRID = Array.from({ length: 5 }, () => ['KUNAI', 'MASQUE', 'FLEUR'])
const displayGrid  = ref(EMPTY_GRID.map(col => [...col]))
const colStopped   = ref([true, true, true, true, true])

const winningWays  = ref([])
const twinReels    = ref(null)
const lastWin      = ref(0)
const displayedWin = ref(0)
const bigWinTier   = ref(null)
const bigWinActive = ref(false)

// Effets
const shaking            = ref(false)
const lossFlashing       = ref(false)
const nearMissActive     = ref(false)
const nearMissMatchedReels = ref([])
const nearMissSymbol     = ref('')
const particles          = ref([])

// ── Particules ───────────────────────────────────────────────────────────────
const PARTICLE_SETS = {
  win:     { icons: ['🪙','⭐'], count: 14, dur: [1.2, 1.8] },
  big:     { icons: ['🪙','⭐','💛'], count: 30, dur: [1.4, 2.2] },
  mega:    { icons: ['🪙','⭐','💛','✨'], count: 55, dur: [1.6, 2.6] },
  jackpot: { icons: ['🪙','⭐','💛','✨','🌸','👹'], count: 90, dur: [1.8, 3.0] },
}

let ptclCounter = 0

function spawnParticles(type) {
  const cfg = PARTICLE_SETS[type]
  if (!cfg) return
  const now = Date.now()
  const newPtcl = Array.from({ length: cfg.count }, (_, i) => {
    const dur  = cfg.dur[0] + Math.random() * (cfg.dur[1] - cfg.dur[0])
    const delay = Math.random() * 0.6
    const x    = Math.random() * 100
    const drift = (Math.random() - 0.5) * 120
    const size = 0.9 + Math.random() * 0.9
    const spin = Math.random() > 0.5 ? 1 : -1
    return {
      id: `${now}_${ptclCounter++}`,
      icon: cfg.icons[Math.floor(Math.random() * cfg.icons.length)],
      style: {
        left: `${x}%`,
        '--dur':   `${dur}s`,
        '--delay': `${delay}s`,
        '--drift': `${drift}px`,
        '--size':  `${size}rem`,
        '--spin':  spin,
      },
    }
  })
  particles.value = [...particles.value, ...newPtcl]
  const maxTime = (cfg.dur[1] + 0.8) * 1000
  setTimeout(() => {
    const ids = new Set(newPtcl.map(p => p.id))
    particles.value = particles.value.filter(p => !ids.has(p.id))
  }, maxTime)
}

// ── Effets machine ───────────────────────────────────────────────────────────
function triggerShake() {
  shaking.value = true
  setTimeout(() => { shaking.value = false }, 600)
}

function triggerLossFlash() {
  lossFlashing.value = true
  setTimeout(() => { lossFlashing.value = false }, 400)
}

function animateWinCounter(target) {
  if (target <= 0) { displayedWin.value = 0; return }
  const steps = 20
  const step  = target / steps
  let current = 0
  const iv = setInterval(() => {
    current += step
    if (current >= target) { displayedWin.value = target; clearInterval(iv); return }
    displayedWin.value = Math.floor(current)
  }, 40)
}

// ── Near miss ────────────────────────────────────────────────────────────────
const HIGH_SYMS = ['DEMON', 'KATANA', 'HASHIRA', 'FLEUR', 'TALISMAN']

function detectNearMiss(grid, totalWin) {
  // Pas de near miss si on a déjà un gros gain
  if (totalWin >= mise.value * 5) return null
  for (const sym of HIGH_SYMS) {
    const match = grid.map(col => col.some(s => s === sym || s === 'WILD'))
    if (match[0] && match[1] && match[2] && match[3] && !match[4]) {
      return { reels: 4, sym, matched: [0, 1, 2, 3] }
    }
    if (match[0] && match[1] && match[2] && !match[3]) {
      return { reels: 3, sym, matched: [0, 1, 2] }
    }
  }
  return null
}

// ── Images symboles ──────────────────────────────────────────────────────────
async function loadSymImages() {
  try {
    const raw = await getOniSymbols()
    const resolved = {}
    for (const [sym, url] of Object.entries(raw)) {
      resolved[sym] = url.startsWith('/') ? SERVER_URL + url : url
    }
    symImages.value = resolved
  } catch {}
}

// ── Sélecteur de mise ────────────────────────────────────────────────────────
function changeMise(dir) {
  const idx = MISE_STEPS.indexOf(mise.value)
  if (dir > 0 && idx < MISE_STEPS.length - 1) mise.value = MISE_STEPS[idx + 1]
  if (dir < 0 && idx > 0)                      mise.value = MISE_STEPS[idx - 1]
  if (idx === -1) mise.value = MISE_STEPS[0]
}

// ── Cellule gagnante ? ───────────────────────────────────────────────────────
function isWinCell(col, row) {
  if (spinning.value || !winningWays.value.length) return false
  return winningWays.value.some(w => w.positions[col]?.includes(row))
}

// ── Boucle aléatoire pendant le spin ─────────────────────────────────────────
const RANDOM_SYMS = ['KUNAI', 'MASQUE', 'TALISMAN', 'FLEUR', 'HASHIRA', 'KATANA', 'DEMON']
let randomInterval = null

function startRandomLoop() {
  randomInterval = setInterval(() => {
    displayGrid.value = displayGrid.value.map((col, r) =>
      colStopped.value[r]
        ? col
        : Array.from({ length: 3 }, () => RANDOM_SYMS[Math.floor(Math.random() * RANDOM_SYMS.length)])
    )
  }, 80)
}

function stopRandomLoop() {
  if (randomInterval) { clearInterval(randomInterval); randomInterval = null }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

// Arrêt d'une colonne spécifique (retourne une Promise résolue après `ms` ms)
function stopColAt(r, finalCol, ms) {
  return delay(ms).then(() => {
    colStopped.value[r] = true
    displayGrid.value[r] = [...finalCol]
    playColStop(r)
  })
}

// ── Séquence d'arrêt avec possible near miss ──────────────────────────────────
async function stopColumnsSequence(grid, nm) {
  if (!nm) {
    // Normal : 5 colonnes avec 240ms d'écart
    await Promise.all(Array.from({ length: 5 }, (_, r) => stopColAt(r, grid[r], r * 240)))
    return
  }

  // Cols qui matchent s'arrêtent normalement
  for (let r = 0; r < nm.matched.length; r++) {
    stopColAt(r, grid[r], r * 240)
  }
  // Attendre que la dernière colonne "match" soit arrêtée
  await delay(nm.matched.length * 240 + 80)

  // Activer l'effet near miss
  nearMissActive.value     = true
  nearMissMatchedReels.value = nm.matched
  nearMissSymbol.value     = nm.sym
  playNearMissStart(nm.reels)

  // Pause dramatique — la durée dépend du nombre de reels qui matchaient
  await delay(nm.reels >= 4 ? 1100 : 800)

  // Stopper les colonnes restantes avec effet crash
  const remaining = nm.reels === 4 ? [4] : [3, 4]
  for (let i = 0; i < remaining.length; i++) {
    const r = remaining[i]
    colStopped.value[r] = true
    displayGrid.value[r] = [...grid[r]]
    if (i === 0) playNearMissCrash()
    else playColStop(r)
    if (i < remaining.length - 1) await delay(280)
  }

  // Désactiver après un bref instant
  await delay(800)
  nearMissActive.value = false
}

// ── Spin ─────────────────────────────────────────────────────────────────────
async function doSpin() {
  if (spinning.value || solde.value < mise.value) return
  resumeAudio()

  erreur.value       = ''
  spinning.value     = true
  bigWinActive.value = false
  winningWays.value  = []
  twinReels.value    = null
  lastWin.value      = 0
  displayedWin.value = 0
  bigWinTier.value   = null
  nearMissActive.value = false
  colStopped.value   = [false, false, false, false, false]

  playSpinStart()
  startRandomLoop()

  try {
    const result = await spinWays243(mise.value)

    await delay(650)
    stopRandomLoop()

    const finalGrid = result.grid
    const nm = detectNearMiss(finalGrid, result.totalWin)

    await stopColumnsSequence(finalGrid, nm)

    // Appliquer résultat
    solde.value       = result.newBalance
    winningWays.value  = result.winningWays
    twinReels.value    = result.twinReels
    const gain         = result.totalWin - mise.value
    lastWin.value      = gain
    bigWinTier.value   = result.bigWinTier

    // Sons & effets selon résultat
    await delay(100)

    if (result.bigWinTier === 'JACKPOT') {
      playJackpot()
      triggerShake()
      spawnParticles('jackpot')
      bigWinActive.value = true
      setTimeout(() => { bigWinActive.value = false }, 4000)
    } else if (result.bigWinTier === 'MEGA_WIN') {
      playMegaWin()
      triggerShake()
      spawnParticles('mega')
      bigWinActive.value = true
      setTimeout(() => { bigWinActive.value = false }, 3500)
    } else if (result.bigWinTier === 'BIG_WIN') {
      playBigWin()
      spawnParticles('big')
      bigWinActive.value = true
      setTimeout(() => { bigWinActive.value = false }, 3200)
    } else if (result.bigWinTier === 'WIN' || gain > 0) {
      playWin()
      spawnParticles('win')
    } else if (!nm) {
      // Vraie perte sans near miss
      playLoss()
      triggerLossFlash()
    }

    if (gain > 0) animateWinCounter(gain)

    // Oni Jumeaux
    if (result.twinReels?.length >= 2) {
      setTimeout(() => playOniJumeaux(), 150)
    }

  } catch (e) {
    stopRandomLoop()
    colStopped.value = [true, true, true, true, true]
    erreur.value = e.message
  } finally {
    spinning.value = false
  }
}

onMounted(() => {
  solde.value = currentUser.value?.solde ?? 0
  loadSymImages()
})
</script>

<style scoped>
/* ── Base ───────────────────────────────────────────────────────────────────── */
.page {
  min-height: 100vh;
  background: #0a0608;
  color: #e8d5b0;
  font-family: 'Cinzel', serif;
  transition: background 0.4s;
}
.page--bigwin { background: #0e080a; }

.page-inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
}

/* ── Header ─────────────────────────────────────────────────────────────────── */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 2rem;
}
.back-link { color: rgba(232,213,176,0.45); text-decoration: none; font-size: 0.8rem; padding-top: 0.2rem; }
.back-link:hover { color: #c9a84c; }
.header-center { text-align: center; }
.page-label { font-size: 0.7rem; letter-spacing: 0.2em; color: rgba(232,213,176,0.4); margin: 0 0 0.2rem; text-transform: uppercase; }
.page-title { font-size: 2.2rem; margin: 0; color: #e8d5b0; letter-spacing: 0.05em; }
.title-accent { color: #c9354f; }
.page-sub { font-size: 0.65rem; letter-spacing: 0.15em; color: rgba(232,213,176,0.3); margin: 0.2rem 0 0; }
.solde-box { text-align: right; }
.solde-label { display: block; font-size: 0.65rem; letter-spacing: 0.15em; color: rgba(232,213,176,0.4); text-transform: uppercase; }
.solde-value { font-size: 1.1rem; color: #c9a84c; }

/* ── Machine ────────────────────────────────────────────────────────────────── */
.machine-wrap { display: flex; flex-direction: column; align-items: center; gap: 1.2rem; }

.machine-frame {
  position: relative;
  border: 2px solid rgba(201,53,79,0.3);
  border-radius: 14px;
  padding: 2rem 1.5rem;
  background: rgba(20,8,12,0.97);
  box-shadow: 0 0 40px rgba(201,53,79,0.12), inset 0 0 50px rgba(0,0,0,0.6);
  transition: box-shadow 0.3s, border-color 0.3s;
}
.machine-frame--spinning {
  border-color: rgba(201,53,79,0.6);
  box-shadow: 0 0 60px rgba(201,53,79,0.28), inset 0 0 50px rgba(0,0,0,0.6);
}
.machine-frame--bigwin {
  border-color: #c9a84c;
  box-shadow: 0 0 90px rgba(201,168,76,0.5), inset 0 0 50px rgba(0,0,0,0.6);
}
.machine-frame--shake {
  animation: machineShake 0.55s ease;
}
@keyframes machineShake {
  0%,100% { transform: translateX(0) rotate(0deg); }
  10%     { transform: translateX(-5px) rotate(-0.4deg); }
  20%     { transform: translateX(5px)  rotate(0.4deg); }
  30%     { transform: translateX(-4px) rotate(-0.3deg); }
  40%     { transform: translateX(4px)  rotate(0.3deg); }
  50%     { transform: translateX(-3px); }
  60%     { transform: translateX(3px); }
  80%     { transform: translateX(-1px); }
}
.machine-frame--loss {
  animation: lossFlash 0.38s ease;
}
@keyframes lossFlash {
  0%,100% { border-color: rgba(201,53,79,0.3); box-shadow: 0 0 40px rgba(201,53,79,0.12); }
  30%     { border-color: rgba(100,50,50,0.7); box-shadow: 0 0 60px rgba(80,20,20,0.5), inset 0 0 30px rgba(50,10,10,0.5); }
}

/* ── Badge 243 WAYS ─────────────────────────────────────────────────────────── */
.ways-badge {
  position: absolute; top: 50%; transform: translateY(-50%);
  font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em;
  color: #c9354f; text-align: center; line-height: 1.2; opacity: 0.8;
}
.ways-badge span { font-size: 0.58rem; letter-spacing: 0.15em; }
.ways-badge--left  { left: 0.5rem; }
.ways-badge--right { right: 0.5rem; }

/* ── Grille ─────────────────────────────────────────────────────────────────── */
.reels-grid { display: flex; gap: 8px; }

.reel-col {
  display: flex; flex-direction: column; gap: 6px;
  border-radius: 8px; overflow: hidden;
  border: 2px solid transparent;
  transition: border-color 0.3s, box-shadow 0.3s;
}
.reel-col--twin {
  border-color: #8b5cf6;
  box-shadow: 0 0 18px rgba(139,92,246,0.5);
}
.reel-col--nearmiss {
  border-color: rgba(255,80,80,0.9);
  box-shadow: 0 0 24px rgba(255,80,80,0.6);
  animation: nearMissPulse 0.35s ease-in-out infinite alternate;
}
@keyframes nearMissPulse {
  from { box-shadow: 0 0 14px rgba(255,80,80,0.5); border-color: rgba(255,80,80,0.7); }
  to   { box-shadow: 0 0 36px rgba(255,120,60,0.9); border-color: rgba(255,120,60,1); }
}
.reel-col--anticipation {
  border-color: rgba(255,200,80,0.5);
  box-shadow: 0 0 14px rgba(255,200,80,0.3);
  animation: anticipationPulse 0.5s ease-in-out infinite alternate;
}
@keyframes anticipationPulse {
  from { opacity: 0.8; }
  to   { opacity: 1; box-shadow: 0 0 22px rgba(255,200,80,0.55); }
}
.reel-col--landing {
  animation: colLand 0.25s cubic-bezier(0.34,1.56,0.64,1);
}
@keyframes colLand {
  0%   { transform: translateY(-10px); }
  100% { transform: translateY(0); }
}

.reel-cell {
  width: 120px; height: 120px;
  background: rgba(255,255,255,0.03);
  border-radius: 6px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px;
  transition: background 0.2s, box-shadow 0.2s;
  position: relative; overflow: hidden;
}
.reel-cell--blur {
  animation: cellSpin 0.08s steps(1) infinite;
}
@keyframes cellSpin {
  0%   { filter: blur(4px) brightness(0.6); }
  50%  { filter: blur(6px) brightness(0.4); }
  100% { filter: blur(4px) brightness(0.6); }
}
.reel-cell--wild {
  background: rgba(255,200,0,0.08);
  border: 1px solid rgba(255,200,0,0.3);
}
.reel-cell--wild .sym-emoji { filter: drop-shadow(0 0 8px gold); }
.reel-cell--wild .sym-img   { filter: drop-shadow(0 0 8px gold); }
.reel-cell--win {
  background: rgba(201,168,76,0.15);
  animation: winPulse 0.75s ease-in-out infinite alternate;
}
@keyframes winPulse {
  from { box-shadow: inset 0 0 10px rgba(201,168,76,0.2); }
  to   { box-shadow: inset 0 0 30px rgba(201,168,76,0.6), 0 0 16px rgba(201,168,76,0.4); }
}

.sym-img   { width: 78px; height: 78px; object-fit: contain; image-rendering: crisp-edges; }
.sym-emoji { font-size: 2.6rem; line-height: 1; }
.sym-name  { font-size: 0.42rem; letter-spacing: 0.1em; color: rgba(232,213,176,0.35); text-transform: uppercase; }

/* ── Near miss badge ────────────────────────────────────────────────────────── */
.nearmiss-badge {
  text-align: center;
  margin-top: 0.8rem;
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  color: #ff6b4a;
  text-shadow: 0 0 14px rgba(255,107,74,0.8);
  animation: nmGlow 0.3s ease-in-out infinite alternate;
}
@keyframes nmGlow {
  from { opacity: 0.8; text-shadow: 0 0 8px rgba(255,107,74,0.6); }
  to   { opacity: 1;   text-shadow: 0 0 20px rgba(255,107,74,1); }
}

/* ── Oni Jumeaux badge ──────────────────────────────────────────────────────── */
.oni-badge {
  text-align: center; margin-top: 0.9rem;
  font-size: 0.68rem; letter-spacing: 0.2em; color: #a78bfa;
  animation: oniGlow 1s ease-in-out infinite alternate;
}
@keyframes oniGlow {
  from { opacity: 0.7; text-shadow: none; }
  to   { opacity: 1; text-shadow: 0 0 12px rgba(167,139,250,0.85); }
}

/* ── Transitions ─────────────────────────────────────────────────────────────── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* ── Big Win Overlay ────────────────────────────────────────────────────────── */
.bigwin-overlay {
  position: fixed; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  z-index: 100; pointer-events: none;
}
.bigwin-overlay--big_win  { background: rgba(0,0,0,0.75); }
.bigwin-overlay--mega_win { background: rgba(10,0,5,0.82); }
.bigwin-overlay--jackpot  { background: rgba(15,5,0,0.88); }
.bigwin-text {
  font-size: 4rem; font-weight: 700; letter-spacing: 0.15em; color: #c9a84c;
  text-shadow: 0 0 40px rgba(201,168,76,0.9), 0 0 80px rgba(201,168,76,0.4);
  animation: bigwinBounce 0.5s cubic-bezier(0.34,1.56,0.64,1);
}
.bigwin-amount { font-size: 2rem; color: #e8d5b0; margin-top: 0.5rem; letter-spacing: 0.1em; }
@keyframes bigwinBounce {
  from { transform: scale(0.3); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}
.bigwin-enter-active { animation: bigwinBounce 0.4s; }
.bigwin-leave-active { transition: opacity 0.5s; }
.bigwin-leave-to     { opacity: 0; }

/* ── Win banner ─────────────────────────────────────────────────────────────── */
.win-banner {
  font-size: 1.7rem; color: #c9a84c; letter-spacing: 0.1em;
  animation: winFade 0.4s ease;
}
@keyframes winFade {
  from { transform: scale(0.7) translateY(6px); opacity: 0; }
  to   { transform: scale(1) translateY(0); opacity: 1; }
}
.winfade-enter-active { animation: winFade 0.4s; }
.winfade-leave-active { transition: opacity 0.4s; }
.winfade-leave-to     { opacity: 0; }

/* ── Détail ways ────────────────────────────────────────────────────────────── */
.ways-detail { display: flex; flex-direction: column; gap: 5px; width: 100%; max-width: 560px; }
.way-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.3rem 0.7rem;
  background: rgba(255,255,255,0.03);
  border-radius: 4px; border-left: 2px solid rgba(201,168,76,0.4);
  font-size: 0.78rem;
  animation: waySlide 0.3s ease both;
}
@keyframes waySlide {
  from { transform: translateX(-8px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
.way-sym   { color: #e8d5b0; display: flex; align-items: center; gap: 6px; }
.way-sym-img { width: 20px; height: 20px; object-fit: contain; }
.way-combo { color: rgba(232,213,176,0.5); font-size: 0.72rem; }
.way-pay   { color: #c9a84c; font-weight: 600; }

/* ── Contrôles ─────────────────────────────────────────────────────────────── */
.controls { display: flex; align-items: center; gap: 2rem; margin-top: 0.5rem; }
.bet-group, .last-gain-box { display: flex; align-items: center; gap: 0.5rem; }
.bet-display, .last-gain-box { display: flex; flex-direction: column; align-items: center; min-width: 100px; }
.bet-label { font-size: 0.62rem; letter-spacing: 0.15em; color: rgba(232,213,176,0.4); text-transform: uppercase; }
.bet-value { font-size: 1rem; color: #e8d5b0; }
.bet-value--win  { color: #c9a84c; }
.bet-value--lose { color: rgba(201,53,79,0.8); }
.btn-step {
  width: 36px; height: 36px; border-radius: 50%;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  color: #e8d5b0; font-size: 1.1rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: background 0.15s;
}
.btn-step:hover:not(:disabled) { background: rgba(255,255,255,0.12); }
.btn-step:disabled { opacity: 0.3; cursor: not-allowed; }

/* ── Bouton SPIN ────────────────────────────────────────────────────────────── */
.btn-spin {
  width: 110px; height: 110px; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #c9354f, #7a1428);
  border: 2px solid rgba(201,53,79,0.6); color: #fff;
  font-size: 1rem; font-weight: 700; letter-spacing: 0.2em; cursor: pointer;
  box-shadow: 0 0 24px rgba(201,53,79,0.4), inset 0 0 18px rgba(0,0,0,0.4);
  transition: transform 0.15s, box-shadow 0.15s;
  display: flex; align-items: center; justify-content: center;
}
.btn-spin:hover:not(:disabled) {
  transform: scale(1.06);
  box-shadow: 0 0 40px rgba(201,53,79,0.65), inset 0 0 18px rgba(0,0,0,0.4);
}
.btn-spin:active:not(:disabled) { transform: scale(0.97); }
.btn-spin:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-spin--spinning { animation: spinPulse 0.6s ease-in-out infinite alternate; }
@keyframes spinPulse {
  from { box-shadow: 0 0 18px rgba(201,53,79,0.3); }
  to   { box-shadow: 0 0 48px rgba(201,53,79,0.75); }
}
.spin-loader { display: inline-block; animation: spinIcon 0.4s linear infinite; }
@keyframes spinIcon { to { transform: rotate(360deg); } }

/* ── Erreur ─────────────────────────────────────────────────────────────────── */
.err-msg { color: rgba(201,53,79,0.8); font-size: 0.75rem; text-align: center; letter-spacing: 0.05em; }

/* ── Paytable ───────────────────────────────────────────────────────────────── */
.paytable-toggle {
  font-size: 0.65rem; letter-spacing: 0.1em;
  color: rgba(232,213,176,0.35); cursor: pointer; text-transform: uppercase; transition: color 0.15s;
}
.paytable-toggle:hover { color: rgba(232,213,176,0.6); }
.paytable { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 0.75rem 1rem; font-size: 0.72rem; }
.paytable table { width: 100%; border-collapse: collapse; }
.paytable th, .paytable td { padding: 0.3rem 0.5rem; text-align: center; }
.paytable th { color: rgba(232,213,176,0.4); font-weight: normal; letter-spacing: 0.1em; }
.paytable td:first-child { text-align: left; display: flex; align-items: center; gap: 6px; }
.paytable tr:nth-child(even) td { background: rgba(255,255,255,0.02); }
.paytable-note { color: rgba(232,213,176,0.3); font-size: 0.6rem; margin: 0.5rem 0 0; letter-spacing: 0.05em; }
.pay-sym-img { width: 18px; height: 18px; object-fit: contain; }

/* ── Responsive ─────────────────────────────────────────────────────────────── */
@media (max-width: 700px) {
  .reel-cell { width: 58px; height: 58px; }
  .sym-img   { width: 36px; height: 36px; }
  .sym-emoji { font-size: 1.4rem; }
  .btn-spin  { width: 80px; height: 80px; font-size: 0.85rem; }
  .ways-badge { display: none; }
  .controls  { gap: 1rem; }
}
@media (max-width: 480px) {
  .reel-cell { width: 46px; height: 46px; }
  .sym-img   { width: 28px; height: 28px; }
  .sym-emoji { font-size: 1.1rem; }
}
</style>

<!-- Styles NON-scoped pour les particules (Teleport sort du composant) -->
<style>
.particles-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 200;
  overflow: hidden;
}
.ptcl {
  position: absolute;
  top: -6%;
  font-size: var(--size);
  animation: ptclFall var(--dur) var(--delay) cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  will-change: transform, opacity;
}
@keyframes ptclFall {
  0%   { transform: translateY(0) translateX(0) rotate(0deg);        opacity: 1; }
  70%  { opacity: 1; }
  100% { transform: translateY(110vh) translateX(var(--drift)) rotate(calc(var(--spin) * 540deg)); opacity: 0; }
}
</style>

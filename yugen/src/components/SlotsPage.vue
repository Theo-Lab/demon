<template>
  <div :class="['page', screenShake ? 'page--shake' : '']">
    <AppNavbar />
    <div v-if="jeuIndisponible" class="jeu-indispo">
      <p class="jeu-indispo-title">Jeu indisponible</p>
      <p class="jeu-indispo-sub">La Machine à Sous est temporairement fermée.</p>
      <RouterLink to="/casino" class="jeu-indispo-link">← Retour au casino</RouterLink>
    </div>
    <div v-show="!jeuIndisponible" class="page-inner">

      <div class="page-header">
        <div>
          <p class="page-label">Casino de l'Ordre</p>
          <h1 class="page-title">Machine à Sous</h1>
        </div>
        <div class="solde-display">
          <span class="solde-label">Solde</span>
          <span class="solde-value">{{ solde.toLocaleString() }} ¥</span>
        </div>
      </div>

      <div class="page-divider"></div>

      <div v-if="loading" class="loading">Chargement…</div>
      <div v-else-if="!config" class="vide">Machine non configurée.</div>
      <div v-else-if="symboles.length < 2" class="vide">
        Aucun symbole configuré. Accédez au
        <RouterLink to="/slots/admin" class="link-admin">panel admin</RouterLink>
        pour en créer.
      </div>

      <template v-else>
        <div class="machine">

          <!-- ── Rouleaux ─────────────────────────────────────────────── -->
          <div class="slots-frame">

            <!-- Indicateur de payline : encoches latérales -->
            <div class="payline-notch payline-notch--left"></div>
            <div class="payline-notch payline-notch--right"></div>

            <div
              class="slot-grid"
              :style="{ gridTemplateColumns: `repeat(${nbCols}, 1fr)` }"
            >
              <div
                v-for="col in nbCols"
                :key="col"
                :class="['reel-wrapper', nearMiss ? 'reel-wrapper--nearmiss' : '']"
              >
                <div
                  class="reel-strip"
                  :style="{
                    transform: `translateY(${reelOffsets[col - 1]}px)`,
                    transition: reelTransitions[col - 1],
                  }"
                >
                  <div
                    v-for="(sym, idx) in reelStrips[col - 1]"
                    :key="idx"
                    :class="[
                      'reel-cell',
                      sym && sym.is_wild ? 'reel-cell--wild' : '',
                      winningCols.has(col - 1) && idx === paylineIdx[col - 1] && !spinning && resultat ? 'reel-cell--win' : '',
                    ]"
                  >
                    <img
                      v-if="sym && sym.image_url"
                      :src="IMG_BASE + sym.image_url"
                      :alt="sym.nom"
                    />
                    <span v-else-if="sym" class="cell-nom">{{ sym.nom }}</span>
                    <span v-else class="cell-vide">?</span>
                    <span v-if="sym && sym.is_wild" class="wild-badge">W</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Ligne de payline + glow victoire -->
            <div :class="['payline-overlay', resultat && resultat.type !== 'none' && !spinning ? 'payline-overlay--win' : '']"></div>

          </div>

          <!-- ── Panneau de contrôle ─────────────────────────────────── -->
          <div class="controls">

            <!-- Résultat — hauteur fixe pour éviter tout décalage de layout -->
            <div :class="['resultat', resultat && resultat.type !== 'none' ? 'resultat--win' : '', !resultat || spinning ? 'resultat--vide' : '']">
              <template v-if="resultat && !spinning">
                <template v-if="resultat.type !== 'none'">
                  <span class="resultat-label">Gain</span>
                  <span class="resultat-montant">+{{ resultat.gain.toLocaleString() }} ¥</span>
                  <span class="resultat-mult">×{{ resultat.multiplicateur }}</span>
                </template>
                <template v-else>
                  <span class="resultat-label resultat-label--lose">Perdu</span>
                  <span class="resultat-montant resultat-montant--lose">−{{ miseDerniere.toLocaleString() }} ¥</span>
                </template>
              </template>
            </div>

            <!-- Mise -->
            <div class="mise-field">
              <label class="field-label">Mise (¥)</label>
              <div class="mise-input-wrap">
                <input
                  v-model.number="mise"
                  class="field-input"
                  type="number"
                  :min="config.mise_min"
                  :max="config.mise_max"
                  :step="config.mise_min"
                  :disabled="spinning"
                />
              </div>
              <div class="presets">
                <button
                  v-for="p in presets"
                  :key="p"
                  class="preset-btn"
                  :class="{ 'preset-btn--active': mise === p }"
                  :disabled="spinning"
                  @click="mise = p"
                >{{ formatPreset(p) }}</button>
              </div>
              <p class="mise-hint">{{ config.mise_min.toLocaleString() }} – {{ config.mise_max.toLocaleString() }} ¥</p>
            </div>

            <div v-if="erreur" class="erreur">{{ erreur }}</div>

            <!-- Bouton Lancer -->
            <button
              class="btn-spin"
              :disabled="spinning || !mise || autoSpinning"
              @click="lancerSpin"
            >
              <span v-if="spinning && !autoSpinning" class="spin-dots">
                <span></span><span></span><span></span>
              </span>
              <span v-else>Lancer</span>
            </button>

            <!-- Série automatique -->
            <div v-if="!autoSpinning" class="auto-row">
              <span class="auto-label">Série</span>
              <div class="auto-counts">
                <button
                  v-for="n in [5, 10, 20]"
                  :key="n"
                  :class="['auto-count-btn', autoSpinCount === n ? 'auto-count-btn--on' : '']"
                  :disabled="spinning"
                  @click="autoSpinCount = autoSpinCount === n ? 0 : n"
                >×{{ n }}</button>
              </div>
              <button
                class="auto-go"
                :disabled="spinning || !mise || !autoSpinCount"
                @click="demarrerAutoSpin"
              >Démarrer</button>
            </div>

            <!-- En cours d'auto-spin -->
            <button v-else class="auto-stop-bar" @click="arreterAutoSpin">
              <span class="auto-stop-remaining">{{ autoSpinRemaining }} lancer{{ autoSpinRemaining > 1 ? 's' : '' }} restant{{ autoSpinRemaining > 1 ? 's' : '' }}</span>
              <span class="auto-stop-cta">Arrêter</span>
            </button>

          </div>

          <!-- Règles -->
          <div class="regles">
            <button class="regles-toggle" @click="reglesOuvertes = !reglesOuvertes">
              <span>Règles</span>
              <span class="regles-chevron" :class="{ 'regles-chevron--open': reglesOuvertes }">›</span>
            </button>

            <div v-if="reglesOuvertes" class="regles-body">
              <div class="regle-item">
                <span class="regle-dot"></span>
                <span>Seule la <strong>rangée centrale</strong> est la ligne de paiement.</span>
              </div>
              <div class="regle-item">
                <span class="regle-dot"></span>
                <span><strong>3 symboles identiques</strong> sur la ligne → gain selon le multiplicateur ×3 du symbole.</span>
              </div>
              <div class="regle-item">
                <span class="regle-dot"></span>
                <span><strong>2 symboles identiques</strong> en partant de la gauche → gain selon le multiplicateur ×2 du symbole.</span>
              </div>
              <div class="regle-item">
                <span class="regle-dot"></span>
                <span>Les symboles ont des <strong>fréquences d'apparition différentes</strong> — les plus rares offrent de meilleurs multiplicateurs.</span>
              </div>
              <div class="regle-item">
                <span class="regle-dot"></span>
                <span>Mise min. <strong>{{ config.mise_min.toLocaleString() }} ¥</strong> — mise max. <strong>{{ config.mise_max.toLocaleString() }} ¥</strong>.</span>
              </div>
            </div>
          </div>

        </div>
      </template>

    </div>
  </div>

  <!-- Flash de victoire -->
  <div v-if="winFlash" :class="['win-flash', `win-flash--${winFlash}`]"></div>

  <!-- Rayons lumineux (jackpot) -->
  <div v-if="showRays" class="rays-container" aria-hidden="true">
    <div v-for="i in 8" :key="i" class="ray" :style="{ '--rot': (i - 1) * 45 + 'deg', '--delay': (i - 1) * 0.08 + 's' }"></div>
  </div>

  <!-- Particules de victoire -->
  <div class="particles-container" aria-hidden="true">
    <div
      v-for="p in particles"
      :key="p.id"
      class="particle"
      :style="{
        left: p.x + 'px',
        top:  p.y + 'px',
        width:  p.size + 'px',
        height: p.size + 'px',
        background: p.color,
        '--dx': p.dx + 'px',
        '--dy': p.dy + 'px',
        animationDuration: p.dur + 'ms',
        animationDelay:    p.delay + 'ms',
      }"
    ></div>
  </div>

  <!-- Overlay Jackpot -->
  <Transition name="jackpot-fade">
    <div v-if="isJackpot" class="jackpot-overlay" @click="isJackpot = false">
      <div class="jackpot-inner">
        <p class="jackpot-eyebrow">Jackpot</p>
        <p class="jackpot-gain">+{{ resultat?.gain.toLocaleString() }} ¥</p>
        <p class="jackpot-mult">×{{ resultat?.multiplicateur }}</p>
        <p class="jackpot-dismiss">Appuyez pour continuer</p>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import AppNavbar from './AppNavbar.vue'
import { currentUser } from '../auth.js'
import { getSlotsConfig, spinSlots, IMG_BASE, getCasinoGames } from '../api.js'
import { playTick, playStop, playSmallWin, playBigWin, playJackpot, playNearMiss, resumeAudio } from '../slots-audio.js'

// ── Constantes animation ──────────────────────────────────────────────────
const CELL_H = 110 // hauteur d'une cellule en px

// Durée du scroll rapide par step (ms)
const STEP_MS = 80

// Transition de décélération à l'arrêt de chaque rouleau
// cubic-bezier avec léger overshoot → effet "claquement" mécanique
const STOP_TRANSITION = 'transform 0.85s cubic-bezier(0.34, 1.3, 0.64, 1)'

// ── État ──────────────────────────────────────────────────────────────────
const loading    = ref(true)
const config     = ref(null)
const symboles   = ref([])
const spinning   = ref(false)
const erreur     = ref('')
const mise       = ref(0)
const miseDerniere = ref(0)
const resultat   = ref(null)

const reelStrips      = ref([[], [], []])
const reelOffsets     = ref([0, 0, 0])
const reelTransitions = ref(['none', 'none', 'none'])

let reelIntervals = [null, null, null]
const reglesOuvertes = ref(false)

const winningCols = ref(new Set())
const nearMiss    = ref(false)
const isJackpot   = ref(false)

// Auto-spin
const autoSpinCount     = ref(0)   // 0 = non sélectionné
const autoSpinRemaining = ref(0)
const autoSpinning      = ref(false)

function demarrerAutoSpin() {
  if (!autoSpinCount.value || spinning.value) return
  autoSpinning.value      = true
  autoSpinRemaining.value = autoSpinCount.value
  lancerSpin()
}

function arreterAutoSpin() {
  autoSpinning.value      = false
  autoSpinRemaining.value = 0
}
const winFlash    = ref(null)    // null | 'small' | 'big' | 'jackpot'
const screenShake = ref(false)
const showRays    = ref(false)
const particles   = ref([])
let   _particleId = 0
let   _shakeTimer = null

function spawnParticles(count, colors, originBias = 0.5) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const batch = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2
    const force = 120 + Math.random() * 320
    return {
      id:    ++_particleId,
      x:     vw * (0.15 + Math.random() * 0.7),
      y:     vh * (0.2  + Math.random() * originBias),
      size:  2 + Math.random() * 7,
      color: colors[Math.floor(Math.random() * colors.length)],
      dx:    Math.cos(angle) * force,
      dy:    Math.sin(angle) * force - 80,
      dur:   1800 + Math.random() * 1600,
      delay: Math.random() * 600,
    }
  })
  particles.value = [...particles.value, ...batch]
  const maxLife = Math.max(...batch.map(p => p.dur + p.delay)) + 80
  setTimeout(() => {
    const ids = new Set(batch.map(p => p.id))
    particles.value = particles.value.filter(p => !ids.has(p.id))
  }, maxLife)
}

function triggerWinEffects(type) {
  if (type === 'jackpot') {
    // Vague 1 — immédiate
    winFlash.value = 'jackpot'
    spawnParticles(70, ['#c87070', '#e8a0a0', '#fff', '#f0d080', '#ffcccc'])
    // Vague 2 — 500ms
    setTimeout(() => spawnParticles(50, ['#fff', '#f0d080', '#c87070', '#ffaaaa']), 500)
    // Vague 3 — 1100ms
    setTimeout(() => spawnParticles(40, ['#c87070', '#e8a0a0', '#f0d080']), 1100)
    // Rayons lumineux
    showRays.value = true
    setTimeout(() => { showRays.value = false }, 4000)
    // Shake
    screenShake.value = true
    clearTimeout(_shakeTimer)
    _shakeTimer = setTimeout(() => { screenShake.value = false }, 600)
    setTimeout(() => { winFlash.value = null }, 2500)

  } else if (type.startsWith('three')) {
    winFlash.value = 'big'
    spawnParticles(45, ['#c87070', '#e8a0a0', '#fff'])
    setTimeout(() => spawnParticles(30, ['#c87070', '#fff', '#e8a0a0']), 500)
    // Shake léger
    screenShake.value = true
    clearTimeout(_shakeTimer)
    _shakeTimer = setTimeout(() => { screenShake.value = false }, 400)
    setTimeout(() => { winFlash.value = null }, 2000)

  } else {
    winFlash.value = 'small'
    spawnParticles(20, ['#c87070', '#e8a0a0'])
    setTimeout(() => { winFlash.value = null }, 1400)
  }
}

// Index de la cellule payline (rangée centrale) dans le strip de chaque colonne
const paylineIdx = computed(() => colSpinCounts.value.map(sc => sc + 1))

const nbCols = computed(() => config.value?.nb_colonnes ?? 3)

// Chaque colonne a un spin count croissant pour l'effet de décalage
const colSpinCounts = computed(() =>
  Array.from({ length: nbCols.value }, (_, i) => 8 + i * 4)
)

const solde = computed(() => currentUser.value?.solde ?? 0)
const jeuIndisponible = ref(false)

const presets = computed(() => {
  if (!config.value) return []
  const { mise_min: mn, mise_max: mx } = config.value
  return [...new Set([mn, mn * 5, Math.round(mx / 4), Math.round(mx / 2), mx])]
    .filter(v => v >= mn && v <= mx)
    .slice(0, 5)
})

function formatPreset(v) {
  if (v >= 1_000_000) return (v / 1_000_000).toLocaleString() + 'M'
  if (v >= 1_000)     return (v / 1_000).toLocaleString() + 'k'
  return v.toLocaleString()
}

function randomSym() {
  return symboles.value[Math.floor(Math.random() * symboles.value.length)]
}

// Construit les bandes initiales (à l'affichage, avant tout spin)
function buildInitialStrips() {
  const n = nbCols.value
  reelStrips.value      = Array.from({ length: n }, (_, col) =>
    Array.from({ length: colSpinCounts.value[col] + 3 }, randomSym)
  )
  reelOffsets.value     = Array(n).fill(0)
  reelTransitions.value = Array(n).fill('none')
}

async function lancerSpin() {
  if (spinning.value || !mise.value) return
  resumeAudio()
  erreur.value     = ''
  resultat.value   = null
  miseDerniere.value = mise.value
  spinning.value   = true
  winningCols.value = new Set()
  nearMiss.value    = false
  isJackpot.value   = false

  // Récupérer le résultat côté serveur en premier
  let res
  try {
    res = await spinSlots(mise.value)
  } catch (e) {
    spinning.value          = false
    autoSpinning.value      = false
    autoSpinRemaining.value = 0
    erreur.value            = e.message
    return
  }

  // grille[col + rangée*3] → résultat par colonne :
  // col C : haut=grille[C], milieu=grille[C+3], bas=grille[C+6]

  const n = res.nb_colonnes

  // Stopper les éventuels intervalles précédents
  reelIntervals.forEach(id => id && clearInterval(id))
  reelIntervals.length = 0

  // Désactiver les transitions avant de repositionner → aucun saut visible
  reelTransitions.value = Array(n).fill('none')
  await nextTick()

  // Reconstruire les bandes avec le résultat au bout
  // grille : 3 rangées × n colonnes, rangée par rangée
  // col C → haut=grille[C], milieu=grille[n+C], bas=grille[2n+C]
  for (let col = 0; col < n; col++) {
    const spinCount  = colSpinCounts.value[col] ?? (8 + col * 4)
    const randomPart = Array.from({ length: spinCount }, randomSym)
    reelStrips.value[col] = [
      ...randomPart,
      res.grille[col],         // rangée haute
      res.grille[n + col],     // rangée centrale = payline
      res.grille[2 * n + col], // rangée basse
    ]
    reelOffsets.value[col] = 0
  }
  await nextTick()

  // Lancer le défilement rapide pour chaque colonne
  for (let col = 0; col < n; col++) {
    const spinCount = colSpinCounts.value[col] ?? (8 + col * 4)
    let step = 0

    reelIntervals[col] = setInterval(() => {
      step++
      reelOffsets.value[col] = -(step * CELL_H)
      playTick()

      // Avant-dernier step → transition douce pour le dernier saut
      if (step >= spinCount - 1) {
        clearInterval(reelIntervals[col])
        reelIntervals[col] = null
        reelTransitions.value[col] = STOP_TRANSITION
        reelOffsets.value[col] = -(spinCount * CELL_H)

        setTimeout(() => playStop(), 100)

        // Quand la dernière colonne s'arrête → afficher le résultat
        if (col === n - 1) {
          setTimeout(() => {
            resultat.value = res
            spinning.value = false
            if (currentUser.value) {
              currentUser.value = { ...currentUser.value, solde: res.solde }
            }

            // Sons et effets selon le résultat
            if (res.type === 'none') {
              if (res.near_miss) {
                nearMiss.value = true
                playNearMiss()
                setTimeout(() => { nearMiss.value = false }, 650)
              }
            } else {
              winningCols.value = new Set(res.winning_cols)
              triggerWinEffects(res.type)
              if (res.is_jackpot) {
                isJackpot.value = true
                playJackpot()
                setTimeout(() => { isJackpot.value = false }, 9000)
              } else if (res.type.startsWith('three')) {
                playBigWin()
              } else {
                playSmallWin()
              }
            }

            // Auto-spin : lancer le suivant
            if (autoSpinning.value) {
              autoSpinRemaining.value--
              if (autoSpinRemaining.value > 0 && solde.value >= mise.value) {
                const delay = res.type !== 'none' ? 1800 : 600
                setTimeout(() => { if (autoSpinning.value) lancerSpin() }, delay)
              } else {
                autoSpinning.value      = false
                autoSpinRemaining.value = 0
              }
            }
          }, 900)
        }
      }
    }, STEP_MS)
  }
}

onMounted(async () => {
  try { const g = await getCasinoGames(); if (!g.slots) jeuIndisponible.value = true } catch {}
  try {
    const data = await getSlotsConfig()
    config.value   = data.config
    symboles.value = data.symboles
    mise.value     = data.config.mise_min
    if (data.symboles.length >= 2) buildInitialStrips()
  } catch (e) {
    erreur.value = e.message
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page { min-height: 100vh; background: #090909; color: #fff; }

.page-inner {
  max-width: 600px;
  margin: 0 auto;
  padding: 48px 24px 80px;
}

/* Header */
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 24px;
}

.page-label {
  font-family: 'Cinzel', serif;
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
  margin: 0 0 6px;
}

.page-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.7rem;
  font-weight: 400;
  margin: 0;
  letter-spacing: 0.06em;
}

.page-divider {
  height: 1px;
  background: rgba(255,255,255,0.06);
  margin-bottom: 40px;
}

.solde-display { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }

.solde-label {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.3);
}

.solde-value {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.15rem;
  color: rgba(255,255,255,0.85);
}

.loading, .vide {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1.05rem;
  font-style: italic;
  color: rgba(255,255,255,0.3);
  padding: 60px 0;
  text-align: center;
}

.link-admin {
  color: rgba(139,26,26,0.8);
  text-decoration: underline;
}

/* Machine */
.machine {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
}

/* ── Rouleaux ────────────────────────────────────────────────────────────── */
.slots-frame {
  position: relative;
  width: 100%;
}

/* Encoches latérales de la payline */
.payline-notch {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 28px;
  background: rgba(139,26,26,0.45);
  z-index: 3;
  pointer-events: none;
}
.payline-notch--left  { left:  -7px; }
.payline-notch--right { right: -7px; }

/* Grille 3 colonnes */
.slot-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
  background: #0a0a0b;
  border: 1px solid rgba(255,255,255,0.07);
  padding: 3px;
  overflow: hidden;
}

/* Chaque colonne = fenêtre de 3 cellules visibles */
.reel-wrapper {
  height: calc(3 * 110px); /* 3 × CELL_H */
  overflow: hidden;
  position: relative;
  background: #111113;
}

/* La bande défilante */
.reel-strip {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  will-change: transform;
}

/* Une cellule */
.reel-cell {
  height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #111113;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  overflow: hidden;
}

.reel-cell img {
  width: 88%;
  height: 88%;
  object-fit: contain;
  display: block;
}

/* Cellule Wild */
.reel-cell--wild {
  position: relative;
  border: 1px solid rgba(200, 165, 40, 0.35);
  background: rgba(180, 140, 20, 0.06);
}

.wild-badge {
  position: absolute;
  top: 4px;
  right: 5px;
  font-family: 'Cinzel', serif;
  font-size: 0.5rem;
  letter-spacing: 0.08em;
  color: rgba(220, 180, 50, 0.75);
  line-height: 1;
  pointer-events: none;
}

/* Cellule gagnante */
.reel-cell--win {
  animation: cellWin 0.7s ease-out forwards;
}

@keyframes cellWin {
  0%   { background: #111113; box-shadow: none; }
  25%  { background: rgba(139,26,26,0.28); box-shadow: inset 0 0 22px rgba(200,80,80,0.45); }
  100% { background: rgba(139,26,26,0.12); box-shadow: inset 0 0 12px rgba(200,80,80,0.2); }
}

/* Near miss — vibration horizontale */
.reel-wrapper--nearmiss {
  animation: nearMissShake 0.55s ease-out;
}

@keyframes nearMissShake {
  0%, 100% { transform: translateX(0); }
  15%  { transform: translateX(-4px); }
  35%  { transform: translateX(4px); }
  55%  { transform: translateX(-3px); }
  75%  { transform: translateX(2px); }
  90%  { transform: translateX(-1px); }
}

.cell-nom {
  font-family: 'Cinzel', serif;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  color: rgba(255,255,255,0.45);
  text-align: center;
  padding: 8px;
  word-break: break-word;
}

.cell-vide {
  font-family: 'Cinzel', serif;
  font-size: 1.4rem;
  color: rgba(255,255,255,0.07);
}

/* Overlay de payline (ligne centrale) */
.payline-overlay {
  position: absolute;
  top:    calc(100% / 3);
  left:   0;
  right:  0;
  height: calc(100% / 3);
  border-top:    1px solid rgba(139,26,26,0.18);
  border-bottom: 1px solid rgba(139,26,26,0.18);
  pointer-events: none;
  transition: background 0.4s, box-shadow 0.4s, border-color 0.4s;
  z-index: 2;
}

.payline-overlay--win {
  background:   rgba(139,26,26,0.07);
  border-color: rgba(200,80,80,0.5);
  box-shadow:   inset 0 0 24px rgba(139,26,26,0.18), 0 0 20px rgba(139,26,26,0.12);
  animation: winPulse 1.2s ease-in-out 2;
}

@keyframes winPulse {
  0%, 100% { box-shadow: inset 0 0 24px rgba(139,26,26,0.18), 0 0 20px rgba(139,26,26,0.12); }
  50%       { box-shadow: inset 0 0 40px rgba(139,26,26,0.3),  0 0 40px rgba(139,26,26,0.25); }
}

/* ── Contrôles ───────────────────────────────────────────────────────────── */
.controls {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Résultat — toujours présent, hauteur fixe, pas de saut de layout */
.resultat {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 18px;
  height: 46px;
  box-sizing: border-box;
  border: 1px solid rgba(255,255,255,0.06);
  background: #141416;
  transition: border-color 0.3s, background 0.3s;
}

.resultat--vide {
  border-color: transparent;
  background: transparent;
}

.resultat--win {
  border-color: rgba(139,26,26,0.3);
  background: rgba(139,26,26,0.06);
}

.resultat-label {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
}

.resultat-label--lose { color: rgba(255,255,255,0.2); }

.resultat-montant {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.3rem;
  color: #c87070;
  flex: 1;
}

.resultat-montant--lose {
  color: rgba(255,255,255,0.2);
  font-size: 1rem;
  font-family: 'Cinzel', serif;
}

.resultat-mult {
  font-family: 'Cinzel', serif;
  font-size: 0.72rem;
  color: rgba(139,26,26,0.65);
  letter-spacing: 0.08em;
}

/* Mise */
.mise-field { display: flex; flex-direction: column; gap: 8px; }

.field-label {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.28);
}

.mise-input-wrap {
  background: #0f0f10;
  border: 1px solid rgba(255,255,255,0.08);
}
.mise-input-wrap:focus-within { border-color: rgba(139,26,26,0.35); }

.field-input {
  width: 100%;
  box-sizing: border-box;
  background: transparent;
  border: none;
  color: #d4cfc9;
  padding: 9px 12px;
  font-family: 'Cinzel', serif;
  font-size: 0.92rem;
  outline: none;
}

.mise-hint {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.82rem;
  font-style: italic;
  color: rgba(255,255,255,0.18);
  margin: 0;
}

/* Presets */
.presets {
  display: flex;
  flex-direction: row;
  gap: 6px;
  flex-wrap: wrap;
}

.preset-btn {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.28);
  padding: 4px 10px;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
}
.preset-btn:hover:not(:disabled) { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.6); }
.preset-btn--active { border-color: rgba(139,26,26,0.35); color: #c05050; background: rgba(139,26,26,0.07); }
.preset-btn:disabled { opacity: 0.25; cursor: default; }

.erreur {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.95rem;
  font-style: italic;
  color: #c05050;
}

/* Bouton Lancer */
.btn-spin {
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  background: #8b1a1a;
  color: #fff;
  border: none;
  padding: 15px 0;
  cursor: pointer;
  width: 100%;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 50px;
}
.btn-spin:hover:not(:disabled) { background: #a82020; }
.btn-spin:disabled { opacity: 0.45; cursor: default; }

/* ── Série automatique ───────────────────────────────────────────────────── */
.auto-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid rgba(255,255,255,0.05);
  background: #0d0d0e;
}

.auto-label {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.2);
  flex-shrink: 0;
}

.auto-counts {
  display: flex;
  gap: 5px;
  flex: 1;
}

.auto-count-btn {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.25);
  padding: 5px 10px;
  cursor: pointer;
  transition: all 0.12s;
}
.auto-count-btn:hover:not(:disabled) { border-color: rgba(255,255,255,0.18); color: rgba(255,255,255,0.55); }
.auto-count-btn--on { border-color: rgba(139,26,26,0.4); color: #c05050; background: rgba(139,26,26,0.08); }
.auto-count-btn:disabled { opacity: 0.2; cursor: default; }

.auto-go {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  background: transparent;
  border: none;
  color: rgba(200,80,80,0.5);
  cursor: pointer;
  padding: 4px 0;
  transition: color 0.12s;
  flex-shrink: 0;
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: rgba(139,26,26,0.3);
}
.auto-go:hover:not(:disabled) { color: #c87070; }
.auto-go:disabled { opacity: 0.2; cursor: default; text-decoration: none; }

/* Barre d'arrêt auto-spin */
.auto-stop-bar {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 14px;
  background: rgba(139,26,26,0.06);
  border: 1px solid rgba(139,26,26,0.22);
  cursor: pointer;
  transition: background 0.15s;
}
.auto-stop-bar:hover { background: rgba(139,26,26,0.12); }

.auto-stop-remaining {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.95rem;
  font-style: italic;
  color: rgba(255,255,255,0.35);
}

.auto-stop-cta {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(200,80,80,0.6);
}

/* Points de chargement */
.spin-dots { display: flex; gap: 7px; align-items: center; }
.spin-dots span {
  width: 5px; height: 5px;
  background: rgba(255,255,255,0.55);
  border-radius: 50%;
  animation: dotBlink 1s ease-in-out infinite;
}
.spin-dots span:nth-child(2) { animation-delay: 0.18s; }
.spin-dots span:nth-child(3) { animation-delay: 0.36s; }

@keyframes dotBlink {
  0%, 80%, 100% { opacity: 0.2; transform: scale(0.85); }
  40%           { opacity: 1;   transform: scale(1.15); }
}

/* Règles */
.regles {
  width: 100%;
  border: 1px solid rgba(255,255,255,0.05);
}

.regles-toggle {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.25);
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  padding: 11px 16px;
  cursor: pointer;
  transition: color 0.15s;
}
.regles-toggle:hover { color: rgba(255,255,255,0.5); }

.regles-chevron {
  font-size: 1rem;
  line-height: 1;
  transition: transform 0.2s;
  display: inline-block;
}
.regles-chevron--open { transform: rotate(90deg); }

.regles-body {
  border-top: 1px solid rgba(255,255,255,0.05);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.regle-item {
  display: flex;
  gap: 12px;
  align-items: baseline;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.98rem;
  color: rgba(255,255,255,0.45);
  line-height: 1.5;
}

.regle-dot {
  width: 4px;
  height: 4px;
  background: rgba(139,26,26,0.6);
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 7px;
}

.regle-item strong {
  color: rgba(255,255,255,0.7);
  font-weight: 600;
}

/* ── Jackpot Overlay ─────────────────────────────────────────────────────── */
.jackpot-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.jackpot-inner {
  text-align: center;
  padding: 48px 40px;
  border: 1px solid rgba(139,26,26,0.35);
  background: rgba(10, 5, 5, 0.95);
  animation: jackpotPulse 1.6s ease-in-out infinite;
}

@keyframes jackpotPulse {
  0%, 100% { box-shadow: 0 0 40px rgba(139,26,26,0.2); }
  50%       { box-shadow: 0 0 80px rgba(139,26,26,0.45), 0 0 160px rgba(139,26,26,0.15); }
}

.jackpot-eyebrow {
  font-family: 'Cinzel', serif;
  font-size: 0.72rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: rgba(200,80,80,0.7);
  margin: 0 0 18px;
}

.jackpot-gain {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 2.8rem;
  color: #c87070;
  margin: 0 0 8px;
  letter-spacing: 0.04em;
  animation: jackpotGlowText 1.6s ease-in-out infinite;
}

@keyframes jackpotGlowText {
  0%, 100% { text-shadow: 0 0 20px rgba(200,80,80,0.4); }
  50%       { text-shadow: 0 0 40px rgba(200,80,80,0.8), 0 0 80px rgba(200,80,80,0.3); }
}

.jackpot-mult {
  font-family: 'Cinzel', serif;
  font-size: 0.85rem;
  letter-spacing: 0.1em;
  color: rgba(200,80,80,0.5);
  margin: 0 0 32px;
}

.jackpot-dismiss {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.9rem;
  font-style: italic;
  color: rgba(255,255,255,0.18);
  margin: 0;
}

/* ── Shake écran ─────────────────────────────────────────────────────────── */
.page--shake { animation: pageShake 0.45s ease-out; }

@keyframes pageShake {
  0%, 100% { transform: translate(0, 0); }
  15%  { transform: translate(-6px, -3px); }
  30%  { transform: translate(6px, 3px); }
  45%  { transform: translate(-4px, 2px); }
  60%  { transform: translate(4px, -2px); }
  75%  { transform: translate(-2px, 1px); }
  90%  { transform: translate(2px, -1px); }
}

/* ── Flash de victoire ───────────────────────────────────────────────────── */
.win-flash {
  position: fixed;
  inset: 0;
  z-index: 500;
  pointer-events: none;
}

.win-flash--small {
  background: radial-gradient(ellipse at center, rgba(139,26,26,0.22) 0%, transparent 70%);
  animation: flashPulse 1.4s ease-out forwards;
}
.win-flash--big {
  background: radial-gradient(ellipse at center, rgba(180,50,50,0.35) 0%, transparent 65%);
  animation: flashPulse 2s ease-out forwards;
}
.win-flash--jackpot {
  background: radial-gradient(ellipse at center, rgba(220,80,80,0.45) 0%, rgba(139,26,26,0.2) 50%, transparent 75%);
  animation: flashPulseJackpot 2.5s ease-out forwards;
}

@keyframes flashPulse {
  0%   { opacity: 0; }
  10%  { opacity: 1; }
  40%  { opacity: 0.85; }
  100% { opacity: 0; }
}

@keyframes flashPulseJackpot {
  0%   { opacity: 0; }
  8%   { opacity: 1; }
  30%  { opacity: 0.9; }
  55%  { opacity: 0.7; }
  75%  { opacity: 0.4; }
  100% { opacity: 0; }
}

/* ── Rayons lumineux (jackpot) ───────────────────────────────────────────── */
.rays-container {
  position: fixed;
  inset: 0;
  z-index: 490;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.ray {
  position: absolute;
  width: 3px;
  height: 100vh;
  background: linear-gradient(to top, transparent 0%, rgba(200,80,80,0.18) 40%, rgba(220,100,100,0.35) 50%, rgba(200,80,80,0.18) 60%, transparent 100%);
  transform-origin: center center;
  transform: rotate(var(--rot));
  animation: rayPulse 3.8s ease-in-out forwards;
  animation-delay: var(--delay);
  opacity: 0;
}

@keyframes rayPulse {
  0%   { opacity: 0;    transform: rotate(var(--rot)) scaleX(1); }
  15%  { opacity: 1;    transform: rotate(var(--rot)) scaleX(2.5); }
  50%  { opacity: 0.6;  transform: rotate(calc(var(--rot) + 8deg)) scaleX(1.8); }
  80%  { opacity: 0.3;  transform: rotate(calc(var(--rot) + 15deg)) scaleX(1); }
  100% { opacity: 0; }
}

/* ── Particules ──────────────────────────────────────────────────────────── */
.particles-container {
  position: fixed;
  inset: 0;
  z-index: 600;
  pointer-events: none;
  overflow: hidden;
}

.particle {
  position: absolute;
  border-radius: 50%;
  opacity: 0;
  animation: particleFly linear forwards;
}

@keyframes particleFly {
  0%   { transform: translate(0, 0) scale(1);   opacity: 1; }
  60%  { opacity: 0.7; }
  85%  { opacity: 0.3; }
  100% { transform: translate(var(--dx), var(--dy)) scale(0.2); opacity: 0; }
}

/* Transition jackpot */
.jackpot-fade-enter-active { transition: opacity 0.35s ease; }
.jackpot-fade-leave-active { transition: opacity 0.25s ease; }
.jackpot-fade-enter-from,
.jackpot-fade-leave-to     { opacity: 0; }

.jeu-indispo {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: calc(100vh - 60px); gap: 12px; text-align: center; padding: 40px;
}
.jeu-indispo-title {
  font-family: 'Cinzel', serif; font-size: 1.4rem; letter-spacing: 0.06em; color: rgba(255,255,255,0.7);
}
.jeu-indispo-sub {
  font-family: 'Crimson Text', Georgia, serif; font-style: italic;
  color: rgba(255,255,255,0.3); font-size: 1rem;
}
.jeu-indispo-link {
  margin-top: 16px; font-family: 'Cinzel', serif; font-size: 0.65rem;
  letter-spacing: 0.15em; text-transform: uppercase;
  color: rgba(139,26,26,0.7); text-decoration: none;
}
.jeu-indispo-link:hover { color: rgba(139,26,26,1); }
</style>

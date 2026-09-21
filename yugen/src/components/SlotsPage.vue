<template>
  <div class="page">
    <AppNavbar />

    <div class="page-inner">

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
              <div v-for="col in nbCols" :key="col" class="reel-wrapper">
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
                    class="reel-cell"
                  >
                    <img
                      v-if="sym && sym.image_url"
                      :src="IMG_BASE + sym.image_url"
                      :alt="sym.nom"
                    />
                    <span v-else-if="sym" class="cell-nom">{{ sym.nom }}</span>
                    <span v-else class="cell-vide">?</span>
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

            <button
              class="btn-spin"
              :disabled="spinning || !mise"
              @click="lancerSpin"
            >
              <span v-if="spinning" class="spin-dots">
                <span></span><span></span><span></span>
              </span>
              <span v-else>Lancer</span>
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
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import AppNavbar from './AppNavbar.vue'
import { currentUser } from '../auth.js'
import { getSlotsConfig, spinSlots, IMG_BASE } from '../api.js'
import { playTick, playStop, playWin, resumeAudio } from '../slots-audio.js'

// ── Constantes animation ──────────────────────────────────────────────────
const CELL_H = 110 // hauteur d'une cellule en px

// Durée du scroll rapide par step (ms)
const STEP_MS = 65

// Transition de décélération à l'arrêt de chaque rouleau
const STOP_TRANSITION = 'transform 0.5s cubic-bezier(0.215, 0.61, 0.355, 1)'

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

const nbCols = computed(() => config.value?.nb_colonnes ?? 3)

// Chaque colonne a un spin count croissant pour l'effet de décalage
const colSpinCounts = computed(() =>
  Array.from({ length: nbCols.value }, (_, i) => 8 + i * 4)
)

const solde = computed(() => currentUser.value?.solde ?? 0)

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

  // Récupérer le résultat côté serveur en premier
  let res
  try {
    res = await spinSlots(mise.value)
  } catch (e) {
    spinning.value = false
    erreur.value   = e.message
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
            if (res.type !== 'none') playWin()
          }, 550)
        }
      }
    }, STEP_MS)
  }
}

onMounted(async () => {
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
</style>

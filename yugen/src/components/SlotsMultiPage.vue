<template>
  <div class="page">
    <AppNavbar />

    <div v-if="jeuIndisponible" class="jeu-indispo">
      <p class="jeu-indispo-title">Jeu indisponible</p>
      <p class="jeu-indispo-sub">La Machine à Sous est temporairement fermée.</p>
      <RouterLink to="/casino" class="jeu-indispo-link">← Retour au casino</RouterLink>
    </div>

    <div v-if="!jeuIndisponible" class="page-inner">

      <div class="page-header">
        <div>
          <RouterLink to="/slots" class="back-link">← Machine à Sous</RouterLink>
          <h1 class="page-title">Multi-Spin</h1>
        </div>
        <div class="solde-display">
          <span class="solde-label">Solde</span>
          <span class="solde-value">{{ solde.toLocaleString() }} ¥</span>
        </div>
      </div>

      <div class="page-divider"></div>

      <div v-if="!config" class="vide">Chargement…</div>

      <template v-else>

        <!-- Sélecteur nombre de machines -->
        <div class="selector-row">
          <span class="selector-label">Machines</span>
          <div class="selector-btns">
            <button v-for="n in [2, 3, 4, 5]" :key="n"
              :class="['sel-btn', nbMachines === n ? 'sel-btn--active' : '']"
              :disabled="spinning" @click="setNbMachines(n)">{{ n }}</button>
          </div>
        </div>

        <!-- Grille des machines -->
        <div class="machines-grid" :style="{ gridTemplateColumns: `repeat(${nbMachines}, 1fr)` }">
          <div v-for="(m, mi) in machineStates" :key="mi" class="machine-wrap">

            <p class="machine-num">#{{ mi + 1 }}</p>

            <div class="slots-frame">
              <div class="slot-grid" :style="{ gridTemplateColumns: `repeat(${nbCols}, 1fr)` }">
                <div v-for="col in nbCols" :key="col"
                  :class="['reel-wrapper', m.nearMiss ? 'reel-wrapper--nearmiss' : '']"
                  :style="{ height: (CELL_H * 3) + 'px' }">
                  <div class="reel-strip"
                    :style="{
                      transform: `translateY(${m.offsets[col - 1]}px)`,
                      transition: m.transitions[col - 1],
                    }">
                    <div
                      v-for="(sym, idx) in m.strips[col - 1]" :key="idx"
                      :class="[
                        'reel-cell',
                        sym?.is_wild ? 'reel-cell--wild' : '',
                        m.winningCols.has(col - 1) && idx === m.paylineIdx[col - 1] && !spinning && m.resultat ? 'reel-cell--win' : '',
                      ]"
                      :style="{ height: CELL_H + 'px' }">
                      <img v-if="sym?.image_url" :src="IMG_BASE + sym.image_url" :alt="sym.nom" />
                      <span v-else-if="sym" class="cell-nom">{{ sym.nom }}</span>
                      <span v-else class="cell-vide">?</span>
                      <span v-if="sym?.is_wild" class="wild-badge">W</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Ligne payline -->
              <div
                :class="['payline-overlay', m.resultat && m.resultat.type !== 'none' && !spinning ? 'payline-overlay--win' : '']"
                :style="{ top: CELL_H + 'px', height: CELL_H + 'px' }">
              </div>
            </div>

            <!-- Résultat par machine -->
            <div :class="['machine-result', m.resultat && m.resultat.type !== 'none' ? 'mr--win' : '', !m.resultat || spinning ? 'mr--vide' : '']">
              <template v-if="m.resultat && !spinning">
                <span v-if="m.resultat.type !== 'none'" class="mr-gain">
                  +{{ m.resultat.gain.toLocaleString() }} ¥
                </span>
                <span v-else class="mr-loss">−{{ mise.toLocaleString() }} ¥</span>
              </template>
            </div>

          </div>
        </div>

        <!-- Récapitulatif total -->
        <Transition name="summary-pop">
          <div v-if="summary && !spinning" class="summary">
            <div class="sum-item">
              <span class="sum-label">Total misé</span>
              <span class="sum-val">{{ summary.total_mise.toLocaleString() }} ¥</span>
            </div>
            <div class="sum-divider"></div>
            <div class="sum-item">
              <span class="sum-label">Total récupéré</span>
              <span class="sum-val">{{ summary.total_gain.toLocaleString() }} ¥</span>
            </div>
            <div class="sum-divider"></div>
            <div class="sum-item">
              <span class="sum-label">Gain net</span>
              <span :class="['sum-val', 'sum-net', summary.total_gain_net > 0 ? 'pos' : summary.total_gain_net < 0 ? 'neg' : '']">
                {{ summary.total_gain_net > 0 ? '+' : '' }}{{ summary.total_gain_net.toLocaleString() }} ¥
              </span>
            </div>
          </div>
        </Transition>

        <!-- Contrôles -->
        <div class="controls">
          <div v-if="erreur" class="erreur">{{ erreur }}</div>

          <div class="mise-field">
            <label class="field-label">Mise par machine (¥)</label>
            <div class="mise-input-wrap">
              <input v-model.number="mise" type="number" class="field-input"
                :min="config.mise_min" :max="config.mise_max" :step="config.mise_min"
                :disabled="spinning" />
            </div>
            <div class="presets">
              <button v-for="p in presets" :key="p"
                :class="['preset-btn', mise === p ? 'preset-btn--active' : '']"
                :disabled="spinning" @click="mise = p">{{ formatPreset(p) }}</button>
            </div>
            <p class="mise-hint">
              {{ config.mise_min.toLocaleString() }} – {{ config.mise_max.toLocaleString() }} ¥ par machine
              · <strong>Total : {{ (mise * nbMachines).toLocaleString() }} ¥</strong>
            </p>
          </div>

          <button class="btn-spin" :disabled="spinning || !mise" @click="lancerMultiSpin">
            <span v-if="spinning" class="spin-dots"><span></span><span></span><span></span></span>
            <span v-else>Lancer {{ nbMachines }} machines</span>
          </button>
        </div>

      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import AppNavbar from './AppNavbar.vue'
import { currentUser } from '../auth.js'
import { getSlotsConfig, IMG_BASE, getCasinoGames } from '../api.js'
import { playTick, playStop, playSmallWin, playBigWin, resumeAudio } from '../slots-audio.js'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
async function apiFetch(url, opts = {}) {
  const res = await fetch(url, { ...opts, credentials: 'include', headers: { 'Content-Type': 'application/json' } })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Erreur')
  return data
}

const STEP_MS          = 80
const STOP_TRANSITION  = 'transform 0.85s cubic-bezier(0.34, 1.3, 0.64, 1)'

// ── State ─────────────────────────────────────────────────────────────────────
const config       = ref(null)
const symboles     = ref([])
const spinning     = ref(false)
const erreur       = ref('')
const mise         = ref(0)
const nbMachines   = ref(3)
const summary      = ref(null)
const machineStates = ref([])
const jeuIndisponible = ref(false)

const solde   = computed(() => currentUser.value?.solde ?? 0)
const nbCols  = computed(() => config.value?.nb_colonnes ?? 3)
const CELL_H  = computed(() => ({ 2: 90, 3: 80, 4: 68, 5: 58 }[nbMachines.value] ?? 80))

const presets = computed(() => {
  if (!config.value) return []
  const { mise_min: mn, mise_max: mx } = config.value
  return [...new Set([mn, mn * 5, Math.round(mx / 4), Math.round(mx / 2), mx])]
    .filter(v => v >= mn && v <= mx).slice(0, 5)
})

function formatPreset(v) {
  if (v >= 1_000_000) return (v / 1_000_000).toLocaleString() + 'M'
  if (v >= 1_000)     return (v / 1_000).toLocaleString() + 'k'
  return v.toLocaleString()
}

function randomSym() {
  return symboles.value[Math.floor(Math.random() * symboles.value.length)]
}

// ── Machines ──────────────────────────────────────────────────────────────────

function makeMachine(idx) {
  const cols       = nbCols.value
  // Décalage : machine idx s'arrête plus tard que machine idx-1
  const spinCounts = Array.from({ length: cols }, (_, j) => 8 + j * 4 + idx * 4)
  return {
    strips:      Array.from({ length: cols }, (_, j) => Array.from({ length: spinCounts[j] + 3 }, randomSym)),
    offsets:     Array(cols).fill(0),
    transitions: Array(cols).fill('none'),
    paylineIdx:  spinCounts.map(sc => sc + 1),
    spinCounts,
    intervals:   Array(cols).fill(null),
    resultat:    null,
    winningCols: new Set(),
    nearMiss:    false,
  }
}

function buildMachines() {
  machineStates.value = Array.from({ length: nbMachines.value }, (_, i) => makeMachine(i))
}

function setNbMachines(n) {
  nbMachines.value = n
  summary.value    = null
  buildMachines()
}

// ── Animation ─────────────────────────────────────────────────────────────────

async function lancerMultiSpin() {
  if (spinning.value || !mise.value) return
  resumeAudio()
  erreur.value  = ''
  summary.value = null
  spinning.value = true

  // Stopper les éventuels intervalles et remettre à zéro
  machineStates.value.forEach(m => {
    m.intervals.forEach(id => id && clearInterval(id))
    m.intervals.fill(null)
    m.resultat    = null
    m.winningCols = new Set()
    m.nearMiss    = false
    m.transitions = Array(nbCols.value).fill('none')
    m.offsets     = Array(nbCols.value).fill(0)
  })

  // Résultats serveur
  let res
  try {
    res = await apiFetch(`${BASE}/slots/multispin`, {
      method: 'POST',
      body: JSON.stringify({ mise: mise.value, nb_machines: nbMachines.value }),
    })
  } catch (e) {
    erreur.value   = e.message
    spinning.value = false
    return
  }

  if (currentUser.value) currentUser.value = { ...currentUser.value, solde: res.solde }

  const cols  = nbCols.value
  const cellH = CELL_H.value

  // Reconstruire les bandes avec les résultats
  for (let mi = 0; mi < nbMachines.value; mi++) {
    const m    = machineStates.value[mi]
    const spin = res.resultats[mi]
    for (let col = 0; col < cols; col++) {
      const sc = m.spinCounts[col]
      m.strips[col] = [
        ...Array.from({ length: sc }, randomSym),
        spin.grille[col],
        spin.grille[cols + col],
        spin.grille[2 * cols + col],
      ]
    }
  }

  // Laisser Vue mettre à jour le DOM avant d'animer
  await new Promise(r => setTimeout(r, 16))

  let doneCount = 0

  for (let mi = 0; mi < nbMachines.value; mi++) {
    const m    = machineStates.value[mi]
    const spin = res.resultats[mi]

    for (let col = 0; col < cols; col++) {
      const sc  = m.spinCounts[col]
      let   step = 0

      m.intervals[col] = setInterval(() => {
        step++
        m.offsets[col] = -(step * cellH)
        playTick()

        if (step >= sc - 1) {
          clearInterval(m.intervals[col])
          m.intervals[col]    = null
          m.transitions[col]  = STOP_TRANSITION
          m.offsets[col]      = -(sc * cellH)
          setTimeout(() => playStop(), 100)

          // Dernière colonne de cette machine → afficher résultat
          if (col === cols - 1) {
            setTimeout(() => {
              m.resultat    = spin
              m.winningCols = new Set(spin.winning_cols)
              if (spin.near_miss) {
                m.nearMiss = true
                setTimeout(() => { m.nearMiss = false }, 650)
              }
              if (spin.type !== 'none') {
                if (spin.type.startsWith('three') || spin.is_jackpot) playBigWin()
                else playSmallWin()
              }

              doneCount++
              if (doneCount === nbMachines.value) {
                spinning.value = false
                summary.value  = {
                  total_mise:     res.total_mise,
                  total_gain:     res.total_gain,
                  total_gain_net: res.total_gain_net,
                }
              }
            }, 900)
          }
        }
      }, STEP_MS)
    }
  }
}

// ── Mount ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  try { const g = await getCasinoGames(); if (!g.slots) jeuIndisponible.value = true } catch {}
  try {
    const data     = await getSlotsConfig()
    config.value   = data.config
    symboles.value = data.symboles
    mise.value     = data.config.mise_min
    buildMachines()
  } catch (e) {
    erreur.value = e.message
  }
})
</script>

<style scoped>
.page { min-height: 100vh; background: #090909; color: #fff; }

.page-inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 40px 24px 80px;
}

/* Header */
.page-header {
  display: flex; align-items: flex-end; justify-content: space-between;
  margin-bottom: 24px;
}
.back-link {
  font-family: 'Cinzel', serif; font-size: 0.62rem; letter-spacing: 0.14em;
  text-transform: uppercase; color: rgba(255,255,255,0.3);
  text-decoration: none; display: block; margin-bottom: 8px;
  transition: color 0.15s;
}
.back-link:hover { color: rgba(255,255,255,0.6); }
.page-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.7rem; font-weight: 400; margin: 0; letter-spacing: 0.06em;
}
.page-divider { height: 1px; background: rgba(255,255,255,0.06); margin-bottom: 32px; }
.solde-display { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.solde-label {
  font-family: 'Cinzel', serif; font-size: 0.6rem; letter-spacing: 0.16em;
  text-transform: uppercase; color: rgba(255,255,255,0.3);
}
.solde-value {
  font-family: 'Cinzel Decorative', 'Cinzel', serif; font-size: 1.15rem; color: rgba(255,255,255,0.85);
}

.vide {
  font-family: 'Crimson Text', Georgia, serif; font-size: 1.05rem; font-style: italic;
  color: rgba(255,255,255,0.3); padding: 60px 0; text-align: center;
}

/* Sélecteur */
.selector-row {
  display: flex; align-items: center; gap: 14px; margin-bottom: 24px;
}
.selector-label {
  font-family: 'Cinzel', serif; font-size: 0.6rem; letter-spacing: 0.18em;
  text-transform: uppercase; color: rgba(255,255,255,0.25);
}
.selector-btns { display: flex; gap: 6px; }
.sel-btn {
  font-family: 'Cinzel', serif; font-size: 0.7rem; letter-spacing: 0.08em;
  padding: 6px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.09);
  color: rgba(255,255,255,0.3); cursor: pointer; transition: all 0.12s;
}
.sel-btn:hover:not(:disabled) { border-color: rgba(255,255,255,0.22); color: rgba(255,255,255,0.65); }
.sel-btn--active { border-color: rgba(139,26,26,0.45); color: #c05050; background: rgba(139,26,26,0.08); }
.sel-btn:disabled { opacity: 0.25; cursor: default; }

/* Machines */
.machines-grid {
  display: grid;
  gap: 10px;
  margin-bottom: 20px;
}

.machine-wrap { display: flex; flex-direction: column; gap: 0; }

.machine-num {
  font-family: 'Cinzel', serif; font-size: 0.55rem; letter-spacing: 0.18em;
  text-transform: uppercase; color: rgba(255,255,255,0.18);
  margin: 0 0 6px; text-align: center;
}

/* Slots frame */
.slots-frame { position: relative; width: 100%; }

.slot-grid {
  display: grid; gap: 2px;
  background: #0a0a0b; border: 1px solid rgba(255,255,255,0.07); padding: 2px;
  overflow: hidden;
}

.reel-wrapper { overflow: hidden; position: relative; background: #111113; }

.reel-strip { position: absolute; top: 0; left: 0; right: 0; will-change: transform; }

.reel-cell {
  display: flex; align-items: center; justify-content: center;
  background: #111113; border-bottom: 1px solid rgba(255,255,255,0.03); overflow: hidden;
}
.reel-cell img { width: 82%; height: 82%; object-fit: contain; display: block; }

.reel-cell--wild {
  border: 1px solid rgba(200,165,40,0.35);
  background: rgba(180,140,20,0.06);
  position: relative;
}
.wild-badge {
  position: absolute; top: 3px; right: 3px;
  font-family: 'Cinzel', serif; font-size: 0.42rem; letter-spacing: 0.08em;
  color: rgba(220,180,50,0.75); pointer-events: none;
}
.reel-cell--win { animation: cellWin 0.7s ease-out forwards; }
@keyframes cellWin {
  0%   { background: #111113; box-shadow: none; }
  25%  { background: rgba(139,26,26,0.28); box-shadow: inset 0 0 18px rgba(200,80,80,0.4); }
  100% { background: rgba(139,26,26,0.1);  box-shadow: inset 0 0 10px rgba(200,80,80,0.18); }
}

.reel-wrapper--nearmiss { animation: nearMissShake 0.55s ease-out; }
@keyframes nearMissShake {
  0%, 100% { transform: translateX(0); }
  15%  { transform: translateX(-3px); }
  35%  { transform: translateX(3px); }
  55%  { transform: translateX(-2px); }
  75%  { transform: translateX(2px); }
}

.cell-nom {
  font-family: 'Cinzel', serif; font-size: 0.58rem; letter-spacing: 0.04em;
  color: rgba(255,255,255,0.4); text-align: center; padding: 4px; word-break: break-word;
}
.cell-vide { font-family: 'Cinzel', serif; font-size: 1rem; color: rgba(255,255,255,0.07); }

.payline-overlay {
  position: absolute; left: 0; right: 0;
  border-top: 1px solid rgba(139,26,26,0.15);
  border-bottom: 1px solid rgba(139,26,26,0.15);
  pointer-events: none; z-index: 2;
  transition: background 0.4s, box-shadow 0.4s, border-color 0.4s;
}
.payline-overlay--win {
  background: rgba(139,26,26,0.06); border-color: rgba(200,80,80,0.45);
  box-shadow: inset 0 0 18px rgba(139,26,26,0.15);
  animation: winPulse 1.2s ease-in-out 2;
}
@keyframes winPulse {
  0%, 100% { box-shadow: inset 0 0 18px rgba(139,26,26,0.15); }
  50%       { box-shadow: inset 0 0 30px rgba(139,26,26,0.28), 0 0 24px rgba(139,26,26,0.15); }
}

/* Résultat par machine */
.machine-result {
  height: 32px; display: flex; align-items: center; justify-content: center;
  border: 1px solid transparent; background: transparent;
  font-family: 'Cinzel', serif; font-size: 0.72rem; letter-spacing: 0.05em;
  transition: border-color 0.3s, background 0.3s; margin-top: 4px;
}
.mr--win { border-color: rgba(139,26,26,0.25); background: rgba(139,26,26,0.05); }
.mr--vide { border-color: transparent; background: transparent; }
.mr-gain { color: #c87070; }
.mr-loss { color: rgba(255,255,255,0.2); }

/* Récapitulatif */
.summary {
  display: flex; align-items: center; gap: 0;
  border: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.02);
  margin-bottom: 24px;
}
.sum-item {
  display: flex; flex-direction: column; gap: 4px;
  padding: 14px 20px; flex: 1;
}
.sum-divider { width: 1px; height: 40px; background: rgba(255,255,255,0.06); flex-shrink: 0; }
.sum-label {
  font-family: 'Cinzel', serif; font-size: 0.55rem; letter-spacing: 0.16em;
  text-transform: uppercase; color: rgba(255,255,255,0.22);
}
.sum-val {
  font-family: 'Cinzel', serif; font-size: 0.88rem; letter-spacing: 0.05em; color: #d4cfc9;
}
.sum-net.pos { color: #c87070; }
.sum-net.neg { color: rgba(255,255,255,0.3); }

@keyframes summary-in {
  0%   { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}
.summary-pop-enter-active { animation: summary-in 0.3s ease both; }
.summary-pop-leave-active { transition: opacity 0.15s; }
.summary-pop-leave-to     { opacity: 0; }

/* Contrôles */
.controls { display: flex; flex-direction: column; gap: 14px; max-width: 520px; margin: 0 auto; }

.erreur {
  font-family: 'Crimson Text', Georgia, serif; font-size: 0.95rem;
  font-style: italic; color: #c05050;
}

.mise-field { display: flex; flex-direction: column; gap: 8px; }
.field-label {
  font-family: 'Cinzel', serif; font-size: 0.6rem; letter-spacing: 0.14em;
  text-transform: uppercase; color: rgba(255,255,255,0.28);
}
.mise-input-wrap {
  background: #0f0f10; border: 1px solid rgba(255,255,255,0.08);
}
.mise-input-wrap:focus-within { border-color: rgba(139,26,26,0.35); }
.field-input {
  width: 100%; box-sizing: border-box; background: transparent; border: none;
  color: #d4cfc9; padding: 9px 12px; font-family: 'Cinzel', serif; font-size: 0.92rem; outline: none;
}
.mise-hint {
  font-family: 'Crimson Text', Georgia, serif; font-size: 0.82rem; font-style: italic;
  color: rgba(255,255,255,0.18); margin: 0;
}
.mise-hint strong { color: rgba(255,255,255,0.45); font-weight: 600; }

.presets { display: flex; gap: 6px; flex-wrap: wrap; }
.preset-btn {
  font-family: 'Cinzel', serif; font-size: 0.58rem; letter-spacing: 0.1em;
  text-transform: uppercase; background: transparent; border: 1px solid rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.28); padding: 4px 10px; cursor: pointer; transition: all 0.12s;
}
.preset-btn:hover:not(:disabled) { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.6); }
.preset-btn--active { border-color: rgba(139,26,26,0.35); color: #c05050; background: rgba(139,26,26,0.07); }
.preset-btn:disabled { opacity: 0.25; cursor: default; }

.btn-spin {
  font-family: 'Cinzel', serif; font-size: 0.72rem; letter-spacing: 0.2em; text-transform: uppercase;
  background: #8b1a1a; color: #fff; border: none; padding: 15px 0; cursor: pointer;
  width: 100%; transition: background 0.15s;
  display: flex; align-items: center; justify-content: center; min-height: 50px;
}
.btn-spin:hover:not(:disabled) { background: #a82020; }
.btn-spin:disabled { opacity: 0.45; cursor: default; }

.spin-dots { display: flex; gap: 7px; align-items: center; }
.spin-dots span {
  width: 5px; height: 5px; background: rgba(255,255,255,0.55); border-radius: 50%;
  animation: dotBlink 1s ease-in-out infinite;
}
.spin-dots span:nth-child(2) { animation-delay: 0.18s; }
.spin-dots span:nth-child(3) { animation-delay: 0.36s; }
@keyframes dotBlink {
  0%, 80%, 100% { opacity: 0.2; transform: scale(0.85); }
  40%           { opacity: 1;   transform: scale(1.15); }
}

/* Jeu indispo */
.jeu-indispo {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: calc(100vh - 60px); gap: 12px; text-align: center; padding: 40px;
}
.jeu-indispo-title { font-family: 'Cinzel', serif; font-size: 1.4rem; letter-spacing: 0.06em; color: rgba(255,255,255,0.7); }
.jeu-indispo-sub   { font-family: 'Crimson Text', Georgia, serif; font-style: italic; color: rgba(255,255,255,0.3); font-size: 1rem; }
.jeu-indispo-link  { margin-top: 16px; font-family: 'Cinzel', serif; font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(139,26,26,0.7); text-decoration: none; }
.jeu-indispo-link:hover { color: rgba(139,26,26,1); }
</style>

<template>
  <div class="page">
    <AppNavbar />

    <div class="page-inner">
      <div class="top-bar">
        <RouterLink to="/casino" class="back-link">← Casino</RouterLink>
        <div class="solde-badge">{{ fmtYen(solde) }}</div>
      </div>

      <h1 class="page-title">Traversée<br>Démoniaque</h1>
      <p class="page-subtitle">Traversez les ruelles. Encaissez avant d'être brûlé.</p>

      <!-- ── Arena ──────────────────────────────────────── -->
      <div class="arena" :class="{ 'arena--bust': bustAnim, 'arena--win': winAnim }">

        <div
          v-for="lane in lanesDisplay"
          :key="lane.num"
          class="lane"
          :class="{
            'lane--pending': !lane.isCleared && !lane.isActive,
            'lane--cleared': lane.isCleared && !lane.isActive,
            'lane--active':  lane.isActive,
            'lane--bust':    lane.isBust,
          }"
        >
          <span class="lane-num">{{ lane.num }}</span>

          <div class="lane-track">
            <!-- Demon actif sur cette ruelle -->
            <template v-if="lane.isActive">
              <span class="demon" :class="{ 'demon--bust': lane.isBust, 'demon--advance': advanceAnim }">😈</span>
            </template>
            <!-- Ruelle traversée -->
            <template v-else-if="lane.isCleared">
              <span class="cleared-check">✓</span>
            </template>
            <!-- Obstacles animés -->
            <template v-else>
              <span
                v-for="obs in lane.obstacles"
                :key="obs.id"
                class="obstacle"
                :style="obs.style"
              >{{ obs.icon }}</span>
            </template>
          </div>

          <span class="lane-mult">×{{ lane.mult.toFixed(2) }}</span>
        </div>

        <!-- Ligne de départ -->
        <div class="lane lane--start">
          <span class="lane-num start-dash">—</span>
          <div class="lane-track">
            <span v-if="laneActuelle === 0 && etat !== 'idle'" class="demon demon--advance" :style="advanceAnim ? 'animation: none' : ''">😈</span>
            <span v-else-if="etat === 'idle'" class="demon demon--idle">😈</span>
          </div>
          <span class="lane-mult start-txt">Départ</span>
        </div>

      </div>

      <!-- ── Multiplicateur courant ──────────────────────── -->
      <Transition name="mb-fade">
        <div v-if="etat === 'en_cours'" class="mult-bar">
          <template v-if="laneActuelle > 0">
            <span class="mb-label">Encaisser maintenant :</span>
            <span class="mb-mult">×{{ MULT[laneActuelle - 1].toFixed(2) }}</span>
            <span class="mb-gain">+{{ fmtYen(Math.floor(miseEnCours * MULT[laneActuelle - 1]) - miseEnCours) }}</span>
          </template>
          <template v-else>
            <span class="mb-hint">Traversez la première ruelle pour débloquer l'encaissement</span>
          </template>
        </div>
      </Transition>

      <!-- ── Résultat ─────────────────────────────────────── -->
      <Transition name="result-pop">
        <div
          v-if="etat === 'fini_bust' || etat === 'fini_win'"
          class="resultat"
          :class="etat === 'fini_bust' ? 'resultat--bust' : 'resultat--win'"
        >
          <span class="r-label">{{ etat === 'fini_bust' ? '🔥 Brûlé !' : '✓ Encaissé !' }}</span>
          <span class="r-gain" :class="gainNet >= 0 ? 'pos' : 'neg'">
            {{ gainNet > 0 ? '+' : '' }}{{ fmtYen(gainNet) }}
          </span>
        </div>
      </Transition>

      <!-- ── Actions ──────────────────────────────────────── -->
      <div class="actions">
        <template v-if="etat === 'idle'">
          <div class="mise-row">
            <label class="mise-label">Mise</label>
            <input
              v-model.number="miseInput"
              type="number"
              class="mise-input"
              :min="1"
              :max="solde"
              step="1000"
              :disabled="loading"
              @keydown.enter="lancerPartie"
            />
          </div>
          <button class="btn btn--invoke" :disabled="loading || miseInput <= 0" @click="lancerPartie">
            Invoquer le Démon
          </button>
        </template>

        <template v-else-if="etat === 'en_cours'">
          <div class="btns">
            <button class="btn btn--avancer" :disabled="loading" @click="doAvancer">
              Traverser ↑
            </button>
            <button
              class="btn btn--encaisser"
              :disabled="loading || laneActuelle === 0"
              @click="doEncaisser"
            >
              Encaisser ×{{ laneActuelle > 0 ? MULT[laneActuelle - 1].toFixed(2) : '—' }}
            </button>
          </div>
        </template>

        <template v-else>
          <div class="btns">
            <button class="btn btn--invoke" @click="rejouer">Rejouer ({{ fmtYen(miseInput) }})</button>
            <button class="btn btn--ghost"  @click="reset">Changer la mise</button>
          </div>
        </template>
      </div>

      <p v-if="erreur" class="erreur">{{ erreur }}</p>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import AppNavbar from './AppNavbar.vue'
import { getMe } from '../api.js'
import { playStep, playBust, playCoin, playInvoke, resumeAudio } from '../crossroad-audio.js'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

async function apiFetch(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const res = await fetch(url, { ...options, credentials: 'include', headers })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Erreur')
  return data
}

const crossroadNew      = (mise) => apiFetch(`${BASE}/crossroad/new`,      { method: 'POST', body: JSON.stringify({ mise }) })
const crossroadAvancer  = ()     => apiFetch(`${BASE}/crossroad/avancer`,  { method: 'POST' })
const crossroadEncaisser = ()    => apiFetch(`${BASE}/crossroad/encaisser`, { method: 'POST' })

// ── Constantes ────────────────────────────────────────────────────────────────

const MULT      = [1.08, 1.23, 1.39, 1.58, 1.80, 2.04, 2.32, 2.64, 3.00, 3.41]
const MAX_LANES = MULT.length

function laneObstacles(laneNum) {
  const icons = ['🔥', '🔥', '💀', '🔥']
  const dir   = laneNum % 2 === 0 ? 'obs-rtl' : 'obs-ltr'
  const dur   = 2.6 + laneNum * 0.12
  return [0, 1, 2, 3].map(i => ({
    id:    i,
    icon:  icons[i],
    style: {
      animationName:     dir,
      animationDuration: `${dur}s`,
      animationDelay:    `${-(i * dur / 4).toFixed(2)}s`,
      animationTimingFunction: 'linear',
      animationIterationCount: 'infinite',
    },
  }))
}

// ── State ─────────────────────────────────────────────────────────────────────

const solde       = ref(0)
const miseInput   = ref(10000)
const miseEnCours = ref(0)
const etat        = ref('idle')   // 'idle' | 'en_cours' | 'fini_bust' | 'fini_win'
const laneActuelle = ref(0)
const gainNet     = ref(0)
const loading     = ref(false)
const erreur      = ref('')
const bustAnim    = ref(false)
const winAnim     = ref(false)
const advanceAnim = ref(false)

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Computed ──────────────────────────────────────────────────────────────────

const lanesDisplay = computed(() => {
  return Array.from({ length: MAX_LANES }, (_, i) => {
    const num       = MAX_LANES - i          // 10, 9, ..., 1
    const mult      = MULT[num - 1]
    const isCleared = etat.value !== 'idle' && laneActuelle.value > num
    const isActive  = etat.value !== 'idle' && laneActuelle.value === num
    const isBust    = isActive && etat.value === 'fini_bust'
    return { num, mult, isCleared, isActive, isBust, obstacles: laneObstacles(num) }
  })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtYen(n) {
  if (n == null) return '—'
  return (n < 0 ? '-¥' : '¥') + Math.abs(n).toLocaleString('fr-FR')
}

function triggerBust() {
  bustAnim.value = true
  setTimeout(() => { bustAnim.value = false }, 600)
}
function triggerWin() {
  winAnim.value = true
  setTimeout(() => { winAnim.value = false }, 900)
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function lancerPartie() {
  if (loading.value) return
  erreur.value = ''
  loading.value = true
  resumeAudio()
  playInvoke()
  try {
    const data = await crossroadNew(miseInput.value)
    miseEnCours.value = miseInput.value
    laneActuelle.value = 0
    etat.value = 'en_cours'
    gainNet.value = 0
    if (data.solde != null) solde.value = data.solde
  } catch (e) {
    erreur.value = e.message
  } finally {
    loading.value = false
  }
}

async function doAvancer() {
  if (loading.value) return
  erreur.value = ''
  loading.value = true
  resumeAudio()
  try {
    const data = await crossroadAvancer()

    // Animation d'avancement
    advanceAnim.value = true
    playStep()
    await sleep(160)
    advanceAnim.value = false

    laneActuelle.value = data.lane_actuelle
    if (data.solde != null) solde.value = data.solde

    if (data.statut === 'bust') {
      etat.value = 'fini_bust'
      gainNet.value = data.gain_net
      triggerBust()
      playBust()
    } else if (data.statut === 'victoire_totale') {
      etat.value = 'fini_win'
      gainNet.value = data.gain_net
      triggerWin()
      playCoin()
    }
    // sinon : 'en_cours', on reste dans le jeu
  } catch (e) {
    erreur.value = e.message
  } finally {
    loading.value = false
  }
}

async function doEncaisser() {
  if (loading.value) return
  erreur.value = ''
  loading.value = true
  resumeAudio()
  try {
    const data = await crossroadEncaisser()
    etat.value = 'fini_win'
    gainNet.value = data.gain_net
    if (data.solde != null) solde.value = data.solde
    triggerWin()
    playCoin()
  } catch (e) {
    erreur.value = e.message
  } finally {
    loading.value = false
  }
}

async function rejouer() {
  etat.value = 'idle'
  await lancerPartie()
}

function reset() {
  etat.value = 'idle'
  laneActuelle.value = 0
  gainNet.value = 0
}

onMounted(async () => {
  const me = await getMe()
  if (me) solde.value = me.solde
})
</script>

<style scoped>
.page { min-height: 100vh; background: #090909; color: #fff; }

.page-inner {
  max-width: 620px;
  margin: 0 auto;
  padding: 3rem 1.5rem 6rem;
}

/* ── Top bar ─────────────────────────────────── */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
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

/* ── Titre ───────────────────────────────────── */
.page-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: clamp(1.6rem, 4vw, 2rem);
  font-weight: 400;
  letter-spacing: 0.06em;
  color: #fff;
  margin: 0 0 0.6rem;
  text-align: center;
  line-height: 1.2;
}

.page-subtitle {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  font-style: italic;
  color: rgba(255,255,255,0.28);
  text-align: center;
  margin: 0 0 2rem;
}

/* ── Arena ───────────────────────────────────── */

@keyframes arena-bust {
  0%,100% { box-shadow: none; }
  35%     { box-shadow: 0 0 40px rgba(192,57,43,0.32) inset; }
}
@keyframes arena-win {
  0%,100% { box-shadow: none; }
  40%     { box-shadow: 0 0 40px rgba(201,168,76,0.22) inset; }
}

.arena {
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255,255,255,0.06);
  overflow: hidden;
}
.arena--bust { animation: arena-bust 0.55s ease; }
.arena--win  { animation: arena-win  0.85s ease; }

/* ── Lane ────────────────────────────────────── */

.lane {
  display: flex;
  align-items: center;
  gap: 0;
  height: 46px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  transition: background 0.25s;
}
.lane:last-child { border-bottom: none; }

.lane-num {
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.15);
  width: 28px;
  text-align: center;
  flex-shrink: 0;
}

.lane-track {
  flex: 1;
  position: relative;
  overflow: hidden;
  height: 100%;
  display: flex;
  align-items: center;
}

.lane-mult {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.18);
  width: 52px;
  text-align: right;
  padding-right: 10px;
  flex-shrink: 0;
  transition: color 0.25s;
}

/* Pending — obstacles animés */
.lane--pending {
  background: #0c0c0e;
}

/* Cleared — dorée */
.lane--cleared {
  background: rgba(201,168,76,0.04);
}
.lane--cleared .lane-mult { color: rgba(201,168,76,0.35); }
.lane--cleared .lane-num  { color: rgba(201,168,76,0.25); }

/* Active — le démon est ici */
.lane--active {
  background: rgba(139,26,26,0.1);
  border-left: 2px solid rgba(139,26,26,0.5);
}
.lane--active .lane-mult { color: rgba(255,255,255,0.55); }
.lane--active .lane-num  { color: rgba(255,255,255,0.35); }

/* Bust — flash rouge */
.lane--bust {
  background: rgba(192,57,43,0.18) !important;
  border-left: 2px solid rgba(192,57,43,0.7) !important;
}

/* Start row */
.lane--start {
  background: rgba(255,255,255,0.02);
  height: 52px;
}
.start-dash { color: rgba(255,255,255,0.08); }
.start-txt  { color: rgba(255,255,255,0.12); font-size: 0.55rem; }

/* ── Obstacles animés ────────────────────────── */

.obstacle {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1rem;
  pointer-events: none;
  user-select: none;
}

@keyframes obs-ltr {
  from { left: -8%; }
  to   { left: 108%; }
}
@keyframes obs-rtl {
  from { left: 108%; }
  to   { left: -8%; }
}

/* ── Demon ───────────────────────────────────── */

.demon {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.3rem;
  user-select: none;
  pointer-events: none;
  z-index: 2;
  filter: drop-shadow(0 0 6px rgba(139,26,26,0.7));
}

@keyframes demon-float {
  0%,100% { transform: translate(-50%, -50%); }
  50%     { transform: translate(-50%, calc(-50% - 4px)); }
}
@keyframes demon-advance {
  0%  { transform: translate(-50%, calc(-50% + 6px)); opacity: 0.6; }
  60% { transform: translate(-50%, calc(-50% - 3px)); }
  100%{ transform: translate(-50%, -50%); opacity: 1; }
}
@keyframes demon-bust {
  0%   { transform: translate(-50%, -50%) scale(1); filter: drop-shadow(0 0 6px rgba(192,57,43,0.9)); }
  40%  { transform: translate(-50%, -50%) scale(1.4) rotate(8deg); }
  100% { transform: translate(-50%, -50%) scale(0) rotate(20deg); opacity: 0; }
}

.demon--idle    { animation: demon-float 2.4s ease-in-out infinite; }
.demon--advance { animation: demon-advance 0.22s ease-out; }
.demon--bust    { animation: demon-bust 0.55s ease-out forwards; }

/* ── Checkmark ───────────────────────────────── */

.cleared-check {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  color: rgba(201,168,76,0.3);
  letter-spacing: 0.05em;
  pointer-events: none;
}

/* ── Mult bar ────────────────────────────────── */

.mult-bar {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
  min-height: 42px;
}

.mb-label {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.25);
}

.mb-mult {
  font-family: 'Cinzel', serif;
  font-size: 0.9rem;
  letter-spacing: 0.08em;
  color: #c9a84c;
  margin-left: auto;
}

.mb-gain {
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  color: rgba(201,168,76,0.7);
}

.mb-hint {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.9rem;
  color: rgba(255,255,255,0.2);
}

.mb-fade-enter-active, .mb-fade-leave-active { transition: opacity 0.2s; }
.mb-fade-enter-from, .mb-fade-leave-to       { opacity: 0; }

/* ── Résultat ────────────────────────────────── */

.resultat {
  margin-top: 14px;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  gap: 18px;
  justify-content: center;
}

.r-label {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1rem;
  letter-spacing: 0.05em;
}
.resultat--bust .r-label  { color: #c0392b; }
.resultat--win  .r-label  { color: #c9a84c; }

.r-gain {
  font-family: 'Cinzel', serif;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
}
.r-gain.pos { color: #c9a84c; }
.r-gain.neg { color: #8b1a1a; }

@keyframes result-in {
  0%   { opacity: 0; transform: translateY(8px) scale(0.92); }
  60%  { transform: translateY(-2px) scale(1.02); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
.result-pop-enter-active { animation: result-in 0.32s ease both; }
.result-pop-leave-active { transition: opacity 0.15s; }
.result-pop-leave-to     { opacity: 0; }

/* ── Actions ─────────────────────────────────── */

.actions {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
}

.mise-row { display: flex; align-items: center; gap: 12px; }

.mise-label {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.3);
}

.mise-input {
  background: #111;
  border: 1px solid rgba(255,255,255,0.12);
  color: #d4cfc9;
  font-family: 'Cinzel', serif;
  font-size: 0.85rem;
  padding: 8px 14px;
  width: 150px;
  text-align: right;
  outline: none;
  transition: border-color 0.15s;
}
.mise-input:focus { border-color: rgba(201,168,76,0.4); }
.mise-input::-webkit-inner-spin-button { opacity: 0.3; }

.btns { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }

.btn {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  padding: 11px 28px;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s, background 0.15s, transform 0.1s;
}
.btn:active:not(:disabled) { transform: scale(0.97); }
.btn:disabled { opacity: 0.35; cursor: not-allowed; }

.btn--invoke {
  background: #8b1a1a;
  color: #e8ddd0;
}
.btn--invoke:hover:not(:disabled) { background: #a01f1f; }

.btn--avancer {
  background: rgba(201,168,76,0.14);
  color: #c9a84c;
  border: 1px solid rgba(201,168,76,0.3);
}
.btn--avancer:hover:not(:disabled) { background: rgba(201,168,76,0.24); }

.btn--encaisser {
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.55);
  border: 1px solid rgba(255,255,255,0.1);
}
.btn--encaisser:hover:not(:disabled) { background: rgba(255,255,255,0.1); }

.btn--ghost {
  background: transparent;
  color: rgba(255,255,255,0.3);
  border: 1px solid rgba(255,255,255,0.1);
}
.btn--ghost:hover:not(:disabled) { color: rgba(255,255,255,0.55); }

.erreur {
  font-family: 'Crimson Text', serif;
  font-style: italic;
  color: #c0392b;
  text-align: center;
  margin-top: 14px;
  font-size: 0.95rem;
}
</style>

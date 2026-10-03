<template>
  <div class="page" :class="{ 'page--shake': isShaking }">
    <AppNavbar />

    <div class="page-inner">

      <!-- Barre haute -->
      <div class="top-bar">
        <RouterLink to="/casino" class="back-link">← Casino</RouterLink>
        <div class="solde-badge">{{ fmtYen(solde) }}</div>
      </div>

      <h1 class="page-title">Corps Démoniaque</h1>

      <!-- ── Orbe central ───────────────────────────────────────────────── -->
      <div class="orb-wrap">

        <!-- Anneau externe -->
        <div class="orb-ring" :class="{ 'orb-ring--spin': statut === 'en_cours', 'orb-ring--bust': statut === 'rupture', 'orb-ring--win': statut === 'scelle' }"></div>

        <!-- Orbe -->
        <div
          class="orb"
          :class="{ 'orb--active': statut === 'en_cours', 'orb--bust': statut === 'rupture', 'orb--win': statut === 'scelle' }"
          :style="{ transform: `scale(${orbScale})` }"
        >
          <div class="orb-inner"></div>

          <div class="orb-content">
            <Transition name="mult-pop" mode="out-in">
              <span :key="multDisplay" class="orb-mult">×{{ multDisplay }}</span>
            </Transition>
            <span class="orb-phase">{{ phaseLabel }}</span>
            <span v-if="statut === 'en_cours' && pumps > 0" class="orb-gain">
              +{{ gainPotentiel.toLocaleString('fr-FR') }} ¥
            </span>
          </div>
        </div>

        <!-- Éclats de rupture -->
        <TransitionGroup name="shard-fly" tag="div" class="shards-layer">
          <div v-for="s in shards" :key="s.id" class="shard" :style="s.style"></div>
        </TransitionGroup>

      </div>

      <!-- ── Barre d'instabilité ────────────────────────────────────────── -->
      <div class="inst-row">
        <span class="inst-label">Instabilité</span>
        <div class="inst-track">
          <div class="inst-fill" :style="{ width: instabiliteDisplay + '%', background: instabiliteColor }"></div>
        </div>
        <span class="inst-pct" :style="{ color: instabiliteColor }">{{ instabiliteDisplay }}%</span>
      </div>

      <!-- ── Difficulté ─────────────────────────────────────────────────── -->
      <div v-if="statut === 'idle'" class="diff-row">
        <button
          v-for="(d, key) in DIFFS"
          :key="key"
          class="diff-btn"
          :class="{ 'diff-btn--active': difficulte === key }"
          @click="difficulte = key"
        >
          <span class="diff-btn-name">{{ d.label }}</span>
        </button>
      </div>

      <div v-else class="diff-tag">
        {{ DIFFS[difficulte]?.label }}
      </div>

      <!-- ── Actions ────────────────────────────────────────────────────── -->
      <div class="actions">

        <!-- IDLE -->
        <template v-if="statut === 'idle'">
          <div class="mise-row">
            <label class="mise-label">Mise</label>
            <input
              v-model.number="mise"
              type="number" min="100" max="50000" step="500"
              class="mise-input"
              @keydown.enter="startGame"
            />
          </div>
          <div class="presets">
            <button v-for="p in PRESETS" :key="p" class="preset-btn" @click="mise = p">
              {{ p.toLocaleString('fr-FR') }}
            </button>
          </div>
          <p v-if="erreur" class="erreur">{{ erreur }}</p>
          <button class="btn btn--invoke" :disabled="busy || !mise || mise < 100" @click="startGame">
            Lancer l'Infusion
          </button>
        </template>

        <!-- EN COURS -->
        <template v-else-if="statut === 'en_cours'">
          <p v-if="erreur" class="erreur">{{ erreur }}</p>
          <div class="btns">
            <button class="btn btn--pump" :disabled="busy" @click="doPump">
              Amplifier  <span class="btn-sub">+{{ (pumpStep * 100).toFixed(0) }}%</span>
            </button>
            <button class="btn btn--sceller" :disabled="busy || pumps === 0" @click="doSceller">
              Sceller  <span class="btn-sub" v-if="pumps > 0">×{{ multDisplay }}</span>
            </button>
          </div>
          <p class="action-note">{{ pumps }} amplification{{ pumps > 1 ? 's' : '' }} · mise {{ fmtYen(miseEnCours) }}</p>
        </template>

        <!-- RÉSULTATS -->
        <template v-else>
          <Transition name="result-pop">
            <div
              class="resultat"
              :class="statut === 'rupture' ? 'resultat--bust' : 'resultat--win'"
            >
              <div class="r-left">
                <span class="r-label">{{ statut === 'rupture' ? 'Rupture Cellulaire' : 'Corps Scellé' }}</span>
                <span class="r-detail" v-if="statut === 'rupture'">
                  Seuil à ×{{ bustMult }} · {{ pumps }} amplification{{ pumps > 1 ? 's' : '' }}
                </span>
                <span class="r-detail" v-else>
                  ×{{ multDisplay }} · {{ pumps }} amplification{{ pumps > 1 ? 's' : '' }}
                </span>
              </div>
              <span class="r-gain" :class="gainNet >= 0 ? 'pos' : 'neg'">
                {{ gainNet > 0 ? '+' : '' }}{{ fmtYen(gainNet) }}
              </span>
            </div>
          </Transition>
          <div class="btns">
            <button class="btn btn--invoke" @click="rejouer">Rejouer ({{ fmtYen(miseEnCours) }})</button>
            <button class="btn btn--ghost" @click="reset">Changer</button>
          </div>
        </template>

      </div>

      <!-- ── Historique ──────────────────────────────────────────────────── -->
      <div v-if="historique.length" class="hist-strip">
        <TransitionGroup name="hist-item" tag="div" class="hist-list">
          <span
            v-for="h in historique"
            :key="h.id"
            class="hist-chip"
            :class="h.statut === 'scelle' ? 'hist-chip--win' : 'hist-chip--loss'"
          >
            ×{{ h.mult }}
          </span>
        </TransitionGroup>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AppNavbar from './AppNavbar.vue'
import { corpsState, corpsStart, corpsPump, corpsSceller } from '../api.js'

const PRESETS = [500, 1000, 5000, 10000]

const DIFFS = {
  initie:      { label: 'Facile',         pump_step: 0.08, house_edge: 0.35 },
  demoniaque:  { label: 'Difficile',      pump_step: 0.12, house_edge: 0.25 },
  experimente: { label: 'Très difficile', pump_step: 0.20, house_edge: 0.45 },
}

// ── State ─────────────────────────────────────────────────────────────────────
const statut      = ref('idle')
const pumps       = ref(0)
const mult        = ref(1.0)
const mise        = ref(1000)
const miseEnCours = ref(0)
const solde       = ref(0)
const gainNet     = ref(0)
const bustMult    = ref(null)
const erreur      = ref('')
const busy        = ref(false)
const isShaking   = ref(false)
const historique  = ref([])
const shards      = ref([])
const difficulte  = ref('demoniaque')
const pumpStep    = ref(0.12)

// ── Computed ──────────────────────────────────────────────────────────────────
const multDisplay = computed(() => mult.value.toFixed(2))

const gainPotentiel = computed(() =>
  pumps.value > 0 && miseEnCours.value > 0
    ? Math.floor(miseEnCours.value * mult.value) - miseEnCours.value
    : 0
)

const instabiliteDisplay = computed(() => {
  if (pumps.value === 0) return 0
  const he = DIFFS[difficulte.value]?.house_edge ?? 0.25
  return Math.min(99, parseFloat(((1 - (1 - he) / mult.value) * 100).toFixed(1)))
})

const instabiliteColor = computed(() => {
  const v = instabiliteDisplay.value
  if (v < 30) return '#c9a84c'
  if (v < 60) return '#c47830'
  if (v < 80) return '#c04030'
  return '#e02020'
})

const orbScale = computed(() => {
  if (statut.value === 'rupture') return 0.85
  if (statut.value === 'scelle')  return 1.06
  if (statut.value === 'idle')    return 1
  return 1 + Math.min(pumps.value * 0.028, 0.65)
})

const phaseLabel = computed(() => {
  if (statut.value === 'idle')     return 'En attente'
  if (statut.value === 'en_cours') return 'Infusion active'
  if (statut.value === 'rupture')  return 'Rupture'
  return 'Scellé'
})

// ── Sons (Web Audio) ──────────────────────────────────────────────────────────
let audioCtx = null
let heartbeatTimer = null

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  return audioCtx
}

function playPump(instPct) {
  const ctx = getCtx(); const t = ctx.currentTime; const r = instPct / 100
  const osc1 = ctx.createOscillator(); const g1 = ctx.createGain()
  osc1.connect(g1); g1.connect(ctx.destination); osc1.type = 'sine'
  osc1.frequency.setValueAtTime(55 + r * 30, t)
  osc1.frequency.exponentialRampToValueAtTime(28 + r * 10, t + 0.28)
  g1.gain.setValueAtTime(0.5, t); g1.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
  osc1.start(t); osc1.stop(t + 0.3)
  const osc2 = ctx.createOscillator(); const g2 = ctx.createGain()
  const f = ctx.createBiquadFilter(); osc2.connect(f); f.connect(g2); g2.connect(ctx.destination)
  osc2.type = 'sawtooth'; f.type = 'bandpass'; f.frequency.value = 600 + r * 1200; f.Q.value = 3
  osc2.frequency.value = 160 + r * 80
  g2.gain.setValueAtTime(0.1 + r * 0.08, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.14)
  osc2.start(t); osc2.stop(t + 0.15)
}

function playRupture() {
  const ctx = getCtx(); const t = ctx.currentTime
  const bl = Math.floor(ctx.sampleRate * 0.85); const buf = ctx.createBuffer(1, bl, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bl; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bl, 1.5)
  const src = ctx.createBufferSource(); src.buffer = buf
  const gn = ctx.createGain(); const filt = ctx.createBiquadFilter()
  filt.type = 'lowpass'; filt.frequency.value = 3000
  src.connect(filt); filt.connect(gn); gn.connect(ctx.destination)
  gn.gain.setValueAtTime(0.85, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.85)
  src.start(t)
  const osc = ctx.createOscillator(); const g2 = ctx.createGain()
  osc.connect(g2); g2.connect(ctx.destination); osc.type = 'sine'
  osc.frequency.setValueAtTime(110, t); osc.frequency.exponentialRampToValueAtTime(18, t + 0.7)
  g2.gain.setValueAtTime(0.65, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.7)
  osc.start(t); osc.stop(t + 0.7)
}

function playSceller() {
  const ctx = getCtx(); const t = ctx.currentTime
  ;[392, 523, 659, 784, 1047].forEach((f, i) => {
    const osc = ctx.createOscillator(); const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination); osc.type = 'sine'; osc.frequency.value = f
    const dt = t + i * 0.07
    g.gain.setValueAtTime(0, dt); g.gain.linearRampToValueAtTime(0.2, dt + 0.04)
    g.gain.exponentialRampToValueAtTime(0.001, dt + 0.5)
    osc.start(dt); osc.stop(dt + 0.51)
  })
}

function startHeartbeat() {
  stopHeartbeat()
  function beat() {
    if (statut.value !== 'en_cours') return
    const ctx = getCtx(); const t = ctx.currentTime
    ;[0, 0.18].forEach(d => {
      const osc = ctx.createOscillator(); const g = ctx.createGain()
      osc.connect(g); g.connect(ctx.destination); osc.type = 'sine'
      osc.frequency.setValueAtTime(55, t + d); osc.frequency.exponentialRampToValueAtTime(28, t + d + 0.12)
      g.gain.setValueAtTime(0.07, t + d); g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.14)
      osc.start(t + d); osc.stop(t + d + 0.15)
    })
    const bpm = 40 + instabiliteDisplay.value * 1.4
    heartbeatTimer = setTimeout(beat, 60000 / bpm)
  }
  beat()
}

function stopHeartbeat() {
  if (heartbeatTimer) { clearTimeout(heartbeatTimer); heartbeatTimer = null }
}

// ── Shake + éclats ────────────────────────────────────────────────────────────
function triggerShake() {
  isShaking.value = true
  setTimeout(() => { isShaking.value = false }, 500)
}

let shardId = 0
function spawnShards() {
  shards.value = Array.from({ length: 10 }, () => {
    const angle = Math.random() * 360
    const dist  = 60 + Math.random() * 80
    const size  = 3 + Math.random() * 7
    return {
      id: shardId++,
      style: {
        '--tx': `${Math.cos(angle * Math.PI / 180) * dist}px`,
        '--ty': `${Math.sin(angle * Math.PI / 180) * dist}px`,
        width: `${size}px`,
        height: `${size * 0.4}px`,
        transform: `rotate(${Math.random() * 360}deg)`,
        background: Math.random() > 0.5 ? '#c0392b' : '#8b1a1a',
      },
    }
  })
  setTimeout(() => { shards.value = [] }, 700)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtYen(n) {
  if (n == null) return '—'
  return (n < 0 ? '-¥' : '¥') + Math.abs(n).toLocaleString('fr-FR')
}

// ── Actions ───────────────────────────────────────────────────────────────────
async function startGame() {
  erreur.value = ''
  if (!mise.value || mise.value < 100) return
  busy.value = true
  try {
    const r       = await corpsStart(mise.value, difficulte.value)
    miseEnCours.value = mise.value
    statut.value  = r.statut
    pumps.value   = r.pumps
    mult.value    = r.mult
    pumpStep.value = r.pump_step ?? DIFFS[difficulte.value].pump_step
    solde.value   = r.solde
    startHeartbeat()
  } catch (e) { erreur.value = e.message }
  finally { busy.value = false }
}

async function doPump() {
  erreur.value = ''
  busy.value   = true
  playPump(instabiliteDisplay.value)
  try {
    const r = await corpsPump()
    pumps.value  = r.pumps
    mult.value   = r.mult
    if (r.pump_step) pumpStep.value = r.pump_step
    if (r.solde != null) solde.value = r.solde
    statut.value = r.statut
    if (r.statut === 'rupture') {
      stopHeartbeat()
      bustMult.value = r.bust_mult
      gainNet.value  = r.gain_net
      triggerShake(); spawnShards()
      setTimeout(playRupture, 80)
      addHist({ statut: 'rupture', mult: r.mult, gain_net: r.gain_net })
    }
  } catch (e) { erreur.value = e.message }
  finally { busy.value = false }
}

async function doSceller() {
  erreur.value = ''
  busy.value   = true
  playSceller()
  try {
    const r = await corpsSceller()
    stopHeartbeat()
    pumps.value   = r.pumps
    mult.value    = r.mult
    solde.value   = r.solde
    gainNet.value = r.gain_net
    statut.value  = r.statut
    addHist({ statut: 'scelle', mult: r.mult, gain_net: r.gain_net })
  } catch (e) { erreur.value = e.message }
  finally { busy.value = false }
}

async function rejouer() {
  statut.value = 'idle'; pumps.value = 0; mult.value = 1.0
  bustMult.value = null; gainNet.value = 0; erreur.value = ''
  await startGame()
}

function reset() {
  stopHeartbeat()
  statut.value = 'idle'; pumps.value = 0; mult.value = 1.0
  bustMult.value = null; gainNet.value = 0; erreur.value = ''
}

let histId = 0
function addHist(entry) {
  historique.value.unshift({ id: histId++, ...entry })
  if (historique.value.length > 16) historique.value.pop()
}

onMounted(async () => {
  try {
    const r = await corpsState()
    if (r.solde != null) solde.value = r.solde
    if (r.statut === 'en_cours') {
      statut.value      = 'en_cours'
      pumps.value       = r.pumps
      mult.value        = r.mult
      pumpStep.value    = r.pump_step ?? 0.12
      difficulte.value  = r.difficulte ?? 'demoniaque'
      startHeartbeat()
    }
  } catch {}
})

onUnmounted(() => {
  stopHeartbeat()
  if (audioCtx) { audioCtx.close(); audioCtx = null }
})
</script>

<style scoped>
/* ── Base ──────────────────────────────────────────────────────────────────── */
.page { min-height: 100vh; background: #080b11; color: #fff; }

.page--shake { animation: s-shake 0.45s cubic-bezier(.36,.07,.19,.97) both; }
@keyframes s-shake {
  10%, 90%  { transform: translate(-2px, 1px); }
  20%, 80%  { transform: translate(3px, -1px); }
  30%, 50%, 70% { transform: translate(-3px, 1px); }
  40%, 60%  { transform: translate(3px, -1px); }
}

.page-inner {
  max-width: 580px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 5rem;
}

/* ── Top bar ───────────────────────────────────────────────────────────────── */
.top-bar {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 2rem;
}

.back-link {
  font-family: 'Cinzel', serif; font-size: 0.65rem; letter-spacing: 0.15em;
  text-transform: uppercase; color: rgba(255,255,255,0.3);
  text-decoration: none; transition: color 0.15s;
}
.back-link:hover { color: rgba(255,255,255,0.6); }

.solde-badge {
  font-family: 'Cinzel', serif; font-size: 0.78rem; letter-spacing: 0.06em;
  color: #c9a84c; background: rgba(201,168,76,0.07);
  border: 1px solid rgba(201,168,76,0.2); padding: 5px 14px;
}

/* ── Titre ─────────────────────────────────────────────────────────────────── */
.page-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: clamp(1.2rem, 3.5vw, 1.7rem); font-weight: 400;
  letter-spacing: 0.06em; color: #fff; margin: 0 0 2rem; text-align: center;
}

/* ── Orbe ──────────────────────────────────────────────────────────────────── */
.orb-wrap {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 260px;
  margin-bottom: 1.4rem;
}

.orb-ring {
  position: absolute;
  width: 220px; height: 220px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.06);
  transition: border-color 0.4s ease, box-shadow 0.4s ease;
}

.orb-ring--spin    { animation: ring-spin 16s linear infinite; border-color: rgba(139,26,26,0.35); }
.orb-ring--bust    { border-color: rgba(192,57,43,0.6); box-shadow: 0 0 30px rgba(192,57,43,0.25); animation: none; }
.orb-ring--win     { border-color: rgba(201,168,76,0.5); box-shadow: 0 0 24px rgba(201,168,76,0.2); animation: none; }

@keyframes ring-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.orb {
  position: relative;
  width: 180px; height: 180px;
  border-radius: 50%;
  background: radial-gradient(ellipse at 38% 32%, #1e0808, #0c0404);
  border: 1px solid rgba(139,26,26,0.4);
  box-shadow: 0 0 40px rgba(139,26,26,0.15), inset 0 0 30px rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.4s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.4s ease, border-color 0.4s ease;
}

.orb--active {
  border-color: rgba(192,57,43,0.6);
  box-shadow: 0 0 50px rgba(139,26,26,0.3), 0 0 100px rgba(139,26,26,0.1), inset 0 0 30px rgba(0,0,0,0.5);
}

.orb--bust {
  border-color: rgba(192,57,43,0.8);
  box-shadow: 0 0 60px rgba(192,57,43,0.4), inset 0 0 30px rgba(100,0,0,0.4);
  background: radial-gradient(ellipse at 38% 32%, #2a0606, #0e0202);
}

.orb--win {
  border-color: rgba(201,168,76,0.6);
  box-shadow: 0 0 50px rgba(201,168,76,0.2), inset 0 0 30px rgba(0,0,0,0.4);
  background: radial-gradient(ellipse at 38% 32%, #1a1404, #0a0c04);
}

/* Reflet interne */
.orb-inner {
  position: absolute;
  top: 12%; left: 18%;
  width: 40%; height: 25%;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(255,255,255,0.04) 0%, transparent 70%);
  pointer-events: none;
}

.orb-content {
  position: relative; z-index: 1;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  text-align: center;
}

.orb-mult {
  display: block;
  font-family: 'Cinzel', serif; font-size: 2.4rem; font-weight: 700;
  letter-spacing: 0.04em; color: #e8ddd0; line-height: 1;
}

.orb--active .orb-mult { color: #fff; text-shadow: 0 0 20px rgba(192,57,43,0.5); }
.orb--win    .orb-mult  { color: #f0e0a0; text-shadow: 0 0 16px rgba(201,168,76,0.4); }

.orb-phase {
  font-family: 'Cinzel', serif; font-size: 0.52rem;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: rgba(255,255,255,0.22);
}

.orb-gain {
  font-family: 'Cinzel', serif; font-size: 0.72rem; letter-spacing: 0.06em;
  color: #c9a84c;
}

/* Éclats */
.shards-layer { position: absolute; inset: 0; pointer-events: none; }

.shard {
  position: absolute;
  top: 50%; left: 50%;
  border-radius: 1px;
}

.shard-fly-enter-active { animation: shard-out 0.65s ease-out forwards; }
.shard-fly-leave-active { display: none; }
@keyframes shard-out {
  0%   { transform: translate(-50%,-50%) scale(1); opacity: 1; }
  100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0) rotate(200deg); opacity: 0; }
}

/* ── Jauge instabilité ─────────────────────────────────────────────────────── */
.inst-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 1.4rem;
}

.inst-label {
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.2);
  white-space: nowrap;
}

.inst-track {
  flex: 1;
  height: 3px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px;
  overflow: hidden;
}

.inst-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.35s ease, background 0.4s ease;
}

.inst-pct {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  min-width: 36px;
  text-align: right;
  transition: color 0.4s;
}

/* ── Difficulté ────────────────────────────────────────────────────────────── */
.diff-row {
  display: flex;
  gap: 6px;
  margin-bottom: 1.4rem;
}

.diff-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 10px 8px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 2px;
  cursor: pointer;
  font-family: 'Cinzel', serif;
  transition: all 0.15s;
}

.diff-btn:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.15); }

.diff-btn--active {
  background: rgba(139,26,26,0.15);
  border-color: rgba(139,26,26,0.5);
}

.diff-btn-name {
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.7);
}

.diff-btn--active .diff-btn-name { color: #e8ddd0; }

.diff-btn-desc {
  font-size: 0.58rem;
  color: rgba(255,255,255,0.2);
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  text-align: center;
}

.diff-btn--active .diff-btn-desc { color: rgba(255,255,255,0.45); }

.diff-tag {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.2);
  text-align: center;
  margin-bottom: 1.2rem;
}

/* ── Actions ───────────────────────────────────────────────────────────────── */
.actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.mise-row {
  display: flex; align-items: center; gap: 12px;
}

.mise-label {
  font-family: 'Cinzel', serif; font-size: 0.65rem; letter-spacing: 0.14em;
  text-transform: uppercase; color: rgba(255,255,255,0.3);
}

.mise-input {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);
  color: #d4cfc9; font-family: 'Cinzel', serif; font-size: 0.85rem;
  padding: 8px 14px; width: 160px; text-align: right;
  outline: none; transition: border-color 0.15s; border-radius: 2px;
}
.mise-input:focus { border-color: rgba(201,168,76,0.4); }
.mise-input::-webkit-inner-spin-button { opacity: 0.3; }

.presets {
  display: flex; gap: 6px; flex-wrap: wrap; justify-content: center;
}

.preset-btn {
  padding: 6px 14px; background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08); border-radius: 2px;
  color: rgba(255,255,255,0.35); font-family: 'Cinzel', serif;
  font-size: 0.65rem; letter-spacing: 0.06em; cursor: pointer;
  transition: all 0.15s;
}
.preset-btn:hover { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.65); }

.btns { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }

.btn {
  font-family: 'Cinzel', serif; font-size: 0.65rem; letter-spacing: 0.16em;
  text-transform: uppercase; padding: 11px 28px; border: none;
  cursor: pointer; transition: opacity 0.15s, background 0.15s, transform 0.1s;
  border-radius: 2px; display: flex; align-items: center; gap: 8px;
}
.btn:active:not(:disabled) { transform: scale(0.97); }
.btn:disabled { opacity: 0.3; cursor: not-allowed; }

.btn--invoke  { background: #8b1a1a; color: #e8ddd0; }
.btn--invoke:hover:not(:disabled) { background: #a01f1f; }

.btn--pump    { background: #8b1a1a; color: #e8ddd0; }
.btn--pump:hover:not(:disabled) { background: #a01f1f; }

.btn--sceller { background: rgba(201,168,76,0.12); color: #c9a84c; border: 1px solid rgba(201,168,76,0.3); }
.btn--sceller:hover:not(:disabled) { background: rgba(201,168,76,0.22); }

.btn--ghost   { background: transparent; color: rgba(255,255,255,0.3); border: 1px solid rgba(255,255,255,0.1); }
.btn--ghost:hover:not(:disabled) { color: rgba(255,255,255,0.55); }

.btn-sub { font-size: 0.6rem; opacity: 0.65; font-weight: 400; letter-spacing: 0.06em; }

.action-note {
  font-family: 'Cinzel', serif; font-size: 0.58rem; letter-spacing: 0.1em;
  color: rgba(255,255,255,0.2); text-align: center; margin: 0;
}

/* ── Résultat ──────────────────────────────────────────────────────────────── */
.resultat {
  padding: 16px 20px; width: 100%; box-sizing: border-box;
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; border: 1px solid rgba(255,255,255,0.07);
}

.resultat--bust { border-color: rgba(192,57,43,0.35); background: rgba(192,57,43,0.06); }
.resultat--win  { border-color: rgba(201,168,76,0.3); background: rgba(201,168,76,0.05); }

.r-left { display: flex; flex-direction: column; gap: 4px; }

.r-label {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 0.85rem; letter-spacing: 0.04em;
}
.resultat--bust .r-label { color: #e74c3c; }
.resultat--win  .r-label { color: #c9a84c; }

.r-detail {
  font-family: 'Cinzel', serif; font-size: 0.6rem;
  letter-spacing: 0.08em; color: rgba(255,255,255,0.25);
}

.r-gain { font-family: 'Cinzel', serif; font-size: 0.88rem; letter-spacing: 0.08em; white-space: nowrap; }
.r-gain.pos { color: #c9a84c; }
.r-gain.neg { color: #8b1a1a; }

@keyframes result-in {
  0%   { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}
.result-pop-enter-active { animation: result-in 0.28s ease both; }
.result-pop-leave-active { transition: opacity 0.15s; }
.result-pop-leave-to { opacity: 0; }

/* ── Erreur ─────────────────────────────────────────────────────────────────── */
.erreur {
  font-family: 'Crimson Text', serif; font-style: italic;
  color: #c0392b; text-align: center; font-size: 0.9rem; margin: 0;
}

/* ── Historique ─────────────────────────────────────────────────────────────── */
.hist-strip {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255,255,255,0.05);
}

.hist-list {
  display: flex; gap: 5px; flex-wrap: wrap;
}

.hist-chip {
  padding: 3px 10px; border-radius: 1px;
  font-family: 'Cinzel', serif; font-size: 0.62rem; letter-spacing: 0.06em;
  border: 1px solid;
}

.hist-chip--win  { border-color: rgba(201,168,76,0.3); color: rgba(201,168,76,0.7); }
.hist-chip--loss { border-color: rgba(139,26,26,0.4); color: rgba(192,57,43,0.6); }

/* ── Transitions ────────────────────────────────────────────────────────────── */
.mult-pop-enter-active { transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
.mult-pop-leave-active { transition: all 0.1s ease; }
.mult-pop-enter-from   { transform: scale(1.3); opacity: 0.5; }
.mult-pop-leave-to     { transform: scale(0.8); opacity: 0; }

.hist-item-enter-active { transition: all 0.25s ease; }
.hist-item-leave-active { transition: all 0.15s ease; }
.hist-item-enter-from   { transform: scale(0.8); opacity: 0; }
.hist-item-leave-to     { opacity: 0; }
</style>

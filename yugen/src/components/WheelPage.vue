<template>
  <div class="page">
    <AppNavbar />

    <div v-if="jeuIndisponible" class="jeu-indispo">
      <p class="jeu-indispo-title">Jeu indisponible</p>
      <p class="jeu-indispo-sub">La Roue du Destin est temporairement fermée.</p>
      <RouterLink to="/casino" class="jeu-indispo-link">← Retour au casino</RouterLink>
    </div>

    <div v-if="!jeuIndisponible" class="page-inner">

      <div class="top-bar">
        <RouterLink to="/casino" class="back-link">← Casino</RouterLink>
        <div class="solde-badge">{{ fmtYen(solde) }}</div>
      </div>

      <h1 class="page-title">Roue du Destin</h1>

      <!-- Roue -->
      <div class="wheel-outer">
        <div class="wheel-pointer"></div>
        <canvas ref="wheelCanvas" class="wheel-canvas"></canvas>
      </div>

      <!-- Résultat -->
      <Transition name="result-pop">
        <div v-if="etat === 'fini'" class="resultat"
          :class="gainNet > 0 ? 'resultat--win' : gainNet === 0 ? 'resultat--neutral' : 'resultat--bust'">
          <div class="r-row">
            <span class="r-label">Mise</span>
            <span class="r-val">{{ fmtYen(derniereMise) }}</span>
          </div>
          <div class="r-divider"></div>
          <div class="r-row">
            <span class="r-label">Multiplicateur</span>
            <span class="r-val r-mult">×{{ dernierMult }}</span>
          </div>
          <div class="r-divider"></div>
          <div class="r-row">
            <span class="r-label">Récupéré</span>
            <span class="r-val">{{ fmtYen(derniereMise + gainNet) }}</span>
          </div>
          <div class="r-divider"></div>
          <div class="r-row">
            <span class="r-label">Gain net</span>
            <span class="r-val r-gain" :class="gainNet > 0 ? 'pos' : gainNet === 0 ? 'neutral' : 'neg'">
              {{ gainNet > 0 ? '+' : '' }}{{ fmtYen(gainNet) }}
            </span>
          </div>
        </div>
      </Transition>

      <!-- Actions -->
      <div class="actions">
        <div class="mise-row">
          <label class="mise-label">Mise</label>
          <input v-model.number="miseInput" type="number" class="mise-input"
            :min="1" :max="Math.min(solde, 500000)" :disabled="etat === 'spinning'"
            @keydown.enter="doSpin" />
        </div>
        <div class="presets">
          <button v-for="p in [1000, 5000, 10000, 50000, 100000]" :key="p"
            class="preset-btn" :disabled="etat === 'spinning' || p > solde"
            @click="miseInput = p">{{ fmtYen(p) }}</button>
        </div>
        <button class="btn btn--spin"
          :disabled="etat === 'spinning' || loading || miseInput <= 0 || miseInput > solde || miseInput > 500000"
          @click="doSpin">
          {{ etat === 'spinning' ? 'La roue tourne…' : loading ? '…' : 'Lancer la Roue' }}
        </button>
      </div>

      <p v-if="erreur" class="erreur">{{ erreur }}</p>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import AppNavbar from './AppNavbar.vue'
import { getMe, getCasinoGames } from '../api.js'
import { playTick, playResult, resumeAudio } from '../wheel-audio.js'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
async function apiFetch(url, opts = {}) {
  const res = await fetch(url, { ...opts, credentials: 'include', headers: { 'Content-Type': 'application/json' } })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Erreur')
  return data
}

// ── Segments (ordre affiché sur la roue) ─────────────────────────────────────
const SEGMENTS = [
  { mult: 0,   label: '×0',   bg: '#4a0808', border: '#7a1010', fg: '#ff6060' },
  { mult: 0.3, label: '×0.3', bg: '#1c1c1c', border: '#303030', fg: '#787878' },
  { mult: 1,   label: '×1',   bg: '#0d1b38', border: '#1a3464', fg: '#6faeff' },
  { mult: 2,   label: '×2',   bg: '#0a2c18', border: '#145028', fg: '#4cc87a' },
  { mult: 5,   label: '×5',   bg: '#321800', border: '#582c00', fg: '#ff9940' },
  { mult: 10,  label: '×10',  bg: '#170a2e', border: '#2c1454', fg: '#cc80ff' },
  { mult: 20,  label: '×20',  bg: '#2a2000', border: '#483800', fg: '#ffd700' },
]

const N         = SEGMENTS.length
const SEG_ANGLE = (2 * Math.PI) / N
const R         = 168   // rayon extérieur
const INNER_R   = 36    // rayon du moyeu
const CW        = 400
const CH        = 400
const CX        = CW / 2
const CY        = CH / 2
const SPIN_DURATION = 4400

// ── State ─────────────────────────────────────────────────────────────────────
const solde       = ref(0)
const miseInput   = ref(5000)
const etat        = ref('idle')   // idle | spinning | fini
const loading     = ref(false)
const dernierMult = ref(0)
const derniereMise = ref(0)
const gainNet     = ref(0)
const erreur      = ref('')
const jeuIndisponible = ref(false)
const wheelCanvas = ref(null)

let ctx = null
let loopRAF = null

// Animation state (mutable, not reactive)
let rotation     = 0
let spinFrom     = 0
let spinTo       = 0
let spinStartTs  = null
let resultIdx    = 0
let glowAmt      = 0
let prevTickCount = 0

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtYen(n) {
  if (n == null) return '—'
  return (n < 0 ? '-¥' : '¥') + Math.abs(n).toLocaleString('fr-FR')
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 4)
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

// Quel segment est face au pointeur (top = -PI/2) pour l'angle courant
function segAtPointer(rot) {
  const norm = ((-Math.PI / 2 - rot) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
  return Math.floor(norm / SEG_ANGLE) % N
}

// ── Canvas draw ───────────────────────────────────────────────────────────────
function drawWheel(rot, hlIdx = -1, glow = 0) {
  if (!ctx) return
  ctx.clearRect(0, 0, CW, CH)

  // Fond sombre derrière la roue
  ctx.beginPath()
  ctx.arc(CX, CY, R + 18, 0, Math.PI * 2)
  ctx.fillStyle = '#09090d'
  ctx.fill()

  // Anneau externe décoratif
  ctx.beginPath()
  ctx.arc(CX, CY, R + 12, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(139,26,26,0.2)'
  ctx.lineWidth = 14
  ctx.shadowBlur = 20
  ctx.shadowColor = 'rgba(139,26,26,0.3)'
  ctx.stroke()
  ctx.shadowBlur = 0

  // Segments
  for (let i = 0; i < N; i++) {
    const seg    = SEGMENTS[i]
    const startA = rot + i * SEG_ANGLE
    const endA   = startA + SEG_ANGLE
    const midA   = startA + SEG_ANGLE / 2
    const isHl   = i === hlIdx

    // Fond du segment
    ctx.beginPath()
    ctx.moveTo(CX, CY)
    ctx.arc(CX, CY, R, startA, endA)
    ctx.closePath()
    ctx.fillStyle = seg.bg
    ctx.fill()

    // Bordure du segment
    ctx.strokeStyle = seg.border
    ctx.lineWidth = 1
    ctx.stroke()

    // Glow sur segment résultat
    if (isHl && glow > 0) {
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(CX, CY)
      ctx.arc(CX, CY, R, startA, endA)
      ctx.closePath()
      ctx.fillStyle = `rgba(${hexToRgb(seg.fg)},${glow * 0.12})`
      ctx.fill()
      ctx.shadowBlur = 28 * glow
      ctx.shadowColor = seg.fg
      ctx.strokeStyle = `rgba(${hexToRgb(seg.fg)},${glow * 0.7})`
      ctx.lineWidth = 2.5
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.restore()
    }

    // Texte du multiplicateur
    const textR = R * 0.64
    const tx = CX + Math.cos(midA) * textR
    const ty = CY + Math.sin(midA) * textR
    ctx.save()
    ctx.translate(tx, ty)
    ctx.rotate(midA + Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `600 ${seg.mult >= 10 ? 16 : 14}px Cinzel, serif`
    if (isHl && glow > 0) {
      ctx.shadowBlur = 12 * glow
      ctx.shadowColor = seg.fg
      ctx.fillStyle = seg.fg
    } else {
      ctx.fillStyle = seg.fg + 'bb'
    }
    ctx.fillText(seg.label, 0, 0)
    ctx.shadowBlur = 0
    ctx.restore()
  }

  // Lignes de séparation (rayons)
  for (let i = 0; i < N; i++) {
    const a = rot + i * SEG_ANGLE
    ctx.beginPath()
    ctx.moveTo(CX + Math.cos(a) * INNER_R, CY + Math.sin(a) * INNER_R)
    ctx.lineTo(CX + Math.cos(a) * R, CY + Math.sin(a) * R)
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  // Anneau extérieur blanc subtil
  ctx.beginPath()
  ctx.arc(CX, CY, R, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  ctx.lineWidth = 2
  ctx.stroke()

  // Moyeu
  const hubG = ctx.createRadialGradient(CX - 8, CY - 8, 3, CX, CY, INNER_R)
  hubG.addColorStop(0, '#2a1010')
  hubG.addColorStop(1, '#0c0808')
  ctx.beginPath()
  ctx.arc(CX, CY, INNER_R, 0, Math.PI * 2)
  ctx.fillStyle = hubG
  ctx.shadowBlur = 14
  ctx.shadowColor = 'rgba(139,26,26,0.4)'
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(139,26,26,0.45)'
  ctx.lineWidth = 2
  ctx.stroke()

  // Bouton central
  ctx.beginPath()
  ctx.arc(CX, CY, 7, 0, Math.PI * 2)
  ctx.fillStyle = '#8b1a1a'
  ctx.shadowBlur = 14
  ctx.shadowColor = 'rgba(139,26,26,0.9)'
  ctx.fill()
  ctx.shadowBlur = 0
}

// ── Boucle principale ─────────────────────────────────────────────────────────
function loop(timestamp) {
  if (etat.value === 'idle') {
    rotation += 0.0025
    // Highlight léger du segment face au pointeur
    const live = segAtPointer(rotation)
    drawWheel(rotation, live, 0.22)

  } else if (etat.value === 'spinning') {
    if (!spinStartTs) spinStartTs = timestamp
    const elapsed = timestamp - spinStartTs
    const t       = Math.min(elapsed / SPIN_DURATION, 1)

    rotation = spinFrom + (spinTo - spinFrom) * easeOut(t)

    // Tick : un son par segment franchi
    const ticks = Math.floor((rotation - spinFrom) / SEG_ANGLE)
    if (ticks > prevTickCount) {
      playTick()
      prevTickCount = ticks
    }

    // Highlight du segment courant pendant la rotation
    const live = segAtPointer(rotation)
    drawWheel(rotation, live, 0.18)

    if (t >= 1) {
      rotation   = spinTo
      glowAmt    = 0
      etat.value = 'fini'
      playResult(dernierMult.value)
    }

  } else if (etat.value === 'fini') {
    glowAmt = Math.min(glowAmt + 0.022, 1)
    drawWheel(rotation, resultIdx, glowAmt)
  }

  loopRAF = requestAnimationFrame(loop)
}

// ── Calcul de l'angle cible ───────────────────────────────────────────────────
function getTargetRotation(idx) {
  // On veut le centre du segment idx face au pointeur (top = -PI/2)
  // Centre du seg idx = rotation + idx*SEG_ANGLE + SEG_ANGLE/2
  // Cible : rotation + idx*SEG_ANGLE + SEG_ANGLE/2 = -PI/2 + 2*PI*k
  // rotation_cible = -PI/2 - idx*SEG_ANGLE - SEG_ANGLE/2 + 2*PI*k
  const base       = -Math.PI / 2 - idx * SEG_ANGLE - SEG_ANGLE / 2
  const extraTurns = 2 * Math.PI * (6 + Math.floor(Math.random() * 4))
  let   target     = base
  while (target < spinFrom + extraTurns - 2 * Math.PI) target += 2 * Math.PI
  while (target < spinFrom + extraTurns)               target += 2 * Math.PI
  return target
}

// ── doSpin ─────────────────────────────────────────────────────────────────────
async function doSpin() {
  if (etat.value === 'spinning' || loading.value) return
  erreur.value = ''
  loading.value = true
  resumeAudio()

  try {
    // Récupérer le résultat serveur AVANT de lancer l'animation
    const data = await apiFetch(`${BASE}/wheel/spin`, {
      method: 'POST',
      body: JSON.stringify({ mise: miseInput.value }),
    })

    resultIdx = SEGMENTS.findIndex(s => s.mult === data.mult)
    if (resultIdx === -1) resultIdx = 0

    dernierMult.value  = data.mult
    derniereMise.value = miseInput.value
    gainNet.value      = data.gain_net
    solde.value        = data.solde

    // Configurer la trajectoire puis démarrer l'animation
    spinFrom      = rotation
    spinTo        = getTargetRotation(resultIdx)
    spinStartTs   = null
    prevTickCount = 0
    etat.value    = 'spinning'

  } catch (e) {
    erreur.value = e.message
  } finally {
    loading.value = false
  }
}

// ── Mount / Unmount ───────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const g = await getCasinoGames()
    if (g.wheel === false) jeuIndisponible.value = true
  } catch {}

  const me = await getMe()
  if (me) solde.value = me.solde

  const canvas = wheelCanvas.value
  const dpr    = window.devicePixelRatio || 1
  canvas.width  = CW * dpr
  canvas.height = CH * dpr
  ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  await document.fonts.ready
  loopRAF = requestAnimationFrame(loop)
})

onUnmounted(() => { if (loopRAF) cancelAnimationFrame(loopRAF) })
</script>

<style scoped>
.page { min-height: 100vh; background: #080b11; color: #fff; }

.page-inner {
  max-width: 520px;
  margin: 0 auto;
  padding: 3rem 1.5rem 6rem;
}

/* Top bar */
.top-bar {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 2rem;
}
.back-link {
  font-family: 'Cinzel', serif; font-size: 0.65rem; letter-spacing: 0.15em;
  text-transform: uppercase; color: rgba(255,255,255,0.3);
  text-decoration: none; transition: color 0.15s;
}
.back-link:hover { color: rgba(255,255,255,0.65); }
.solde-badge {
  font-family: 'Cinzel', serif; font-size: 0.78rem; letter-spacing: 0.06em;
  color: #c9a84c; background: rgba(201,168,76,0.08);
  border: 1px solid rgba(201,168,76,0.2); padding: 5px 14px;
}

/* Titre */
.page-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: clamp(1.3rem, 4vw, 1.9rem); font-weight: 400;
  letter-spacing: 0.06em; color: #fff;
  margin: 0 0 2rem; text-align: center;
}

/* Roue */
.wheel-outer {
  position: relative;
  width: 400px;
  max-width: 100%;
  margin: 0 auto 1.5rem;
}

.wheel-pointer {
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 0; height: 0;
  border-left: 11px solid transparent;
  border-right: 11px solid transparent;
  border-top: 22px solid #c9a84c;
  z-index: 2;
  filter: drop-shadow(0 0 8px rgba(201,168,76,0.7));
}

.wheel-canvas {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 1 / 1;
}

/* Résultat */
.resultat {
  display: flex; flex-direction: column;
  padding: 0; margin-bottom: 1.5rem;
  border: 1px solid rgba(255,255,255,0.06);
  background: rgba(255,255,255,0.02);
}
.resultat--win     { border-color: rgba(201,168,76,0.2); background: rgba(201,168,76,0.03); }
.resultat--bust    { border-color: rgba(139,26,26,0.25); background: rgba(139,26,26,0.04); }
.resultat--neutral { border-color: rgba(255,255,255,0.06); }

.r-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 18px;
}
.r-divider {
  height: 1px; background: rgba(255,255,255,0.05); margin: 0;
}
.r-label {
  font-family: 'Cinzel', serif; font-size: 0.58rem; letter-spacing: 0.14em;
  text-transform: uppercase; color: rgba(255,255,255,0.28);
}
.r-val {
  font-family: 'Cinzel', serif; font-size: 0.8rem; letter-spacing: 0.06em;
  color: #d4cfc9;
}
.r-mult {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1rem; letter-spacing: 0.05em; color: #d4cfc9;
}
.r-gain { font-family: 'Cinzel', serif; font-size: 0.8rem; letter-spacing: 0.08em; }
.r-gain.pos     { color: #c9a84c; }
.r-gain.neutral { color: rgba(255,255,255,0.35); }
.r-gain.neg     { color: #c0392b; }

@keyframes result-in {
  0%   { opacity: 0; transform: translateY(8px) scale(0.94); }
  60%  { transform: translateY(-1px) scale(1.01); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
.result-pop-enter-active { animation: result-in 0.3s ease both; }
.result-pop-leave-active { transition: opacity 0.15s; }
.result-pop-leave-to     { opacity: 0; }

/* Actions */
.actions {
  display: flex; flex-direction: column; gap: 14px; align-items: center;
}

.mise-row { display: flex; align-items: center; gap: 12px; }
.mise-label {
  font-family: 'Cinzel', serif; font-size: 0.65rem; letter-spacing: 0.14em;
  text-transform: uppercase; color: rgba(255,255,255,0.3);
}
.mise-input {
  background: #111520; border: 1px solid rgba(255,255,255,0.1);
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
  font-family: 'Cinzel', serif; font-size: 0.58rem; letter-spacing: 0.1em;
  padding: 6px 10px; background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.4);
  cursor: pointer; transition: background 0.15s, color 0.15s; border-radius: 2px;
}
.preset-btn:hover:not(:disabled) { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.7); }
.preset-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.btn {
  font-family: 'Cinzel', serif; font-size: 0.65rem; letter-spacing: 0.16em;
  text-transform: uppercase; padding: 12px 36px; border: none;
  cursor: pointer; transition: opacity 0.15s, background 0.15s, transform 0.1s;
  border-radius: 2px;
}
.btn:active:not(:disabled) { transform: scale(0.97); }
.btn:disabled { opacity: 0.35; cursor: not-allowed; }

.btn--spin { background: #8b1a1a; color: #e8ddd0; }
.btn--spin:hover:not(:disabled) { background: #a01f1f; }

.erreur {
  font-family: 'Crimson Text', serif; font-style: italic;
  color: #c0392b; text-align: center; margin-top: 14px; font-size: 0.95rem;
}

/* Jeu indisponible */
.jeu-indispo {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; min-height: calc(100vh - 60px);
  gap: 12px; text-align: center; padding: 40px;
}
.jeu-indispo-title {
  font-family: 'Cinzel', serif; font-size: 1.4rem;
  letter-spacing: 0.06em; color: rgba(255,255,255,0.7);
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

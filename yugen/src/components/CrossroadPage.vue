<template>
  <div class="page">
    <AppNavbar />
    <div class="page-inner">

      <div class="top-bar">
        <RouterLink to="/casino" class="back-link">← Casino</RouterLink>
        <div class="solde-badge">{{ fmtYen(solde) }}</div>
      </div>

      <h1 class="page-title">Traversée Démoniaque</h1>

      <!-- ── Canvas ────────────────────────────────────── -->
      <div class="canvas-wrap" :class="{ 'cw--bust': bustFlash }">
        <canvas ref="gameCanvas" class="game-canvas" />
      </div>

      <!-- ── Mult bar ──────────────────────────────────── -->
      <Transition name="mb-fade">
        <div v-if="etat === 'en_cours' && laneActuelle > 0" class="mult-bar">
          <span class="mb-label">Encaisser maintenant :</span>
          <span class="mb-mult">×{{ MULT[laneActuelle - 1].toFixed(2) }}</span>
          <span class="mb-gain">+{{ fmtYen(Math.floor(miseEnCours * MULT[laneActuelle - 1]) - miseEnCours) }}</span>
        </div>
      </Transition>

      <!-- ── Résultat ──────────────────────────────────── -->
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

      <!-- ── Actions ───────────────────────────────────── -->
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
import { ref, onMounted, onUnmounted } from 'vue'
import AppNavbar from './AppNavbar.vue'
import { getMe } from '../api.js'
import { playStep, playBust, playCoin, playInvoke, resumeAudio } from '../crossroad-audio.js'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
async function apiFetch(url, opts = {}) {
  const res  = await fetch(url, { ...opts, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Erreur')
  return data
}
const crossroadNew      = (mise) => apiFetch(`${BASE}/crossroad/new`,      { method: 'POST', body: JSON.stringify({ mise }) })
const crossroadAvancer  = ()     => apiFetch(`${BASE}/crossroad/avancer`,  { method: 'POST' })
const crossroadEncaisser = ()    => apiFetch(`${BASE}/crossroad/encaisser`, { method: 'POST' })

// ── Constantes jeu ────────────────────────────────────────────────────────────

const MULT      = [1.08, 1.23, 1.39, 1.58, 1.80, 2.04, 2.32, 2.64, 3.00, 3.41]
const MAX_LANES = MULT.length

// ── Constantes canvas ─────────────────────────────────────────────────────────

const CW      = 560            // largeur interne canvas
const LANE_H  = 44             // hauteur d'une ruelle
const CH      = LANE_H * (MAX_LANES + 1)   // hauteur totale = 11 ruelles
const LEFT_W  = 28             // colonne numéro gauche
const RIGHT_W = 64             // colonne multiplicateur droite
const TRACK_X = LEFT_W         // début de la piste
const TRACK_W = CW - LEFT_W - RIGHT_W

// Y en pixels du centre d'une ruelle (lane 0 = départ, lane 1-10 = ruelles)
function laneY(n) {
  return (MAX_LANES - n) * LANE_H + LANE_H / 2
}

// ── State jeu ─────────────────────────────────────────────────────────────────

const solde        = ref(0)
const miseInput    = ref(10000)
const miseEnCours  = ref(0)
const etat         = ref('idle')   // 'idle'|'en_cours'|'fini_bust'|'fini_win'
const laneActuelle = ref(0)
const gainNet      = ref(0)
const loading      = ref(false)
const erreur       = ref('')
const bustFlash    = ref(false)

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Canvas ────────────────────────────────────────────────────────────────────

const gameCanvas = ref(null)
let   ctx        = null
let   raf        = null
let   frame      = 0

// Position fluide du démon (interpolation)
let demonY        = laneY(0)
let demonTargetY  = laneY(0)
let demonState    = 'idle'   // 'idle'|'walk'|'bust'|'win'
let bustProgress  = 0        // 0→1 pendant l'explosion

// Obstacles par ruelle (indexés 0 = lane 1 … 9 = lane 10)
const obstacles = Array.from({ length: MAX_LANES }, (_, idx) => {
  const lane  = idx + 1
  const dir   = lane % 2 === 0 ? -1 : 1
  const speed = (0.55 + lane * 0.14) * dir
  const count = lane >= 8 ? 5 : 4
  return Array.from({ length: count }, (_, j) => ({
    x:    TRACK_X + (j / count) * TRACK_W + Math.random() * (TRACK_W / count * 0.5),
    speed,
    type: lane >= 7 ? 'skull' : 'fire',
    phase: Math.random() * Math.PI * 2,
  }))
})

// ── Dessin ────────────────────────────────────────────────────────────────────

function drawLaneBg(lane) {
  const y0    = (MAX_LANES - lane) * LANE_H
  const isCleared = etat.value !== 'idle' && laneActuelle.value > lane
  const isActive  = etat.value !== 'idle' && laneActuelle.value === lane
  const isBust    = isActive && etat.value === 'fini_bust'

  // Fond de ruelle
  if (isBust) {
    ctx.fillStyle = 'rgba(160,30,20,0.35)'
  } else if (isActive) {
    ctx.fillStyle = 'rgba(120,20,20,0.22)'
  } else if (isCleared) {
    ctx.fillStyle = 'rgba(201,168,76,0.06)'
  } else {
    ctx.fillStyle = lane % 2 === 0 ? '#0e0e10' : '#0b0b0d'
  }
  ctx.fillRect(0, y0, CW, LANE_H)

  // Bordure gauche active
  if (isActive) {
    ctx.fillStyle = isBust ? 'rgba(192,57,43,0.7)' : 'rgba(139,26,26,0.6)'
    ctx.fillRect(0, y0, 3, LANE_H)
  }
  if (isCleared) {
    ctx.fillStyle = 'rgba(201,168,76,0.18)'
    ctx.fillRect(0, y0, 3, LANE_H)
  }

  // Séparateur
  ctx.fillStyle = 'rgba(255,255,255,0.04)'
  ctx.fillRect(0, y0 + LANE_H - 1, CW, 1)
}

function drawLaneLabels(lane) {
  const cy = (MAX_LANES - lane) * LANE_H + LANE_H / 2
  const isCleared = etat.value !== 'idle' && laneActuelle.value > lane
  const isActive  = etat.value !== 'idle' && laneActuelle.value === lane

  // Numéro gauche
  ctx.font = '500 10px "Cinzel", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = isCleared ? 'rgba(201,168,76,0.25)' : isActive ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)'
  ctx.fillText(lane, LEFT_W / 2, cy)

  // Multiplicateur droite
  ctx.font = '500 11px "Cinzel", serif'
  ctx.textAlign = 'right'
  ctx.fillStyle = isCleared ? 'rgba(201,168,76,0.45)' : isActive ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.18)'
  ctx.fillText('×' + MULT[lane - 1].toFixed(2), CW - 6, cy)
}

function drawStartRow() {
  const y0 = MAX_LANES * LANE_H
  ctx.fillStyle = '#0a0a0c'
  ctx.fillRect(0, y0, CW, LANE_H)
  ctx.fillStyle = 'rgba(255,255,255,0.03)'
  ctx.fillRect(0, y0 + LANE_H - 1, CW, 1)
  ctx.font = '10px "Cinzel", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.fillText('DÉPART', CW / 2, y0 + LANE_H / 2)
}

function drawClearedMark(lane) {
  if (etat.value === 'idle') return
  if (laneActuelle.value <= lane) return
  const cy = (MAX_LANES - lane) * LANE_H + LANE_H / 2

  // Dashed separator (visual de route traversée)
  ctx.setLineDash([6, 8])
  ctx.strokeStyle = 'rgba(201,168,76,0.12)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(TRACK_X + 10, cy)
  ctx.lineTo(TRACK_X + TRACK_W - 10, cy)
  ctx.stroke()
  ctx.setLineDash([])

  // Checkmark flottant au milieu
  ctx.font = 'bold 11px "Cinzel", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(201,168,76,0.28)'
  ctx.fillText('✓', TRACK_X + TRACK_W / 2, cy)
}

function drawFire(x, y, f, phase) {
  const flicker = 1 + Math.sin(f * 0.18 + phase) * 0.18
  const h = 18 * flicker

  ctx.save()
  ctx.translate(x, y)

  // Halo
  const grad = ctx.createRadialGradient(0, 0, 0, 0, -h / 2, h)
  grad.addColorStop(0,   'rgba(255,210,30,0.85)')
  grad.addColorStop(0.4, 'rgba(255,80,0,0.7)')
  grad.addColorStop(1,   'rgba(180,10,0,0)')
  ctx.fillStyle = grad

  ctx.beginPath()
  ctx.moveTo(0, 5)
  ctx.bezierCurveTo(-9, 0, -7 * flicker, -h * 0.6, 0, -h)
  ctx.bezierCurveTo(7 * flicker, -h * 0.6, 9, 0, 0, 5)
  ctx.fill()

  // Centre
  const inner = ctx.createRadialGradient(0, -4, 0, 0, -4, 7 * flicker)
  inner.addColorStop(0, 'rgba(255,250,200,0.95)')
  inner.addColorStop(1, 'rgba(255,150,0,0)')
  ctx.fillStyle = inner
  ctx.beginPath()
  ctx.ellipse(0, -4, 4, 7 * flicker, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

function drawSkull(x, y, f, phase) {
  const bob = Math.sin(f * 0.05 + phase) * 2.5
  ctx.save()
  ctx.translate(x, y + bob)

  // Crâne
  ctx.fillStyle = 'rgba(210,210,210,0.82)'
  ctx.shadowBlur = 6
  ctx.shadowColor = 'rgba(255,0,0,0.25)'
  ctx.beginPath()
  ctx.arc(0, -8, 9, 0, Math.PI * 2)
  ctx.fill()
  // Mâchoire
  ctx.beginPath()
  ctx.roundRect(-6, -3, 12, 7, 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // Orbites
  ctx.fillStyle = '#1a0505'
  ctx.beginPath()
  ctx.arc(-3, -10, 2.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(3, -10, 2.8, 0, Math.PI * 2)
  ctx.fill()

  // Lueur rouge dans les yeux
  ctx.fillStyle = 'rgba(255,0,0,0.4)'
  ctx.shadowBlur = 8
  ctx.shadowColor = '#ff0000'
  ctx.beginPath()
  ctx.arc(-3, -10, 1.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(3, -10, 1.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // Dents
  ctx.fillStyle = '#e8e8e8'
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue
    ctx.fillRect(i * 2.8 - 1, -1, 2, 4)
  }

  ctx.restore()
}

function drawDemon(x, y, f, state) {
  const bob = state === 'idle' ? Math.sin(f * 0.04) * 3 : 0
  const wy  = state === 'walk' ? Math.sin(f * 0.3) * 2 : 0

  ctx.save()
  ctx.translate(x, y + bob + wy)

  // Ombre portée
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.beginPath()
  ctx.ellipse(0, 18, 9, 3, 0, 0, Math.PI * 2)
  ctx.fill()

  // Queue (derrière le corps)
  const tw = Math.sin(f * 0.07) * 10
  ctx.strokeStyle = '#4a0808'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(7, 5)
  ctx.bezierCurveTo(16, 5 + tw, 18, 14, 13, 19)
  ctx.stroke()
  // Pointe de queue
  ctx.fillStyle = '#2e0606'
  ctx.beginPath()
  ctx.moveTo(13, 19)
  ctx.lineTo(10, 25)
  ctx.lineTo(16, 25)
  ctx.closePath()
  ctx.fill()

  // Jambes
  const legSwing = state === 'walk' ? Math.sin(f * 0.25) * 6 : 0
  ctx.fillStyle = '#6a1414'
  ctx.save()
  ctx.translate(-4, 15)
  ctx.rotate((legSwing) * Math.PI / 180)
  ctx.beginPath()
  ctx.roundRect(-3, 0, 6, 9, 2)
  ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.translate(4, 15)
  ctx.rotate((-legSwing) * Math.PI / 180)
  ctx.beginPath()
  ctx.roundRect(-3, 0, 6, 9, 2)
  ctx.fill()
  ctx.restore()

  // Corps
  const bodyGrad = ctx.createRadialGradient(-3, 0, 0, 0, 2, 14)
  bodyGrad.addColorStop(0, '#9b2020')
  bodyGrad.addColorStop(1, '#5a0e0e')
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  ctx.ellipse(0, 5, 9, 12, 0, 0, Math.PI * 2)
  ctx.fill()

  // Tête
  const headGrad = ctx.createRadialGradient(-3, -10, 0, 0, -7, 13)
  headGrad.addColorStop(0, '#b52222')
  headGrad.addColorStop(1, '#6a1010')
  ctx.fillStyle = headGrad
  ctx.beginPath()
  ctx.arc(0, -7, 12, 0, Math.PI * 2)
  ctx.fill()

  // Cornes
  ctx.fillStyle = '#1e0606'
  // Corne gauche
  ctx.beginPath()
  ctx.moveTo(-9, -16)
  ctx.lineTo(-5, -7)
  ctx.lineTo(-1.5, -18)
  ctx.closePath()
  ctx.fill()
  // Reflet corne gauche
  ctx.fillStyle = '#3a0a0a'
  ctx.beginPath()
  ctx.moveTo(-8, -16)
  ctx.lineTo(-6.5, -11)
  ctx.lineTo(-4.5, -16)
  ctx.closePath()
  ctx.fill()
  // Corne droite
  ctx.fillStyle = '#1e0606'
  ctx.beginPath()
  ctx.moveTo(9, -16)
  ctx.lineTo(5, -7)
  ctx.lineTo(1.5, -18)
  ctx.closePath()
  ctx.fill()

  // Sourcils
  ctx.strokeStyle = '#1a0404'
  ctx.lineWidth = 1.8
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-7, -12)
  ctx.quadraticCurveTo(-5, -14, -2, -12)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(7, -12)
  ctx.quadraticCurveTo(5, -14, 2, -12)
  ctx.stroke()

  // Yeux (lueur)
  ctx.shadowBlur = 12
  ctx.shadowColor = '#ff2200'
  ctx.fillStyle = '#ff4444'
  ctx.beginPath()
  ctx.arc(-4, -10, 2.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(4, -10, 2.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // Pupilles
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.arc(-4, -10, 1.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(4, -10, 1.3, 0, Math.PI * 2)
  ctx.fill()

  // Sourire
  ctx.strokeStyle = '#1a0404'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(0, -4, 5, 0.25, Math.PI - 0.25)
  ctx.stroke()
  // Crocs
  ctx.fillStyle = '#e8d8c0'
  ctx.beginPath()
  ctx.moveTo(-3, 0)
  ctx.lineTo(-1.5, 3)
  ctx.lineTo(0, 0)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(1.5, 3)
  ctx.lineTo(3, 0)
  ctx.closePath()
  ctx.fill()

  // Bras
  ctx.strokeStyle = '#6a1414'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  const armSwing = state === 'walk' ? Math.sin(f * 0.25 + Math.PI) * 8 : 0
  ctx.save()
  ctx.translate(-9, 1)
  ctx.rotate((armSwing - 10) * Math.PI / 180)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-6, 10)
  ctx.stroke()
  ctx.restore()
  ctx.save()
  ctx.translate(9, 1)
  ctx.rotate((-armSwing + 10) * Math.PI / 180)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(6, 10)
  ctx.stroke()
  ctx.restore()

  ctx.restore()
}

function drawExplosion(x, y, progress) {
  if (progress <= 0 || progress >= 1) return
  ctx.save()
  ctx.translate(x, y)

  const p = progress

  // Shockwave
  ctx.strokeStyle = `rgba(255,100,20,${(1 - p) * 0.9})`
  ctx.lineWidth = 3 - p * 2
  ctx.beginPath()
  ctx.arc(0, 0, p * 55, 0, Math.PI * 2)
  ctx.stroke()

  // Cercle secondaire
  ctx.strokeStyle = `rgba(255,220,50,${(1 - p) * 0.5})`
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(0, 0, p * 38, 0, Math.PI * 2)
  ctx.stroke()

  // Étincelles
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 + p * 0.5
    const d = p * 48
    const px = Math.cos(angle) * d
    const py = Math.sin(angle) * d
    const size = (1 - p) * 5
    ctx.fillStyle = i % 2 === 0
      ? `rgba(255,200,0,${(1 - p) * 0.9})`
      : `rgba(255,60,0,${(1 - p) * 0.8})`
    ctx.beginPath()
    ctx.arc(px, py, size, 0, Math.PI * 2)
    ctx.fill()
  }

  // Flammes centrales
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2
    const d = p * 22
    drawFire(Math.cos(angle) * d, Math.sin(angle) * d, frame, i)
  }

  ctx.restore()
}

// ── Boucle principale ─────────────────────────────────────────────────────────

function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, CW, CH)

  // Fond global
  ctx.fillStyle = '#090909'
  ctx.fillRect(0, 0, CW, CH)

  // Ruelles (fond + obstacles + labels)
  for (let lane = MAX_LANES; lane >= 1; lane--) {
    drawLaneBg(lane)
    drawLaneLabels(lane)

    // Obstacles (seulement si ruelle non traversée et pas la ruelle active du démon)
    const isCleared = etat.value !== 'idle' && laneActuelle.value > lane
    const isActive  = etat.value !== 'idle' && laneActuelle.value === lane
    if (!isCleared && !(isActive && demonState !== 'bust')) {
      const laneIdx = lane - 1
      for (const obs of obstacles[laneIdx]) {
        const cy = (MAX_LANES - lane) * LANE_H + LANE_H / 2
        if (obs.type === 'fire') drawFire(obs.x, cy + 8, frame, obs.phase)
        else                     drawSkull(obs.x, cy + 4, frame, obs.phase)
      }
    }

    drawClearedMark(lane)
  }

  // Ligne de départ
  drawStartRow()

  // Séparateur piste / labels
  ctx.fillStyle = 'rgba(255,255,255,0.04)'
  ctx.fillRect(LEFT_W, 0, 1, CH)
  ctx.fillRect(CW - RIGHT_W, 0, 1, CH)

  // Démon
  const demonX = TRACK_X + TRACK_W / 2

  if (demonState === 'bust') {
    bustProgress = Math.min(bustProgress + 0.025, 1)
    if (bustProgress < 0.6) {
      // Démon tourne et rapetisse
      ctx.save()
      ctx.translate(demonX, demonY)
      const s = 1 - bustProgress * 0.8
      ctx.scale(s, s)
      ctx.rotate(bustProgress * Math.PI * 2)
      ctx.globalAlpha = 1 - bustProgress * 1.2
      drawDemon(0, 0, frame, 'idle')
      ctx.restore()
    }
    drawExplosion(demonX, demonY, bustProgress)
  } else if (demonState === 'win') {
    // Victoire : démon qui danse
    const dance = Math.sin(frame * 0.15) * 4
    ctx.save()
    ctx.translate(demonX, demonY + dance)
    ctx.shadowBlur = 20
    ctx.shadowColor = 'rgba(201,168,76,0.6)'
    drawDemon(0, 0, frame, 'walk')
    ctx.restore()
  } else {
    const state = Math.abs(demonY - demonTargetY) > 2 ? 'walk' : 'idle'
    demonY += (demonTargetY - demonY) * 0.12
    drawDemon(demonX, demonY, frame, state)
  }

  // Mise à jour obstacles
  for (let i = 0; i < MAX_LANES; i++) {
    for (const obs of obstacles[i]) {
      obs.x += obs.speed
      if (obs.speed > 0 && obs.x > TRACK_X + TRACK_W + 10) obs.x = TRACK_X - 10
      if (obs.speed < 0 && obs.x < TRACK_X - 10) obs.x = TRACK_X + TRACK_W + 10
    }
  }

  frame++
  raf = requestAnimationFrame(draw)
}

// ── Actions jeu ───────────────────────────────────────────────────────────────

function fmtYen(n) {
  if (n == null) return '—'
  return (n < 0 ? '-¥' : '¥') + Math.abs(n).toLocaleString('fr-FR')
}

async function lancerPartie() {
  if (loading.value) return
  erreur.value = ''
  loading.value = true
  resumeAudio()
  playInvoke()
  try {
    const data = await crossroadNew(miseInput.value)
    miseEnCours.value  = miseInput.value
    laneActuelle.value = 0
    etat.value         = 'en_cours'
    gainNet.value      = 0
    demonState         = 'idle'
    bustProgress       = 0
    demonTargetY       = laneY(0)
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

    playStep()
    laneActuelle.value = data.lane_actuelle
    demonTargetY       = laneY(data.lane_actuelle)
    demonState         = 'walk'
    if (data.solde != null) solde.value = data.solde

    if (data.statut === 'bust') {
      await sleep(300) // laisser le démon arriver
      etat.value     = 'fini_bust'
      gainNet.value  = data.gain_net
      demonState     = 'bust'
      bustProgress   = 0
      bustFlash.value = true
      playBust()
      setTimeout(() => { bustFlash.value = false }, 600)
    } else if (data.statut === 'victoire_totale') {
      await sleep(400)
      etat.value    = 'fini_win'
      gainNet.value = data.gain_net
      demonState    = 'win'
      playCoin()
    } else {
      await sleep(250)
      demonState = 'idle'
    }
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
    etat.value    = 'fini_win'
    gainNet.value = data.gain_net
    demonState    = 'win'
    if (data.solde != null) solde.value = data.solde
    playCoin()
  } catch (e) {
    erreur.value = e.message
  } finally {
    loading.value = false
  }
}

async function rejouer() {
  etat.value = 'idle'
  demonTargetY = laneY(0)
  demonY       = laneY(0)
  demonState   = 'idle'
  bustProgress = 0
  await lancerPartie()
}

function reset() {
  etat.value         = 'idle'
  laneActuelle.value = 0
  gainNet.value      = 0
  demonTargetY       = laneY(0)
  demonY             = laneY(0)
  demonState         = 'idle'
  bustProgress       = 0
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  const me = await getMe()
  if (me) solde.value = me.solde

  const canvas = gameCanvas.value
  const dpr    = window.devicePixelRatio || 1

  // Taille interne × dpr pour la netteté
  canvas.width  = CW * dpr
  canvas.height = CH * dpr

  ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  // Font fallback pour canvas
  ctx.font = '11px "Cinzel", serif'

  demonY = laneY(0)
  demonTargetY = laneY(0)

  draw()
})

onUnmounted(() => {
  if (raf) cancelAnimationFrame(raf)
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
  font-size: clamp(1.4rem, 4vw, 1.9rem);
  font-weight: 400;
  letter-spacing: 0.06em;
  color: #fff;
  margin: 0 0 1.6rem;
  text-align: center;
}

/* ── Canvas ──────────────────────────────────── */
.canvas-wrap {
  border: 1px solid rgba(255,255,255,0.07);
  overflow: hidden;
  transition: box-shadow 0.15s;
}
@keyframes bust-flash {
  0%,100% { box-shadow: none; }
  40%     { box-shadow: 0 0 40px rgba(192,57,43,0.5) inset; }
}
.cw--bust { animation: bust-flash 0.6s ease; }

.game-canvas {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 560 / 484;
  image-rendering: crisp-edges;
}

/* ── Mult bar ────────────────────────────────── */
.mult-bar {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
}
.mb-label {
  font-family: 'Cinzel', serif;
  font-size: 0.56rem;
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
  font-size: 0.72rem;
  color: rgba(201,168,76,0.65);
}
.mb-fade-enter-active, .mb-fade-leave-active { transition: opacity 0.2s; }
.mb-fade-enter-from, .mb-fade-leave-to { opacity: 0; }

/* ── Résultat ────────────────────────────────── */
.resultat {
  margin-top: 12px;
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
.resultat--bust .r-label { color: #c0392b; }
.resultat--win  .r-label { color: #c9a84c; }
.r-gain { font-family: 'Cinzel', serif; font-size: 0.8rem; letter-spacing: 0.08em; }
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
  margin-top: 18px;
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

.btn--invoke  { background: #8b1a1a; color: #e8ddd0; }
.btn--invoke:hover:not(:disabled) { background: #a01f1f; }

.btn--avancer { background: rgba(201,168,76,0.14); color: #c9a84c; border: 1px solid rgba(201,168,76,0.3); }
.btn--avancer:hover:not(:disabled) { background: rgba(201,168,76,0.24); }

.btn--encaisser { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.55); border: 1px solid rgba(255,255,255,0.1); }
.btn--encaisser:hover:not(:disabled) { background: rgba(255,255,255,0.1); }

.btn--ghost { background: transparent; color: rgba(255,255,255,0.3); border: 1px solid rgba(255,255,255,0.1); }
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

<template>
  <div class="page">
    <AppNavbar />
    <div class="page-inner">

      <div class="top-bar">
        <RouterLink to="/casino" class="back-link">← Casino</RouterLink>
        <div class="solde-badge">{{ fmtYen(solde) }}</div>
      </div>

      <h1 class="page-title">Traversée Démoniaque</h1>

      <!-- Canvas -->
      <div class="canvas-wrap" :class="{ 'cw--bust': bustFlash }">
        <canvas ref="gameCanvas" class="game-canvas" />
      </div>

      <!-- Mult bar -->
      <Transition name="mb-fade">
        <div v-if="etat === 'en_cours' && laneActuelle > 0" class="mult-bar">
          <span class="mb-label">Encaisser maintenant :</span>
          <span class="mb-mult">×{{ MULT[laneActuelle - 1].toFixed(2) }}</span>
          <span class="mb-gain">+{{ fmtYen(Math.floor(miseEnCours * MULT[laneActuelle - 1]) - miseEnCours) }}</span>
        </div>
      </Transition>

      <!-- Résultat -->
      <Transition name="result-pop">
        <div v-if="etat === 'fini_bust' || etat === 'fini_win'" class="resultat"
          :class="etat === 'fini_bust' ? 'resultat--bust' : 'resultat--win'">
          <span class="r-label">{{ etat === 'fini_bust' ? '🔥 Brûlé !' : '✓ Encaissé !' }}</span>
          <span class="r-gain" :class="gainNet >= 0 ? 'pos' : 'neg'">
            {{ gainNet > 0 ? '+' : '' }}{{ fmtYen(gainNet) }}
          </span>
        </div>
      </Transition>

      <!-- Actions -->
      <div class="actions">
        <template v-if="etat === 'idle'">
          <div class="mise-row">
            <label class="mise-label">Mise</label>
            <input v-model.number="miseInput" type="number" class="mise-input"
              :min="1" :max="solde" step="1000" :disabled="loading" @keydown.enter="lancerPartie" />
          </div>
          <button class="btn btn--invoke" :disabled="loading || miseInput <= 0" @click="lancerPartie">
            Invoquer le Démon
          </button>
        </template>

        <template v-else-if="etat === 'en_cours'">
          <div class="btns">
            <button class="btn btn--avancer" :disabled="loading" @click="doAvancer">Traverser ↑</button>
            <button class="btn btn--encaisser" :disabled="loading || laneActuelle === 0" @click="doEncaisser">
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
  const res  = await fetch(url, { ...opts, credentials: 'include', headers: { 'Content-Type': 'application/json' } })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Erreur')
  return data
}
const crossroadNew       = (mise) => apiFetch(`${BASE}/crossroad/new`,       { method: 'POST', body: JSON.stringify({ mise }) })
const crossroadAvancer   = ()     => apiFetch(`${BASE}/crossroad/avancer`,   { method: 'POST' })
const crossroadEncaisser = ()     => apiFetch(`${BASE}/crossroad/encaisser`, { method: 'POST' })

// ── Constantes ────────────────────────────────────────────────────────────────

const MULT      = [1.08, 1.23, 1.39, 1.58, 1.80, 2.04, 2.32, 2.64, 3.00, 3.41]
const MAX_LANES = MULT.length

const CW      = 580
const LANE_H  = 46
const CH      = LANE_H * (MAX_LANES + 1)
const L_PAD   = 34    // colonne numéro gauche
const R_PAD   = 72    // colonne multiplicateur droite
const TX      = L_PAD
const TW      = CW - L_PAD - R_PAD

function laneY(n)   { return (MAX_LANES - n) * LANE_H + LANE_H / 2 }
function laneTop(n) { return (MAX_LANES - n) * LANE_H }

// ── State ─────────────────────────────────────────────────────────────────────

const solde        = ref(0)
const miseInput    = ref(10000)
const miseEnCours  = ref(0)
const etat         = ref('idle')
const laneActuelle = ref(0)
const gainNet      = ref(0)
const loading      = ref(false)
const erreur       = ref('')
const bustFlash    = ref(false)

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Canvas state ──────────────────────────────────────────────────────────────

const gameCanvas = ref(null)
let ctx = null, raf = null, frame = 0

let demonY       = 0
let demonTargetY = 0
let demonState   = 'idle'   // idle | walk | bust | win
let bustProg     = 0
let roadScroll   = 0

// Étincelles (sparks)
const sparks = []
function spawnSparks(x, y, count = 14) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 1.2 + Math.random() * 2.8
    sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.5,
      life: 1, decay: 0.03 + Math.random() * 0.04,
      size: 2 + Math.random() * 3,
      color: Math.random() > 0.5 ? '#ff9900' : '#ff4400' })
  }
}

// Obstacles (un tableau de 10 ruelles)
const obstacles = Array.from({ length: MAX_LANES }, (_, idx) => {
  const lane  = idx + 1
  const dir   = lane % 2 === 0 ? -1 : 1
  const speed = (0.55 + lane * 0.16) * dir
  const count = lane >= 8 ? 5 : 4
  return Array.from({ length: count }, (_, j) => ({
    x:     TX + (j / count) * TW + 10 + Math.random() * (TW / count * 0.4),
    speed, phase: j * 1.1 + lane * 0.7,
    type:  lane >= 7 ? 'skull' : 'fire',
  }))
})

// ── Draw helpers ──────────────────────────────────────────────────────────────

// Lane background + road style
function drawLane(lane) {
  const y0  = laneTop(lane)
  const cleared = etat.value !== 'idle' && laneActuelle.value > lane
  const active  = etat.value !== 'idle' && laneActuelle.value === lane
  const bust    = active && etat.value === 'fini_bust'

  // Fond
  let bg
  if (bust)    bg = '#1a0808'
  else if (active)  bg = '#160b0b'
  else if (cleared) bg = '#0b1208'
  else              bg = lane % 2 === 0 ? '#0e1319' : '#0b1016'
  ctx.fillStyle = bg
  ctx.fillRect(0, y0, CW, LANE_H)

  // Marquage route (tirets qui défilent)
  if (!cleared) {
    const dir = lane % 2 === 0 ? 1 : -1
    const offset = (roadScroll * dir) % 48
    ctx.save()
    ctx.setLineDash([18, 30])
    ctx.lineDashOffset = offset
    ctx.strokeStyle = cleared ? 'rgba(201,168,76,0.07)' : 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(TX + 6, y0 + LANE_H / 2)
    ctx.lineTo(TX + TW - 6, y0 + LANE_H / 2)
    ctx.stroke()
    ctx.restore()
  }

  // Bordure gauche colorée
  if (active) {
    ctx.fillStyle = bust ? '#c0392b' : '#8b1a1a'
    ctx.shadowBlur = bust ? 12 : 8
    ctx.shadowColor = bust ? '#ff0000' : '#cc2222'
    ctx.fillRect(0, y0, 3, LANE_H)
    ctx.shadowBlur = 0
  } else if (cleared) {
    ctx.fillStyle = '#c9a84c'
    ctx.shadowBlur = 4
    ctx.shadowColor = '#c9a84c'
    ctx.fillRect(0, y0, 3, LANE_H)
    ctx.shadowBlur = 0
  }

  // Séparateur
  ctx.fillStyle = 'rgba(255,255,255,0.03)'
  ctx.fillRect(0, y0 + LANE_H - 1, CW, 1)

  // Numéro de ruelle (gauche)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '500 10px Cinzel, serif'
  ctx.fillStyle = cleared ? 'rgba(201,168,76,0.4)'
                : active  ? 'rgba(255,255,255,0.55)'
                : 'rgba(255,255,255,0.14)'
  ctx.fillText(lane, L_PAD / 2, y0 + LANE_H / 2)

  // Multiplicateur (droite) — grand & visible
  ctx.textAlign = 'right'
  ctx.font = cleared || active ? '600 13px Cinzel, serif' : '500 12px Cinzel, serif'
  if (cleared) {
    ctx.shadowBlur = 6; ctx.shadowColor = '#c9a84c'
    ctx.fillStyle = '#c9a84c'
  } else if (active) {
    ctx.shadowBlur = 0
    ctx.fillStyle = '#e8ddd0'
  } else {
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
  }
  ctx.fillText('×' + MULT[lane - 1].toFixed(2), CW - 8, y0 + LANE_H / 2)
  ctx.shadowBlur = 0

  // Checkmark sur ruelles traversées
  if (cleared) {
    ctx.textAlign = 'center'
    ctx.font = '12px sans-serif'
    ctx.fillStyle = 'rgba(201,168,76,0.2)'
    ctx.fillText('✓', TX + TW / 2, y0 + LANE_H / 2)
  }
}

function drawStartRow() {
  const y0 = laneTop(0)
  ctx.fillStyle = '#0a0c10'
  ctx.fillRect(0, y0, CW, LANE_H)
  ctx.fillStyle = 'rgba(255,255,255,0.03)'
  ctx.fillRect(0, y0 + LANE_H - 1, CW, 1)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '500 9px Cinzel, serif'
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.fillText('DÉPART', TX + TW / 2, y0 + LANE_H / 2)
}

// ── Flammes ───────────────────────────────────────────────────────────────────

function drawFire(x, y, f, phase) {
  const flicker = 1 + Math.sin(f * 0.14 + phase) * 0.14
  const h = 30 * flicker

  ctx.save()
  ctx.translate(x, y)

  // Halo sol
  const glow = ctx.createRadialGradient(0, 4, 0, 0, 4, 16)
  glow.addColorStop(0, 'rgba(255,100,0,0.45)')
  glow.addColorStop(1, 'rgba(255,0,0,0)')
  ctx.fillStyle = glow
  ctx.beginPath(); ctx.ellipse(0, 4, 16, 5, 0, 0, Math.PI * 2); ctx.fill()

  // Flamme externe
  const og = ctx.createLinearGradient(0, 4, 0, -h)
  og.addColorStop(0, 'rgba(255,70,0,0.95)')
  og.addColorStop(0.5, 'rgba(220,30,0,0.6)')
  og.addColorStop(1, 'rgba(180,0,0,0)')
  ctx.fillStyle = og
  ctx.beginPath()
  ctx.moveTo(-8, 4)
  ctx.bezierCurveTo(-8 * flicker, -h * 0.25, -4 * flicker, -h * 0.7, 0, -h)
  ctx.bezierCurveTo(4 * flicker, -h * 0.7, 8 * flicker, -h * 0.25, 8, 4)
  ctx.fill()

  // Flamme milieu
  const mh = h * 0.72
  const mg = ctx.createLinearGradient(0, 2, 0, -mh)
  mg.addColorStop(0, 'rgba(255,165,0,1)')
  mg.addColorStop(0.55, 'rgba(255,80,0,0.75)')
  mg.addColorStop(1, 'rgba(255,20,0,0)')
  ctx.fillStyle = mg
  ctx.beginPath()
  ctx.moveTo(-5, 2)
  ctx.bezierCurveTo(-4, -mh * 0.4, -2, -mh * 0.85, 0, -mh)
  ctx.bezierCurveTo(2, -mh * 0.85, 4, -mh * 0.4, 5, 2)
  ctx.fill()

  // Cœur (jaune vif)
  const ch2 = h * 0.42
  ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(255,220,50,0.9)'
  ctx.fillStyle = 'rgba(255,248,120,0.97)'
  ctx.beginPath()
  ctx.moveTo(-2.5, 2)
  ctx.bezierCurveTo(-2, -ch2 * 0.5, -1, -ch2 * 0.9, 0, -ch2)
  ctx.bezierCurveTo(1, -ch2 * 0.9, 2, -ch2 * 0.5, 2.5, 2)
  ctx.fill()
  ctx.shadowBlur = 0

  ctx.restore()
}

// ── Crânes ────────────────────────────────────────────────────────────────────

function drawSkull(x, y, f, phase) {
  const bob = Math.sin(f * 0.05 + phase) * 2.2
  ctx.save()
  ctx.translate(x, y + bob)

  // Halo rouge
  ctx.shadowBlur = 14; ctx.shadowColor = 'rgba(200,0,0,0.5)'
  ctx.fillStyle = 'rgba(210,200,195,0.88)'
  ctx.beginPath()
  ctx.arc(0, -7, 10, Math.PI, 0) // demi-cercle haut = crâne
  ctx.lineTo(7, -7)
  ctx.lineTo(7, 1)
  ctx.arc(0, 1, 7, 0, Math.PI) // mâchoire arrondie
  ctx.lineTo(-7, 1)
  ctx.lineTo(-7, -7)
  ctx.closePath()
  ctx.fill()
  ctx.shadowBlur = 0

  // Orbites
  ctx.fillStyle = '#0d0505'
  ctx.beginPath(); ctx.ellipse(-3.5, -9, 2.8, 2.8, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(3.5, -9, 2.8, 2.8, 0, 0, Math.PI * 2); ctx.fill()

  // Lueur orbes
  ctx.shadowBlur = 8; ctx.shadowColor = '#ff1111'
  ctx.fillStyle = 'rgba(255,0,0,0.55)'
  ctx.beginPath(); ctx.ellipse(-3.5, -9, 1.6, 1.6, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(3.5, -9, 1.6, 1.6, 0, 0, Math.PI * 2); ctx.fill()
  ctx.shadowBlur = 0

  // Nez (triangle)
  ctx.fillStyle = '#0d0505'
  ctx.beginPath(); ctx.moveTo(0, -5.5); ctx.lineTo(-1.5, -2); ctx.lineTo(1.5, -2); ctx.closePath(); ctx.fill()

  // Dents
  ctx.fillStyle = '#e8e4e0'
  for (let i = -1; i <= 1; i++) {
    ctx.fillRect(i * 3 - 1, -1, 2, 3.5)
  }

  ctx.restore()
}

// ── Démon ─────────────────────────────────────────────────────────────────────

function drawDemon(x, y, f, state) {
  const bob = state === 'idle' ? Math.sin(f * 0.038) * 2.5 : 0

  ctx.save()
  ctx.translate(x, y + bob)

  // Halo sol
  const ground = ctx.createRadialGradient(0, 17, 0, 0, 17, 22)
  ground.addColorStop(0, 'rgba(200,30,30,0.45)')
  ground.addColorStop(1, 'rgba(200,30,30,0)')
  ctx.fillStyle = ground
  ctx.beginPath(); ctx.ellipse(0, 17, 22, 7, 0, 0, Math.PI * 2); ctx.fill()

  // Corps
  const bodyG = ctx.createLinearGradient(-10, -5, 10, 16)
  bodyG.addColorStop(0, '#b01c1c')
  bodyG.addColorStop(1, '#660c0c')
  ctx.fillStyle = bodyG
  ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(180,20,20,0.5)'
  ctx.beginPath()
  ctx.ellipse(0, 7, 10, 12, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // Épaules/manteau
  ctx.fillStyle = '#8b1010'
  ctx.beginPath()
  ctx.ellipse(-9, 2, 5, 4, -0.4, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath()
  ctx.ellipse(9, 2, 5, 4, 0.4, 0, Math.PI * 2); ctx.fill()

  // Tête
  const headG = ctx.createRadialGradient(-3, -12, 2, 0, -9, 13)
  headG.addColorStop(0, '#cc2828')
  headG.addColorStop(1, '#7a1010')
  ctx.fillStyle = headG
  ctx.shadowBlur = 12; ctx.shadowColor = 'rgba(200,20,20,0.4)'
  ctx.beginPath()
  ctx.arc(0, -9, 13, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // Reflet sur tête
  const hlG = ctx.createRadialGradient(-4, -15, 0, -4, -15, 6)
  hlG.addColorStop(0, 'rgba(255,120,120,0.22)')
  hlG.addColorStop(1, 'rgba(255,120,120,0)')
  ctx.fillStyle = hlG
  ctx.beginPath(); ctx.arc(0, -9, 13, 0, Math.PI * 2); ctx.fill()

  // Cornes
  const hornG = ctx.createLinearGradient(0, -24, 0, -9)
  hornG.addColorStop(0, '#280404')
  hornG.addColorStop(1, '#7a0e0e')
  ctx.fillStyle = hornG
  // Gauche
  ctx.beginPath()
  ctx.moveTo(-10, -19); ctx.lineTo(-4, -9); ctx.lineTo(-1.5, -21); ctx.closePath(); ctx.fill()
  // Droite
  ctx.beginPath()
  ctx.moveTo(10, -19); ctx.lineTo(4, -9); ctx.lineTo(1.5, -21); ctx.closePath(); ctx.fill()
  // Reflets cornes
  ctx.fillStyle = 'rgba(180,40,40,0.35)'
  ctx.beginPath()
  ctx.moveTo(-9.5, -18); ctx.lineTo(-7, -13); ctx.lineTo(-5.5, -18); ctx.closePath(); ctx.fill()
  ctx.beginPath()
  ctx.moveTo(9.5, -18); ctx.lineTo(7, -13); ctx.lineTo(5.5, -18); ctx.closePath(); ctx.fill()

  // Sourcils (expressifs)
  ctx.strokeStyle = '#1a0303'; ctx.lineWidth = 1.8; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(-7.5, -13.5); ctx.quadraticCurveTo(-5, -16), (-2, -13.5); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(7.5, -13.5);  ctx.quadraticCurveTo(5, -16),  (2, -13.5);  ctx.stroke()

  // Yeux — lueur intense
  ctx.shadowBlur = 18; ctx.shadowColor = '#ff2200'
  ctx.fillStyle = '#ff4433'
  ctx.save(); ctx.translate(-4.5, -10); ctx.rotate(-0.18)
  ctx.beginPath(); ctx.ellipse(0, 0, 3.8, 2.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore()
  ctx.save(); ctx.translate(4.5, -10);  ctx.rotate(0.18)
  ctx.beginPath(); ctx.ellipse(0, 0, 3.8, 2.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore()
  ctx.shadowBlur = 0

  // Pupilles (petits carrés pour style démoniaque)
  ctx.fillStyle = '#080000'
  ctx.save(); ctx.translate(-4.5, -10); ctx.rotate(-0.18)
  ctx.fillRect(-1.2, -1.2, 2.4, 2.4); ctx.restore()
  ctx.save(); ctx.translate(4.5, -10);  ctx.rotate(0.18)
  ctx.fillRect(-1.2, -1.2, 2.4, 2.4); ctx.restore()

  // Bouche / crocs
  ctx.strokeStyle = '#200404'; ctx.lineWidth = 1.4
  ctx.beginPath(); ctx.arc(0, -5, 5.5, 0.25, Math.PI - 0.25); ctx.stroke()
  ctx.fillStyle = '#eeddd0'
  // Croc gauche
  ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(-1.5, 2); ctx.lineTo(0, -2); ctx.closePath(); ctx.fill()
  // Croc droit
  ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(1.5, 2); ctx.lineTo(3, -2); ctx.closePath(); ctx.fill()

  // Queue (derrière)
  const tw = Math.sin(f * 0.06) * 8
  ctx.strokeStyle = '#5a0e0e'; ctx.lineWidth = 3; ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(9, 6); ctx.bezierCurveTo(17, 6 + tw, 20, 14, 15, 21); ctx.stroke()
  ctx.fillStyle = '#300606'
  ctx.beginPath(); ctx.moveTo(15, 21); ctx.lineTo(11, 27); ctx.lineTo(18, 27); ctx.closePath(); ctx.fill()

  // Jambes (walk anim)
  const walk = state === 'walk' ? Math.sin(f * 0.28) * 5 : 0
  ctx.fillStyle = '#7a1212'
  ctx.save(); ctx.translate(-4, 16); ctx.rotate(walk * Math.PI / 180)
  ctx.beginPath(); ctx.roundRect(-3, 0, 6, 8, 2); ctx.fill(); ctx.restore()
  ctx.save(); ctx.translate(4, 16); ctx.rotate(-walk * Math.PI / 180)
  ctx.beginPath(); ctx.roundRect(-3, 0, 6, 8, 2); ctx.fill(); ctx.restore()

  ctx.restore()
}

// ── Explosion ─────────────────────────────────────────────────────────────────

function drawBust(x, y, progress) {
  if (progress <= 0) return
  ctx.save()
  ctx.translate(x, y)
  const p = progress

  // Onde externe
  ctx.strokeStyle = `rgba(255,80,0,${(1 - p) * 0.9})`
  ctx.lineWidth = 3.5 - p * 2
  ctx.shadowBlur = 20; ctx.shadowColor = `rgba(255,80,0,${1 - p})`
  ctx.beginPath(); ctx.arc(0, 0, p * 60, 0, Math.PI * 2); ctx.stroke()
  ctx.shadowBlur = 0

  // Onde interne
  ctx.strokeStyle = `rgba(255,220,0,${(1 - p) * 0.55})`
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.arc(0, 0, p * 40, 0, Math.PI * 2); ctx.stroke()

  // Éclats
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 + p
    const d = p * 50
    const s = (1 - p) * 5.5
    const c = i % 2 === 0 ? `rgba(255,200,0,${(1-p)*0.9})` : `rgba(255,60,0,${(1-p)*0.8})`
    ctx.fillStyle = c
    ctx.shadowBlur = 8; ctx.shadowColor = c
    ctx.beginPath()
    ctx.arc(Math.cos(angle) * d, Math.sin(angle) * d, s, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }

  // Flammes secondaires
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + p * 0.5
    const d = p * 24
    drawFire(Math.cos(a) * d, Math.sin(a) * d, frame, i * 1.3)
  }

  // Démon qui tourne + rétrécit
  if (p < 0.55) {
    ctx.save()
    ctx.scale(1 - p * 1.5, 1 - p * 1.5)
    ctx.rotate(p * Math.PI * 2.5)
    ctx.globalAlpha = Math.max(0, 1 - p * 2.2)
    drawDemon(0, 0, frame, 'idle')
    ctx.restore()
  }

  ctx.restore()
}

// ── Étincelles ────────────────────────────────────────────────────────────────

function updateSparks() {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]
    s.x += s.vx; s.y += s.vy; s.vy += 0.08; s.life -= s.decay
    if (s.life <= 0) { sparks.splice(i, 1); continue }
    ctx.globalAlpha = s.life
    ctx.fillStyle   = s.color
    ctx.shadowBlur  = 6; ctx.shadowColor = s.color
    ctx.beginPath(); ctx.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }
}

// ── Boucle de rendu ───────────────────────────────────────────────────────────

function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, CW, CH)

  // Fond global gradient
  const bgG = ctx.createLinearGradient(0, 0, 0, CH)
  bgG.addColorStop(0,   '#0a0d14')
  bgG.addColorStop(0.5, '#0d111a')
  bgG.addColorStop(1,   '#090c12')
  ctx.fillStyle = bgG
  ctx.fillRect(0, 0, CW, CH)

  // Ruelles
  for (let lane = MAX_LANES; lane >= 1; lane--) {
    drawLane(lane)
  }
  drawStartRow()

  // Colonnes gauche/droite (séparateurs visuels)
  ctx.fillStyle = 'rgba(255,255,255,0.04)'
  ctx.fillRect(L_PAD, 0, 1, CH)
  ctx.fillRect(CW - R_PAD, 0, 1, CH)

  const demonX = TX + TW / 2

  // Obstacles
  for (let i = 0; i < MAX_LANES; i++) {
    const lane    = i + 1
    const cleared = etat.value !== 'idle' && laneActuelle.value > lane
    const active  = etat.value !== 'idle' && laneActuelle.value === lane && demonState !== 'bust'
    if (cleared || active) continue

    for (const obs of obstacles[i]) {
      const cy = laneTop(lane) + LANE_H / 2
      if (obs.type === 'fire') drawFire(obs.x, cy + 8, frame, obs.phase)
      else                     drawSkull(obs.x, cy + 4, frame, obs.phase)
    }
  }

  // Étincelles
  updateSparks()

  // Démon
  if (demonState === 'bust') {
    bustProg = Math.min(bustProg + 0.022, 1)
    drawBust(demonX, demonY, bustProg)
  } else if (demonState === 'win') {
    const dance = Math.sin(frame * 0.14) * 4
    ctx.save()
    ctx.shadowBlur = 24; ctx.shadowColor = 'rgba(201,168,76,0.6)'
    drawDemon(demonX, demonY + dance, frame, 'walk')
    ctx.restore()
  } else {
    demonY += (demonTargetY - demonY) * 0.11
    const st = Math.abs(demonY - demonTargetY) > 2 ? 'walk' : 'idle'
    ctx.save()
    ctx.shadowBlur = 18; ctx.shadowColor = 'rgba(180,20,20,0.45)'
    drawDemon(demonX, demonY, frame, st)
    ctx.restore()
  }

  // Mise à jour obstacles + road scroll
  roadScroll += 0.7
  for (let i = 0; i < MAX_LANES; i++) {
    for (const obs of obstacles[i]) {
      obs.x += obs.speed
      if (obs.speed > 0 && obs.x > TX + TW + 14) obs.x = TX - 14
      if (obs.speed < 0 && obs.x < TX - 14)       obs.x = TX + TW + 14
    }
  }

  frame++
  raf = requestAnimationFrame(draw)
}

// ── Logic ─────────────────────────────────────────────────────────────────────

function fmtYen(n) {
  if (n == null) return '—'
  return (n < 0 ? '-¥' : '¥') + Math.abs(n).toLocaleString('fr-FR')
}

async function lancerPartie() {
  if (loading.value) return
  erreur.value = ''
  loading.value = true
  resumeAudio(); playInvoke()
  try {
    const data = await crossroadNew(miseInput.value)
    miseEnCours.value  = miseInput.value
    laneActuelle.value = 0
    etat.value         = 'en_cours'
    gainNet.value      = 0
    demonState         = 'idle'
    bustProg           = 0
    demonTargetY       = laneY(0)
    if (data.solde != null) solde.value = data.solde
  } catch (e) { erreur.value = e.message }
  finally { loading.value = false }
}

async function doAvancer() {
  if (loading.value) return
  erreur.value = ''
  loading.value = true
  resumeAudio(); playStep()
  try {
    const data = await crossroadAvancer()
    laneActuelle.value = data.lane_actuelle
    demonTargetY       = laneY(data.lane_actuelle)
    demonState         = 'walk'
    if (data.solde != null) solde.value = data.solde

    if (data.statut === 'bust') {
      await sleep(280)
      etat.value = 'fini_bust'; gainNet.value = data.gain_net
      demonState = 'bust'; bustProg = 0
      bustFlash.value = true; playBust()
      spawnSparks(TX + TW / 2, demonY, 20)
      setTimeout(() => { bustFlash.value = false }, 600)
    } else if (data.statut === 'victoire_totale') {
      await sleep(380)
      etat.value = 'fini_win'; gainNet.value = data.gain_net
      demonState = 'win'; playCoin()
      spawnSparks(TX + TW / 2, demonY, 16)
    } else {
      await sleep(240); demonState = 'idle'
    }
  } catch (e) { erreur.value = e.message }
  finally { loading.value = false }
}

async function doEncaisser() {
  if (loading.value) return
  erreur.value = ''
  loading.value = true
  resumeAudio()
  try {
    const data = await crossroadEncaisser()
    etat.value = 'fini_win'; gainNet.value = data.gain_net
    demonState = 'win'
    if (data.solde != null) solde.value = data.solde
    playCoin()
    spawnSparks(TX + TW / 2, demonY, 12)
  } catch (e) { erreur.value = e.message }
  finally { loading.value = false }
}

async function rejouer() {
  etat.value = 'idle'
  demonTargetY = laneY(0); demonY = laneY(0)
  demonState = 'idle'; bustProg = 0
  await lancerPartie()
}

function reset() {
  etat.value = 'idle'; laneActuelle.value = 0; gainNet.value = 0
  demonTargetY = laneY(0); demonY = laneY(0)
  demonState = 'idle'; bustProg = 0
}

onMounted(async () => {
  const me = await getMe()
  if (me) solde.value = me.solde

  const canvas = gameCanvas.value
  const dpr = window.devicePixelRatio || 1
  canvas.width  = CW * dpr
  canvas.height = CH * dpr
  ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  demonY       = laneY(0)
  demonTargetY = laneY(0)
  draw()
})

onUnmounted(() => { if (raf) cancelAnimationFrame(raf) })
</script>

<style scoped>
.page { min-height: 100vh; background: #080b11; color: #fff; }

.page-inner {
  max-width: 640px;
  margin: 0 auto;
  padding: 3rem 1.5rem 6rem;
}

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

.page-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: clamp(1.3rem, 3.5vw, 1.8rem); font-weight: 400;
  letter-spacing: 0.06em; color: #fff; margin: 0 0 1.4rem; text-align: center;
}

/* Canvas */
.canvas-wrap {
  border: 1px solid rgba(255,255,255,0.07);
  overflow: hidden; border-radius: 4px;
}
@keyframes bust-flash {
  0%,100% { box-shadow: none; }
  35% { box-shadow: 0 0 50px rgba(192,57,43,0.55) inset, 0 0 20px rgba(255,60,0,0.3); }
}
.cw--bust { animation: bust-flash 0.65s ease; }
.game-canvas {
  display: block; width: 100%; height: auto;
  aspect-ratio: 580 / 506; image-rendering: -webkit-optimize-contrast;
}

/* Mult bar */
.mult-bar {
  margin-top: 10px; display: flex; align-items: center; gap: 10px;
  padding: 9px 14px; background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05); border-radius: 3px;
}
.mb-label {
  font-family: 'Cinzel', serif; font-size: 0.56rem; letter-spacing: 0.12em;
  text-transform: uppercase; color: rgba(255,255,255,0.25);
}
.mb-mult {
  font-family: 'Cinzel', serif; font-size: 0.92rem; letter-spacing: 0.08em;
  color: #c9a84c; margin-left: auto;
  text-shadow: 0 0 12px rgba(201,168,76,0.5);
}
.mb-gain {
  font-family: 'Cinzel', serif; font-size: 0.72rem; color: rgba(201,168,76,0.65);
}
.mb-fade-enter-active, .mb-fade-leave-active { transition: opacity 0.2s; }
.mb-fade-enter-from, .mb-fade-leave-to { opacity: 0; }

/* Résultat */
.resultat {
  margin-top: 12px; padding: 14px 20px;
  display: flex; align-items: center; gap: 18px; justify-content: center;
}
.r-label {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1rem; letter-spacing: 0.05em;
}
.resultat--bust .r-label { color: #e74c3c; }
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
.result-pop-leave-to { opacity: 0; }

/* Actions */
.actions {
  margin-top: 18px; display: flex; flex-direction: column;
  gap: 14px; align-items: center;
}
.mise-row { display: flex; align-items: center; gap: 12px; }
.mise-label {
  font-family: 'Cinzel', serif; font-size: 0.65rem; letter-spacing: 0.14em;
  text-transform: uppercase; color: rgba(255,255,255,0.3);
}
.mise-input {
  background: #111520; border: 1px solid rgba(255,255,255,0.1);
  color: #d4cfc9; font-family: 'Cinzel', serif; font-size: 0.85rem;
  padding: 8px 14px; width: 150px; text-align: right;
  outline: none; transition: border-color 0.15s; border-radius: 2px;
}
.mise-input:focus { border-color: rgba(201,168,76,0.4); }
.mise-input::-webkit-inner-spin-button { opacity: 0.3; }

.btns { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }

.btn {
  font-family: 'Cinzel', serif; font-size: 0.65rem; letter-spacing: 0.16em;
  text-transform: uppercase; padding: 11px 28px; border: none;
  cursor: pointer; transition: opacity 0.15s, background 0.15s, transform 0.1s;
  border-radius: 2px;
}
.btn:active:not(:disabled) { transform: scale(0.97); }
.btn:disabled { opacity: 0.35; cursor: not-allowed; }

.btn--invoke  { background: #8b1a1a; color: #e8ddd0; }
.btn--invoke:hover:not(:disabled)  { background: #a01f1f; }

.btn--avancer { background: rgba(201,168,76,0.15); color: #c9a84c; border: 1px solid rgba(201,168,76,0.3); }
.btn--avancer:hover:not(:disabled) { background: rgba(201,168,76,0.25); }

.btn--encaisser { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.55); border: 1px solid rgba(255,255,255,0.1); }
.btn--encaisser:hover:not(:disabled) { background: rgba(255,255,255,0.1); }

.btn--ghost { background: transparent; color: rgba(255,255,255,0.3); border: 1px solid rgba(255,255,255,0.1); }
.btn--ghost:hover:not(:disabled) { color: rgba(255,255,255,0.55); }

.erreur {
  font-family: 'Crimson Text', serif; font-style: italic;
  color: #c0392b; text-align: center; margin-top: 14px; font-size: 0.95rem;
}
</style>

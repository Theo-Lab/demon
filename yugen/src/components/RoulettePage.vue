<template>
  <div class="page">
    <AppNavbar />
    <div v-if="jeuIndisponible" class="jeu-indispo">
      <p class="jeu-indispo-title">Jeu indisponible</p>
      <p class="jeu-indispo-sub">La Roulette est temporairement fermée.</p>
      <RouterLink to="/casino" class="jeu-indispo-link">← Retour au casino</RouterLink>
    </div>
    <div v-if="!jeuIndisponible" class="page-inner">

      <div class="pg-header">
        <div>
          <p class="pg-label">Casino de l'Ordre</p>
          <h1 class="pg-title">Roulette</h1>
        </div>
        <div class="solde-box">
          <span class="solde-lbl">Solde</span>
          <span class="solde-val">{{ solde.toLocaleString() }} ¥</span>
        </div>
      </div>

      <div class="pg-divider"></div>

      <div class="game-wrap">

        <!-- ── Roue + Panel ───────────────────────────────────────────── -->
        <div class="top-row">

          <div class="wheel-wrap">
            <canvas ref="canvasEl"></canvas>
            <div class="marker">▼</div>
          </div>

          <div class="panel">

            <!-- Résultat -->
            <div class="result-zone">
              <transition name="pop">
                <div v-if="resultat && !animating" class="result-inner">
                  <div class="result-ball" :class="'rb--' + resultat.couleur">
                    {{ resultat.numero }}
                  </div>
                  <div class="result-gain" :class="resultat.gain_net >= 0 ? 'g-pos' : 'g-neg'">
                    {{ resultat.gain_net >= 0 ? '+' : '' }}{{ resultat.gain_net.toLocaleString() }} ¥
                  </div>
                </div>
              </transition>
            </div>

            <!-- Historique -->
            <div v-if="historique.length" class="hist-row">
              <span v-for="(h, i) in historique" :key="i"
                class="hist-pill" :class="'hp--' + h.couleur">{{ h.numero }}</span>
            </div>

            <!-- Chips -->
            <div class="blk">
              <p class="blk-label">Mise</p>
              <div class="chips">
                <button v-for="c in CHIPS" :key="c.valeur"
                  :class="['chip', montantSelectionne === c.valeur ? 'chip-on' : '']"
                  :style="{ '--cc': c.couleur }"
                  :disabled="animating"
                  @click="montantSelectionne = c.valeur">{{ c.label }}</button>
              </div>
            </div>

            <p v-if="erreur" class="erreur">{{ erreur }}</p>

            <button class="btn-lancer" :disabled="animating || !mises.length" @click="lancerSpin">
              <span v-if="animating" class="dots"><span/><span/><span/></span>
              <span v-else>Lancer</span>
            </button>

            <div class="btn-row">
              <button class="btn-secondary" :disabled="animating || !dernieresMises.length" @click="reparier">
                ↺ Reparier
              </button>
              <button class="btn-secondary" :disabled="animating || !mises.length" @click="effacerTout">
                Effacer
              </button>
            </div>

          </div>
        </div>

        <!-- ── Table de mise + sidebar mises ────────────────────────── -->
        <div class="table-row">

          <div class="table-scroll">
            <div class="bet-table">

              <div class="bt-main">
                <!-- Zéro -->
                <div class="num-cell zero-cell"
                  :class="{ 'nc-active': misesParNumero[0], 'nc-result': resultat?.numero === 0 }"
                  @click="togglePlein(0)">
                  <span class="nc-txt">0</span>
                  <span v-if="misesParNumero[0]" class="nc-chip"/>
                </div>

                <!-- Grille 12×3 -->
                <div class="nums-grid">
                  <template v-for="col in 12" :key="col">
                    <div v-for="row in [3,2,1]" :key="row"
                      class="num-cell"
                      :class="[numCls((col-1)*3+row), { 'nc-active': misesParNumero[(col-1)*3+row], 'nc-result': resultat?.numero === (col-1)*3+row }]"
                      @click="togglePlein((col-1)*3+row)">
                      <span class="nc-txt">{{ (col-1)*3+row }}</span>
                      <span v-if="misesParNumero[(col-1)*3+row]" class="nc-chip"/>
                    </div>
                  </template>
                </div>

                <!-- Colonnes -->
                <div class="col-col">
                  <button v-for="c in [1,2,3]" :key="c"
                    class="ob" :class="{ 'ob-on': hasMise('colonne_'+c) }"
                    :disabled="animating" @click="toggleOB('colonne_'+c)">Col {{ c }}</button>
                </div>
              </div>

              <!-- Outside bets -->
              <div class="ob-row">
                <button class="ob" :class="{ 'ob-on': hasMise('manque') }"  :disabled="animating" @click="toggleOB('manque')">1–18</button>
                <button class="ob" :class="{ 'ob-on': hasMise('pair') }"   :disabled="animating" @click="toggleOB('pair')">Pair</button>
                <button class="ob ob-rouge" :class="{ 'ob-on': hasMise('rouge') }" :disabled="animating" @click="toggleOB('rouge')">Rouge</button>
                <button class="ob ob-noir"  :class="{ 'ob-on': hasMise('noir') }"  :disabled="animating" @click="toggleOB('noir')">Noir</button>
                <button class="ob" :class="{ 'ob-on': hasMise('impair') }" :disabled="animating" @click="toggleOB('impair')">Impair</button>
                <button class="ob" :class="{ 'ob-on': hasMise('passe') }"  :disabled="animating" @click="toggleOB('passe')">19–36</button>
              </div>

              <div class="ob-row">
                <button v-for="d in [1,2,3]" :key="d"
                  class="ob dz" :class="{ 'ob-on': hasMise('douzaine_'+d) }"
                  :disabled="animating" @click="toggleOB('douzaine_'+d)">Douzaine {{ d }}</button>
              </div>

            </div>
          </div>

          <!-- Sidebar mises -->
          <div class="mises-side">
            <p class="blk-label">Mises placées</p>

            <p v-if="!mises.length" class="mises-empty">Aucune mise</p>
            <div v-else class="mises-list">
              <div v-for="(m, i) in mises" :key="i" class="mise-row">
                <span class="mr-type">{{ labelMise(m) }}</span>
                <span class="mr-montant">{{ m.montant.toLocaleString() }} ¥</span>
                <button class="mr-del" :disabled="animating" @click="retirerMise(i)">×</button>
              </div>
            </div>

            <div v-if="mises.length" class="mises-total">
              <span>Total</span>
              <span>{{ totalMises.toLocaleString() }} ¥</span>
            </div>
          </div>

        </div>

        <!-- ── Règles ─────────────────────────────────────────────────── -->
        <div class="rules-section">
          <button class="rules-toggle" @click="reglesOuvertes = !reglesOuvertes">
            <span>Règles du jeu</span>
            <span class="rules-chevron" :class="{ 'rules-chevron--open': reglesOuvertes }">▾</span>
          </button>

          <div v-if="reglesOuvertes" class="rules-body">
            <p class="rules-intro">La roulette européenne comporte 37 cases numérotées de 0 à 36. Placez vos mises avant de lancer, puis la bille désigne le numéro gagnant.</p>

            <div class="rules-grid">
              <div class="rule-block">
                <h3 class="rule-title">Plein</h3>
                <p class="rule-desc">Miser sur un numéro exact (0–36). Cote : <strong>×35</strong>.</p>
              </div>
              <div class="rule-block">
                <h3 class="rule-title">Rouge / Noir</h3>
                <p class="rule-desc">Miser sur la couleur du numéro. Le 0 ne compte pas. Cote : <strong>×1</strong>.</p>
              </div>
              <div class="rule-block">
                <h3 class="rule-title">Pair / Impair</h3>
                <p class="rule-desc">Miser sur la parité. Le 0 perd. Cote : <strong>×1</strong>.</p>
              </div>
              <div class="rule-block">
                <h3 class="rule-title">Manque / Passe</h3>
                <p class="rule-desc">Manque = 1–18, Passe = 19–36. Le 0 perd. Cote : <strong>×1</strong>.</p>
              </div>
              <div class="rule-block">
                <h3 class="rule-title">Douzaines</h3>
                <p class="rule-desc">1ère (1–12), 2ème (13–24), 3ème (25–36). Le 0 perd. Cote : <strong>×2</strong>.</p>
              </div>
              <div class="rule-block">
                <h3 class="rule-title">Colonnes</h3>
                <p class="rule-desc">Col 1 = n%3==1, Col 2 = n%3==2, Col 3 = n%3==0. Le 0 perd. Cote : <strong>×2</strong>.</p>
              </div>
            </div>

            <p class="rules-note">Vous pouvez cumuler plusieurs mises différentes sur le même tour. Les gains sont calculés indépendamment pour chaque mise.</p>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AppNavbar from './AppNavbar.vue'
import { currentUser } from '../auth.js'
import { spinRoulette, getMe, getCasinoGames } from '../api.js'
import { startRoll, updateRoll, stopRoll, playTick, playLand, playWin, resumeAudio } from '../roulette-audio.js'

// ── Constantes ────────────────────────────────────────────────────────────────

const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26]
const ROUGE_SET   = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])

const CHIPS = [
  { valeur: 1000,   label: '1k',   couleur: '#4a3a8b' },
  { valeur: 5000,   label: '5k',   couleur: '#8b1a1a' },
  { valeur: 10000,  label: '10k',  couleur: '#1a4a8b' },
  { valeur: 50000,  label: '50k',  couleur: '#4a7a1a' },
  { valeur: 100000, label: '100k', couleur: '#7a5a1a' },
]

const LABELS = {
  rouge:'Rouge', noir:'Noir', pair:'Pair', impair:'Impair',
  manque:'1–18', passe:'19–36',
  douzaine_1:'Douzaine 1', douzaine_2:'Douzaine 2', douzaine_3:'Douzaine 3',
  colonne_1:'Colonne 1',   colonne_2:'Colonne 2',   colonne_3:'Colonne 3',
}

// ── Canvas ────────────────────────────────────────────────────────────────────

const CS   = 380          // canvas logical size
const CX   = CS / 2
const CY   = CS / 2
const TAU  = Math.PI * 2
const SA   = TAU / 37            // sector angle
const MARK = -Math.PI / 2        // top (12 o'clock)

// Radii
const RF_OUT = 182    // outer wooden rim
const RF_IN  = 169    // inner rim / outer ball track
const RN_OUT = 154    // outer edge of number sectors
const RN_IN  = 108    // inner edge of number sectors
const R_BOWL = 92     // inner bowl
const R_BALL_OUT = 162   // ball outer orbit
const R_BALL_PKT = 124   // ball in pocket

// Animation variables (not reactive — canvas-driven)
let wheelAngle  = 0
let ballAngle   = MARK
let ballR       = 0
let ballVisible = false
let winnerIdx   = -1       // index in WHEEL_ORDER of last winner
let pendingRes  = null

// Loop handles
let idleId  = null
let animId  = null
let animT0  = null
let wFrom   = 0; let wTo = 0
let bFrom   = 0; let bTo = 0
let prevTickCount = 0  // pour les ticks bille

const ANIM_DUR     = 5800   // ms
const N_WHEEL_SPIN = 7
const M_BALL_SPIN  = 11

// ── Vue state ─────────────────────────────────────────────────────────────────

const canvasEl           = ref(null)
const animating          = ref(false)
const erreur             = ref('')
const resultat           = ref(null)
const historique         = ref([])
const mises              = ref([])
const dernieresMises     = ref([])
const montantSelectionne = ref(5000)
const reglesOuvertes     = ref(false)
let ctx = null

const solde      = computed(() => currentUser.value?.solde ?? 0)
const totalMises = computed(() => mises.value.reduce((s, m) => s + m.montant, 0))

const misesParNumero = computed(() => {
  const map = {}
  for (const m of mises.value)
    if (m.type === 'plein') map[m.valeur] = (map[m.valeur] || 0) + 1
  return map
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function numCls(n) {
  if (n === 0) return 'nc-vert'
  return ROUGE_SET.has(n) ? 'nc-rouge' : 'nc-noir'
}

function labelMise(m) {
  return m.type === 'plein' ? `Plein ${m.valeur}` : (LABELS[m.type] ?? m.type)
}

function hasMise(type) { return mises.value.some(m => m.type === type) }

function togglePlein(n) {
  if (animating.value) return
  const i = mises.value.findLastIndex(m => m.type === 'plein' && m.valeur === n)
  if (i !== -1) mises.value.splice(i, 1)
  else mises.value.push({ type: 'plein', valeur: n, montant: montantSelectionne.value })
}

function toggleOB(type) {
  if (animating.value) return
  const i = mises.value.findIndex(m => m.type === type)
  if (i !== -1) mises.value.splice(i, 1)
  else mises.value.push({ type, valeur: null, montant: montantSelectionne.value })
}

function retirerMise(i) { mises.value.splice(i, 1) }
function effacerTout()  { mises.value = [] }
function reparier() {
  if (animating.value || !dernieresMises.value.length) return
  mises.value = dernieresMises.value.map(m => ({ ...m }))
}

// ── Canvas drawing ────────────────────────────────────────────────────────────

function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, CS, CS)
  drawRim()
  drawSectors()
  drawBowl()
  drawFrets()
  drawHub()
  if (ballVisible) drawBall()
}

function drawRim() {
  // Outer wood fill
  ctx.beginPath()
  ctx.arc(CX, CY, RF_OUT, 0, TAU)
  ctx.fillStyle = '#1c1005'
  ctx.fill()

  // Gold outer border
  ctx.beginPath()
  ctx.arc(CX, CY, RF_OUT - 1, 0, TAU)
  ctx.strokeStyle = '#9a7a30'
  ctx.lineWidth = 3
  ctx.stroke()

  // Inner rim line
  ctx.beginPath()
  ctx.arc(CX, CY, RF_IN, 0, TAU)
  ctx.strokeStyle = '#5a3a10'
  ctx.lineWidth = 1
  ctx.stroke()
}

function drawSectors() {
  for (let i = 0; i < 37; i++) {
    const num = WHEEL_ORDER[i]
    const a0  = wheelAngle + (i - 0.5) * SA
    const a1  = wheelAngle + (i + 0.5) * SA
    const mid = wheelAngle + i * SA

    // Background color
    let fill
    if (num === 0)            fill = '#1a5a1a'
    else if (ROUGE_SET.has(num)) fill = '#7a1212'
    else                      fill = '#0d0d0d'

    // Winner highlight
    const isWinner = (i === winnerIdx && !animating.value)
    if (isWinner) {
      ctx.shadowBlur  = 22
      ctx.shadowColor = 'rgba(255,210,80,0.7)'
    }

    // Annular sector
    ctx.beginPath()
    ctx.arc(CX, CY, RN_OUT, a0, a1)
    ctx.arc(CX, CY, RN_IN, a1, a0, true)
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 0.5
    ctx.stroke()

    if (isWinner) ctx.shadowBlur = 0

    // Number label
    const tr = (RN_OUT + RN_IN) / 2
    const tx = CX + Math.cos(mid) * tr
    const ty = CY + Math.sin(mid) * tr
    ctx.save()
    ctx.translate(tx, ty)
    ctx.rotate(mid + Math.PI / 2)
    ctx.font = 'bold 9px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = num === 0 ? '#80d080' : ROUGE_SET.has(num) ? '#ffa0a0' : '#d8d8d8'
    ctx.fillText(String(num), 0, 0)
    ctx.restore()
  }

  // Radial dividers
  for (let i = 0; i < 37; i++) {
    const a = wheelAngle + (i - 0.5) * SA
    ctx.beginPath()
    ctx.moveTo(CX + Math.cos(a) * RN_IN,  CY + Math.sin(a) * RN_IN)
    ctx.lineTo(CX + Math.cos(a) * RN_OUT, CY + Math.sin(a) * RN_OUT)
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 0.8
    ctx.stroke()
  }
}

function drawBowl() {
  // Fill inside sectors
  ctx.beginPath()
  ctx.arc(CX, CY, RN_IN, 0, TAU)
  ctx.fillStyle = '#080808'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  ctx.lineWidth = 1
  ctx.stroke()

  // Inner bowl gradient
  const g = ctx.createRadialGradient(CX - 14, CY - 14, 4, CX, CY, R_BOWL)
  g.addColorStop(0, '#2e1a06')
  g.addColorStop(0.7, '#180e04')
  g.addColorStop(1, '#0a0805')
  ctx.beginPath()
  ctx.arc(CX, CY, R_BOWL, 0, TAU)
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = '#7a5a1a'
  ctx.lineWidth = 1.5
  ctx.stroke()
}

function drawFrets() {
  // Small gold pegs between sectors on the ball track
  for (let i = 0; i < 37; i++) {
    const a  = wheelAngle + (i - 0.5) * SA
    const r  = RN_OUT + (RF_IN - RN_OUT) / 2
    const px = CX + Math.cos(a) * r
    const py = CY + Math.sin(a) * r
    ctx.beginPath()
    ctx.arc(px, py, 2.2, 0, TAU)
    ctx.fillStyle = '#9a7a30'
    ctx.fill()
  }
}

function drawHub() {
  ctx.beginPath()
  ctx.arc(CX, CY, 20, 0, TAU)
  ctx.fillStyle = '#2a1a06'
  ctx.fill()
  ctx.strokeStyle = '#9a7a30'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(CX, CY, 12, 0, TAU)
  ctx.fillStyle = '#9a7a30'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(CX, CY, 6, 0, TAU)
  ctx.fillStyle = '#c8a840'
  ctx.fill()
}

function drawBall() {
  const bx = CX + Math.cos(ballAngle) * ballR
  const by = CY + Math.sin(ballAngle) * ballR

  // Shadow
  ctx.beginPath()
  ctx.arc(bx + 2, by + 2, 6.5, 0, TAU)
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fill()

  // Sphere gradient
  const g = ctx.createRadialGradient(bx - 2.5, by - 2.5, 1, bx, by, 6.5)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.45, '#dddddd')
  g.addColorStop(1, '#888888')
  ctx.beginPath()
  ctx.arc(bx, by, 6.5, 0, TAU)
  ctx.fillStyle = g
  ctx.fill()
}

// ── Idle animation ────────────────────────────────────────────────────────────

function idleStep() {
  wheelAngle = (wheelAngle + 0.0018) % TAU
  draw()
  idleId = requestAnimationFrame(idleStep)
}

function startIdle() {
  if (idleId) cancelAnimationFrame(idleId)
  idleId = requestAnimationFrame(idleStep)
}

function stopIdle() {
  if (idleId) { cancelAnimationFrame(idleId); idleId = null }
}

// ── Spin animation ────────────────────────────────────────────────────────────

function easeOut(t) { return 1 - Math.pow(1 - t, 4) }

function startAnimation(winnerNumber) {
  const wi = WHEEL_ORDER.indexOf(winnerNumber)
  winnerIdx = wi

  // Wheel rotates clockwise → target: sector wi at MARK
  wFrom = wheelAngle
  let adj = (MARK - wi * SA - wheelAngle) % TAU
  if (adj < 0) adj += TAU
  wTo = wheelAngle + N_WHEEL_SPIN * TAU + adj

  // Ball rotates counterclockwise → ends at MARK
  bFrom = ballAngle
  let adjB = (MARK - ballAngle) % TAU
  if (adjB > 0) adjB -= TAU
  if (adjB > -0.05) adjB -= TAU
  bTo = ballAngle - M_BALL_SPIN * TAU + adjB

  ballR        = R_BALL_OUT
  ballVisible  = true
  prevTickCount = 0
  animT0       = null
  startRoll()
  animId = requestAnimationFrame(animStep)
}

function animStep(ts) {
  if (!animT0) animT0 = ts
  const t = Math.min((ts - animT0) / ANIM_DUR, 1)
  const e = easeOut(t)

  wheelAngle = wFrom + (wTo - wFrom) * e
  ballAngle  = bFrom + (bTo - bFrom) * e

  // Bruit de roulement avec vitesse
  updateRoll(t)

  // Ticks : bille franchit un séparateur (37 par tour)
  const totalBallTravel = Math.abs(bTo - bFrom) * e
  const tickCount = Math.floor(totalBallTravel / SA)
  if (tickCount > prevTickCount && t < 0.92) {
    const speed = 1 - t
    playTick(0.05 + speed * 0.22)
    prevTickCount = tickCount
  }

  // Ball spirals inward in the last 35%
  if (t < 0.65) {
    ballR = R_BALL_OUT
  } else {
    const ft = (t - 0.65) / 0.35
    ballR = R_BALL_OUT + (R_BALL_PKT - R_BALL_OUT) * easeOut(ft)
  }

  draw()

  if (t < 1) {
    animId = requestAnimationFrame(animStep)
  } else {
    wheelAngle = wTo
    ballAngle  = bTo
    ballR      = R_BALL_PKT
    draw()
    stopRoll()
    playLand()
    onAnimDone()
  }
}

function onAnimDone() {
  animating.value = false
  const res = pendingRes
  pendingRes = null
  if (!res) return

  resultat.value = res
  if (currentUser.value) currentUser.value = { ...currentUser.value, solde: res.solde }
  historique.value.unshift({ numero: res.numero, couleur: res.couleur })
  if (historique.value.length > 10) historique.value.pop()
  mises.value = []

  if (res.gain_net > 0) playWin()

  startIdle()
}

// ── Spin ──────────────────────────────────────────────────────────────────────

async function lancerSpin() {
  if (animating.value || !mises.value.length) return
  resumeAudio()
  erreur.value  = ''
  resultat.value = null
  winnerIdx      = -1
  ballVisible    = false
  dernieresMises.value = mises.value.map(m => ({ ...m }))
  animating.value = true

  stopIdle()

  try {
    const res = await spinRoulette(mises.value)
    pendingRes = res
    startAnimation(res.numero)
  } catch (e) {
    erreur.value    = e.message
    animating.value = false
    startIdle()
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

const jeuIndisponible = ref(false)

onMounted(async () => {
  try { const g = await getCasinoGames(); if (!g.roulette) jeuIndisponible.value = true } catch {}
  const canvas = canvasEl.value
  const dpr = window.devicePixelRatio || 1
  canvas.width  = CS * dpr
  canvas.height = CS * dpr
  canvas.style.width  = CS + 'px'
  canvas.style.height = CS + 'px'
  ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  startIdle()

  if (!currentUser.value) {
    try { const u = await getMe(); if (u) currentUser.value = u } catch {}
  }
})

onUnmounted(() => {
  stopIdle()
  stopRoll()
  if (animId) cancelAnimationFrame(animId)
})
</script>

<style scoped>
.page { min-height: 100vh; background: #090909; color: #d4cfc9; }

.page-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 48px 24px 80px;
}

/* ── Header ─────────────────────────────────────────────────────────────────── */
.pg-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 24px;
}

.pg-label {
  font-family: 'Cinzel', serif;
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.3);
  margin: 0 0 6px;
}

.pg-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.7rem;
  font-weight: 400;
  margin: 0;
  letter-spacing: 0.06em;
  color: #fff;
}

.pg-divider { height: 1px; background: rgba(255,255,255,0.06); margin-bottom: 36px; }

.solde-box { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }

.solde-lbl {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.25);
}

.solde-val {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.1rem;
  color: rgba(255,255,255,0.85);
}

/* ── Layout ─────────────────────────────────────────────────────────────────── */
.game-wrap   { display: flex; flex-direction: column; gap: 32px; }
.top-row     { display: flex; gap: 32px; align-items: flex-start; flex-wrap: wrap; }

/* ── Wheel ──────────────────────────────────────────────────────────────────── */
.wheel-wrap {
  position: relative;
  width: 380px;
  flex-shrink: 0;
}

.wheel-wrap canvas { display: block; }

.marker {
  position: absolute;
  top: 2px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 16px;
  color: #c8a840;
  line-height: 1;
  text-shadow: 0 0 10px rgba(200,168,64,0.7);
  pointer-events: none;
}

/* ── Panel ──────────────────────────────────────────────────────────────────── */
.panel {
  flex: 1;
  min-width: 220px;
  max-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* ── Résultat ───────────────────────────────────────────────────────────────── */
.result-zone { min-height: 90px; display: flex; align-items: center; justify-content: center; }

.result-inner { display: flex; flex-direction: column; align-items: center; gap: 10px; }

.result-ball {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.6rem;
  color: #fff;
  border: 2px solid rgba(255,255,255,0.15);
}

.rb--rouge { background: #7a1212; box-shadow: 0 0 28px rgba(139,26,26,0.6); }
.rb--noir  { background: #141414; box-shadow: 0 0 20px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08); }
.rb--vert  { background: #1a5a1a; box-shadow: 0 0 28px rgba(26,90,26,0.6); }

.result-gain { font-family: 'Cinzel', serif; font-size: 0.85rem; letter-spacing: 0.1em; }
.g-pos { color: #7aba7a; }
.g-neg { color: #c05050; }

/* pop transition */
.pop-enter-active { animation: popIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275); }
@keyframes popIn {
  from { opacity: 0; transform: scale(0.4); }
  to   { opacity: 1; transform: scale(1); }
}

/* ── Historique ─────────────────────────────────────────────────────────────── */
.hist-row { display: flex; flex-wrap: wrap; gap: 4px; }

.hist-pill {
  width: 26px; height: 26px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Cinzel', serif;
  font-size: 0.48rem; font-weight: 700;
  color: rgba(255,255,255,0.85);
  border: 1px solid rgba(255,255,255,0.1);
}

.hp--rouge { background: #7a1212; }
.hp--noir  { background: #1a1a1a; }
.hp--vert  { background: #1a5a1a; color: #7aba7a; }

/* ── Chips ──────────────────────────────────────────────────────────────────── */
.blk { display: flex; flex-direction: column; gap: 8px; }

.blk-label {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.22);
  margin: 0;
}

.chips { display: flex; gap: 6px; flex-wrap: wrap; }

.chip {
  width: 40px; height: 40px;
  border-radius: 50%;
  border: 2px solid var(--cc);
  background: color-mix(in srgb, var(--cc) 18%, transparent);
  color: rgba(255,255,255,0.65);
  font-family: 'Cinzel', serif;
  font-size: 0.5rem; letter-spacing: 0.04em;
  cursor: pointer; transition: all 0.12s;
  display: flex; align-items: center; justify-content: center;
}

.chip:hover:not(:disabled) { background: color-mix(in srgb, var(--cc) 40%, transparent); color: #fff; }
.chip-on { background: var(--cc) !important; color: #fff !important; box-shadow: 0 0 10px color-mix(in srgb, var(--cc) 55%, transparent); }
.chip:disabled { opacity: 0.3; cursor: default; }

/* ── Mises ──────────────────────────────────────────────────────────────────── */
.mises-empty { font-family: 'Crimson Text', Georgia, serif; font-style: italic; font-size: 0.9rem; color: rgba(255,255,255,0.18); margin: 0; }

.mises-list { display: flex; flex-direction: column; gap: 3px; max-height: 170px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.08) transparent; }

.mise-row {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 8px;
  background: #141416;
  border: 1px solid rgba(255,255,255,0.04);
}

.mr-type { font-family: 'Cinzel', serif; font-size: 0.56rem; letter-spacing: 0.07em; color: rgba(255,255,255,0.45); flex: 1; }
.mr-montant { font-family: 'Crimson Text', Georgia, serif; font-size: 0.86rem; color: rgba(255,255,255,0.6); white-space: nowrap; }
.mr-del { background: none; border: none; color: rgba(255,255,255,0.18); cursor: pointer; font-size: 0.95rem; padding: 0 2px; transition: color 0.1s; }
.mr-del:hover:not(:disabled) { color: #c05050; }
.mr-del:disabled { opacity: 0.15; cursor: default; }

/* ── Erreur ─────────────────────────────────────────────────────────────────── */
.erreur { font-family: 'Crimson Text', Georgia, serif; font-style: italic; font-size: 0.92rem; color: #c05050; margin: 0; }

/* ── Boutons ────────────────────────────────────────────────────────────────── */
.btn-lancer {
  font-family: 'Cinzel', serif; font-size: 0.72rem; letter-spacing: 0.2em; text-transform: uppercase;
  background: #8b1a1a; color: #fff; border: none; padding: 14px 0;
  cursor: pointer; width: 100%; transition: background 0.15s;
  display: flex; align-items: center; justify-content: center; min-height: 48px;
}
.btn-lancer:hover:not(:disabled) { background: #a82020; }
.btn-lancer:disabled { opacity: 0.4; cursor: default; }

.btn-clear {
  font-family: 'Cinzel', serif; font-size: 0.6rem; letter-spacing: 0.14em; text-transform: uppercase;
  background: transparent; color: rgba(255,255,255,0.22); border: 1px solid rgba(255,255,255,0.07);
  padding: 9px 0; cursor: pointer; width: 100%; transition: all 0.12s;
}
.btn-clear:hover:not(:disabled) { border-color: rgba(255,255,255,0.18); color: rgba(255,255,255,0.55); }
.btn-clear:disabled { opacity: 0.15; cursor: default; }

/* ── Spin dots ──────────────────────────────────────────────────────────────── */
.dots { display: flex; gap: 5px; align-items: center; }
.dots span { width: 5px; height: 5px; background: rgba(255,255,255,0.5); border-radius: 50%; animation: db 1s ease-in-out infinite; }
.dots span:nth-child(2) { animation-delay: 0.18s; }
.dots span:nth-child(3) { animation-delay: 0.36s; }
@keyframes db { 0%,80%,100%{ opacity:0.2; transform:scale(0.85); } 40%{ opacity:1; transform:scale(1.15); } }

/* ── Table de mise ──────────────────────────────────────────────────────────── */
.table-row    { display: flex; gap: 16px; align-items: flex-start; }
.table-scroll { overflow-x: auto; flex: 1; min-width: 0; }

.bet-table {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 700px;
  background: #0f0f10;
  border: 1px solid rgba(255,255,255,0.06);
  padding: 12px;
}

.bt-main { display: flex; gap: 4px; align-items: stretch; }

/* Case zéro */
.zero-cell {
  width: 52px; min-width: 52px;
  align-self: stretch;
  background: #1a4a1a;
  border: 1px solid rgba(255,255,255,0.07);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; position: relative; user-select: none;
  transition: filter 0.12s, border-color 0.12s;
}
.zero-cell:hover { filter: brightness(1.35); border-color: rgba(255,255,255,0.2); }

.num-cell {
  width: 52px; height: 50px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid rgba(255,255,255,0.06);
  cursor: pointer; position: relative; user-select: none;
  transition: filter 0.12s, border-color 0.12s;
  box-sizing: border-box;
}

.nc-rouge { background: #6b1515; }
.nc-rouge .nc-txt { color: #ffa0a0; }
.nc-rouge:hover { filter: brightness(1.45); border-color: rgba(255,96,96,0.4); }

.nc-noir { background: #141414; }
.nc-noir .nc-txt { color: rgba(255,255,255,0.82); }
.nc-noir:hover { filter: brightness(1.7); border-color: rgba(255,255,255,0.22); }

.nc-vert { background: #1a4a1a; }
.nc-vert .nc-txt { color: #80d080; }

.nc-txt {
  font-family: 'Cinzel', serif; font-size: 0.78rem; letter-spacing: 0.04em; font-weight: 600; z-index: 1;
}

/* Mise indicator dot */
.nc-chip {
  position: absolute; top: 3px; right: 3px;
  width: 10px; height: 10px; border-radius: 50%;
  background: rgba(255,210,80,0.9);
  box-shadow: 0 0 4px rgba(255,210,80,0.6);
}

.nc-active { border-color: rgba(255,210,80,0.55) !important; }
.nc-result { border-color: rgba(255,255,255,0.8) !important; box-shadow: 0 0 10px rgba(255,255,255,0.25); filter: brightness(1.5); }

/* Grid */
.nums-grid {
  display: grid;
  grid-template-columns: repeat(12, 52px);
  grid-template-rows: repeat(3, 50px);
  gap: 3px;
}

/* Colonnes (right of grid) */
.col-col { display: flex; flex-direction: column; gap: 3px; min-width: 54px; }
.col-col .ob { flex: 1; font-size: 0.5rem; }

/* Outside bets */
.ob-row { display: flex; gap: 4px; margin-left: 56px; }

.ob {
  flex: 1; height: 34px;
  font-family: 'Cinzel', serif; font-size: 0.55rem; letter-spacing: 0.1em; text-transform: uppercase;
  background: #141416; border: 1px solid rgba(255,255,255,0.07); color: rgba(255,255,255,0.4);
  cursor: pointer; transition: all 0.12s; white-space: nowrap;
}
.ob:hover:not(:disabled) { background: #1e1e20; border-color: rgba(255,255,255,0.18); color: rgba(255,255,255,0.75); }
.ob:disabled { opacity: 0.3; cursor: default; }
.ob-on { border-color: rgba(255,210,80,0.5) !important; background: rgba(255,210,80,0.06) !important; color: rgba(255,210,80,0.9) !important; }

.ob-rouge { color: #d08080; }
.ob-noir  { color: rgba(255,255,255,0.45); }

.dz { font-size: 0.52rem; }

/* ── Sidebar mises ──────────────────────────────────────────────────────────── */
.mises-side {
  width: 200px;
  flex-shrink: 0;
  background: #0d0d0e;
  border: 1px solid rgba(255,255,255,0.06);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mises-total {
  display: flex;
  justify-content: space-between;
  padding: 8px 0 0;
  border-top: 1px solid rgba(255,255,255,0.06);
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
}

.btn-row { display: flex; gap: 8px; }

.btn-secondary {
  flex: 1;
  font-family: 'Cinzel', serif; font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase;
  background: transparent; color: rgba(255,255,255,0.3); border: 1px solid rgba(255,255,255,0.08);
  padding: 9px 0; cursor: pointer; transition: all 0.12s;
}
.btn-secondary:hover:not(:disabled) { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.65); }
.btn-secondary:disabled { opacity: 0.2; cursor: default; }

/* ── Règles ─────────────────────────────────────────────────────────────────── */
.rules-section {
  border: 1px solid rgba(255,255,255,0.06);
  background: #0d0d0e;
}

.rules-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: none;
  border: none;
  color: rgba(255,255,255,0.35);
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 0.15s;
}
.rules-toggle:hover { color: rgba(255,255,255,0.65); }

.rules-chevron { font-size: 0.9rem; transition: transform 0.2s; }
.rules-chevron--open { transform: rotate(180deg); }

.rules-body { padding: 0 20px 20px; }

.rules-intro {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  font-style: italic;
  color: rgba(255,255,255,0.35);
  margin: 0 0 20px;
  line-height: 1.6;
}

.rules-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px 20px;
  margin-bottom: 16px;
}

.rule-block { display: flex; flex-direction: column; gap: 4px; }

.rule-title {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  margin: 0;
  font-weight: 400;
}

.rule-desc {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.92rem;
  color: rgba(255,255,255,0.28);
  margin: 0;
  line-height: 1.5;
}

.rule-desc strong { color: rgba(255,255,255,0.55); font-weight: 600; }

.rules-note {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.88rem;
  font-style: italic;
  color: rgba(255,255,255,0.2);
  margin: 0;
  border-top: 1px solid rgba(255,255,255,0.04);
  padding-top: 12px;
}

@media (max-width: 800px) {
  .top-row   { flex-direction: column; align-items: center; }
  .panel     { max-width: 380px; width: 100%; }
  .table-row { flex-direction: column; }
  .mises-side { width: 100%; }
  .rules-grid { grid-template-columns: repeat(2, 1fr); }
}
.jeu-indispo { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:calc(100vh - 60px); gap:12px; text-align:center; padding:40px; }
.jeu-indispo-title { font-family:'Cinzel',serif; font-size:1.4rem; letter-spacing:0.06em; color:rgba(255,255,255,0.7); }
.jeu-indispo-sub { font-family:'Crimson Text',Georgia,serif; font-style:italic; color:rgba(255,255,255,0.3); font-size:1rem; }
.jeu-indispo-link { margin-top:16px; font-family:'Cinzel',serif; font-size:0.65rem; letter-spacing:0.15em; text-transform:uppercase; color:rgba(139,26,26,0.7); text-decoration:none; }
.jeu-indispo-link:hover { color:rgba(139,26,26,1); }
</style>

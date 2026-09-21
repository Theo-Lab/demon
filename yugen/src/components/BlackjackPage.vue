<template>
  <div class="page">
    <AppNavbar />

    <div class="page-inner">
      <div class="top-bar">
        <RouterLink to="/casino" class="back-link">← Casino</RouterLink>
        <div class="solde-badge">{{ fmtYen(solde) }}</div>
      </div>

      <h1 class="page-title">Blackjack</h1>

      <!-- ── Table ────────────────────────────────────── -->
      <div class="table" :class="{ 'table--win': winAnim, 'table--bust': bustAnim }">

        <!-- Dealer -->
        <div class="zone zone--dealer">
          <div class="zone-label">
            Croupier
            <span v-if="etat === 'fini'" class="zone-total" :class="totalClass(dTotal)">{{ dTotal }}</span>
            <span v-else-if="dealerRevealing" class="zone-total dim">…</span>
            <span v-else-if="etat === 'en_cours' && mainDealer.length" class="zone-total dim">
              {{ dealerVisibleTotal }}
            </span>
          </div>
          <div class="hand">
            <TransitionGroup name="card-pop">
              <PlayingCard
                v-for="(c, i) in mainDealer"
                :key="i"
                :card="c"
                :flipIn="dealerFlipIdx === i"
              />
            </TransitionGroup>
          </div>
        </div>

        <div class="divider" />

        <!-- Joueur -->
        <div class="zone zone--player">
          <div class="zone-label">
            Vous
            <span v-if="pTotal" class="zone-total" :class="totalClass(pTotal)">{{ pTotal }}</span>
          </div>
          <div class="hand" :class="{ 'hand--bust': bustAnim, 'hand--win': winAnim }">
            <TransitionGroup name="card-pop">
              <PlayingCard v-for="(c, i) in mainJoueur" :key="i" :card="c" />
            </TransitionGroup>
          </div>
        </div>

      </div>

      <!-- ── Résultat ─────────────────────────────────── -->
      <Transition name="result-pop">
        <div v-if="etat === 'fini'" class="resultat" :class="`resultat--${resultat}`">
          {{ resultatLabel }}
          <span class="resultat-gain" :class="gainNet > 0 ? 'pos' : gainNet < 0 ? 'neg' : ''">
            {{ gainNet > 0 ? '+' : '' }}{{ fmtYen(gainNet) }}
          </span>
        </div>
      </Transition>

      <!-- ── Actions ─────────────────────────────────── -->
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
          <div class="btns">
            <button class="btn btn--primary" :disabled="loading || miseInput <= 0" @click="lancerPartie">
              Nouvelle Partie
            </button>
          </div>
        </template>

        <template v-else-if="etat === 'en_cours'">
          <div class="btns">
            <button class="btn btn--hit"    :disabled="loading" @click="doHit">Tirer</button>
            <button class="btn btn--stand"  :disabled="loading" @click="doStand">Rester</button>
            <button v-if="canDouble" class="btn btn--double" :disabled="loading" @click="doDouble">Doubler ×2</button>
          </div>
        </template>

        <template v-else-if="etat === 'fini'">
          <div class="btns">
            <button class="btn btn--primary" @click="rejouer">Rejouer ({{ fmtYen(miseInput) }})</button>
            <button class="btn btn--ghost"   @click="changerMise">Changer la mise</button>
          </div>
        </template>
      </div>

      <p v-if="erreur" class="erreur">{{ erreur }}</p>

      <!-- ── Règles ───────────────────────────────────── -->
      <div class="regles">
        <button class="regles-toggle" @click="reglesOuvertes = !reglesOuvertes">
          {{ reglesOuvertes ? '▲' : '▼' }} Règles du Blackjack
        </button>
        <div v-if="reglesOuvertes" class="regles-body">
          <div class="regle-grid">
            <div class="regle-item">
              <span class="regle-nom">Blackjack</span>
              <span class="regle-cote">× 2.5</span>
              <span class="regle-desc">As + figure/10 sur les 2 premières cartes</span>
            </div>
            <div class="regle-item">
              <span class="regle-nom">Victoire</span>
              <span class="regle-cote">× 2</span>
              <span class="regle-desc">Total supérieur au croupier sans dépasser 21</span>
            </div>
            <div class="regle-item">
              <span class="regle-nom">Égalité</span>
              <span class="regle-cote">× 1</span>
              <span class="regle-desc">Même total que le croupier — mise remboursée</span>
            </div>
            <div class="regle-item">
              <span class="regle-nom">Doubler</span>
              <span class="regle-cote">×2 mise</span>
              <span class="regle-desc">Sur les 2 premières cartes — une seule carte supplémentaire</span>
            </div>
            <div class="regle-item">
              <span class="regle-nom">Croupier</span>
              <span class="regle-cote">≥ 17</span>
              <span class="regle-desc">Le croupier tire jusqu'à atteindre 17 ou plus (soft 17 compris)</span>
            </div>
            <div class="regle-item">
              <span class="regle-nom">As</span>
              <span class="regle-cote">1 ou 11</span>
              <span class="regle-desc">Compte 11, redevient 1 si le total dépasse 21</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import AppNavbar from './AppNavbar.vue'
import PlayingCard from './PlayingCard.vue'
import { getMe, blackjackNew, blackjackHit, blackjackStand, blackjackDouble } from '../api.js'
import {
  playDeal, playFlip, playBust, playLose, playWin, playBlackjack, playChip, resumeAudio,
} from '../blackjack-audio.js'

// ── State ─────────────────────────────────────────────────────────────────────

const solde          = ref(0)
const miseInput      = ref(10000)
const etat           = ref('idle')      // 'idle' | 'en_cours' | 'fini'
const mainJoueur     = ref([])
const mainDealer     = ref([])
const pTotal         = ref(null)
const dTotal         = ref(null)
const resultat       = ref(null)
const gainNet        = ref(0)
const canDouble      = ref(false)
const loading        = ref(false)
const erreur         = ref('')
const reglesOuvertes = ref(false)

// Animation
const dealerFlipIdx  = ref(-1)   // index de la carte dealer en train de se retourner
const bustAnim       = ref(false)
const winAnim        = ref(false)
const dealerRevealing = ref(false)

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Computed ──────────────────────────────────────────────────────────────────

const LABELS = {
  victoire:  'Victoire !',
  defaite:   'Défaite',
  egalite:   'Égalité',
  blackjack: 'Blackjack !',
}
const resultatLabel = computed(() => LABELS[resultat.value] ?? '')

// Valeur visible du croupier pendant la partie (seulement sa 1ère carte)
const dealerVisibleTotal = computed(() => {
  const c = mainDealer.value[0]
  if (!c || c.hidden) return '?'
  if (c.v === 'A') return 11
  if (['J','Q','K'].includes(c.v)) return 10
  return parseInt(c.v)
})

function totalClass(t) {
  if (!t) return ''
  if (t > 21) return 'bust'
  if (t === 21) return 'vingt-et-un'
  return ''
}

function fmtYen(n) {
  if (n == null) return '—'
  return (n < 0 ? '-¥' : '¥') + Math.abs(n).toLocaleString('fr-FR')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function applyFinalState(data) {
  etat.value    = 'fini'
  dTotal.value  = data.dTotal  ?? null
  pTotal.value  = data.pTotal  ?? null
  resultat.value = data.resultat ?? null
  gainNet.value  = data.gain_net ?? 0
  if (data.solde != null) solde.value = data.solde
}

function triggerWin() {
  winAnim.value = true
  setTimeout(() => { winAnim.value = false }, 1400)
}

function triggerBust() {
  bustAnim.value = true
  setTimeout(() => { bustAnim.value = false }, 550)
}

function playResultSound(r, wasBust = false) {
  if (r === 'blackjack')                  playBlackjack()
  else if (r === 'victoire')              playWin()
  else if (r === 'defaite' && wasBust)    { /* son de bust déjà joué */ }
  else if (r === 'defaite')               playLose()
}

// Anime le dévoilement de la main du croupier (retourne la carte cachée + tire les suivantes)
async function animateDealerReveal(data) {
  dealerRevealing.value = true
  const finalDealer = data.mainDealer

  // 1. Flip la carte cachée (index 1)
  const d = [...mainDealer.value]
  d[1] = finalDealer[1]
  mainDealer.value = d
  dealerFlipIdx.value = 1
  playFlip()
  await sleep(420)
  dealerFlipIdx.value = -1

  // 2. Cartes supplémentaires du croupier
  for (let i = 2; i < finalDealer.length; i++) {
    await sleep(330)
    mainDealer.value = [...mainDealer.value, finalDealer[i]]
    playDeal()
    await sleep(300)
  }

  dealerRevealing.value = false

  // 3. Afficher le résultat
  applyFinalState(data)

  // 4. Son + animation de résultat
  await sleep(120)
  const wasBust = data.pTotal > 21
  playResultSound(data.resultat, wasBust)
  if (data.resultat === 'victoire' || data.resultat === 'blackjack') triggerWin()

  loading.value = false
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function lancerPartie() {
  if (loading.value) return
  erreur.value = ''
  loading.value = true
  resumeAudio()
  playChip()

  try {
    const data = await blackjackNew(miseInput.value)
    const pCards = data.mainJoueur
    const dCards = data.mainDealer  // [real, {hidden}] ou [real, real] si fin immédiate

    // Reset
    mainJoueur.value  = []
    mainDealer.value  = []
    pTotal.value      = null
    dTotal.value      = null
    resultat.value    = null
    etat.value        = 'idle'

    // Distribution alternée : j1 → d1 → j2 → d2(cachée)
    await sleep(80)
    mainJoueur.value = [pCards[0]]
    playDeal()

    await sleep(210)
    mainDealer.value = [dCards[0]]
    playDeal()

    await sleep(210)
    mainJoueur.value = [...mainJoueur.value, pCards[1]]
    playDeal()

    await sleep(210)
    mainDealer.value = [...mainDealer.value, { hidden: true }]
    playDeal()
    await sleep(280)

    if (data.statut === 'en_cours') {
      etat.value     = 'en_cours'
      pTotal.value   = data.pTotal
      canDouble.value = data.canDouble ?? true
      if (data.solde != null) solde.value = data.solde
      loading.value  = false
    } else {
      // Blackjack immédiat — retourner la carte cachée
      await sleep(150)
      const d = [...mainDealer.value]
      d[1] = dCards[1]
      mainDealer.value = d
      dealerFlipIdx.value = 1
      playFlip()
      await sleep(440)
      dealerFlipIdx.value = -1

      pTotal.value = data.pTotal
      applyFinalState(data)
      await sleep(110)

      if (data.resultat === 'blackjack') { playBlackjack(); triggerWin() }
      else if (data.resultat === 'victoire') { playWin(); triggerWin() }
      else if (data.resultat === 'defaite') playLose()
      loading.value = false
    }
  } catch (e) {
    erreur.value = e.message
    loading.value = false
  }
}

async function doHit() {
  if (loading.value) return
  erreur.value = ''
  loading.value = true
  resumeAudio()
  try {
    const data = await blackjackHit()

    // Nouvelle carte joueur (TransitionGroup gère l'entrée)
    mainJoueur.value = data.mainJoueur
    pTotal.value     = data.pTotal
    playDeal()
    await sleep(320)

    if (data.statut === 'fini') {
      if (data.pTotal > 21) {
        // Bust
        triggerBust()
        playBust()
        await sleep(500)
      }
      await animateDealerReveal(data)
    } else {
      canDouble.value = false
      if (data.solde != null) solde.value = data.solde
      loading.value = false
    }
  } catch (e) {
    erreur.value = e.message
    loading.value = false
  }
}

async function doStand() {
  if (loading.value) return
  erreur.value = ''
  loading.value = true
  resumeAudio()
  try {
    const data = await blackjackStand()
    await animateDealerReveal(data)
  } catch (e) {
    erreur.value = e.message
    loading.value = false
  }
}

async function doDouble() {
  if (loading.value) return
  erreur.value = ''
  loading.value = true
  resumeAudio()
  playChip()
  try {
    const data = await blackjackDouble()

    // Nouvelle carte joueur (double)
    mainJoueur.value = data.mainJoueur
    pTotal.value     = data.pTotal
    playDeal()
    await sleep(350)

    if (data.pTotal > 21) {
      triggerBust()
      playBust()
      await sleep(500)
    }

    await animateDealerReveal(data)
  } catch (e) {
    erreur.value = e.message
    loading.value = false
  }
}

async function rejouer() {
  etat.value = 'idle'
  await lancerPartie()
}

function changerMise() {
  etat.value       = 'idle'
  mainJoueur.value = []
  mainDealer.value = []
  pTotal.value     = null
  dTotal.value     = null
  resultat.value   = null
}

onMounted(async () => {
  const me = await getMe()
  if (me) solde.value = me.solde
})
</script>

<style scoped>
.page { min-height: 100vh; background: #090909; }

.page-inner {
  max-width: 720px;
  margin: 0 auto;
  padding: 3rem 2rem 6rem;
}

/* ── Top bar ─────────────────────────────────────── */

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
  transition: background 0.3s;
}

.page-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 2rem;
  font-weight: 400;
  letter-spacing: 0.08em;
  color: #fff;
  margin: 0 0 2.5rem;
  text-align: center;
}

/* ── Table ─────────────────────────────────────────── */

.table {
  background: #0d1a0d;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 4px;
  padding: 28px 24px;
  min-height: 320px;
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.4s;
}

@keyframes table-win-glow {
  0%,100% { box-shadow: none; }
  40%     { box-shadow: 0 0 32px rgba(201,168,76,0.22); }
}
@keyframes table-bust-flash {
  0%,100% { box-shadow: none; }
  30%     { box-shadow: 0 0 24px rgba(192,57,43,0.28); }
}
.table--win  { animation: table-win-glow  0.8s ease; }
.table--bust { animation: table-bust-flash 0.55s ease; }

/* ── Zones ─────────────────────────────────────────── */

.zone { display: flex; flex-direction: column; gap: 14px; padding: 16px 0; }

.divider {
  height: 1px;
  background: rgba(255,255,255,0.06);
  margin: 8px 0;
}

.zone-label {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.22);
  display: flex;
  align-items: center;
  gap: 10px;
}

.zone-total {
  font-family: 'Cinzel', serif;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  color: rgba(255,255,255,0.55);
}
.zone-total.bust          { color: #c0392b; }
.zone-total.vingt-et-un   { color: #c9a84c; }
.zone-total.dim           { color: rgba(255,255,255,0.2); }

/* ── Main (cartes) ───────────────────────────────── */

.hand {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  min-height: 100px;
  align-items: flex-start;
  transform-origin: left center;
}

@keyframes hand-shake {
  0%,100% { transform: translateX(0); }
  18%     { transform: translateX(-7px) rotate(-1deg); }
  36%     { transform: translateX(7px)  rotate(1deg); }
  54%     { transform: translateX(-5px) rotate(-0.5deg); }
  72%     { transform: translateX(5px)  rotate(0.5deg); }
}
@keyframes hand-glow {
  0%,100% { filter: brightness(1); }
  45%     { filter: brightness(1.22) drop-shadow(0 0 8px rgba(201,168,76,0.55)); }
}
.hand--bust { animation: hand-shake 0.48s ease; }
.hand--win  { animation: hand-glow  0.75s ease; }

/* ── Résultat ─────────────────────────────────────── */

.resultat {
  margin: 20px 0 0;
  padding: 16px 20px;
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.1rem;
  font-weight: 400;
  letter-spacing: 0.06em;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
}
.resultat--victoire  { color: #c9a84c; }
.resultat--blackjack { color: #e2c97e; }
.resultat--egalite   { color: rgba(255,255,255,0.45); }
.resultat--defaite   { color: #8b1a1a; }

.resultat-gain { font-family: 'Cinzel', serif; font-size: 0.82rem; letter-spacing: 0.08em; }
.resultat-gain.pos { color: #c9a84c; }
.resultat-gain.neg { color: #8b1a1a; }

/* ── Actions ─────────────────────────────────────── */

.actions { margin-top: 24px; display: flex; flex-direction: column; gap: 16px; align-items: center; }

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

.btn--primary { background: #8b1a1a; color: #e8ddd0; }
.btn--primary:hover:not(:disabled) { background: #a01f1f; }

.btn--hit    { background: rgba(201,168,76,0.14); color: #c9a84c; border: 1px solid rgba(201,168,76,0.3); }
.btn--hit:hover:not(:disabled)    { background: rgba(201,168,76,0.24); }

.btn--stand  { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.6); border: 1px solid rgba(255,255,255,0.1); }
.btn--stand:hover:not(:disabled)  { background: rgba(255,255,255,0.1); }

.btn--double { background: rgba(139,26,26,0.14); color: #c0392b; border: 1px solid rgba(139,26,26,0.3); }
.btn--double:hover:not(:disabled) { background: rgba(139,26,26,0.24); }

.btn--ghost  { background: transparent; color: rgba(255,255,255,0.3); border: 1px solid rgba(255,255,255,0.1); }
.btn--ghost:hover:not(:disabled)  { color: rgba(255,255,255,0.55); border-color: rgba(255,255,255,0.2); }

.erreur {
  font-family: 'Crimson Text', serif;
  font-style: italic;
  color: #c0392b;
  text-align: center;
  margin-top: 14px;
  font-size: 0.95rem;
}

/* ── Règles ──────────────────────────────────────── */

.regles { margin-top: 3rem; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 1.5rem; }

.regles-toggle {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.25);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}
.regles-toggle:hover { color: rgba(255,255,255,0.5); }

.regles-body { margin-top: 1.2rem; }

.regle-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.regle-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  background: #111;
  border: 1px solid rgba(255,255,255,0.05);
}

.regle-nom {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
}

.regle-cote {
  font-family: 'Cinzel', serif;
  font-size: 0.92rem;
  color: #c9a84c;
}

.regle-desc {
  font-family: 'Crimson Text', serif;
  font-style: italic;
  font-size: 0.88rem;
  color: rgba(255,255,255,0.25);
  line-height: 1.4;
}

/* ── Transitions cartes ─────────────────────────── */

/* Entrée : la carte arrive en glissant du haut avec légère rotation */
.card-pop-enter-active {
  transition: all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.card-pop-enter-from {
  opacity: 0;
  transform: translateY(-22px) rotate(-4deg) scale(0.82);
}

/* Résultat */
@keyframes result-in {
  0%   { opacity: 0; transform: translateY(8px) scale(0.94); }
  60%  { transform: translateY(-2px) scale(1.02); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
.result-pop-enter-active { animation: result-in 0.32s ease both; }
.result-pop-leave-active { transition: opacity 0.18s; }
.result-pop-leave-to     { opacity: 0; }

@media (max-width: 560px) {
  .regle-grid { grid-template-columns: repeat(2, 1fr); }
  .btns { gap: 8px; }
}
</style>

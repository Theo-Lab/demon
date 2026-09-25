<template>
  <div class="page">
    <AppNavbar />

    <!-- Jeu indisponible -->
    <div v-if="jeuIndisponible" class="jeu-indispo">
      <p class="jeu-indispo-title">Jeu indisponible</p>
      <p class="jeu-indispo-sub">Le Champ Maudit est temporairement fermé.</p>
      <RouterLink to="/casino" class="jeu-indispo-link">← Retour au casino</RouterLink>
    </div>

    <div v-if="!jeuIndisponible" class="page-inner">

      <!-- Barre haute -->
      <div class="top-bar">
        <RouterLink to="/casino" class="back-link">← Casino</RouterLink>
        <div class="solde-badge">{{ fmtYen(solde) }}</div>
      </div>

      <h1 class="page-title">Champ Maudit</h1>

      <!-- Grille 5×5 -->
      <div class="grid" :class="{ 'grid--bust': bustFlash }">
        <button
          v-for="i in 25"
          :key="i - 1"
          class="tile"
          :class="tileClass(i - 1)"
          :disabled="!canReveal(i - 1)"
          @click="doReveal(i - 1)"
        >
          <!-- Gemme safe -->
          <span v-if="revealed.includes(i - 1) && !mines.includes(i - 1)" class="gem"></span>
          <!-- Mine après bust -->
          <span v-else-if="mines.includes(i - 1)" class="mine-x">×</span>
          <!-- Non révélé -->
          <span v-else class="tile-dot"></span>
        </button>
      </div>

      <!-- Mult bar -->
      <Transition name="mb-fade">
        <div v-if="etat === 'en_cours' && revealed.length > 0" class="mult-bar">
          <span class="mb-label">Encaisser maintenant :</span>
          <span class="mb-mult">×{{ mult.toFixed(2) }}</span>
          <span class="mb-gain">+{{ fmtYen(gainNetPotentiel) }}</span>
        </div>
      </Transition>

      <!-- Résultat -->
      <Transition name="result-pop">
        <div v-if="etat === 'fini_bust' || etat === 'fini_win'" class="resultat"
          :class="etat === 'fini_bust' ? 'resultat--bust' : 'resultat--win'">
          <span class="r-label">{{ etat === 'fini_bust' ? 'Mine percutée !' : 'Encaissé !' }}</span>
          <span class="r-gain" :class="gainNet >= 0 ? 'pos' : 'neg'">
            {{ gainNet > 0 ? '+' : '' }}{{ fmtYen(gainNet) }}
          </span>
        </div>
      </Transition>

      <!-- Actions -->
      <div class="actions">

        <!-- Idle : configuration + lancement -->
        <template v-if="etat === 'idle'">
          <div class="config-row">
            <div class="config-group">
              <label class="config-label">Mines</label>
              <div class="preset-btns">
                <button
                  v-for="n in [3, 5, 10, 15, 24]"
                  :key="n"
                  class="preset-btn"
                  :class="{ 'preset-btn--active': nbMines === n }"
                  @click="nbMines = n"
                >{{ n }}</button>
              </div>
            </div>
            <div class="config-group">
              <label class="config-label">Mise</label>
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
          </div>
          <button class="btn btn--invoke" :disabled="loading || miseInput <= 0 || miseInput > solde" @click="lancerPartie">
            {{ loading ? 'Chargement…' : 'Invoquer' }}
          </button>
        </template>

        <!-- En cours : encaisser -->
        <template v-else-if="etat === 'en_cours'">
          <button
            class="btn btn--cashout"
            :disabled="loading || revealed.length === 0"
            @click="doCashout"
          >
            Encaisser ×{{ mult.toFixed(2) }}
            <span v-if="revealed.length > 0" class="btn-sub">+{{ fmtYen(gainNetPotentiel) }}</span>
          </button>
        </template>

        <!-- Fini : rejouer ou changer mise -->
        <template v-else>
          <div class="btns">
            <button class="btn btn--invoke" :disabled="loading" @click="rejouer">
              Rejouer ({{ fmtYen(miseInput) }})
            </button>
            <button class="btn btn--ghost" @click="reset">Changer la mise</button>
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
import { getMe, getCasinoGames, minesNew, minesReveal, minesCashout } from '../api.js'

// ── State ─────────────────────────────────────────────────────────────────────

const solde           = ref(0)
const miseInput       = ref(10000)
const miseEnCours     = ref(0)
const nbMines         = ref(3)
const etat            = ref('idle')     // 'idle' | 'en_cours' | 'fini_bust' | 'fini_win'
const revealed        = ref([])         // positions sûres révélées
const mines           = ref([])         // positions mines (après bust ou victoire totale)
const mult            = ref(1)
const gainNet         = ref(0)
const gainNetPotentiel = ref(0)
const loading         = ref(false)
const erreur          = ref('')
const bustFlash       = ref(false)
const jeuIndisponible = ref(false)

// ── Formatage ─────────────────────────────────────────────────────────────────

function fmtYen(n) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' ¥'
}

// ── Helpers tiles ─────────────────────────────────────────────────────────────

function tileClass(i) {
  if (mines.value.includes(i)) return 'tile--mine'
  if (revealed.value.includes(i)) return 'tile--safe'
  return 'tile--hidden'
}

function canReveal(i) {
  return etat.value === 'en_cours' && !revealed.value.includes(i) && !mines.value.includes(i) && !loading.value
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function lancerPartie() {
  erreur.value = ''
  loading.value = true
  try {
    const r = await minesNew(miseInput.value, nbMines.value)
    miseEnCours.value = miseInput.value
    revealed.value    = r.revealed ?? []
    mines.value       = []
    mult.value        = r.mult ?? 1
    gainNet.value     = 0
    gainNetPotentiel.value = 0
    solde.value       = r.solde
    etat.value        = 'en_cours'
  } catch (e) {
    erreur.value = e.message
  } finally {
    loading.value = false
  }
}

async function doReveal(position) {
  if (!canReveal(position)) return
  erreur.value = ''
  loading.value = true
  try {
    const r = await minesReveal(position)
    solde.value = r.solde

    if (r.statut === 'bust') {
      mines.value   = r.mines
      gainNet.value = r.gain_net
      etat.value    = 'fini_bust'
      bustFlash.value = true
      setTimeout(() => { bustFlash.value = false }, 600)
    } else if (r.statut === 'victoire_totale') {
      revealed.value = [...revealed.value, position]
      mines.value    = r.mines
      mult.value     = r.mult
      gainNet.value  = r.gain_net
      gainNetPotentiel.value = r.gain_net
      etat.value     = 'fini_win'
    } else {
      revealed.value = [...revealed.value, position]
      mult.value     = r.mult
      gainNetPotentiel.value = r.gain_net_potentiel
    }
  } catch (e) {
    erreur.value = e.message
  } finally {
    loading.value = false
  }
}

async function doCashout() {
  erreur.value = ''
  loading.value = true
  try {
    const r = await minesCashout()
    solde.value   = r.solde
    mult.value    = r.mult
    gainNet.value = r.gain_net
    gainNetPotentiel.value = r.gain_net
    etat.value    = 'fini_win'
  } catch (e) {
    erreur.value = e.message
  } finally {
    loading.value = false
  }
}

function reset() {
  etat.value     = 'idle'
  revealed.value = []
  mines.value    = []
  mult.value     = 1
  gainNet.value  = 0
  gainNetPotentiel.value = 0
  erreur.value   = ''
}

async function rejouer() {
  reset()
  await lancerPartie()
}

// ── Mount ─────────────────────────────────────────────────────────────────────

onMounted(async () => {
  try {
    const [user, games] = await Promise.all([getMe(), getCasinoGames()])
    if (!games?.mines) {
      jeuIndisponible.value = true
      return
    }
    solde.value = user?.solde ?? 0
  } catch {
    jeuIndisponible.value = true
  }
})
</script>

<style scoped>
/* ── Base ─────────────────────────────────────────────────────────────────── */
.page {
  min-height: 100vh;
  background: #080b11;
  color: #e8dcc8;
  font-family: 'Crimson Text', Georgia, serif;
}

.jeu-indispo {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 12px;
}
.jeu-indispo-title { font-family: 'Cinzel', serif; font-size: 1.5rem; color: #8b1a1a; }
.jeu-indispo-sub   { color: #8a7a6a; font-size: 1rem; }
.jeu-indispo-link  { color: #c9a84c; text-decoration: none; margin-top: 8px; }
.jeu-indispo-link:hover { text-decoration: underline; }

.page-inner {
  max-width: 560px;
  margin: 0 auto;
  padding: 20px 16px 48px;
}

/* ── Top bar ─────────────────────────────────────────────────────────────── */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.back-link {
  color: #8a7a6a;
  text-decoration: none;
  font-size: 0.9rem;
  transition: color .2s;
}
.back-link:hover { color: #e8dcc8; }

.solde-badge {
  background: #0f0f11;
  border: 1px solid #2a2020;
  border-radius: 6px;
  padding: 5px 14px;
  font-size: 0.9rem;
  color: #c9a84c;
  font-family: 'Cinzel', serif;
  letter-spacing: .04em;
}

/* ── Titre ───────────────────────────────────────────────────────────────── */
.page-title {
  font-family: 'Cinzel', serif;
  font-size: 1.7rem;
  color: #e8dcc8;
  text-align: center;
  margin: 0 0 28px;
  letter-spacing: .08em;
  text-transform: uppercase;
}

/* ── Grille ──────────────────────────────────────────────────────────────── */
.grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-bottom: 20px;
  transition: filter .3s;
}
.grid--bust {
  filter: brightness(.5) saturate(.3);
}

.tile {
  aspect-ratio: 1;
  border-radius: 8px;
  border: 1px solid #1e1a2a;
  background: #0f0f11;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color .15s, background .15s, transform .1s;
  position: relative;
  overflow: hidden;
}
.tile:not(:disabled):hover {
  border-color: #3a3050;
  background: #151520;
  transform: scale(1.04);
}
.tile:disabled { cursor: default; }

/* Tile cachée (à révéler) */
.tile--hidden {
  background: #0f0f11;
  border-color: #1e1a2a;
}

/* Tile safe (gemme) */
.tile--safe {
  background: #0e1208;
  border-color: #c9a84c;
  box-shadow: 0 0 8px rgba(201,168,76,.18);
}

/* Tile mine (après bust) */
.tile--mine {
  background: #2a0808;
  border-color: #7a1010;
  box-shadow: 0 0 8px rgba(180,20,20,.25);
}

/* ── Gemme (losange CSS) ─────────────────────────────────────────────────── */
.gem {
  display: block;
  width: 38%;
  aspect-ratio: 1;
  background: #c9a84c;
  transform: rotate(45deg);
  border-radius: 2px;
  box-shadow:
    0 0 8px rgba(201,168,76,.7),
    0 0 2px rgba(255,230,140,.9);
}

/* ── Croix mine ──────────────────────────────────────────────────────────── */
.mine-x {
  font-size: 1.6rem;
  color: #e03030;
  font-weight: 700;
  line-height: 1;
  text-shadow: 0 0 8px rgba(220,40,40,.6);
}

/* ── Dot non révélé ──────────────────────────────────────────────────────── */
.tile-dot {
  display: block;
  width: 16%;
  aspect-ratio: 1;
  background: #2a2540;
  border-radius: 50%;
  opacity: .5;
}

/* ── Mult bar ────────────────────────────────────────────────────────────── */
.mult-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #0c1018;
  border: 1px solid #1e3030;
  border-radius: 8px;
  padding: 10px 18px;
  margin-bottom: 16px;
}
.mb-label { color: #8a7a6a; font-size: .9rem; flex: 1; }
.mb-mult  { font-family: 'Cinzel', serif; color: #c9a84c; font-size: 1.1rem; font-weight: 700; }
.mb-gain  { color: #66bb6a; font-size: .95rem; margin-left: 4px; }

.mb-fade-enter-active, .mb-fade-leave-active { transition: opacity .25s, transform .25s; }
.mb-fade-enter-from, .mb-fade-leave-to       { opacity: 0; transform: translateY(-6px); }

/* ── Résultat ────────────────────────────────────────────────────────────── */
.resultat {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 8px;
  padding: 12px 20px;
  margin-bottom: 16px;
}
.resultat--bust { background: #1a0808; border: 1px solid #5a1010; }
.resultat--win  { background: #081a08; border: 1px solid #1a5a1a; }
.r-label { font-family: 'Cinzel', serif; font-size: 1rem; letter-spacing: .05em; }
.r-gain  { font-size: 1.1rem; font-weight: 700; }
.pos { color: #66bb6a; }
.neg { color: #e05050; }

.result-pop-enter-active { transition: all .3s; }
.result-pop-enter-from   { opacity: 0; transform: scale(.94); }

/* ── Actions ─────────────────────────────────────────────────────────────── */
.actions { display: flex; flex-direction: column; gap: 14px; }

.config-row {
  display: flex;
  gap: 20px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.config-group { display: flex; flex-direction: column; gap: 6px; }
.config-label {
  font-family: 'Cinzel', serif;
  font-size: .78rem;
  color: #8a7a6a;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.preset-btns { display: flex; gap: 6px; }
.preset-btn {
  background: #12101a;
  border: 1px solid #2a2040;
  border-radius: 5px;
  color: #8a7a8a;
  font-family: 'Cinzel', serif;
  font-size: .85rem;
  padding: 5px 11px;
  cursor: pointer;
  transition: border-color .15s, color .15s, background .15s;
}
.preset-btn:hover { border-color: #5a3060; color: #e8dcc8; }
.preset-btn--active {
  background: #1e0a2a;
  border-color: #8b1a1a;
  color: #e8dcc8;
}

.mise-input {
  background: #12101a;
  border: 1px solid #2a2040;
  border-radius: 6px;
  color: #e8dcc8;
  font-family: 'Crimson Text', serif;
  font-size: 1rem;
  padding: 7px 12px;
  width: 140px;
  outline: none;
  transition: border-color .15s;
}
.mise-input:focus { border-color: #5a3060; }

/* ── Boutons ─────────────────────────────────────────────────────────────── */
.btn {
  border: none;
  border-radius: 7px;
  font-family: 'Cinzel', serif;
  letter-spacing: .06em;
  font-size: .9rem;
  padding: 12px 22px;
  cursor: pointer;
  transition: filter .15s, transform .1s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.btn:disabled { opacity: .45; cursor: default; }
.btn:not(:disabled):hover { filter: brightness(1.12); transform: translateY(-1px); }
.btn:not(:disabled):active { transform: translateY(0); }

.btn--invoke  { background: #8b1a1a; color: #f0e6d0; width: 100%; }
.btn--cashout { background: #0c2a1a; border: 1px solid #1a7a4a; color: #80dba0; width: 100%; font-size: 1rem; }
.btn-sub { font-size: .8rem; color: #66bb6a; opacity: .9; }

.btns { display: flex; gap: 12px; }
.btn--ghost {
  background: transparent;
  border: 1px solid #2a2040;
  color: #8a7a8a;
  flex: 1;
}
.btn--invoke { flex: 2; }

/* ── Erreur ──────────────────────────────────────────────────────────────── */
.erreur {
  color: #e05050;
  font-size: .9rem;
  text-align: center;
  margin-top: 8px;
  background: #1a0808;
  border: 1px solid #4a1010;
  border-radius: 6px;
  padding: 8px 14px;
}
</style>

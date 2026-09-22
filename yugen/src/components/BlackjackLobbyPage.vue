<template>
  <div class="page">
    <AppNavbar />

    <div class="page-inner">
      <div class="top-bar">
        <RouterLink to="/casino" class="back-link">← Casino</RouterLink>
        <div class="solde-badge">{{ fmtYen(solde) }}</div>
      </div>

      <h1 class="page-title">Blackjack Multijoueur</h1>
      <p v-if="erreur" class="erreur">{{ erreur }}</p>

      <div class="tables-list">
        <div v-for="table in tables" :key="table.id" class="table-wrap">

          <div class="table-meta">
            <span class="table-label">Table {{ table.id }}</span>
            <span class="table-statut" :class="`statut--${table.statut}`">{{ statutLabel(table.statut) }}</span>
          </div>

          <!-- Countdown -->
          <div v-if="countdowns[table.id] != null" class="countdown">
            <span class="countdown-num">{{ countdowns[table.id] }}</span>
            <span class="countdown-txt">secondes avant le début</span>
          </div>

          <!-- Table visuelle -->
          <div class="casino-table" :class="`casino-table--${table.statut}`">

            <!-- Tapis -->
            <div class="tapis">
              <span class="dealer-label">Croupier</span>
              <div class="tapis-inner">
                <span class="bj-label">Blackjack</span>
              </div>
            </div>

            <!-- Sièges en arc en bas -->
            <div class="sieges-arc">
              <div
                v-for="siege in table.sieges"
                :key="siege.numero"
                class="siege-slot"
                :class="{
                  'siege-slot--vide': siege.statut === 'vide',
                  'siege-slot--occupe': siege.statut !== 'vide',
                  'siege-slot--moi': siege.user_id === currentUserId,
                  'siege-slot--clickable': siege.statut === 'vide' && table.statut === 'attente' && !dejaAssis,
                }"
                @click="siege.statut === 'vide' && table.statut === 'attente' && !dejaAssis && ouvrirModale(table.id, siege.numero)"
              >
                <template v-if="siege.statut === 'vide'">
                  <span class="siege-plus">+</span>
                  <span class="siege-num">{{ siege.numero }}</span>
                </template>
                <template v-else>
                  <span class="siege-avatar">{{ siege.user_nom?.[0]?.toUpperCase() }}</span>
                  <span class="siege-nom">{{ siege.user_nom }}</span>
                  <span class="siege-mise">{{ fmtYen(siege.mise) }}</span>
                  <button
                    v-if="siege.user_id === currentUserId && table.statut === 'attente'"
                    class="btn-quitter"
                    @click.stop="doQuitterSiege(table.id)"
                  >✕</button>
                </template>
              </div>
            </div>

          </div>

          <button
            v-if="estAssisA(table.id) && table.statut === 'en_cours'"
            class="btn-jouer"
            @click="$router.push(`/blackjack/table/${table.id}`)"
          >
            Rejoindre la partie →
          </button>

        </div>
      </div>
    </div>

    <!-- Modale de mise -->
    <Transition name="modal-fade">
      <div v-if="modale.ouverte" class="modal-overlay" @click.self="fermerModale">
        <div class="modal">
          <h2 class="modal-title">Prendre le siège {{ modale.siegeNumero }}</h2>
          <p class="modal-sub">Table {{ modale.tableId }} — Solde : {{ fmtYen(solde) }}</p>
          <div class="modal-field">
            <label class="modal-label">Mise</label>
            <input
              v-model.number="modale.mise"
              type="number"
              class="modal-input"
              :min="100"
              :max="solde"
              step="100"
              @keydown.enter="confirmerSiege"
            />
          </div>
          <p v-if="modale.erreur" class="modal-erreur">{{ modale.erreur }}</p>
          <div class="modal-btns">
            <button class="btn btn--primary" :disabled="modale.loading" @click="confirmerSiege">
              S'asseoir
            </button>
            <button class="btn btn--ghost" @click="fermerModale">Annuler</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { io } from 'socket.io-client'
import AppNavbar from './AppNavbar.vue'
import { getMe, getBlackjackTables } from '../api.js'

const router = useRouter()
const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')

// ── State ─────────────────────────────────────────────────────────────────────

const solde        = ref(0)
const currentUserId = ref(null)
const tables       = ref([])
const erreur       = ref('')
const countdowns   = reactive({}) // tableId -> secondsLeft

const modale = reactive({
  ouverte: false,
  tableId: null,
  siegeNumero: null,
  mise: 1000,
  erreur: '',
  loading: false,
})

let socket = null
const joinedRooms = new Set()

// ── Computed ──────────────────────────────────────────────────────────────────

const dejaAssis = computed(() => {
  return tables.value.some(t =>
    t.statut === 'attente' &&
    t.sieges.some(s => s.user_id === currentUserId.value && s.statut !== 'vide')
  )
})

function estAssisA(tableId) {
  const t = tables.value.find(t => t.id === tableId)
  return t && t.sieges.some(s => s.user_id === currentUserId.value && s.statut !== 'vide')
}

function statutLabel(statut) {
  if (statut === 'attente') return 'En attente'
  if (statut === 'en_cours') return 'En jeu'
  if (statut === 'fini') return 'Terminée'
  return statut
}

function fmtYen(n) {
  if (n == null) return '—'
  return (n < 0 ? '-¥' : '¥') + Math.abs(n).toLocaleString('fr-FR')
}

// ── Socket ────────────────────────────────────────────────────────────────────

function initSocket() {
  socket = io(SOCKET_URL, { withCredentials: true })

  socket.on('connect', () => {
    // Rejoindre toutes les tables
    for (let i = 1; i <= 3; i++) {
      socket.emit('join_table', i)
    }
  })

  socket.on('table_update', (state) => {
    const idx = tables.value.findIndex(t => t.id === state.table.id)
    if (idx >= 0) {
      tables.value[idx] = {
        ...state.table,
        sieges: state.sieges,
      }
    }
  })

  socket.on('countdown_tick', ({ secondsLeft, tableId: tid }) => {
    // Si le serveur envoie tableId, on l'utilise, sinon on cherche la table en attente
    // Le serveur émet countdown_tick dans la room table_${tableId}
    // On ne sait pas forcément le tableId ici, on le met à jour depuis la room
    // Workaround: le serveur devrait inclure tableId dans le tick
    // On va le gérer côté serveur correctement dans l'event
    if (tid != null) {
      countdowns[tid] = secondsLeft
      if (secondsLeft <= 0) delete countdowns[tid]
    }
  })

  socket.on('countdown_cancelled', ({ tableId: tid } = {}) => {
    if (tid != null) {
      delete countdowns[tid]
    } else {
      for (const key of Object.keys(countdowns)) {
        delete countdowns[key]
      }
    }
  })

  socket.on('game_start', ({ tableId }) => {
    delete countdowns[tableId]
    if (estAssisA(tableId)) {
      router.push(`/blackjack/table/${tableId}`)
    }
  })

  socket.on('table_reset', () => {
    // La table_update suivante rafraîchira
  })

  socket.on('siege_pris', ({ solde: s }) => {
    solde.value = s
  })

  socket.on('siege_quitte', ({ solde: s }) => {
    solde.value = s
  })

  socket.on('error', ({ message }) => {
    modale.erreur = message
    modale.loading = false
    erreur.value = message
    setTimeout(() => { erreur.value = '' }, 4000)
  })
}

// ── Actions ───────────────────────────────────────────────────────────────────

function ouvrirModale(tableId, siegeNumero) {
  modale.ouverte = true
  modale.tableId = tableId
  modale.siegeNumero = siegeNumero
  modale.mise = Math.min(1000, solde.value)
  modale.erreur = ''
  modale.loading = false
}

function fermerModale() {
  modale.ouverte = false
}

function confirmerSiege() {
  if (modale.loading) return
  modale.erreur = ''
  if (!modale.mise || modale.mise <= 0) {
    modale.erreur = 'Mise invalide.'
    return
  }
  if (modale.mise > solde.value) {
    modale.erreur = 'Solde insuffisant.'
    return
  }
  modale.loading = true
  socket.emit('prendre_siege', {
    tableId: modale.tableId,
    siegeNumero: modale.siegeNumero,
    mise: modale.mise,
  })
  fermerModale()
  modale.loading = false
}

function doQuitterSiege(tableId) {
  socket.emit('quitter_siege', { tableId })
}

// ── Mount ─────────────────────────────────────────────────────────────────────

onMounted(async () => {
  const me = await getMe()
  if (me) {
    solde.value = me.solde
    currentUserId.value = me.id
  }
  try {
    tables.value = await getBlackjackTables()
  } catch (e) {
    erreur.value = e.message
  }
  initSocket()
})

onUnmounted(() => {
  if (socket) socket.disconnect()
})
</script>

<style scoped>
.page { min-height: 100vh; background: #090909; color: #fff; }

.page-inner {
  max-width: 960px;
  margin: 0 auto;
  padding: 3rem 2rem 6rem;
}

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

.page-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.8rem;
  font-weight: 400;
  letter-spacing: 0.08em;
  color: #fff;
  margin: 0 0 2.5rem;
  text-align: center;
}

.erreur {
  font-family: 'Crimson Text', serif;
  font-style: italic;
  color: #c0392b;
  text-align: center;
  margin-bottom: 1.5rem;
}

/* ── Liste de tables ─────────────────────────────────────── */

.tables-list {
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

.table-wrap { display: flex; flex-direction: column; gap: 10px; }

.table-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.table-label {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.3);
}

.table-statut {
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 2px 8px;
  border: 1px solid;
}
.statut--attente  { color: rgba(255,255,255,0.3); border-color: rgba(255,255,255,0.1); }
.statut--en_cours { color: #c9a84c; border-color: rgba(201,168,76,0.35); }
.statut--fini     { color: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.06); }

/* ── Countdown ───────────────────────────────────────────── */

.countdown {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 8px 14px;
  background: rgba(139,26,26,0.08);
  border: 1px solid rgba(139,26,26,0.25);
}
.countdown-num {
  font-family: 'Cinzel', serif;
  font-size: 1.4rem;
  color: #8b1a1a;
  font-weight: 700;
  min-width: 2ch;
}
.countdown-txt {
  font-family: 'Crimson Text', serif;
  font-style: italic;
  font-size: 0.88rem;
  color: rgba(255,255,255,0.3);
}

/* ── Table casino ────────────────────────────────────────── */

.casino-table {
  position: relative;
  background: #0b1f0e;
  border: 3px solid #1a4020;
  border-radius: 120px;
  padding: 24px 32px 0;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: inset 0 0 60px rgba(0,0,0,0.5), 0 0 0 6px #0d0d0d, 0 0 0 8px rgba(255,255,255,0.04);
  overflow: visible;
}

.casino-table--en_cours {
  border-color: rgba(201,168,76,0.4);
  box-shadow: inset 0 0 60px rgba(0,0,0,0.5), 0 0 0 6px #0d0d0d, 0 0 0 8px rgba(201,168,76,0.1);
}

.tapis {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding-bottom: 16px;
  width: 100%;
}

.dealer-label {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.2);
}

.tapis-inner {
  width: 160px;
  height: 50px;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bj-label {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.18em;
  color: rgba(255,255,255,0.12);
  text-transform: uppercase;
}

/* ── Sièges en arc ───────────────────────────────────────── */

.sieges-arc {
  display: flex;
  justify-content: center;
  gap: 12px;
  position: relative;
  bottom: -24px;
  padding: 0 12px;
}

.siege-slot {
  width: 90px;
  min-height: 90px;
  border-radius: 50%;
  border: 2px dashed rgba(255,255,255,0.12);
  background: rgba(0,0,0,0.4);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  position: relative;
  transition: border-color 0.15s, background 0.15s, transform 0.15s;
  padding: 8px;
}

.siege-slot--clickable {
  cursor: pointer;
  border-style: dashed;
  border-color: rgba(255,255,255,0.22);
}
.siege-slot--clickable:hover {
  background: rgba(255,255,255,0.05);
  border-color: rgba(255,255,255,0.4);
  transform: translateY(-4px);
}

.siege-slot--occupe {
  border-style: solid;
  border-color: rgba(255,255,255,0.15);
  background: rgba(10,30,10,0.7);
}

.siege-slot--moi {
  border-color: rgba(201,168,76,0.5);
  background: rgba(201,168,76,0.06);
}

.siege-plus {
  font-size: 1.4rem;
  color: rgba(255,255,255,0.2);
  line-height: 1;
}

.siege-num {
  font-family: 'Cinzel', serif;
  font-size: 0.52rem;
  letter-spacing: 0.14em;
  color: rgba(255,255,255,0.18);
}

.siege-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(139,26,26,0.3);
  border: 1px solid rgba(139,26,26,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  color: rgba(255,255,255,0.7);
  flex-shrink: 0;
}

.siege-nom {
  font-family: 'Cinzel', serif;
  font-size: 0.52rem;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.65);
  text-align: center;
  word-break: break-all;
  max-width: 70px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.siege-mise {
  font-family: 'Cinzel', serif;
  font-size: 0.5rem;
  color: #c9a84c;
}

.btn-quitter {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(139,26,26,0.4);
  border: none;
  color: rgba(255,255,255,0.5);
  font-size: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.btn-quitter:hover { background: rgba(139,26,26,0.8); color: #fff; }

/* ── Bouton rejoindre ────────────────────────────────────── */

.btn-jouer {
  margin-top: 36px;
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #c9a84c;
  background: rgba(201,168,76,0.08);
  border: 1px solid rgba(201,168,76,0.3);
  padding: 10px 24px;
  cursor: pointer;
  transition: background 0.15s;
  align-self: center;
}
.btn-jouer:hover { background: rgba(201,168,76,0.16); }

/* ── Modale ──────────────────────────────────────────────── */

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal {
  background: #111;
  border: 1px solid rgba(255,255,255,0.1);
  padding: 36px 40px;
  min-width: 320px;
  max-width: 400px;
  width: 100%;
}

.modal-title {
  font-family: 'Cinzel', serif;
  font-size: 1rem;
  font-weight: 400;
  letter-spacing: 0.1em;
  color: #fff;
  margin: 0 0 6px;
}

.modal-sub {
  font-family: 'Crimson Text', serif;
  font-size: 0.9rem;
  color: rgba(255,255,255,0.35);
  margin: 0 0 24px;
}

.modal-field {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.modal-label {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.3);
  white-space: nowrap;
}

.modal-input {
  background: #0d0d0d;
  border: 1px solid rgba(255,255,255,0.12);
  color: #d4cfc9;
  font-family: 'Cinzel', serif;
  font-size: 0.88rem;
  padding: 8px 14px;
  flex: 1;
  outline: none;
  transition: border-color 0.15s;
}
.modal-input:focus { border-color: rgba(201,168,76,0.4); }

.modal-erreur {
  font-family: 'Crimson Text', serif;
  font-style: italic;
  color: #c0392b;
  font-size: 0.88rem;
  margin: 0 0 14px;
}

.modal-btns { display: flex; gap: 10px; margin-top: 8px; }

.btn {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  padding: 11px 22px;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s, background 0.15s;
}
.btn:disabled { opacity: 0.35; cursor: not-allowed; }
.btn--primary { background: #8b1a1a; color: #e8ddd0; flex: 1; }
.btn--primary:hover:not(:disabled) { background: #a01f1f; }
.btn--ghost { background: transparent; color: rgba(255,255,255,0.3); border: 1px solid rgba(255,255,255,0.1); }
.btn--ghost:hover { color: rgba(255,255,255,0.55); }

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

@media (max-width: 640px) {
  .sieges-arc { gap: 8px; }
  .siege-slot { width: 72px; min-height: 72px; }
  .casino-table { border-radius: 80px; }
}
</style>

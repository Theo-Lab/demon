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

      <div class="tables-grid">
        <div
          v-for="table in tables"
          :key="table.id"
          class="table-card"
          :class="`table-card--${table.statut}`"
        >
          <div class="table-header">
            <span class="table-label">Table {{ table.id }}</span>
            <span class="table-statut" :class="`statut--${table.statut}`">
              {{ statutLabel(table.statut) }}
            </span>
          </div>

          <!-- Countdown si actif -->
          <div v-if="countdowns[table.id] != null" class="countdown">
            <span class="countdown-num">{{ countdowns[table.id] }}</span>
            <span class="countdown-txt">secondes avant le début</span>
          </div>

          <div class="sieges-grid">
            <div
              v-for="siege in table.sieges"
              :key="siege.numero"
              class="siege"
              :class="{
                'siege--vide': siege.statut === 'vide',
                'siege--occupe': siege.statut !== 'vide',
                'siege--moi': siege.user_id === currentUserId,
              }"
            >
              <template v-if="siege.statut === 'vide'">
                <button
                  class="siege-btn"
                  :disabled="table.statut !== 'attente' || dejaAssis"
                  @click="ouvrirModale(table.id, siege.numero)"
                >
                  Siège {{ siege.numero }}
                </button>
              </template>
              <template v-else>
                <div class="siege-info">
                  <span class="siege-nom">{{ siege.user_nom }}</span>
                  <span class="siege-mise">{{ fmtYen(siege.mise) }}</span>
                  <span v-if="siege.user_id === currentUserId && table.statut === 'attente'" class="siege-moi-badge">Vous</span>
                </div>
                <button
                  v-if="siege.user_id === currentUserId && table.statut === 'attente'"
                  class="btn-quitter"
                  @click="doQuitterSiege(table.id)"
                >
                  Quitter
                </button>
              </template>
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
.page { min-height: 100vh; background: #090909; }

.page-inner {
  max-width: 900px;
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

/* ── Tables ──────────────────────────────────────────────── */

.tables-grid {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.table-card {
  background: #0d0d0d;
  border: 1px solid rgba(255,255,255,0.07);
  padding: 24px;
}

.table-card--en_cours {
  border-color: rgba(139,26,26,0.4);
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}

.table-label {
  font-family: 'Cinzel', serif;
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
}

.table-statut {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 3px 10px;
  border: 1px solid;
}

.statut--attente { color: rgba(255,255,255,0.3); border-color: rgba(255,255,255,0.1); }
.statut--en_cours { color: #8b1a1a; border-color: rgba(139,26,26,0.4); }
.statut--fini { color: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.06); }

/* ── Countdown ───────────────────────────────────────────── */

.countdown {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 16px;
  padding: 10px 14px;
  background: rgba(139,26,26,0.08);
  border: 1px solid rgba(139,26,26,0.25);
}

.countdown-num {
  font-family: 'Cinzel', serif;
  font-size: 1.6rem;
  color: #8b1a1a;
  font-weight: 700;
  min-width: 2.5ch;
}

.countdown-txt {
  font-family: 'Crimson Text', serif;
  font-style: italic;
  font-size: 0.9rem;
  color: rgba(255,255,255,0.35);
}

/* ── Sièges ──────────────────────────────────────────────── */

.sieges-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.siege {
  padding: 14px 10px;
  min-height: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid rgba(255,255,255,0.06);
}

.siege--vide {
  background: #111;
}

.siege--occupe {
  background: #0a150a;
  border-color: rgba(255,255,255,0.1);
}

.siege--moi {
  border-color: rgba(201,168,76,0.35);
  background: rgba(201,168,76,0.04);
}

.siege-btn {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.25);
  background: none;
  border: 1px dashed rgba(255,255,255,0.12);
  padding: 10px 8px;
  width: 100%;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.siege-btn:hover:not(:disabled) {
  color: rgba(255,255,255,0.55);
  border-color: rgba(255,255,255,0.25);
}
.siege-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.siege-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  width: 100%;
}

.siege-nom {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.7);
  text-align: center;
  word-break: break-all;
}

.siege-mise {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  color: #c9a84c;
  letter-spacing: 0.05em;
}

.siege-moi-badge {
  font-family: 'Cinzel', serif;
  font-size: 0.5rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #c9a84c;
  border: 1px solid rgba(201,168,76,0.3);
  padding: 1px 5px;
}

.btn-quitter {
  font-family: 'Cinzel', serif;
  font-size: 0.52rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.25);
  background: none;
  border: 1px solid rgba(255,255,255,0.08);
  padding: 4px 8px;
  cursor: pointer;
  transition: color 0.15s;
  margin-top: 2px;
}
.btn-quitter:hover { color: #8b1a1a; border-color: rgba(139,26,26,0.4); }

.btn-jouer {
  margin-top: 16px;
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #c9a84c;
  background: rgba(201,168,76,0.08);
  border: 1px solid rgba(201,168,76,0.3);
  padding: 10px 20px;
  cursor: pointer;
  transition: background 0.15s;
  width: 100%;
}
.btn-jouer:hover { background: rgba(201,168,76,0.15); }

/* ── Erreur ──────────────────────────────────────────────── */

.erreur {
  font-family: 'Crimson Text', serif;
  font-style: italic;
  color: #c0392b;
  text-align: center;
  margin-bottom: 1.5rem;
  font-size: 0.95rem;
}

/* ── Modale ──────────────────────────────────────────────── */

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.75);
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
  max-width: 420px;
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
.modal-input::-webkit-inner-spin-button { opacity: 0.3; }

.modal-erreur {
  font-family: 'Crimson Text', serif;
  font-style: italic;
  color: #c0392b;
  font-size: 0.88rem;
  margin: 0 0 14px;
}

.modal-btns {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}

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

/* ── Transitions ─────────────────────────────────────────── */

.modal-fade-enter-active, .modal-fade-leave-active {
  transition: opacity 0.2s;
}
.modal-fade-enter-from, .modal-fade-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .sieges-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>

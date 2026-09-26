<template>
  <div class="page">
    <AppNavbar />
    <div class="page-inner">

      <div class="page-header">
        <div>
          <p class="page-label">Casino de l'Ordre</p>
          <h1 class="page-title">Poker</h1>
        </div>
        <RouterLink to="/casino" class="back-link">← Casino</RouterLink>
      </div>
      <div class="page-divider"></div>

      <!-- Créer une table -->
      <div class="create-section">
        <h2 class="section-title">Créer une table</h2>
        <form class="create-form" @submit.prevent="creerTable">
          <div class="form-row">
            <label class="form-label">Nom</label>
            <input v-model="form.name" class="form-input" placeholder="Ma table" maxlength="32" />
          </div>
          <div class="form-row">
            <label class="form-label">Blinds</label>
            <select v-model="form.blindPreset" class="form-select">
              <option value="500/1000">500 / 1 000 ¥</option>
              <option value="1000/2000">1 000 / 2 000 ¥</option>
              <option value="2500/5000">2 500 / 5 000 ¥</option>
              <option value="5000/10000">5 000 / 10 000 ¥</option>
            </select>
          </div>
          <div class="form-row">
            <label class="form-label">Joueurs max</label>
            <select v-model="form.maxPlayers" class="form-select">
              <option v-for="n in [2,3,4,5,6,7,8]" :key="n" :value="n">{{ n }}</option>
            </select>
          </div>
          <button type="submit" class="btn-create" :disabled="creating">
            {{ creating ? '…' : 'Créer la table' }}
          </button>
        </form>
      </div>

      <div class="page-divider"></div>

      <!-- Liste des tables -->
      <div class="tables-section">
        <div class="tables-header">
          <h2 class="section-title">Tables actives</h2>
          <button class="btn-refresh" @click="chargerTables">↻</button>
        </div>
        <div v-if="loadingTables" class="vide">Chargement…</div>
        <div v-else-if="tables.length === 0" class="vide">Aucune table ouverte pour le moment.</div>
        <div v-else class="tables-list">
          <div
            v-for="t in tables"
            :key="t.id"
            class="table-card"
            @click="rejoindre(t)"
          >
            <div class="table-card-main">
              <span class="table-name">{{ t.name }}</span>
              <span class="table-blinds">{{ t.smallBlind.toLocaleString() }} / {{ t.bigBlind.toLocaleString() }} ¥</span>
            </div>
            <div class="table-card-meta">
              <span class="table-players">{{ t.playerCount }} / {{ t.maxPlayers }} joueurs</span>
              <span class="table-status" :class="`status--${t.status}`">
                {{ statusLabel(t.status) }}
              </span>
            </div>
            <span class="table-cta">Rejoindre →</span>
          </div>
        </div>
      </div>

    </div>

    <!-- Modale buy-in -->
    <div v-if="modale.open" class="modale-overlay" @click.self="modale.open = false">
      <div class="modale">
        <h3 class="modale-title">Buy-in — {{ modale.table?.name }}</h3>
        <p class="modale-blinds">Blinds : {{ modale.table?.smallBlind.toLocaleString() }} / {{ modale.table?.bigBlind.toLocaleString() }} ¥</p>
        <p class="modale-range">
          Min {{ (modale.table?.bigBlind * 10).toLocaleString() }} ¥ —
          Max {{ (modale.table?.bigBlind * 200).toLocaleString() }} ¥
        </p>
        <div class="modale-presets">
          <button
            v-for="preset in buyInPresets"
            :key="preset"
            class="preset-btn"
            :class="{ active: modale.buyIn === preset }"
            @click="modale.buyIn = preset"
          >{{ preset.toLocaleString() }} ¥</button>
        </div>
        <input
          v-model.number="modale.buyIn"
          type="number"
          class="form-input"
          :min="modale.table?.bigBlind * 10"
          :max="modale.table?.bigBlind * 200"
          step="1000"
        />
        <div class="modale-actions">
          <button class="btn-cancel" @click="modale.open = false">Annuler</button>
          <button class="btn-confirm" @click="confirmerBuyIn" :disabled="joining">
            {{ joining ? '…' : 'S\'asseoir' }}
          </button>
        </div>
        <p v-if="modale.error" class="modale-error">{{ modale.error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppNavbar from './AppNavbar.vue'
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:3001'
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api'

const router = useRouter()
const tables = ref([])
const loadingTables = ref(true)
const creating = ref(false)
const joining = ref(false)

const form = reactive({
  name: '',
  blindPreset: '500/1000',
  maxPlayers: 6,
})

const modale = reactive({
  open: false,
  table: null,
  buyIn: 0,
  error: '',
})

const buyInPresets = computed(() => {
  if (!modale.table) return []
  const bb = modale.table.bigBlind
  return [bb * 10, bb * 20, bb * 50, bb * 100].filter(v => v <= bb * 200)
})

function statusLabel(s) {
  if (s === 'waiting') return 'En attente'
  return 'Partie en cours'
}

async function chargerTables() {
  loadingTables.value = true
  try {
    const r = await fetch(`${API}/poker/tables`, { credentials: 'include' })
    tables.value = await r.json()
  } catch {}
  loadingTables.value = false
}

async function creerTable() {
  creating.value = true
  const [sb, bb] = form.blindPreset.split('/').map(Number)
  try {
    const r = await fetch(`${API}/poker/tables`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name || 'Table Poker', smallBlind: sb, bigBlind: bb, maxPlayers: form.maxPlayers }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.message)
    await chargerTables()
    // Rejoindre directement
    const t = tables.value.find(t => t.id === data.id)
    if (t) rejoindre(t)
  } catch (e) {
    alert(e.message)
  }
  creating.value = false
}

function rejoindre(t) {
  if (t.status !== 'waiting' && t.playerCount >= t.maxPlayers) {
    router.push(`/poker/${t.id}`)
    return
  }
  modale.table = t
  modale.buyIn = t.bigBlind * 20
  modale.error = ''
  modale.open = true
}

let socket

async function confirmerBuyIn() {
  if (joining.value) return
  joining.value = true
  modale.error = ''

  socket = io(SOCKET_URL, { withCredentials: true })
  socket.on('connect', () => {
    socket.emit('poker_sit', { tableId: modale.table.id, buyIn: modale.buyIn })
  })
  socket.on('poker_sat', () => {
    socket.disconnect()
    router.push(`/poker/${modale.table.id}`)
  })
  socket.on('poker_error', ({ message }) => {
    modale.error = message
    socket.disconnect()
    joining.value = false
  })
  socket.on('connect_error', () => {
    modale.error = 'Erreur de connexion.'
    joining.value = false
  })
}

onMounted(chargerTables)
</script>

<style scoped>
.page { min-height: 100vh; background: #090909; color: #fff; }

.page-inner {
  max-width: 700px;
  margin: 0 auto;
  padding: 40px 24px 80px;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 24px;
}
.page-label {
  font-family: 'Cinzel', serif;
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
  margin: 0 0 6px;
}
.page-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.7rem;
  font-weight: 400;
  margin: 0;
}
.back-link {
  font-family: 'Cinzel', serif;
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.3);
  text-decoration: none;
}
.back-link:hover { color: rgba(255,255,255,0.6); }

.page-divider { height: 1px; background: rgba(255,255,255,0.06); margin-bottom: 32px; }

.section-title {
  font-family: 'Cinzel', serif;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  margin: 0 0 20px;
}

/* Create form */
.create-section { margin-bottom: 32px; }
.create-form { display: flex; flex-direction: column; gap: 12px; }
.form-row { display: flex; align-items: center; gap: 16px; }
.form-label {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.35);
  min-width: 90px;
}
.form-input, .form-select {
  background: #0f0f11;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px;
  color: #fff;
  padding: 8px 12px;
  font-size: 0.88rem;
  flex: 1;
}
.form-input:focus, .form-select:focus { outline: none; border-color: rgba(201,168,76,0.4); }
.form-select option { background: #1a1a1e; }

.btn-create {
  align-self: flex-start;
  background: #8B1A1A;
  border: none;
  border-radius: 4px;
  color: #fff;
  font-family: 'Cinzel', serif;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 10px 24px;
  cursor: pointer;
  margin-top: 4px;
  transition: background 0.15s;
}
.btn-create:hover:not(:disabled) { background: #a82020; }
.btn-create:disabled { opacity: 0.45; cursor: default; }

/* Tables list */
.tables-section { }
.tables-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.btn-refresh {
  background: none; border: none; color: rgba(255,255,255,0.3);
  font-size: 1rem; cursor: pointer; padding: 4px 8px;
}
.btn-refresh:hover { color: rgba(255,255,255,0.6); }
.vide { color: rgba(255,255,255,0.2); font-size: 0.88rem; padding: 16px 0; }

.tables-list { display: flex; flex-direction: column; gap: 2px; }
.table-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 18px;
  background: #0f0f11;
  border: 1px solid rgba(255,255,255,0.06);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.table-card:hover { border-color: rgba(201,168,76,0.25); background: #141416; }
.table-card-main { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.table-name { font-family: 'Cinzel', serif; font-size: 0.82rem; letter-spacing: 0.06em; color: #d4cfc9; }
.table-blinds { font-size: 0.78rem; color: rgba(255,255,255,0.3); }
.table-card-meta { display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
.table-players { font-size: 0.75rem; color: rgba(255,255,255,0.3); }
.table-status { font-family: 'Cinzel', serif; font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; }
.status--waiting { color: #4caf78; }
.status--preflop, .status--flop, .status--turn, .status--river, .status--showdown { color: rgba(255,180,60,0.7); }
.table-cta { font-family: 'Cinzel', serif; font-size: 0.58rem; letter-spacing: 0.12em; color: rgba(139,26,26,0.6); flex-shrink: 0; }

/* Modale */
.modale-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 200;
}
.modale {
  background: #111113;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 32px;
  width: 360px;
  display: flex; flex-direction: column; gap: 14px;
}
.modale-title {
  font-family: 'Cinzel', serif;
  font-size: 0.9rem;
  letter-spacing: 0.1em;
  margin: 0;
}
.modale-blinds, .modale-range {
  font-size: 0.78rem;
  color: rgba(255,255,255,0.3);
  margin: 0;
}
.modale-presets { display: flex; gap: 8px; flex-wrap: wrap; }
.preset-btn {
  background: #1a1a1e; border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px; color: rgba(255,255,255,0.5);
  padding: 6px 12px; font-size: 0.78rem; cursor: pointer;
  transition: all 0.12s;
}
.preset-btn:hover, .preset-btn.active {
  border-color: rgba(201,168,76,0.5); color: #c9a84c; background: rgba(201,168,76,0.08);
}
.modale-actions { display: flex; gap: 10px; margin-top: 4px; }
.btn-cancel {
  flex: 1; background: none; border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px; color: rgba(255,255,255,0.4); padding: 10px;
  font-family: 'Cinzel', serif; font-size: 0.68rem; letter-spacing: 0.1em; cursor: pointer;
}
.btn-confirm {
  flex: 2; background: #8B1A1A; border: none; border-radius: 4px;
  color: #fff; padding: 10px; font-family: 'Cinzel', serif;
  font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer;
  transition: background 0.15s;
}
.btn-confirm:hover:not(:disabled) { background: #a82020; }
.btn-confirm:disabled { opacity: 0.45; }
.modale-error { color: #e05555; font-size: 0.8rem; margin: 0; }
</style>

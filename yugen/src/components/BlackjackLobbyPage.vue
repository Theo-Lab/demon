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
          @click="$router.push(`/blackjack/table/${table.id}`)"
        >
          <div class="table-card-header">
            <span class="table-num">Table {{ table.id }}</span>
            <span class="table-statut" :class="`statut--${table.statut}`">{{ statutLabel(table.statut) }}</span>
          </div>

          <!-- Sièges visuels -->
          <div class="table-visual">
            <div class="felt">
              <span class="felt-label">Blackjack</span>
            </div>
            <div class="seats-row">
              <div
                v-for="s in table.sieges"
                :key="s.numero"
                class="seat"
                :class="s.statut !== 'vide' ? 'seat--taken' : 'seat--free'"
              >
                <span v-if="s.statut !== 'vide'" class="seat-initial">{{ s.user_nom?.[0]?.toUpperCase() }}</span>
                <span v-else class="seat-plus">+</span>
              </div>
            </div>
          </div>

          <div class="table-card-footer">
            <span class="players-count">
              {{ table.sieges.filter(s => s.statut !== 'vide').length }}/{{ table.sieges.length }} joueurs
            </span>
            <span class="join-hint">Rejoindre →</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { io } from 'socket.io-client'
import AppNavbar from './AppNavbar.vue'
import { getMe, getBlackjackTables } from '../api.js'

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')

const solde  = ref(0)
const tables = ref([])
const erreur = ref('')
let socket   = null

function statutLabel(s) {
  if (s === 'attente')  return 'En attente'
  if (s === 'en_cours') return 'En jeu'
  if (s === 'fini')     return 'Terminée'
  return s
}

function fmtYen(n) {
  if (n == null) return '—'
  return (n < 0 ? '-¥' : '¥') + Math.abs(n).toLocaleString('fr-FR')
}

onMounted(async () => {
  try {
    const me = await getMe()
    if (me) solde.value = me.solde ?? 0
  } catch {}
  try {
    tables.value = await getBlackjackTables()
  } catch {
    erreur.value = 'Impossible de joindre le serveur.'
    return
  }

  socket = io(SOCKET_URL, { withCredentials: true })
  socket.on('connect', () => {
    for (let i = 1; i <= 3; i++) socket.emit('join_table', i)
  })
  socket.on('table_update', ({ table, sieges }) => {
    const idx = tables.value.findIndex(t => t.id === table.id)
    if (idx >= 0) tables.value[idx] = { ...table, sieges }
  })
})

onUnmounted(() => { if (socket) socket.disconnect() })
</script>

<style scoped>
.page { min-height: 100vh; background: #090909; color: #fff; }

.page-inner {
  max-width: 820px;
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

/* ── Grille de tables ──────────────────────────────── */

.tables-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.table-card {
  background: #0d0d0f;
  border: 1px solid rgba(255,255,255,0.07);
  cursor: pointer;
  transition: border-color 0.2s, transform 0.2s;
  overflow: hidden;
}
.table-card:hover {
  border-color: rgba(255,255,255,0.2);
  transform: translateY(-3px);
}
.table-card--en_cours {
  border-color: rgba(201,168,76,0.3);
}
.table-card--en_cours:hover {
  border-color: rgba(201,168,76,0.5);
}

.table-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px 10px;
}

.table-num {
  font-family: 'Cinzel', serif;
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.5);
}

.table-statut {
  font-family: 'Cinzel', serif;
  font-size: 0.52rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 2px 7px;
  border: 1px solid;
}
.statut--attente  { color: rgba(255,255,255,0.3); border-color: rgba(255,255,255,0.1); }
.statut--en_cours { color: #c9a84c; border-color: rgba(201,168,76,0.35); }
.statut--fini     { color: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.06); }

/* ── Visuel table ──────────────────────────────────── */

.table-visual {
  padding: 12px 16px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.felt {
  width: 100%;
  background: #0b1f0e;
  border: 2px solid #1a4020;
  border-radius: 60px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.felt-label {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.18em;
  color: rgba(255,255,255,0.1);
  text-transform: uppercase;
}

.seats-row {
  display: flex;
  gap: 8px;
  justify-content: center;
  padding-bottom: 4px;
}

.seat {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed rgba(255,255,255,0.15);
  transition: border-color 0.15s;
}

.seat--free {
  background: rgba(0,0,0,0.3);
}

.seat--taken {
  background: rgba(139,26,26,0.2);
  border-style: solid;
  border-color: rgba(139,26,26,0.4);
}

.seat-initial {
  font-family: 'Cinzel', serif;
  font-size: 0.7rem;
  color: rgba(255,255,255,0.6);
}

.seat-plus {
  font-size: 0.9rem;
  color: rgba(255,255,255,0.15);
  line-height: 1;
}

/* ── Footer carte ──────────────────────────────────── */

.table-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  margin-top: 4px;
  border-top: 1px solid rgba(255,255,255,0.04);
}

.players-count {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.25);
}

.join-hint {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  color: rgba(255,255,255,0.2);
  transition: color 0.15s;
}
.table-card:hover .join-hint { color: rgba(255,255,255,0.55); }

@media (max-width: 640px) {
  .tables-grid { grid-template-columns: 1fr; }
}
</style>

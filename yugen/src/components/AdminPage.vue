<template>
  <div class="page">
    <AppNavbar />

    <div class="page-inner">

      <div class="page-header">
        <div>
          <p class="page-label">Administration</p>
          <h1 class="page-title">Gestion des membres</h1>
        </div>
      </div>

      <div class="page-divider"></div>

      <!-- Recherche -->
      <div class="toolbar">
        <input
          v-model="recherche"
          class="field-input recherche-input"
          type="text"
          placeholder="Rechercher un membre…"
          autocomplete="off"
        />
        <span class="count">{{ membresFiltres.length }} membre{{ membresFiltres.length !== 1 ? 's' : '' }}</span>
      </div>

      <div v-if="loading" class="loading">Chargement…</div>
      <div v-else-if="membresFiltres.length === 0" class="vide">Aucun membre trouvé.</div>

      <div v-else class="membres-list">
        <div v-for="m in membresFiltres" :key="m.id" class="membre-block">

          <!-- Ligne résumé -->
          <div
            class="membre-row"
            :class="{ 'membre-row--open': ouvert === m.id }"
            @click="toggleOuvrir(m)"
          >
            <div class="membre-info">
              <div class="membre-nom-row">
                <span class="membre-nom">{{ m.nom }}</span>
                <span v-if="m.role === 'admin'" class="badge-admin">Admin</span>
              </div>
              <span class="membre-id">{{ m.identifiant }}</span>
            </div>
            <div class="membre-meta">
              <span v-if="m.grade" class="membre-grade">{{ m.grade }}</span>
            </div>
            <span class="membre-chevron">{{ ouvert === m.id ? '▲' : '▼' }}</span>
          </div>

          <!-- Panneau édition -->
          <div v-if="ouvert === m.id" class="edit-panel">

            <div class="edit-grid">
              <div class="field">
                <label class="field-label">Nom affiché</label>
                <input v-model="form.nom" class="field-input" type="text" />
              </div>
              <div class="field">
                <label class="field-label">Identifiant (login)</label>
                <input v-model="form.identifiant" class="field-input" type="text" autocomplete="off" />
              </div>
              <div class="field">
                <label class="field-label">Nouveau mot de passe</label>
                <input v-model="form.mot_de_passe" class="field-input" type="password" placeholder="Laisser vide pour ne pas changer" autocomplete="new-password" />
              </div>
              <div class="field">
                <label class="field-label">Grade</label>
                <input v-model="form.grade" class="field-input" type="text" placeholder="Ex : Lune Supérieure" />
              </div>
              <div class="field">
                <label class="field-label">Nom de pouvoir</label>
                <input v-model="form.pouvoir_nom" class="field-input" type="text" placeholder="Ex : Sang démoniaque" />
              </div>
              <div class="field">
                <label class="field-label">Rôle</label>
                <select v-model="form.role" class="field-input field-select">
                  <option value="membre">Membre</option>
                  <option value="groupier">Groupier</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div class="field field--full">
                <label class="field-label">Signature</label>
                <textarea v-model="form.signature" class="field-input field-textarea" rows="3" placeholder="Texte affiché sous le nom dans les rapports…" />
              </div>
            </div>

            <div v-if="erreur" class="edit-erreur">{{ erreur }}</div>
            <div v-if="ok" class="edit-ok">Modifications enregistrées.</div>

            <div class="edit-actions">
              <button class="btn-secondary" @click="ouvert = null">Annuler</button>
              <button class="btn-submit" :disabled="loading_save" @click="sauvegarder(m)">
                {{ loading_save ? '…' : 'Enregistrer' }}
              </button>
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
import { adminUpdateUser, getSlotsAdminJoueurs } from '../api.js'

const membres     = ref([])
const loading     = ref(true)
const loading_save = ref(false)
const recherche   = ref('')
const ouvert      = ref(null)
const form        = ref({})
const erreur      = ref('')
const ok          = ref(false)

const membresFiltres = computed(() => {
  const q = recherche.value.trim().toLowerCase()
  if (!q) return membres.value
  return membres.value.filter(m =>
    m.nom.toLowerCase().includes(q) || m.identifiant.toLowerCase().includes(q)
  )
})

onMounted(async () => {
  try {
    membres.value = await getSlotsAdminJoueurs()
  } finally {
    loading.value = false
  }
})

function toggleOuvrir(m) {
  if (ouvert.value === m.id) {
    ouvert.value = null
    return
  }
  ouvert.value = m.id
  erreur.value = ''
  ok.value = false
  form.value = {
    nom:          m.nom         ?? '',
    identifiant:  m.identifiant ?? '',
    mot_de_passe: '',
    grade:        m.grade       ?? '',
    pouvoir_nom:  m.pouvoir_nom ?? '',
    role:         m.role        ?? 'membre',
    signature:    m.signature   ?? '',
  }
}

async function sauvegarder(m) {
  erreur.value = ''
  ok.value = false
  loading_save.value = true
  try {
    const fields = { ...form.value }
    if (!fields.mot_de_passe) delete fields.mot_de_passe
    const updated = await adminUpdateUser(m.id, fields)
    const idx = membres.value.findIndex(x => x.id === m.id)
    if (idx !== -1) membres.value[idx] = { ...membres.value[idx], ...updated }
    form.value.mot_de_passe = ''
    ok.value = true
    setTimeout(() => { ok.value = false }, 3000)
  } catch (e) {
    erreur.value = e.message
  } finally {
    loading_save.value = false
  }
}
</script>

<style scoped>
.page { min-height: 100vh; background: #090909; color: #fff; }

.page-inner {
  max-width: 760px;
  margin: 0 auto;
  padding: 48px 24px 80px;
}

.page-header { margin-bottom: 24px; }

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
  letter-spacing: 0.06em;
}

.page-divider {
  height: 1px;
  background: rgba(255,255,255,0.06);
  margin-bottom: 32px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}

.field-input {
  background: #0f0f10;
  border: 1px solid rgba(255,255,255,0.08);
  color: #d4cfc9;
  padding: 9px 12px;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  outline: none;
}
.field-input:focus { border-color: rgba(139,26,26,0.4); }

.recherche-input { flex: 1; }

.count {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.2);
  white-space: nowrap;
}

.loading, .vide {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1.05rem;
  font-style: italic;
  color: rgba(255,255,255,0.25);
  padding: 60px 0;
  text-align: center;
}

/* Liste */
.membres-list { display: flex; flex-direction: column; gap: 6px; }

.membre-block { display: flex; flex-direction: column; }

.membre-row {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.05);
  padding: 14px 18px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.membre-row:hover { background: #17171a; }
.membre-row--open {
  border-color: rgba(139,26,26,0.3);
  background: #171214;
}

.membre-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}

.membre-nom-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.membre-nom {
  font-family: 'Cinzel', serif;
  font-size: 0.85rem;
  letter-spacing: 0.06em;
  color: #d4cfc9;
}

.badge-admin {
  font-family: 'Cinzel', serif;
  font-size: 0.52rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #c9a84c;
  background: rgba(201,168,76,0.1);
  border: 1px solid rgba(201,168,76,0.25);
  padding: 2px 6px;
}

.membre-id {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.22);
  text-transform: uppercase;
}

.membre-meta { min-width: 140px; }

.membre-grade {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.9rem;
  font-style: italic;
  color: rgba(255,255,255,0.35);
}

.membre-chevron {
  font-size: 0.52rem;
  color: rgba(255,255,255,0.18);
  flex-shrink: 0;
}

/* Panneau édition */
.edit-panel {
  background: #111113;
  border: 1px solid rgba(139,26,26,0.2);
  border-top: none;
  padding: 24px 22px 18px;
}

.edit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 22px;
  margin-bottom: 18px;
}

.field { display: flex; flex-direction: column; gap: 6px; }
.field--full { grid-column: 1 / -1; }

.field-label {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.28);
}

.field-select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='rgba(255,255,255,0.25)'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  cursor: pointer;
}

.field-textarea {
  resize: vertical;
  min-height: 64px;
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  line-height: 1.45;
}

.edit-erreur {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.95rem;
  font-style: italic;
  color: #c05050;
  margin-bottom: 12px;
}

.edit-ok {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.95rem;
  font-style: italic;
  color: #6aaa6a;
  margin-bottom: 12px;
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-submit {
  font-family: 'Cinzel', serif;
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  background: #8b1a1a;
  color: #fff;
  border: none;
  padding: 9px 22px;
  cursor: pointer;
}
.btn-submit:hover:not(:disabled) { background: #a82020; }
.btn-submit:disabled { opacity: 0.5; cursor: default; }

.btn-secondary {
  font-family: 'Cinzel', serif;
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.4);
  padding: 9px 18px;
  cursor: pointer;
}
.btn-secondary:hover { border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.7); }
</style>

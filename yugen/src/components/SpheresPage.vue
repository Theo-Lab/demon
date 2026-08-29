<template>
  <div class="page">
    <AppNavbar />

    <div class="page-inner">

      <div class="page-header">
        <div>
          <p class="page-label">Ordre Démoniaque</p>
          <h1 class="page-title">Sphères</h1>
        </div>
        <button v-if="currentUser?.role === 'admin'" class="btn-new" @click="showForm = !showForm">
          {{ showForm ? 'Annuler' : 'Nouvelle sphère' }}
        </button>
      </div>

      <div class="page-divider"></div>

      <!-- Formulaire création (admin) -->
      <div v-if="showForm" class="form-card">
        <h2 class="form-title">Nouvelle sphère</h2>

        <div class="field">
          <label class="field-label">Nom</label>
          <input v-model="form.nom" class="field-input" type="text" placeholder="Nom de la sphère" />
        </div>

        <div class="field">
          <label class="field-label">Description</label>
          <textarea v-model="form.description" class="field-input field-textarea" placeholder="Description de la sphère..."></textarea>
        </div>

        <div class="field">
          <label class="field-label">Chef de sphère</label>
          <select v-model="form.chef_id" class="field-input">
            <option :value="null">— Aucun —</option>
            <option v-for="u in users" :key="u.id" :value="u.id">{{ u.nom }}</option>
          </select>
        </div>

        <p v-if="formError" class="error-msg">{{ formError }}</p>

        <button class="btn-submit" @click="submitSphere" :disabled="formLoading">
          {{ formLoading ? '...' : 'Créer la sphère' }}
        </button>
      </div>

      <!-- Liste -->
      <div v-if="loading" class="state-msg">Chargement...</div>
      <div v-else-if="error" class="state-msg state-msg--error">{{ error }}</div>
      <div v-else-if="spheres.length === 0" class="state-msg">Aucune sphère créée.</div>

      <div v-else class="spheres-grid">
        <RouterLink
          v-for="s in spheres"
          :key="s.id"
          :to="`/spheres/${s.id}`"
          class="sphere-card"
        >
          <div class="sphere-card-top">
            <h2 class="sphere-nom">{{ s.nom }}</h2>
            <span class="sphere-count">{{ s.nb_membres }} membre{{ s.nb_membres !== 1 ? 's' : '' }}</span>
          </div>
          <p v-if="s.description" class="sphere-desc">{{ s.description }}</p>
          <p v-if="s.chef_nom" class="sphere-chef">Chef · {{ s.chef_nom }}</p>
        </RouterLink>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppNavbar from './AppNavbar.vue'
import { currentUser } from '../auth.js'
import { getSpheres, createSphere, getUsers } from '../api.js'

const spheres = ref([])
const users = ref([])
const loading = ref(true)
const error = ref('')

const showForm = ref(false)
const formLoading = ref(false)
const formError = ref('')
const form = ref({ nom: '', description: '', chef_id: null })

onMounted(async () => {
  try {
    spheres.value = await getSpheres()
    if (currentUser.value?.role === 'admin') {
      users.value = await getUsers()
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

async function submitSphere() {
  if (!form.value.nom) { formError.value = 'Nom requis.'; return }
  formLoading.value = true
  formError.value = ''
  try {
    const s = await createSphere(form.value.nom, form.value.description, form.value.chef_id)
    spheres.value.push(s)
    form.value = { nom: '', description: '', chef_id: null }
    showForm.value = false
  } catch (e) {
    formError.value = e.message
  } finally {
    formLoading.value = false
  }
}
</script>

<style scoped>
.page { min-height: 100vh; background: #090909; }

.page-inner {
  max-width: 900px;
  margin: 0 auto;
  padding: 3.5rem 2rem 6rem;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 1.8rem;
  gap: 1rem;
}

.page-label {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.35em;
  color: #8b1a1a;
  text-transform: uppercase;
  margin-bottom: 0.4rem;
}

.page-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.06em;
  margin: 0;
}

.btn-new {
  background: rgba(139,26,26,0.12);
  border: 1px solid rgba(139,26,26,0.3);
  color: #8b1a1a;
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 0.55rem 1.1rem;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.btn-new:hover { background: rgba(139,26,26,0.2); border-color: rgba(139,26,26,0.5); color: #c02020; }

.page-divider { height: 1px; background: rgba(255,255,255,0.07); margin-bottom: 2rem; }

/* ── Formulaire ───────────────────────────── */
.form-card {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.07);
  padding: 1.8rem 2rem;
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.form-title {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.2em;
  color: rgba(255,255,255,0.3);
  text-transform: uppercase;
  margin: 0;
}

.field { display: flex; flex-direction: column; gap: 0.4rem; }

.field-label {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  color: rgba(255,255,255,0.3);
  text-transform: uppercase;
}

.field-input {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  color: #fff;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  padding: 0.55rem 0.8rem;
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
  box-sizing: border-box;
}
.field-input:focus { border-color: rgba(139,26,26,0.5); }
.field-input option { background: #141416; }
.field-textarea { resize: vertical; min-height: 80px; line-height: 1.6; }

.error-msg { font-family: 'Crimson Text', Georgia, serif; font-style: italic; font-size: 0.9rem; color: #8b1a1a; }

.btn-submit {
  align-self: flex-start;
  background: #8b1a1a;
  border: none;
  color: #fff;
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  padding: 0.7rem 1.4rem;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-submit:hover:not(:disabled) { background: #a82020; }
.btn-submit:disabled { opacity: 0.5; cursor: default; }

/* ── État ─────────────────────────────────── */
.state-msg {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  color: rgba(255,255,255,0.2);
  font-size: 0.98rem;
  padding: 2rem 0;
}
.state-msg--error { color: #8b1a1a; }

/* ── Grille sphères ───────────────────────── */
.spheres-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.06);
}

.sphere-card {
  background: #0f0f10;
  padding: 1.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  text-decoration: none;
  transition: background 0.15s;
}
.sphere-card:hover { background: #141416; }

.sphere-card-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.sphere-nom {
  font-family: 'Cinzel', serif;
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.05em;
  margin: 0;
}

.sphere-count {
  font-family: 'Cinzel', serif;
  font-size: 0.52rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.2);
  text-transform: uppercase;
  white-space: nowrap;
}

.sphere-desc {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.95rem;
  color: rgba(255,255,255,0.35);
  line-height: 1.6;
  margin: 0;
}

.sphere-chef {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.85rem;
  color: #8b1a1a;
  margin: 0;
}

@media (max-width: 600px) {
  .page-inner { padding: 2rem 1.2rem 4rem; }
  .spheres-grid { grid-template-columns: 1fr; }
}
</style>

<template>
  <div class="page">
    <AppNavbar />

    <div class="page-inner">

      <div v-if="loading" class="state-msg">Chargement...</div>
      <div v-else-if="error" class="state-msg state-msg--error">{{ error }}</div>

      <template v-else>

        <!-- Header -->
        <div class="sphere-header">
          <div>
            <p class="page-label">Sphère</p>
            <h1 class="sphere-titre">{{ sphere.nom }}</h1>
            <p v-if="sphere.chef_nom" class="sphere-chef">Chef · {{ sphere.chef_nom }}</p>
          </div>
          <button v-if="currentUser?.role === 'admin'" class="btn-danger" @click="supprimerSphere">
            Supprimer
          </button>
        </div>

        <p v-if="sphere.description" class="sphere-desc">{{ sphere.description }}</p>

        <div class="page-divider"></div>

        <!-- Membres -->
        <div class="section-header">
          <h2 class="section-title">Membres</h2>
          <button v-if="canManage" class="btn-add" @click="showAddForm = !showAddForm">
            {{ showAddForm ? 'Annuler' : '+ Ajouter' }}
          </button>
        </div>

        <!-- Formulaire ajout membre -->
        <div v-if="showAddForm && canManage" class="form-card">
          <div class="form-row">
            <div class="field field--grow">
              <label class="field-label">Membre</label>
              <select v-model="addForm.user_id" class="field-input">
                <option :value="null">— Choisir —</option>
                <option v-for="u in usersDisponibles" :key="u.id" :value="u.id">{{ u.nom }}</option>
              </select>
            </div>
            <div class="field field--grow">
              <label class="field-label">Grade dans la sphère</label>
              <select v-model="addForm.grade" class="field-input">
                <option value="">— Aucun grade —</option>
                <option v-for="g in grades" :key="g.id" :value="g.nom">{{ g.nom }}</option>
              </select>
            </div>
          </div>
          <p v-if="addError" class="error-msg">{{ addError }}</p>
          <button class="btn-submit" @click="ajouterMembre" :disabled="addLoading">
            {{ addLoading ? '...' : 'Ajouter' }}
          </button>
        </div>

        <!-- Liste membres -->
        <div v-if="membres.length === 0" class="state-msg">Aucun membre.</div>

        <div v-else class="membres-list">
          <div v-for="m in membres" :key="m.id" class="membre-item">
            <div class="membre-info">
              <span class="membre-nom">{{ m.nom }}</span>
              <span class="membre-grade-global">{{ m.grade_global }}</span>
            </div>

            <div class="membre-right">
              <!-- Grade sphère éditable -->
              <template v-if="canManage && editingGrade === m.id">
                <select v-model="gradeEdit" class="grade-input">
                  <option value="">— Aucun —</option>
                  <option v-for="g in grades" :key="g.id" :value="g.nom">{{ g.nom }}</option>
                </select>
                <button class="action-sm action-sm--save" @click="saveGrade(m)">✓</button>
                <button class="action-sm" @click="editingGrade = null">✕</button>
              </template>
              <template v-else>
                <span class="membre-grade-sphere">{{ m.grade_sphere || '—' }}</span>
                <button v-if="canManage" class="action-sm" @click="startEditGrade(m)" title="Modifier le grade">✎</button>
                <button v-if="canManage" class="action-sm action-sm--del" @click="retirerMembre(m)" title="Retirer">×</button>
              </template>
            </div>
          </div>
        </div>

        <div class="page-divider" style="margin-top:2rem"></div>

        <!-- Grades de la sphère -->
        <div class="section-header">
          <h2 class="section-title">Grades de la sphère</h2>
          <button v-if="canManage" class="btn-add" @click="showGradeForm = !showGradeForm">
            {{ showGradeForm ? 'Annuler' : '+ Créer un grade' }}
          </button>
        </div>

        <div v-if="showGradeForm && canManage" class="form-card">
          <div class="form-row">
            <div class="field field--grow">
              <label class="field-label">Nom du grade</label>
              <input v-model="gradeForm.nom" class="field-input" type="text" placeholder="Ex: Apprenti, Maître, Archiviste..." @keyup.enter="creerGrade" />
            </div>
            <div class="field">
              <label class="field-label">Ordre</label>
              <input v-model.number="gradeForm.ordre" class="field-input" type="number" placeholder="0" style="width:80px" />
            </div>
          </div>
          <p v-if="gradeFormError" class="error-msg">{{ gradeFormError }}</p>
          <button class="btn-submit" @click="creerGrade" :disabled="gradeFormLoading">
            {{ gradeFormLoading ? '...' : 'Créer' }}
          </button>
        </div>

        <div v-if="grades.length === 0" class="state-msg">Aucun grade défini.</div>
        <div v-else class="grades-list">
          <div v-for="g in grades" :key="g.id" class="grade-item">
            <span class="grade-ordre">{{ g.ordre }}</span>
            <span class="grade-nom">{{ g.nom }}</span>
            <button v-if="canManage" class="action-sm action-sm--del" @click="supprimerGrade(g)" title="Supprimer">×</button>
          </div>
        </div>

        <div class="back-row">
          <RouterLink to="/spheres" class="back-link">← Retour aux sphères</RouterLink>
        </div>

      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppNavbar from './AppNavbar.vue'
import { currentUser } from '../auth.js'
import { getSphere, deleteSphere, addMembreSphere, updateGradeMembre, removeMembreSphere, getUsers, getSphereGrades, createSphereGrade, deleteSphereGrade } from '../api.js'

const route = useRoute()
const router = useRouter()

const sphere = ref(null)
const membres = ref([])
const allUsers = ref([])
const grades = ref([])
const loading = ref(true)
const error = ref('')

const showAddForm = ref(false)
const addLoading = ref(false)
const addError = ref('')
const addForm = ref({ user_id: null, grade: '' })

const editingGrade = ref(null)
const gradeEdit = ref('')

const showGradeForm = ref(false)
const gradeFormLoading = ref(false)
const gradeFormError = ref('')
const gradeForm = ref({ nom: '', ordre: 0 })

const canManage = computed(() => {
  if (!currentUser.value) return false
  if (currentUser.value.role === 'admin') return true
  return sphere.value?.chef_id === currentUser.value.id
})

const usersDisponibles = computed(() => {
  const ids = new Set(membres.value.map(m => m.id))
  return allUsers.value.filter(u => !ids.has(u.id))
})

onMounted(async () => {
  try {
    const [data, gradesList] = await Promise.all([
      getSphere(route.params.id),
      getSphereGrades(route.params.id),
    ])
    sphere.value = data.sphere
    membres.value = data.membres
    grades.value = gradesList
    if (currentUser.value) {
      allUsers.value = await getUsers()
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

async function ajouterMembre() {
  if (!addForm.value.user_id) { addError.value = 'Choisissez un membre.'; return }
  addLoading.value = true
  addError.value = ''
  try {
    await addMembreSphere(sphere.value.id, addForm.value.user_id, addForm.value.grade)
    const u = allUsers.value.find(u => u.id === addForm.value.user_id)
    membres.value.push({ id: u.id, nom: u.nom, grade_global: u.grade, grade_sphere: addForm.value.grade })
    addForm.value = { user_id: null, grade: '' }
    showAddForm.value = false
  } catch (e) {
    addError.value = e.message
  } finally {
    addLoading.value = false
  }
}

function startEditGrade(m) {
  editingGrade.value = m.id
  gradeEdit.value = m.grade_sphere || ''
}

async function saveGrade(m) {
  try {
    await updateGradeMembre(sphere.value.id, m.id, gradeEdit.value)
    m.grade_sphere = gradeEdit.value
    editingGrade.value = null
  } catch (e) {
    alert(e.message)
  }
}

async function retirerMembre(m) {
  try {
    await removeMembreSphere(sphere.value.id, m.id)
    membres.value = membres.value.filter(x => x.id !== m.id)
  } catch (e) {
    alert(e.message)
  }
}

async function creerGrade() {
  if (!gradeForm.value.nom) { gradeFormError.value = 'Nom requis.'; return }
  gradeFormLoading.value = true
  gradeFormError.value = ''
  try {
    const g = await createSphereGrade(sphere.value.id, gradeForm.value.nom, gradeForm.value.ordre)
    grades.value.push(g)
    grades.value.sort((a, b) => a.ordre - b.ordre || a.id - b.id)
    gradeForm.value = { nom: '', ordre: 0 }
    showGradeForm.value = false
  } catch (e) {
    gradeFormError.value = e.message
  } finally {
    gradeFormLoading.value = false
  }
}

async function supprimerGrade(g) {
  try {
    await deleteSphereGrade(sphere.value.id, g.id)
    grades.value = grades.value.filter(x => x.id !== g.id)
  } catch (e) {
    alert(e.message)
  }
}

async function supprimerSphere() {
  try {
    await deleteSphere(sphere.value.id)
    router.push('/spheres')
  } catch (e) {
    alert(e.message)
  }
}
</script>

<style scoped>
.page { min-height: 100vh; background: #090909; }

.page-inner {
  max-width: 800px;
  margin: 0 auto;
  padding: 3.5rem 2rem 6rem;
}

.state-msg {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  color: rgba(255,255,255,0.2);
  font-size: 0.98rem;
  padding: 2rem 0;
}
.state-msg--error { color: #8b1a1a; }

/* ── Header ───────────────────────────────── */
.sphere-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.8rem;
}

.page-label {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.35em;
  color: #8b1a1a;
  text-transform: uppercase;
  margin-bottom: 0.4rem;
}

.sphere-titre {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.06em;
  margin: 0 0 0.3rem;
}

.sphere-chef {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.95rem;
  color: #8b1a1a;
  margin: 0;
}

.sphere-desc {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  color: rgba(255,255,255,0.35);
  line-height: 1.65;
  margin: 0 0 1.5rem;
}

.btn-danger {
  background: none;
  border: 1px solid rgba(139,26,26,0.3);
  color: #8b1a1a;
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}
.btn-danger:hover { background: rgba(139,26,26,0.1); color: #c02020; }

.page-divider { height: 1px; background: rgba(255,255,255,0.07); margin-bottom: 1.8rem; }

/* ── Section membres ──────────────────────── */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.2rem;
}

.section-title {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.2em;
  color: rgba(255,255,255,0.3);
  text-transform: uppercase;
  margin: 0;
}

.btn-add {
  background: none;
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.35);
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.35rem 0.8rem;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-add:hover { color: #fff; border-color: rgba(255,255,255,0.25); }

/* ── Formulaire ───────────────────────────── */
.form-card {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.07);
  padding: 1.4rem 1.6rem;
  margin-bottom: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row { display: flex; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.4rem; }
.field--grow { flex: 1; }

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
  padding: 0.5rem 0.8rem;
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
  box-sizing: border-box;
}
.field-input:focus { border-color: rgba(139,26,26,0.5); }
.field-input option { background: #141416; }

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
  padding: 0.6rem 1.2rem;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-submit:hover:not(:disabled) { background: #a82020; }
.btn-submit:disabled { opacity: 0.5; cursor: default; }

/* ── Membres ──────────────────────────────── */
.membres-list {
  border: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 2.5rem;
}

.membre-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.95rem 1.4rem;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  gap: 1rem;
}
.membre-item:last-child { border-bottom: none; }

.membre-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.membre-nom {
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  color: #fff;
  letter-spacing: 0.04em;
}

.membre-grade-global {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.82rem;
  color: rgba(255,255,255,0.25);
}

.membre-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.membre-grade-sphere {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.9rem;
  color: #8b1a1a;
  min-width: 80px;
  text-align: right;
}

.grade-input {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(139,26,26,0.4);
  color: #fff;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.9rem;
  padding: 0.2rem 0.5rem;
  outline: none;
  width: 120px;
}

.action-sm {
  background: none;
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.3);
  font-size: 0.75rem;
  width: 22px;
  height: 22px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all 0.12s;
}
.action-sm:hover { color: #fff; border-color: rgba(255,255,255,0.2); }
.action-sm--del:hover { color: #8b1a1a; border-color: rgba(139,26,26,0.4); }
.action-sm--save:hover { color: #3a7a3a; border-color: rgba(58,122,58,0.4); }

/* ── Grades ───────────────────────────────── */
.grades-list {
  border: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 1rem;
}

.grade-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.4rem;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.grade-item:last-child { border-bottom: none; }

.grade-ordre {
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  color: rgba(255,255,255,0.2);
  width: 20px;
  text-align: center;
}

.grade-nom {
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  color: #fff;
  letter-spacing: 0.05em;
  flex: 1;
}

/* ── Bas de page ──────────────────────────── */
.back-row { margin-top: 1rem; }
.back-link {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.25);
  text-decoration: none;
  text-transform: uppercase;
  transition: color 0.15s;
}
.back-link:hover { color: rgba(255,255,255,0.5); }

@media (max-width: 600px) {
  .page-inner { padding: 2rem 1.2rem 4rem; }
  .form-row { flex-direction: column; }
  .membre-item { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
}
</style>

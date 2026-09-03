<template>
  <div class="page">
    <AppNavbar />

    <div class="page-inner">

      <div class="profile-header">
        <div class="avatar">{{ user?.nom?.[0] ?? '?' }}</div>
        <div class="profile-meta">
          <p class="profile-label">Profil</p>
          <h1 class="profile-name">{{ user?.nom }}</h1>
          <p class="profile-grade">{{ user?.grade || 'Aucun grade attribué' }}</p>
        </div>
      </div>

      <div class="profile-divider"></div>

      <div class="profile-body">

        <!-- Informations générales -->
        <section class="section">
          <h2 class="section-title">Informations</h2>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Identifiant</span>
              <span class="info-value">{{ user?.identifiant }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Rôle</span>
              <span class="info-value info-value--role">{{ user?.role }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Grade</span>
              <input v-model="editGrade" class="pouvoir-input" type="text" placeholder="Ex: Lune Supérieure 1..." />
            </div>
          </div>
        </section>

        <div class="sep"></div>

        <!-- Sphères -->
        <section class="section">
          <h2 class="section-title">Sphères</h2>
          <div v-if="user?.spheres && user.spheres.length > 0" class="spheres-list">
            <div v-for="s in user.spheres" :key="s.id" class="sphere-item">
              <span class="sphere-nom">{{ s.nom }}</span>
              <span v-if="s.grade_sphere" class="sphere-grade">{{ s.grade_sphere }}</span>
            </div>
          </div>
          <p v-else class="empty-text">Aucune sphère assignée.</p>
        </section>

        <div class="sep"></div>

        <!-- Pouvoir Sanguinaire -->
        <section class="section">
          <h2 class="section-title">Pouvoir Sanguinaire</h2>
          <div class="pouvoir-field">
            <input
              v-model="pouvNom"
              class="pouvoir-input"
              type="text"
              placeholder="Nom du pouvoir sanguinaire..."
            />
          </div>
        </section>

        <div class="sep"></div>

        <section class="section">
          <div class="pouvoir-field" style="justify-content:flex-end">
            <button class="pouvoir-btn" @click="saveProfile" :disabled="saving">
              {{ saving ? '...' : 'Enregistrer le profil' }}
            </button>
          </div>
          <p v-if="saveError" class="save-error">{{ saveError }}</p>
          <p v-if="saveOk" class="save-ok">Enregistré.</p>
        </section>

      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppNavbar from './AppNavbar.vue'
import { currentUser } from '../auth.js'
import { getMe, updateProfile } from '../api.js'

const user = ref(null)
const pouvNom = ref('')
const editGrade = ref('')
const saving = ref(false)
const saveError = ref('')
const saveOk = ref(false)

onMounted(async () => {
  const data = await getMe()
  if (data) {
    user.value = data
    pouvNom.value = data.pouvoir_nom || ''
    editGrade.value = data.grade || ''
    if (currentUser.value) {
      currentUser.value = { ...currentUser.value, ...data }
    }
  }
})

async function saveProfile() {
  saving.value = true
  saveError.value = ''
  saveOk.value = false
  try {
    const updated = await updateProfile({ pouvoir_nom: pouvNom.value, grade: editGrade.value })
    user.value = updated
    pouvNom.value = updated.pouvoir_nom || ''
    editGrade.value = updated.grade || ''
    if (currentUser.value) {
      currentUser.value = { ...currentUser.value, pouvoir_nom: updated.pouvoir_nom, grade: updated.grade }
    }
    saveOk.value = true
    setTimeout(() => { saveOk.value = false }, 2500)
  } catch (e) {
    saveError.value = e.message
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #090909;
}

.page-inner {
  max-width: 800px;
  margin: 0 auto;
  padding: 3.5rem 2rem 6rem;
}

/* ── Header profil ────────────────────────── */
.profile-header {
  display: flex;
  align-items: center;
  gap: 2rem;
  margin-bottom: 2.5rem;
}

.avatar {
  width: 72px;
  height: 72px;
  background: #8b1a1a;
  color: #fff;
  font-family: 'Cinzel', serif;
  font-size: 1.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.profile-label {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.35em;
  color: #8b1a1a;
  text-transform: uppercase;
  margin-bottom: 0.4rem;
}

.profile-name {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.8rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.06em;
  margin: 0 0 0.3rem;
}

.profile-grade {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 1rem;
  color: rgba(255,255,255,0.4);
}

.profile-divider {
  height: 1px;
  background: rgba(255,255,255,0.07);
  margin-bottom: 2.5rem;
}

/* ── Corps ────────────────────────────────── */
.profile-body {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.07);
}

.section {
  padding: 1.8rem 2rem;
}

.section-title {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.2em;
  color: rgba(255,255,255,0.3);
  text-transform: uppercase;
  margin-bottom: 1.2rem;
}

.sep {
  height: 1px;
  background: rgba(255,255,255,0.06);
}

/* ── Infos ────────────────────────────────── */
.info-grid {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.info-item {
  display: flex;
  align-items: baseline;
  gap: 1rem;
}

.info-label {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.25);
  text-transform: uppercase;
  width: 90px;
  flex-shrink: 0;
}

.info-value {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  color: #d4cfc9;
}

.info-value--role {
  color: #8b1a1a;
  font-style: italic;
}

/* ── Sphères ──────────────────────────────── */
.spheres-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.sphere-item {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.sphere-nom {
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  color: #d4cfc9;
}

.sphere-grade {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.88rem;
  color: rgba(139,26,26,0.8);
}

/* ── Pouvoir ──────────────────────────────── */
.pouvoir-field {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.pouvoir-input {
  flex: 1;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  color: #fff;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  padding: 0.55rem 0.8rem;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.pouvoir-input:focus { border-color: rgba(139,26,26,0.5); }
.pouvoir-input::placeholder { color: rgba(255,255,255,0.18); font-style: italic; }

.pouvoir-btn {
  background: rgba(139,26,26,0.15);
  border: 1px solid rgba(139,26,26,0.35);
  color: #8b1a1a;
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 0.58rem 1.1rem;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;
}
.pouvoir-btn:hover:not(:disabled) { background: rgba(139,26,26,0.25); border-color: rgba(139,26,26,0.55); }
.pouvoir-btn:disabled { opacity: 0.5; cursor: default; }

.save-error {
  margin-top: 0.6rem;
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.9rem;
  color: #8b1a1a;
}

.save-ok {
  margin-top: 0.6rem;
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.9rem;
  color: rgba(74,154,74,0.8);
}

/* ── Vide ─────────────────────────────────── */
.empty-text {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  color: rgba(255,255,255,0.2);
  font-size: 0.95rem;
}

/* ── Responsive ───────────────────────────── */
@media (max-width: 600px) {
  .profile-header { flex-direction: column; align-items: flex-start; gap: 1.2rem; }
  .page-inner { padding: 2rem 1.2rem 4rem; }
  .pouvoir-field { flex-direction: column; align-items: stretch; }
}
</style>

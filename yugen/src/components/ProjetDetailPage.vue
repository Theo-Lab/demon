<template>
  <div class="page">
    <AppNavbar />

    <div class="page-inner">

      <div v-if="loading" class="state-msg">Chargement...</div>
      <div v-else-if="error" class="state-msg state-msg--error">{{ error }}</div>

      <template v-else>

        <div class="projet-header">
          <h1 class="projet-titre">{{ projet.titre }}</h1>
          <p class="projet-info">
            Par <span class="projet-auteur">{{ projet.auteur_nom }}</span>
            · {{ formatDate(projet.created_at) }}
          </p>
        </div>

        <div class="projet-divider"></div>

        <BlocRenderer :blocs="parseBlocs(projet.contenu)" />

        <div class="projet-footer">
          <RouterLink v-if="isAuthor" to="/projets" class="back-link">← Mes projets</RouterLink>
          <span v-else class="back-link-placeholder"></span>

          <button
            v-if="isAuthor"
            class="action-btn action-btn--delete"
            @click="supprimer"
          >Supprimer</button>
        </div>

      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppNavbar from './AppNavbar.vue'
import BlocRenderer from './BlocRenderer.vue'
import { isLoggedIn, currentUser } from '../auth.js'
import { getProjet, deleteProjet } from '../api.js'

const route = useRoute()
const router = useRouter()

const projet = ref(null)
const loading = ref(true)
const error = ref('')

const isAuthor = computed(() =>
  isLoggedIn.value && projet.value && currentUser.value?.id === projet.value.auteur_id
)

onMounted(async () => {
  try {
    projet.value = await getProjet(route.params.token)
    if (projet.value?.doc_titre) {
      document.title = projet.value.doc_titre
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

async function supprimer() {
  if (!confirm('Supprimer ce projet ?')) return
  try {
    await deleteProjet(projet.value.token)
    router.push('/projets')
  } catch (e) {
    alert(e.message)
  }
}

function parseBlocs(contenu) {
  try {
    const parsed = JSON.parse(contenu)
    if (Array.isArray(parsed)) return parsed
  } catch {}
  return [{ type: 'texte', contenu }]
}

function formatDate(dt) {
  return new Date(dt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #090909;
}

.page-inner {
  max-width: 720px;
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
.projet-header {
  margin-bottom: 2rem;
}

.projet-titre {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.9rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.05em;
  margin: 0 0 0.7rem;
  line-height: 1.3;
}

.projet-info {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.95rem;
  color: rgba(255,255,255,0.25);
}

.projet-auteur {
  color: rgba(255,255,255,0.45);
  font-style: italic;
}

.projet-divider {
  height: 1px;
  background: rgba(255,255,255,0.07);
  margin-bottom: 2.5rem;
}

/* ── Footer ───────────────────────────────── */
.projet-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255,255,255,0.06);
  margin-top: 2.5rem;
}

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
.back-link-placeholder { flex: 1; }

.action-btn {
  background: none;
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.35rem 0.8rem;
  cursor: pointer;
  border: 1px solid;
  transition: all 0.12s;
}

.action-btn--delete { color: rgba(255,255,255,0.25); border-color: rgba(255,255,255,0.1); }
.action-btn--delete:hover { color: #8b1a1a; border-color: rgba(139,26,26,0.3); }

@media (max-width: 600px) {
  .page-inner { padding: 2rem 1.2rem 4rem; }
  .projet-titre { font-size: 1.4rem; }
  .projet-footer { flex-direction: column; align-items: flex-start; }
}
</style>

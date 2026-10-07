<template>
  <div class="act-page">
    <AppNavbar />

    <div v-if="loading" class="act-loading">Chargement…</div>

    <div v-else-if="erreur" class="act-erreur">
      <p class="act-erreur-titre">{{ erreur }}</p>
      <RouterLink to="/glace" class="act-back">← Retour</RouterLink>
    </div>

    <div v-else-if="activite" class="act-inner">

      <div class="act-nav">
        <RouterLink to="/glace" class="act-back">← La Glace</RouterLink>
      </div>

      <div class="act-header">
        <div class="act-header-meta">
          <span class="act-type-badge" :class="'act-type-badge--' + activite.type">{{ typeLabels[activite.type] || activite.type }}</span>
          <span v-if="activite.date_activite" class="act-date">{{ formatDate(activite.date_activite) }}</span>
        </div>
        <h1 class="act-titre">{{ activite.titre }}</h1>
        <div class="act-auteur">par {{ activite.auteur_nom || '?' }}</div>
      </div>

      <div v-if="parsedImages.length" class="act-gallery">
        <img v-for="(url, i) in parsedImages" :key="i" :src="SERVER_URL + url" class="act-image" :alt="activite.titre + ' ' + (i+1)" />
      </div>

      <div class="act-body">
        <div v-if="activite.nb_participants" class="act-info-row">
          <span class="act-info-label">Participants</span>
          <span class="act-info-val">{{ activite.nb_participants }}</span>
        </div>

        <div v-if="activite.participants" class="act-section">
          <h2 class="act-section-titre">Présents</h2>
          <ul class="act-participants-list">
            <li v-for="(p, i) in parsedParticipants" :key="i" class="act-participant">{{ p }}</li>
          </ul>
        </div>

        <div v-if="activite.description" class="act-section">
          <h2 class="act-section-titre">Compte-rendu</h2>
          <p class="act-description">{{ activite.description }}</p>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppNavbar from './AppNavbar.vue'
import { glaceGetActivite, SERVER_URL } from '../api.js'

const route   = useRoute()
const activite = ref(null)
const loading  = ref(true)
const erreur   = ref('')

const typeLabels = {
  entrainement: 'Entraînement',
  reunion:      'Réunion',
  mission:      'Mission',
  evenement:    'Événement',
  autre:        'Autre',
}

onMounted(async () => {
  try {
    activite.value = await glaceGetActivite(route.params.id)
  } catch (e) {
    erreur.value = e.message || 'Activité introuvable.'
  } finally {
    loading.value = false
  }
})

const parsedImages = computed(() => {
  if (!activite.value?.image_url) return []
  const raw = activite.value.image_url
  if (raw.startsWith('[')) { try { return JSON.parse(raw) } catch {} }
  return [raw]
})

const parsedParticipants = computed(() => {
  if (!activite.value?.participants) return []
  return activite.value.participants.split('\n').map(s => s.trim()).filter(Boolean)
})

function formatDate(d) {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  } catch { return d }
}
</script>

<style scoped>
.act-page {
  min-height: 100vh;
  background: #090909;
  color: #d4cfc9;
  font-family: 'Crimson Text', Georgia, serif;
}

.act-loading {
  display: flex; align-items: center; justify-content: center;
  height: 60vh; font-style: italic; color: rgba(255,255,255,0.25);
}

.act-erreur {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; height: 60vh; gap: 16px; text-align: center;
}
.act-erreur-titre {
  font-family: 'Cinzel', serif; font-size: 1rem;
  color: rgba(255,255,255,0.4); letter-spacing: 0.1em;
}

.act-inner {
  max-width: 740px;
  margin: 0 auto;
  padding: 32px 24px 80px;
}

.act-nav { margin-bottom: 32px; }

.act-back {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(127,179,200,0.6);
  text-decoration: none;
}
.act-back:hover { color: #a8d8ea; }

.act-header {
  padding-bottom: 28px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 36px;
}

.act-header-meta {
  display: flex; align-items: center; gap: 14px; margin-bottom: 16px;
}

.act-type-badge {
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  padding: 3px 10px;
  border: 1px solid rgba(127,179,200,0.3);
  color: #7fb3c8;
}
.act-type-badge--mission  { border-color: rgba(192,80,80,0.3); color: #c05050; }
.act-type-badge--evenement { border-color: rgba(201,168,76,0.3); color: #c9a84c; }
.act-type-badge--autre    { border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.4); }

.act-date {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.25);
}

.act-titre {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: clamp(1.3rem, 4vw, 1.9rem);
  font-weight: 400;
  letter-spacing: 0.05em;
  color: #e8e3dd;
  margin: 0 0 10px;
  line-height: 1.25;
}

.act-auteur {
  font-size: 0.95rem;
  font-style: italic;
  color: rgba(255,255,255,0.25);
}

.act-gallery {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 36px;
}

.act-image {
  width: 100%;
  max-height: 420px;
  object-fit: cover;
  display: block;
  border: 1px solid rgba(255,255,255,0.06);
}

.act-body { display: flex; flex-direction: column; gap: 32px; }

.act-info-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

.act-info-label {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.25);
  min-width: 100px;
}

.act-info-val {
  font-family: 'Cinzel', serif;
  font-size: 0.85rem;
  color: rgba(167,211,234,0.7);
}

.act-section {}

.act-section-titre {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.22);
  margin: 0 0 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

.act-participants-list {
  list-style: none;
  padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 6px;
}

.act-participant {
  font-size: 1.05rem;
  color: rgba(255,255,255,0.65);
  padding: 6px 0;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  display: flex; align-items: baseline; gap: 10px;
}
.act-participant::before {
  content: '—';
  color: rgba(127,179,200,0.4);
  flex-shrink: 0;
}

.act-description {
  font-size: 1.1rem;
  line-height: 1.7;
  color: rgba(255,255,255,0.75);
  white-space: pre-wrap;
  margin: 0;
}

@media (max-width: 600px) {
  .act-inner { padding: 24px 16px 60px; }
  .act-image { max-height: 240px; }
}
</style>

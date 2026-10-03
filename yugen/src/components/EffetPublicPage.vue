<template>
  <div class="effet-page">
    <div v-if="loading" class="effet-loading">Chargement…</div>
    <div v-else-if="erreur" class="effet-erreur">
      <p class="effet-erreur-titre">{{ erreur === 'Cet effet a expiré.' ? 'Effet expiré' : 'Introuvable' }}</p>
      <p class="effet-erreur-sub">{{ erreur }}</p>
    </div>
    <div v-else-if="effet" class="effet-inner">
      <div class="effet-avertissement">
        <p class="effet-avertissement-text">Si vous lisez ceci, c'est que vous êtes victime de cette potion — merci de prendre tout cela en compte dans votre jeu.</p>
      </div>

      <div class="effet-header">
        <div class="effet-header-meta">
          <span class="effet-type-badge">{{ typeLabel(effet.type) }}</span>
          <span v-if="effet.intensite" class="effet-intensite">
            <span v-for="n in 5" :key="n" class="effet-dot" :class="{ 'effet-dot--active': n <= effet.intensite }"></span>
          </span>
        </div>
        <h1 class="effet-titre">{{ effet.titre }}</h1>
        <p v-if="effet.sous_titre" class="effet-sous-titre">{{ effet.sous_titre }}</p>
        <p v-if="effet.duree" class="effet-duree">Durée estimée : {{ effet.duree }}</p>
      </div>

      <img v-if="effet.image_url" :src="SERVER_URL + effet.image_url" class="effet-image" :alt="effet.titre" />

      <div v-if="effet.contenu" class="effet-section">
        <h2 class="effet-section-titre">Ressenti</h2>
        <p class="effet-contenu">{{ effet.contenu }}</p>
      </div>

      <div v-if="parsedSymptomes.length" class="effet-section">
        <h2 class="effet-section-titre">Symptômes</h2>
        <ul class="effet-symptomes">
          <li v-for="(s, i) in parsedSymptomes" :key="i" class="effet-symptome">{{ s }}</li>
        </ul>
      </div>

      <div class="effet-footer">
        <span class="effet-footer-text">La Scientifique — Ordre Démoniaque</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { sciGetEffetPublic, SERVER_URL } from '../api.js'

const route   = useRoute()
const effet   = ref(null)
const loading = ref(true)
const erreur  = ref('')

onMounted(async () => {
  try {
    effet.value = await sciGetEffetPublic(route.params.token)
  } catch (e) {
    erreur.value = e.message
  } finally {
    loading.value = false
  }
})

const parsedSymptomes = computed(() => {
  if (!effet.value?.symptomes) return []
  return effet.value.symptomes.split('\n').map(s => s.trim()).filter(Boolean)
})

function typeLabel(t) {
  const map = { general: 'Effet', potion: 'Potion', experience: 'Expérience', poison: 'Poison' }
  return map[t] || t
}
</script>

<style scoped>
.effet-page {
  min-height: 100vh;
  background: #06080e;
  color: #d4cfc9;
  font-family: 'Crimson Text', Georgia, serif;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 0 0 80px;
}

.effet-loading, .effet-erreur {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 12px;
  text-align: center;
  padding: 40px;
}
.effet-erreur-titre { font-family: 'Cinzel', serif; font-size: 1.2rem; color: rgba(255,255,255,0.5); }
.effet-erreur-sub { font-size: 1rem; color: rgba(255,255,255,0.25); font-style: italic; }

.effet-inner { width: 100%; max-width: 680px; padding: 0 24px; }

.effet-header {
  padding: 56px 0 32px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 40px;
}

.effet-header-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.effet-type-badge {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(139,26,26,0.9);
  border: 1px solid rgba(139,26,26,0.35);
  padding: 3px 12px;
}

.effet-intensite { display: flex; gap: 4px; align-items: center; }
.effet-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.12); }
.effet-dot--active { background: #8b1a1a; }

.effet-titre {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: clamp(1.4rem, 4vw, 2rem);
  font-weight: 400;
  letter-spacing: 0.05em;
  color: #fff;
  margin: 0 0 10px;
  line-height: 1.25;
}

.effet-sous-titre {
  font-size: 1.15rem;
  color: rgba(255,255,255,0.45);
  font-style: italic;
  margin: 0 0 12px;
}

.effet-duree {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(201,168,76,0.6);
  margin: 0;
}

.effet-image {
  width: 100%;
  max-height: 400px;
  object-fit: cover;
  display: block;
  margin-bottom: 40px;
  border: 1px solid rgba(255,255,255,0.06);
}

.effet-section { margin-bottom: 40px; }

.effet-section-titre {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.25);
  margin: 0 0 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

.effet-contenu {
  font-size: 1.15rem;
  line-height: 1.7;
  color: rgba(255,255,255,0.82);
  white-space: pre-wrap;
  margin: 0;
}

.effet-symptomes {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.effet-symptome {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-size: 1.05rem;
  color: rgba(255,255,255,0.7);
  padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

.effet-symptome::before {
  content: '—';
  color: rgba(139,26,26,0.7);
  flex-shrink: 0;
}

.effet-avertissement {
  margin-top: 40px;
  padding: 16px 20px;
  border: 1px solid rgba(139,26,26,0.2);
  background: rgba(139,26,26,0.05);
  text-align: center;
}

.effet-avertissement-text {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  font-style: italic;
  color: rgba(255,255,255,0.35);
  margin: 0;
  line-height: 1.5;
}

.effet-footer {
  margin-top: 60px;
  padding-top: 24px;
  border-top: 1px solid rgba(255,255,255,0.04);
  text-align: center;
}

.effet-footer-text {
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.12);
}

@media (max-width: 600px) {
  .effet-page { padding: 0 0 60px; }
  .effet-inner { padding: 0 16px; }

  .effet-avertissement { margin-top: 24px; padding: 12px 14px; }
  .effet-avertissement-text { font-size: 0.95rem; }

  .effet-header { padding: 32px 0 24px; margin-bottom: 28px; }
  .effet-header-meta { gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }

  .effet-titre { font-size: clamp(1.2rem, 6vw, 1.6rem); }
  .effet-sous-titre { font-size: 1.05rem; }

  .effet-image { max-height: 220px; margin-bottom: 28px; }

  .effet-section { margin-bottom: 28px; }
  .effet-contenu { font-size: 1.05rem; }
  .effet-symptome { font-size: 1rem; padding: 6px 0; }

  .effet-footer { margin-top: 40px; }
}
</style>

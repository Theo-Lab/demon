<template>
  <div class="blocs">
    <div v-for="(bloc, i) in blocs" :key="i" class="bloc">

      <!-- Section -->
      <div v-if="bloc.type === 'section'" class="bloc-section">
        <h3 class="section-titre">{{ bloc.titre }}</h3>
        <p class="section-contenu">{{ bloc.contenu }}</p>
      </div>

      <!-- Texte -->
      <div v-else-if="bloc.type === 'texte'" class="bloc-texte">
        <p>{{ bloc.contenu }}</p>
      </div>

      <!-- Image -->
      <div v-else-if="bloc.type === 'image'" class="bloc-image">
        <img :src="`${mediaBase}${bloc.url}`" :alt="bloc.legende || ''" />
        <p v-if="bloc.legende" class="image-legende">{{ bloc.legende }}</p>
      </div>

    </div>
  </div>
</template>

<script setup>
import { MEDIA_BASE } from '../config.js'
defineProps({ blocs: Array })
const mediaBase = MEDIA_BASE
</script>

<style scoped>
.blocs {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* ── Section ──────────────────────────────── */
.bloc-section {
  border-left: 2px solid #8b1a1a;
  padding-left: 1.2rem;
}

.section-titre {
  font-family: 'Cinzel', serif;
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.6);
  margin: 0 0 0.7rem;
}

.section-contenu {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1.05rem;
  color: #d4cfc9;
  line-height: 1.8;
  white-space: pre-wrap;
  margin: 0;
}

/* ── Texte ────────────────────────────────── */
.bloc-texte p {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1.05rem;
  color: #d4cfc9;
  line-height: 1.8;
  white-space: pre-wrap;
  margin: 0;
}

/* ── Image ────────────────────────────────── */
.bloc-image {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.bloc-image img {
  width: 100%;
  max-height: 480px;
  object-fit: cover;
  display: block;
  border: 1px solid rgba(255,255,255,0.06);
}

.image-legende {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.88rem;
  color: rgba(255,255,255,0.25);
  text-align: center;
  margin: 0;
}
</style>

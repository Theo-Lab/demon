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
        <img
          :src="`${mediaBase}${bloc.url}`"
          :alt="bloc.legende || ''"
          @click="lightboxSrc = `${mediaBase}${bloc.url}`"
          class="clickable-img"
        />
        <p v-if="bloc.legende" class="image-legende">{{ bloc.legende }}</p>
      </div>

    </div>
  </div>

  <!-- Lightbox -->
  <Teleport to="body">
    <div v-if="lightboxSrc" class="lightbox" @click="lightboxSrc = null">
      <img :src="lightboxSrc" class="lightbox-img" @click.stop />
      <button class="lightbox-close" @click="lightboxSrc = null">✕</button>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'
import { MEDIA_BASE } from '../config.js'

defineProps({ blocs: Array })
const mediaBase = MEDIA_BASE
const lightboxSrc = ref(null)
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

.clickable-img {
  cursor: zoom-in;
  transition: opacity 0.15s;
}
.clickable-img:hover { opacity: 0.85; }

.image-legende {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.88rem;
  color: rgba(255,255,255,0.25);
  text-align: center;
  margin: 0;
}

/* ── Lightbox ─────────────────────────────── */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
}

.lightbox-img {
  max-width: 92vw;
  max-height: 90vh;
  object-fit: contain;
  border: 1px solid rgba(255,255,255,0.08);
  cursor: default;
}

.lightbox-close {
  position: absolute;
  top: 1.2rem;
  right: 1.5rem;
  background: none;
  border: none;
  color: rgba(255,255,255,0.4);
  font-size: 1.2rem;
  cursor: pointer;
  line-height: 1;
  transition: color 0.15s;
}
.lightbox-close:hover { color: #fff; }
</style>

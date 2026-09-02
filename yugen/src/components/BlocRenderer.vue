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
          @click="openLightbox(bloc.url)"
          class="clickable-img"
        />
        <p v-if="bloc.legende" class="image-legende">{{ bloc.legende }}</p>
      </div>

    </div>
  </div>

  <!-- Lightbox -->
  <Teleport to="body">
    <div v-if="lightboxIndex !== null" class="lightbox" @click="closeLightbox">

      <img
        :src="`${mediaBase}${images[lightboxIndex].url}`"
        :alt="images[lightboxIndex].legende || ''"
        class="lightbox-img"
        @click.stop
      />

      <p v-if="images[lightboxIndex].legende" class="lightbox-legende">
        {{ images[lightboxIndex].legende }}
      </p>

      <!-- Flèches -->
      <button v-if="images.length > 1" class="lightbox-arrow lightbox-arrow--left" @click.stop="prev">&#8592;</button>
      <button v-if="images.length > 1" class="lightbox-arrow lightbox-arrow--right" @click.stop="next">&#8594;</button>

      <!-- Compteur -->
      <span v-if="images.length > 1" class="lightbox-counter">{{ lightboxIndex + 1 }} / {{ images.length }}</span>

      <button class="lightbox-close" @click="closeLightbox">✕</button>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { MEDIA_BASE } from '../config.js'

const props = defineProps({ blocs: Array })
const mediaBase = MEDIA_BASE

const images = computed(() =>
  (props.blocs || []).filter(b => b.type === 'image')
)

const lightboxIndex = ref(null)

function openLightbox(url) {
  const idx = images.value.findIndex(b => b.url === url)
  lightboxIndex.value = idx !== -1 ? idx : 0
}

function closeLightbox() {
  lightboxIndex.value = null
}

function prev() {
  lightboxIndex.value = (lightboxIndex.value - 1 + images.value.length) % images.value.length
}

function next() {
  lightboxIndex.value = (lightboxIndex.value + 1) % images.value.length
}

function onKey(e) {
  if (lightboxIndex.value === null) return
  if (e.key === 'Escape') closeLightbox()
  if (e.key === 'ArrowLeft') prev()
  if (e.key === 'ArrowRight') next()
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
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
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
}

.lightbox-img {
  max-width: 88vw;
  max-height: 84vh;
  object-fit: contain;
  border: 1px solid rgba(255,255,255,0.08);
  cursor: default;
}

.lightbox-legende {
  position: absolute;
  bottom: 3.2rem;
  left: 50%;
  transform: translateX(-50%);
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.9rem;
  color: rgba(255,255,255,0.35);
  white-space: nowrap;
}

.lightbox-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.5);
  font-size: 1.4rem;
  width: 2.8rem;
  height: 2.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.lightbox-arrow:hover {
  background: rgba(255,255,255,0.1);
  color: #fff;
}
.lightbox-arrow--left  { left: 1.5rem; }
.lightbox-arrow--right { right: 1.5rem; }

.lightbox-counter {
  position: absolute;
  bottom: 1.2rem;
  left: 50%;
  transform: translateX(-50%);
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.15em;
  color: rgba(255,255,255,0.2);
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

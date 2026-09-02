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

      <!-- Image simple -->
      <div v-else-if="bloc.type === 'image'" class="bloc-image">
        <img
          :src="`${mediaBase}${bloc.url}`"
          :alt="bloc.legende || ''"
          @click="openLightbox(standaloneImages, bloc.url)"
          class="clickable-img"
        />
        <p v-if="bloc.legende" class="image-legende">{{ bloc.legende }}</p>
      </div>

      <!-- Album -->
      <div v-else-if="bloc.type === 'album' && bloc.images?.length" class="bloc-album">
        <p v-if="bloc.titre" class="album-titre">{{ bloc.titre }}</p>
        <div class="album-grid">
          <div
            v-for="(img, j) in bloc.images"
            :key="j"
            class="album-cell"
            @click="openLightbox(albumImages(bloc), img.url)"
          >
            <img :src="`${mediaBase}${img.url}`" :alt="img.legende || ''" />
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- Lightbox -->
  <Teleport to="body">
    <div v-if="lightboxIndex !== null" class="lightbox" @click="closeLightbox">

      <img
        :src="`${mediaBase}${lightboxImages[lightboxIndex].url}`"
        :alt="lightboxImages[lightboxIndex].legende || ''"
        class="lightbox-img"
        @click.stop
      />

      <p v-if="lightboxImages[lightboxIndex].legende" class="lightbox-legende">
        {{ lightboxImages[lightboxIndex].legende }}
      </p>

      <button v-if="lightboxImages.length > 1" class="lightbox-arrow lightbox-arrow--left" @click.stop="prev">&#8592;</button>
      <button v-if="lightboxImages.length > 1" class="lightbox-arrow lightbox-arrow--right" @click.stop="next">&#8594;</button>

      <span v-if="lightboxImages.length > 1" class="lightbox-counter">{{ lightboxIndex + 1 }} / {{ lightboxImages.length }}</span>

      <button class="lightbox-close" @click="closeLightbox">✕</button>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { MEDIA_BASE } from '../config.js'

const props = defineProps({ blocs: Array })
const mediaBase = MEDIA_BASE

const lightboxImages = ref([])
const lightboxIndex = ref(null)

const standaloneImages = computed(() =>
  (props.blocs || [])
    .filter(b => b.type === 'image')
    .map(b => ({ url: b.url, legende: b.legende || '' }))
)

function albumImages(bloc) {
  return (bloc.images || []).map(img => ({ url: img.url, legende: img.legende || '' }))
}

function openLightbox(images, startUrl) {
  lightboxImages.value = images
  const idx = images.findIndex(img => img.url === startUrl)
  lightboxIndex.value = idx !== -1 ? idx : 0
}

function closeLightbox() {
  lightboxIndex.value = null
  lightboxImages.value = []
}

function prev() {
  lightboxIndex.value = (lightboxIndex.value - 1 + lightboxImages.value.length) % lightboxImages.value.length
}

function next() {
  lightboxIndex.value = (lightboxIndex.value + 1) % lightboxImages.value.length
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

/* ── Image simple ─────────────────────────── */
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

/* ── Album ────────────────────────────────── */
.bloc-album {}

.album-titre {
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  margin: 0 0 0.75rem;
}

.album-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.album-cell {
  aspect-ratio: 1;
  overflow: hidden;
  cursor: zoom-in;
  border: 1px solid rgba(255,255,255,0.06);
}

.album-cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: opacity 0.15s, transform 0.2s;
}

.album-cell:hover img {
  opacity: 0.85;
  transform: scale(1.03);
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
.lightbox-arrow:hover { background: rgba(255,255,255,0.1); color: #fff; }
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

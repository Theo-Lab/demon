<template>
  <div class="page">

    <AppNavbar @open-login="emit('open-login')" />

    <div class="page-inner">
      <div class="page-inner-wrap">
      <article class="doc">

        <!-- En-tête -->
        <header class="doc-header">
          <p class="doc-label">Parchemin</p>
          <h1 class="doc-title">de l'ordre Démoniaque.</h1>
          <div class="doc-header-line"></div>
        </header>

        <!-- Navigation -->
        <nav class="doc-nav">
          <button
            v-for="(section, i) in sections"
            :key="section.id"
            class="nav-btn"
            :class="{ 'nav-btn--active': currentSection === section.id }"
            @click="currentSection = section.id"
          >
            {{ section.title }}
          </button>
        </nav>

        <!-- Contenu -->
        <div class="doc-content">

          <!-- Le Démon Originel -->
          <template v-if="currentSection === 'demon-originel'">
            <h2 class="section-title">Le Démon Originel</h2>

            <p class="text">
              Quoiqu'il advienne, le nom du Maître ne doit aucunement être divulgué, une
              prononciation équivaut à une mort certaine à cause de la malédiction qui est
              gravé dans le sang de tout être démoniaque. Le Maître est le démon le plus
              puissant qui puisse exister, il est celui qui a vécu le plus longtemps, qui
              représente la perfection même de ce monde. L'ultime seigneur de l'Ordre,
              l'être en qui le respect comme la grâce se doit d'être à son zénith.
            </p>

            <div class="tenets">
              <p class="tenet">Le Maître voit tout</p>
              <p class="tenet">Le Maître entend tout</p>
              <p class="tenet">Le Maître sait tout sur tout</p>
              <p class="tenet">Le Maître est omniprésent et omnipotent.</p>
            </div>

            <p class="text">
              L'existence des Démons a pour simple but d'assouvir les besoins du Maître,
              le Démon Originel. Chaque Démon est créé afin de réaliser les tâches que le
              Maître leur octroi. Tous choix pris par le Maître est incontestable, celui
              qui échoue à sa tâche devient alors un être inutile pour le Maître, par là,
              le seul sort accordé au cas défectueux est la mort.
            </p>
          </template>

          <!-- Juridiction -->
          <template v-else-if="currentSection === 'juridiction'">
            <h2 class="section-title">Juridiction Démoniaque</h2>

            <div class="sub-list">
              <div v-for="(sub, i) in juridictionSubs" :key="sub" class="sub-item">
                <span class="sub-index">{{ String(i + 1).padStart(2, '0') }}</span>
                <div>
                  <h3 class="sub-title">{{ sub }}</h3>
                  <p class="sub-pending">En cours de rédaction.</p>
                </div>
              </div>
            </div>
          </template>

          <!-- Placeholder -->
          <template v-else>
            <h2 class="section-title">{{ currentSectionObj?.title }}</h2>
            <p class="empty">En cours de rédaction.</p>
          </template>

        </div>


      </article>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import AppNavbar from './AppNavbar.vue'

const emit = defineEmits(['open-login'])

const currentSection = ref('demon-originel')

const sections = [
  { id: 'demon-originel', title: 'Le Démon Originel'          },
  { id: 'juridiction',    title: 'Juridiction Démoniaque'     },
  { id: 'connaissances',  title: 'Connaissances Essentielles' },
  { id: 'pouvoirs',       title: 'Pouvoirs Sanguinaires'      },
]

const juridictionSubs = ['Moralité', 'Règlement en Opération', 'Responsabilités Originelles', 'Respect']

const currentSectionObj = computed(() => sections.find(s => s.id === currentSection.value))
</script>

<style scoped>

/* ── Page ─────────────────────────────────── */
.page {
  min-height: 100vh;
  background: #090909;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.page-inner {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 3rem 1.5rem 5rem;
}

.page-inner-wrap {
  width: 100%;
  max-width: 1100px;
}

/* ── Document ─────────────────────────────── */
.doc {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.1);
}

/* ── En-tête ──────────────────────────────── */
.doc-header {
  padding: 3rem 4rem 0;
}

.doc-label {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.35em;
  color: #8b1a1a;
  text-transform: uppercase;
  margin-bottom: 0.6rem;
}

.doc-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 2rem;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.08em;
  margin: 0 0 1.8rem;
}

.doc-header-line {
  height: 1px;
  background: rgba(255,255,255,0.07);
}

/* ── Navigation ───────────────────────────── */
.doc-nav {
  display: flex;
  flex-wrap: wrap;
  padding: 0 4rem;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}

.nav-btn {
  font-family: 'Cinzel', serif;
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  color: rgba(255,255,255,0.3);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 1.1rem 1.6rem;
  cursor: pointer;
  transition: color 0.15s;
  margin-bottom: -1px;
  white-space: nowrap;
}

.nav-btn:first-child { padding-left: 0; }
.nav-btn:hover { color: rgba(255,255,255,0.65); }

.nav-btn--active {
  color: #fff;
  border-bottom-color: #8b1a1a;
}

/* ── Contenu ──────────────────────────────── */
.doc-content {
  padding: 3rem 4rem;
  min-height: 420px;
}

.section-title {
  font-family: 'Cinzel', serif;
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255,255,255,0.55);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-bottom: 1.6rem;
}

.text {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1.08rem;
  line-height: 1.9;
  color: #d4cfc9;
  margin-bottom: 1.4rem;
}

/* Bloc des vérités */
.tenets {
  border-left: 2px solid #8b1a1a;
  padding: 0.8rem 1.4rem;
  margin: 0.2rem 0 1.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.tenet {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 1.02rem;
  color: #c8c0b8;
  line-height: 1.6;
}

/* ── Sous-sections ────────────────────────── */
.sub-list {
  display: flex;
  flex-direction: column;
}

.sub-item {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
  padding: 1.2rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.sub-item:last-child { border-bottom: none; }

.sub-index {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  color: #8b1a1a;
  letter-spacing: 0.05em;
  padding-top: 0.15rem;
  flex-shrink: 0;
  width: 24px;
}

.sub-title {
  font-family: 'Cinzel', serif;
  font-size: 0.78rem;
  color: #fff;
  letter-spacing: 0.07em;
  margin-bottom: 0.35rem;
  font-weight: 600;
}

.sub-pending {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.95rem;
  color: rgba(255,255,255,0.4);
}

/* ── Vide ─────────────────────────────────── */
.empty {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  color: rgba(255,255,255,0.4);
  font-size: 1rem;
  margin-top: 1rem;
}

/* ── Pied ─────────────────────────────────── */
.doc-footer {
  padding: 1rem 4rem;
  border-top: 1px solid rgba(255,255,255,0.05);
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.2em;
  color: rgba(255,255,255,0.2);
  text-transform: uppercase;
  display: flex;
  gap: 0.8rem;
  align-items: center;
}

.footer-sep { color: #8b1a1a; }

/* ── Responsive ───────────────────────────── */
@media (max-width: 640px) {
  .page { padding: 0; }

  .doc { border-left: none; border-right: none; }

  .doc-header { padding: 1.8rem 1.4rem 0; }

  .doc-title { font-size: 1.4rem; }

  .doc-nav { padding: 0 1.4rem; }

  .nav-btn { font-size: 0.58rem; padding: 0.8rem 0.7rem; }
  .nav-btn:first-child { padding-left: 0; }

  .doc-content { padding: 1.8rem 1.4rem; }

  .doc-footer { padding: 1rem 1.4rem; flex-wrap: wrap; gap: 0.5rem; }
}
</style>

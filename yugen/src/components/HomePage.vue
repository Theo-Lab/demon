<template>
  <div class="page">
    <AppNavbar />

    <div class="page-inner">

      <!-- Hero -->
      <div class="hero">
        <p class="hero-label">Ordre Démoniaque</p>
        <h1 class="hero-title">Bienvenue.</h1>
        <p class="hero-sub">Accédez aux différentes sections de l'Ordre depuis ce portail.</p>
      </div>

      <!-- Grille de navigation -->
      <div class="grid">

        <RouterLink to="/parchemin" class="card">
          <h2 class="card-title">Parchemin de l'Ordre</h2>
          <p class="card-desc">Textes fondateurs, juridiction et connaissances essentielles de l'Ordre Démoniaque.</p>
          <span class="card-link">Consulter →</span>
        </RouterLink>

        <RouterLink to="/rapports" class="card">
          <h2 class="card-title">Rapports</h2>
          <p class="card-desc">Soumettre et consulter les rapports de mission, journaliers et de sphère.</p>
          <span class="card-link">Consulter →</span>
        </RouterLink>

        <RouterLink to="/spheres" class="card">
          <h2 class="card-title">Sphères</h2>
          <p class="card-desc">Gestion des sphères, de leurs membres et de leurs grades internes.</p>
          <span class="card-link">Consulter →</span>
        </RouterLink>

        <div class="card card--soon">
          <h2 class="card-title">Pouvoirs Sanguinaires</h2>
          <p class="card-desc">Répertoire des pouvoirs du sang, de leurs membres et hiérarchies.</p>
          <span class="card-badge">Bientôt</span>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import AppNavbar from './AppNavbar.vue'
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #090909;
}

.page-inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 4rem 2rem 6rem;
}

/* ── Hero ─────────────────────────────────── */
.hero {
  margin-bottom: 3.5rem;
}

.hero-label {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.35em;
  color: #8b1a1a;
  text-transform: uppercase;
  margin-bottom: 0.7rem;
}

.hero-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 2.8rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.06em;
  margin: 0 0 0.8rem;
}

.hero-sub {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1.1rem;
  color: rgba(255,255,255,0.4);
  line-height: 1.7;
}

/* ── Grille ───────────────────────────────── */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.06);
}

.card {
  background: #0f0f10;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  text-decoration: none;
  transition: background 0.15s;
  cursor: pointer;
}

.card:hover { background: #141416; }

.card--soon {
  cursor: default;
  opacity: 0.5;
}

.card--soon:hover { background: #0f0f10; }

.card-title {
  font-family: 'Cinzel', serif;
  font-size: 1.1rem;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.06em;
}

.card-desc {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.98rem;
  color: rgba(255,255,255,0.4);
  line-height: 1.65;
  flex: 1;
}

.card-link {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  color: #8b1a1a;
  text-transform: uppercase;
  margin-top: 0.4rem;
}

.card-badge {
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  color: rgba(255,255,255,0.2);
  text-transform: uppercase;
  margin-top: 0.4rem;
}

/* ── Responsive ───────────────────────────── */
@media (max-width: 640px) {
  .page-inner { padding: 2.5rem 1.2rem 4rem; }
  .hero-title { font-size: 1.9rem; }
  .grid { grid-template-columns: 1fr; }
}
</style>

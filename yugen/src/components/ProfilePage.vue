<template>
  <div class="page">
    <AppNavbar />

    <div class="page-inner">

      <div class="profile-header">
        <div class="avatar">{{ currentUser?.nom?.[0] ?? '?' }}</div>
        <div class="profile-meta">
          <p class="profile-label">Profil</p>
          <h1 class="profile-name">{{ currentUser?.nom }}</h1>
          <p class="profile-grade">{{ currentUser?.grade || 'Aucun grade attribué' }}</p>
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
              <span class="info-value">{{ currentUser?.identifiant }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Rôle</span>
              <span class="info-value info-value--role">{{ currentUser?.role }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Grade</span>
              <span class="info-value">{{ currentUser?.grade || '—' }}</span>
            </div>
          </div>
        </section>

        <div class="sep"></div>

        <!-- Sphères -->
        <section class="section">
          <h2 class="section-title">Sphères</h2>
          <p class="empty-text">Aucune sphère assignée.</p>
        </section>

        <div class="sep"></div>

        <!-- Pouvoir du Sang -->
        <section class="section">
          <h2 class="section-title">Pouvoir Sanguinaire</h2>
          <p class="empty-text">Aucun pouvoir assigné.</p>
        </section>

      </div>

    </div>
  </div>
</template>

<script setup>
import AppNavbar from './AppNavbar.vue'
import { currentUser } from '../auth.js'
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
}
</style>

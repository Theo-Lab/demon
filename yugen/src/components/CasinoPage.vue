<template>
  <div class="page">
    <AppNavbar />

    <div class="page-inner">

      <div class="hero">
        <p class="hero-label">Ordre Démoniaque</p>
        <h1 class="hero-title">Casino</h1>
        <p class="hero-sub">Jouez vos Yens et tentez la fortune dans les jeux de l'Ordre.</p>
      </div>

      <div class="howto">
        <p class="howto-title">Comment jouer ?</p>
        <div class="steps">
          <div class="step">
            <span class="step-num">I</span>
            <div class="step-body">
              <span class="step-name">Créer un compte</span>
              <span class="step-desc">Rejoignez l'Ordre en vous inscrivant sur la plateforme.</span>
            </div>
          </div>
          <div class="step-arrow">→</div>
          <div class="step">
            <span class="step-num">II</span>
            <div class="step-body">
              <span class="step-name">Déposer des Yens</span>
              <span class="step-desc">Adressez-vous à un gestionnaire du site pour créditer votre solde.</span>
            </div>
          </div>
          <div class="step-arrow">→</div>
          <div class="step">
            <span class="step-num">III</span>
            <div class="step-body">
              <span class="step-name">Jouer</span>
              <span class="step-desc">Choisissez votre jeu et misez vos Yens.</span>
            </div>
          </div>
        </div>
      </div>

      <div class="grid">

        <RouterLink to="/slots" class="card">
          <div class="card-icon">🎰</div>
          <h2 class="card-title">Machine à Sous</h2>
          <p class="card-desc">Tirez les rouleaux et alignez les symboles sur la ligne de paiement centrale.</p>
          <span class="card-link">Jouer →</span>
        </RouterLink>

        <RouterLink to="/blackjack" class="card">
          <div class="card-icon">🃏</div>
          <h2 class="card-title">Blackjack</h2>
          <p class="card-desc">Approchez 21 sans le dépasser et défiez le croupier de l'Ordre.</p>
          <span class="card-link">Jouer →</span>
        </RouterLink>

        <RouterLink to="/roulette" class="card">
          <div class="card-icon">🎲</div>
          <h2 class="card-title">Roulette</h2>
          <p class="card-desc">Misez sur les cases et laissez la roue décider de votre sort.</p>
          <span class="card-link">Jouer →</span>
        </RouterLink>

      </div>
    </div>
  </div>
</template>

<script setup>
import AppNavbar from './AppNavbar.vue'
</script>

<style scoped>
.page { min-height: 100vh; background: #090909; }

.page-inner {
  max-width: 900px;
  margin: 0 auto;
  padding: 4rem 2rem 6rem;
}

.hero { margin-bottom: 3rem; }

.hero-label {
  font-family: 'Cinzel', serif;
  font-size: 0.68rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.25);
  margin: 0 0 10px;
}

.hero-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 2.2rem;
  font-weight: 400;
  margin: 0 0 12px;
  letter-spacing: 0.06em;
  color: #fff;
}

.hero-sub {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1.1rem;
  font-style: italic;
  color: rgba(255,255,255,0.35);
  margin: 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #141416;
  border: 1px solid rgba(255,255,255,0.06);
  padding: 28px 24px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s, background 0.15s;
}

.card:hover {
  border-color: rgba(139,26,26,0.35);
  background: #161618;
}

.card--soon { opacity: 0.45; cursor: default; }
.card--soon:hover { border-color: rgba(255,255,255,0.06); background: #141416; }

.card-icon {
  font-size: 1.6rem;
  line-height: 1;
  margin-bottom: 4px;
}

.card-icon--dim { filter: grayscale(1); opacity: 0.5; }

.card-title {
  font-family: 'Cinzel', serif;
  font-size: 0.88rem;
  font-weight: 400;
  letter-spacing: 0.08em;
  color: #d4cfc9;
  margin: 0;
}

.card-desc {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.98rem;
  font-style: italic;
  color: rgba(255,255,255,0.3);
  margin: 0;
  line-height: 1.5;
  flex: 1;
}

.card-link {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #8b1a1a;
  margin-top: 4px;
}

.card-badge {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.1);
  padding: 3px 8px;
  align-self: flex-start;
}

/* ── Comment jouer ───────────────────────────────── */

.howto {
  margin-bottom: 3rem;
  padding: 24px 28px;
  background: #0e0e10;
  border: 1px solid rgba(255,255,255,0.05);
}

.howto-title {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.22);
  margin: 0 0 20px;
}

.steps {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.step {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex: 1;
  min-width: 160px;
}

.step-num {
  font-family: 'Cinzel', serif;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  color: #8b1a1a;
  flex-shrink: 0;
  padding-top: 2px;
}

.step-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.step-name {
  font-family: 'Cinzel', serif;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  color: #d4cfc9;
}

.step-desc {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.92rem;
  font-style: italic;
  color: rgba(255,255,255,0.28);
  line-height: 1.4;
}

.step-arrow {
  font-family: 'Cinzel', serif;
  color: rgba(255,255,255,0.12);
  font-size: 0.9rem;
  flex-shrink: 0;
  align-self: center;
}

@media (max-width: 640px) {
  .grid  { grid-template-columns: 1fr; }
  .steps { flex-direction: column; gap: 16px; }
  .step-arrow { display: none; }
}
</style>

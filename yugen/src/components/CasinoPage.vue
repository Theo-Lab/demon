<template>
  <div class="page">
    <AppNavbar />

    <!-- ── Hero ──────────────────────────────────────────────────────────── -->
    <section class="hero">

      <div class="hero-bg"></div>

      <div class="hero-inner">

        <div class="hero-top">
          <p class="hero-eyebrow">Casino de l'Ordre</p>
        </div>

        <!-- Image centrale -->
        <div class="hero-figure">
          <div class="hero-glow"></div>
          <img :src="croupierImg" alt="Le Croupier Démoniaque" class="hero-img" />
          <div class="hero-shadow"></div>
        </div>

        <!-- Texte bas du hero -->
        <div class="hero-bottom">
          <h1 class="hero-title">Le Croupier<br>vous attend</h1>
          <p class="hero-sub">Misez vos Yens. Tentez la fortune.<br>L'Ordre ne pardonne pas les imprudents.</p>
          <div class="hero-cta">
            <RouterLink to="/slots"      class="cta-btn cta-btn--primary">Jouer</RouterLink>
            <RouterLink to="/blackjack"  class="cta-btn cta-btn--ghost">Blackjack</RouterLink>
          </div>
        </div>

      </div>

      <!-- Ornement bas -->
      <div class="hero-ornament">
        <span class="orn-line"></span>
        <span class="orn-diamond"></span>
        <span class="orn-line"></span>
      </div>

    </section>

    <!-- ── Jeux ───────────────────────────────────────────────────────────── -->
    <section class="games-section">
      <div class="section-inner">

        <p class="section-label">Les jeux</p>

        <div class="games-grid">

          <RouterLink to="/slots" class="game-card">
            <div class="game-card-top">
              <span class="game-icon">🎰</span>
              <span class="game-tag">Disponible</span>
            </div>
            <h2 class="game-title">Machine à Sous</h2>
            <p class="game-desc">Alignez les symboles sur la ligne de paiement. Wilds, jackpots et combos vous attendent.</p>
            <span class="game-link">Jouer →</span>
          </RouterLink>

          <RouterLink to="/blackjack" class="game-card">
            <div class="game-card-top">
              <span class="game-icon">🃏</span>
              <span class="game-tag">Disponible</span>
            </div>
            <h2 class="game-title">Blackjack</h2>
            <p class="game-desc">Approchez 21 sans le dépasser. Défiez le croupier en solo ou à plusieurs autour d'une table.</p>
            <span class="game-link">Jouer →</span>
          </RouterLink>

          <RouterLink to="/roulette" class="game-card">
            <div class="game-card-top">
              <span class="game-icon">🎲</span>
              <span class="game-tag">Disponible</span>
            </div>
            <h2 class="game-title">Roulette</h2>
            <p class="game-desc">Rouge ou noir, plein ou douzaine — laissez la roue décider de votre fortune.</p>
            <span class="game-link">Jouer →</span>
          </RouterLink>

        </div>

      </div>
    </section>

    <!-- ── Comment jouer ─────────────────────────────────────────────────── -->
    <section class="howto-section">
      <div class="section-inner">

        <p class="section-label">Comment jouer</p>

        <div class="steps">
          <div class="step">
            <span class="step-num">I</span>
            <div class="step-body">
              <span class="step-name">Créer un compte</span>
              <span class="step-desc">Rejoignez l'Ordre en vous inscrivant sur la plateforme.</span>
            </div>
          </div>
          <div class="step-sep"></div>
          <div class="step">
            <span class="step-num">II</span>
            <div class="step-body">
              <span class="step-name">Déposer des Yens</span>
              <span class="step-desc">Adressez-vous à un gestionnaire du casino pour créditer votre solde.</span>
            </div>
          </div>
          <div class="step-sep"></div>
          <div class="step">
            <span class="step-num">III</span>
            <div class="step-body">
              <span class="step-name">Tenter la fortune</span>
              <span class="step-desc">Choisissez votre jeu, définissez votre mise et affrontez le Croupier.</span>
            </div>
          </div>
        </div>

      </div>
    </section>

  </div>
</template>

<script setup>
import AppNavbar from './AppNavbar.vue'
const croupierImg = '/croupier.png'
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #090909;
  color: #fff;
}

/* ── Hero ──────────────────────────────────────────────────────────────── */
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 60% 50% at 50% 60%, rgba(139,26,26,0.14) 0%, transparent 70%),
    radial-gradient(ellipse 80% 40% at 50% 100%, rgba(80,10,10,0.3) 0%, transparent 60%);
  pointer-events: none;
}

.hero-inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: 80px 24px 0;
}

.hero-top {
  margin-bottom: 32px;
  text-align: center;
}

.hero-eyebrow {
  font-family: 'Cinzel', serif;
  font-size: 0.68rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: rgba(200,80,80,0.55);
  margin: 0;
}

/* Image */
.hero-figure {
  position: relative;
  display: flex;
  justify-content: center;
  margin-bottom: 0;
}

.hero-glow {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 340px;
  height: 340px;
  background: radial-gradient(ellipse at center, rgba(139,26,26,0.28) 0%, transparent 70%);
  pointer-events: none;
  z-index: 0;
}

.hero-img {
  position: relative;
  z-index: 1;
  height: 520px;
  width: auto;
  object-fit: contain;
  filter: drop-shadow(0 0 40px rgba(139,26,26,0.35)) drop-shadow(0 30px 60px rgba(0,0,0,0.8));
  display: block;
}

.hero-shadow {
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 200px;
  height: 20px;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, transparent 70%);
  z-index: 0;
}

/* Texte bas */
.hero-bottom {
  text-align: center;
  padding: 36px 24px 64px;
}

.hero-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: clamp(1.8rem, 5vw, 3rem);
  font-weight: 400;
  line-height: 1.15;
  letter-spacing: 0.04em;
  color: #fff;
  margin: 0 0 16px;
}

.hero-sub {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1.15rem;
  font-style: italic;
  color: rgba(255,255,255,0.35);
  line-height: 1.7;
  margin: 0 0 32px;
}

.hero-cta {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.cta-btn {
  font-family: 'Cinzel', serif;
  font-size: 0.7rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  text-decoration: none;
  padding: 14px 36px;
  transition: all 0.15s;
}

.cta-btn--primary {
  background: #8b1a1a;
  color: #fff;
  border: 1px solid transparent;
}
.cta-btn--primary:hover { background: #a82020; }

.cta-btn--ghost {
  background: transparent;
  color: rgba(255,255,255,0.45);
  border: 1px solid rgba(255,255,255,0.1);
}
.cta-btn--ghost:hover { border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.75); }

/* Ornement */
.hero-ornament {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 0 48px;
}

.orn-line {
  display: block;
  width: 80px;
  height: 1px;
  background: rgba(255,255,255,0.08);
}

.orn-diamond {
  display: block;
  width: 6px;
  height: 6px;
  background: rgba(139,26,26,0.6);
  transform: rotate(45deg);
}

/* ── Sections communes ───────────────────────────────────────────────── */
.section-inner {
  max-width: 900px;
  margin: 0 auto;
  padding: 64px 24px;
}

.section-label {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.2);
  margin: 0 0 32px;
}

/* ── Jeux ────────────────────────────────────────────────────────────── */
.games-section {
  border-top: 1px solid rgba(255,255,255,0.05);
  background: #0a0a0b;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.04);
}

.game-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #0a0a0b;
  padding: 32px 28px;
  text-decoration: none;
  color: inherit;
  transition: background 0.15s;
}
.game-card:hover { background: #111113; }

.game-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.game-icon { font-size: 1.5rem; line-height: 1; }

.game-tag {
  font-family: 'Cinzel', serif;
  font-size: 0.5rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(139,26,26,0.7);
  border: 1px solid rgba(139,26,26,0.25);
  padding: 3px 8px;
}

.game-title {
  font-family: 'Cinzel', serif;
  font-size: 0.88rem;
  font-weight: 400;
  letter-spacing: 0.08em;
  color: #d4cfc9;
  margin: 0;
}

.game-desc {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.98rem;
  font-style: italic;
  color: rgba(255,255,255,0.28);
  margin: 0;
  line-height: 1.55;
  flex: 1;
}

.game-link {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #8b1a1a;
}

/* ── Comment jouer ───────────────────────────────────────────────────── */
.howto-section {
  border-top: 1px solid rgba(255,255,255,0.05);
}

.steps {
  display: flex;
  align-items: stretch;
  gap: 0;
}

.step {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 28px 24px;
  border: 1px solid rgba(255,255,255,0.05);
  background: #0d0d0e;
}

.step-sep {
  width: 1px;
  background: rgba(255,255,255,0.04);
  flex-shrink: 0;
}

.step-num {
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  color: rgba(139,26,26,0.6);
  flex-shrink: 0;
  padding-top: 3px;
}

.step-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.step-name {
  font-family: 'Cinzel', serif;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  color: #d4cfc9;
}

.step-desc {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.95rem;
  font-style: italic;
  color: rgba(255,255,255,0.28);
  line-height: 1.5;
}

/* ── Responsive ──────────────────────────────────────────────────────── */
@media (max-width: 680px) {
  .hero-img       { height: 360px; }
  .games-grid     { grid-template-columns: 1fr; }
  .steps          { flex-direction: column; }
  .step-sep       { width: 100%; height: 1px; }
}
</style>

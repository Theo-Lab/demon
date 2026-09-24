<template>
  <div class="page">
    <AppNavbar />

    <div class="landing">

      <!-- Fond -->
      <div class="bg-glow"></div>

      <!-- Label -->
      <p class="eyebrow">Casino de l'Ordre</p>

      <!-- Image centrale -->
      <div class="figure">
        <div class="figure-halo"></div>
        <img :src="croupierImg" alt="Le Croupier Démoniaque" class="figure-img" />
      </div>

      <!-- Titre -->
      <h1 class="title">Le Croupier vous attend</h1>
      <p class="subtitle">Misez vos Yens. Tentez la fortune.<br>L'Ordre ne pardonne pas les imprudents.</p>

      <!-- Jeux -->
      <div class="games">
        <RouterLink to="/slots" class="game-btn">
          <span class="game-btn-icon">🎰</span>
          <span class="game-btn-name">Machine à Sous</span>
          <span class="game-btn-arrow">→</span>
        </RouterLink>
        <RouterLink to="/blackjack" class="game-btn">
          <span class="game-btn-icon">🃏</span>
          <span class="game-btn-name">Blackjack</span>
          <span class="game-btn-arrow">→</span>
        </RouterLink>
        <RouterLink to="/roulette" class="game-btn">
          <span class="game-btn-icon">🎲</span>
          <span class="game-btn-name">Roulette</span>
          <span class="game-btn-arrow">→</span>
        </RouterLink>
      </div>

      <!-- Séparateur -->
      <div class="sep">
        <span class="sep-line"></span>
        <span class="sep-diamond"></span>
        <span class="sep-line"></span>
      </div>

      <!-- Comment jouer -->
      <div class="steps">
        <div class="step">
          <span class="step-num">I</span>
          <span class="step-name">Créer un compte</span>
          <span class="step-desc">Rejoignez l'Ordre en vous inscrivant.</span>
        </div>
        <span class="step-arrow">→</span>
        <div class="step">
          <span class="step-num">II</span>
          <span class="step-name">Déposer des Yens</span>
          <span class="step-desc">Adressez-vous à un gestionnaire pour créditer votre solde.</span>
        </div>
        <span class="step-arrow">→</span>
        <div class="step">
          <span class="step-num">III</span>
          <span class="step-name">Jouer</span>
          <span class="step-desc">Choisissez votre jeu et misez vos Yens.</span>
        </div>
      </div>

    </div>
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

.landing {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px 72px;
  overflow: hidden;
}

/* Fond */
.bg-glow {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 55% 45% at 50% 55%, rgba(139,26,26,0.13) 0%, transparent 70%),
    radial-gradient(ellipse 70% 35% at 50% 100%, rgba(80,10,10,0.25) 0%, transparent 60%);
  pointer-events: none;
}

/* Label */
.eyebrow {
  position: relative;
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: rgba(200,80,80,0.5);
  margin: 0 0 32px;
}

/* Image */
.figure {
  position: relative;
  display: flex;
  justify-content: center;
  margin-bottom: 8px;
}

.figure-halo {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 380px;
  height: 380px;
  background: radial-gradient(ellipse at center, rgba(139,26,26,0.22) 0%, transparent 68%);
  pointer-events: none;
}

.figure-img {
  position: relative;
  height: 480px;
  width: auto;
  object-fit: contain;
  filter: drop-shadow(0 0 32px rgba(139,26,26,0.3)) drop-shadow(0 24px 48px rgba(0,0,0,0.75));
  display: block;
}

/* Titre */
.title {
  position: relative;
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: clamp(1.6rem, 4vw, 2.4rem);
  font-weight: 400;
  letter-spacing: 0.05em;
  text-align: center;
  color: #fff;
  margin: 0 0 14px;
}

.subtitle {
  position: relative;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1.08rem;
  font-style: italic;
  color: rgba(255,255,255,0.3);
  text-align: center;
  line-height: 1.7;
  margin: 0 0 40px;
}

/* Jeux */
.games {
  position: relative;
  display: flex;
  gap: 8px;
  width: 100%;
  max-width: 640px;
  margin-bottom: 40px;
}

.game-btn {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  background: #111113;
  border: 1px solid rgba(255,255,255,0.06);
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s, background 0.15s;
}
.game-btn:hover {
  border-color: rgba(139,26,26,0.35);
  background: #161618;
}

.game-btn-icon { font-size: 1.1rem; line-height: 1; }

.game-btn-name {
  font-family: 'Cinzel', serif;
  font-size: 0.68rem;
  letter-spacing: 0.07em;
  color: #d4cfc9;
  flex: 1;
}

.game-btn-arrow {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  color: rgba(139,26,26,0.6);
}

/* Séparateur */
.sep {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 36px;
}

.sep-line {
  display: block;
  width: 64px;
  height: 1px;
  background: rgba(255,255,255,0.07);
}

.sep-diamond {
  display: block;
  width: 5px;
  height: 5px;
  background: rgba(139,26,26,0.5);
  transform: rotate(45deg);
}

/* Comment jouer */
.steps {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  width: 100%;
  max-width: 700px;
}

.step {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 20px 18px;
  border: 1px solid rgba(255,255,255,0.05);
  background: #0d0d0e;
}

.step-num {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: rgba(139,26,26,0.55);
}

.step-name {
  font-family: 'Cinzel', serif;
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  color: #d4cfc9;
}

.step-desc {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.92rem;
  font-style: italic;
  color: rgba(255,255,255,0.25);
  line-height: 1.5;
}

.step-arrow {
  font-family: 'Cinzel', serif;
  color: rgba(255,255,255,0.1);
  font-size: 0.85rem;
  flex-shrink: 0;
  padding-top: 28px;
}

/* Responsive */
@media (max-width: 600px) {
  .figure-img { height: 340px; }
  .games      { flex-direction: column; }
  .steps      { flex-direction: column; }
  .step-arrow { display: none; }
}
</style>

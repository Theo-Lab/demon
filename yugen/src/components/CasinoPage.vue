<template>
  <div class="page">
    <AppNavbar />

    <div class="landing">

      <div class="bg-radial"></div>

      <!-- En-tête -->
      <header class="header">
        <span class="header-line"></span>
        <p class="header-label">Casino de l'Ordre</p>
        <span class="header-line"></span>
      </header>

      <!-- Layout principal : gauche / image / droite -->
      <div class="main-layout">

        <!-- Colonne gauche -->
        <div class="col-left">
          <h1 class="title">Le Croupier<br>vous attend</h1>
          <p class="subtitle">Misez vos Yens. Tentez la fortune.<br>L'Ordre ne pardonne pas les imprudents.</p>

          <nav class="games-list">
            <RouterLink to="/slots" class="game-item">
              <div class="game-item-body">
                <span class="game-item-name">Machine à Sous</span>
                <span class="game-item-desc">Wilds, jackpots, combos</span>
              </div>
              <span class="game-item-cta">Jouer →</span>
            </RouterLink>
            <RouterLink to="/blackjack" class="game-item">
              <div class="game-item-body">
                <span class="game-item-name">Blackjack</span>
                <span class="game-item-desc">Solo ou table multijoueur</span>
              </div>
              <span class="game-item-cta">Jouer →</span>
            </RouterLink>
            <RouterLink to="/roulette" class="game-item">
              <div class="game-item-body">
                <span class="game-item-name">Roulette</span>
                <span class="game-item-desc">Rouge, noir, plein, douzaines</span>
              </div>
              <span class="game-item-cta">Jouer →</span>
            </RouterLink>
            <RouterLink to="/crossroad" class="game-item">
              <div class="game-item-body">
                <span class="game-item-name">Traversée Démoniaque</span>
                <span class="game-item-desc">Traversez les ruelles, encaissez avant d'être brûlé</span>
              </div>
              <span class="game-item-cta">Jouer →</span>
            </RouterLink>
            <RouterLink to="/mines" class="game-item">
              <div class="game-item-body">
                <span class="game-item-name">Champ Maudit</span>
                <span class="game-item-desc">Révélez les gemmes, évitez les mines</span>
              </div>
              <span class="game-item-cta">Jouer →</span>
            </RouterLink>
          </nav>
        </div>

        <!-- Image centrale -->
        <div class="col-center">
          <div class="figure">
            <div class="figure-halo"></div>
            <div class="figure-halo figure-halo--2"></div>
            <img :src="croupierImg" alt="Le Croupier Démoniaque" class="figure-img" />
          </div>
        </div>

        <!-- Colonne droite -->
        <div class="col-right">
          <p class="howto-label">Comment jouer</p>
          <div class="steps">
            <div class="step">
              <span class="step-num">I</span>
              <div class="step-body">
                <span class="step-name">Créer un compte</span>
                <span class="step-desc">Rejoignez l'Ordre en vous inscrivant sur la plateforme.</span>
              </div>
            </div>
            <div class="step-connector"></div>
            <div class="step">
              <span class="step-num">II</span>
              <div class="step-body">
                <span class="step-name">Déposer des Yens</span>
                <span class="step-desc">Adressez-vous à un gestionnaire pour créditer votre solde.</span>
              </div>
            </div>
            <div class="step-connector"></div>
            <div class="step">
              <span class="step-num">III</span>
              <div class="step-body">
                <span class="step-name">Tenter la fortune</span>
                <span class="step-desc">Choisissez votre jeu, misez et affrontez le Croupier.</span>
              </div>
            </div>
          </div>
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
  min-height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 32px 60px;
  overflow: hidden;
}

/* Fond */
.bg-radial {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 50% 60% at 50% 70%, rgba(139,26,26,0.12) 0%, transparent 65%),
    radial-gradient(ellipse 80% 30% at 50% 100%, rgba(60,5,5,0.4) 0%, transparent 55%);
  pointer-events: none;
}

/* En-tête */
.header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 48px;
  width: 100%;
  max-width: 1100px;
  justify-content: center;
}

.header-label {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: rgba(200,80,80,0.45);
  margin: 0;
  white-space: nowrap;
}

.header-line {
  flex: 1;
  max-width: 160px;
  height: 1px;
  background: rgba(255,255,255,0.06);
}

/* Layout principal */
.main-layout {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0 48px;
  width: 100%;
  max-width: 1100px;
  align-items: center;
}

/* ── Colonne gauche ── */
.col-left {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 24px;
  padding-right: 16px;
}

.title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: clamp(1.5rem, 2.5vw, 2.2rem);
  font-weight: 400;
  line-height: 1.2;
  letter-spacing: 0.04em;
  color: #fff;
  margin: 0;
}

.subtitle {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1.05rem;
  font-style: italic;
  color: rgba(255,255,255,0.28);
  line-height: 1.7;
  margin: 0;
}

.games-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 8px;
}

.game-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: #0f0f11;
  border: 1px solid rgba(255,255,255,0.05);
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s, background 0.15s;
}
.game-item:hover {
  border-color: rgba(139,26,26,0.3);
  background: #141416;
}


.game-item-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
}

.game-item-name {
  font-family: 'Cinzel', serif;
  font-size: 0.72rem;
  letter-spacing: 0.07em;
  color: #d4cfc9;
}

.game-item-desc {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.85rem;
  font-style: italic;
  color: rgba(255,255,255,0.22);
}

.game-item-cta {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(139,26,26,0.6);
  flex-shrink: 0;
}

/* ── Image centrale ── */
.col-center {
  display: flex;
  justify-content: center;
  align-items: flex-end;
}

.figure {
  position: relative;
  display: flex;
  justify-content: center;
}

.figure-halo {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 320px;
  height: 320px;
  background: radial-gradient(ellipse at center, rgba(139,26,26,0.2) 0%, transparent 65%);
  pointer-events: none;
  border-radius: 50%;
}

.figure-halo--2 {
  width: 480px;
  height: 480px;
  background: radial-gradient(ellipse at center, rgba(80,10,10,0.15) 0%, transparent 65%);
}

.figure-img {
  position: relative;
  height: 560px;
  width: auto;
  object-fit: contain;
  filter:
    drop-shadow(0 0 30px rgba(139,26,26,0.28))
    drop-shadow(0 20px 50px rgba(0,0,0,0.85));
  display: block;
}

/* ── Colonne droite ── */
.col-right {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 20px;
  padding-left: 16px;
}

.howto-label {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.18);
  margin: 0;
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.step {
  display: flex;
  gap: 14px;
  padding: 18px 0;
}

.step-connector {
  height: 1px;
  background: rgba(255,255,255,0.05);
  margin: 0;
}

.step-num {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: rgba(139,26,26,0.5);
  flex-shrink: 0;
  padding-top: 2px;
  min-width: 16px;
}

.step-body {
  display: flex;
  flex-direction: column;
  gap: 5px;
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
  color: rgba(255,255,255,0.22);
  line-height: 1.5;
}

/* ── Responsive ── */
@media (max-width: 860px) {
  .main-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
    gap: 32px 0;
  }

  .col-left  { padding-right: 0; text-align: center; align-items: center; }
  .col-right { padding-left: 0; }
  .figure-img { height: 380px; }

  .games-list { width: 100%; max-width: 440px; }
  .steps      { max-width: 440px; width: 100%; }
}
</style>

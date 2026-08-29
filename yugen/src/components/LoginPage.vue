<template>
  <div class="page">

    <div class="box">

      <div class="box-header">
        <p class="box-label">Ordre Démoniaque</p>
        <h1 class="box-title">Connexion</h1>
      </div>

      <div class="box-divider"></div>

      <form class="form" @submit.prevent="handleLogin">

        <div class="field">
          <label class="field-label">Identifiant</label>
          <input
            v-model="identifier"
            class="field-input"
            type="text"
            placeholder="Votre identifiant"
            autocomplete="username"
          />
        </div>

        <div class="field">
          <label class="field-label">Mot de passe</label>
          <input
            v-model="password"
            class="field-input"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
          />
        </div>

        <p v-if="error" class="error-msg">{{ error }}</p>

        <button class="submit-btn" type="submit">
          Se connecter
        </button>

      </form>

    </div>

  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { isLoggedIn } from '../auth.js'

const router = useRouter()
const identifier = ref('')
const password = ref('')
const error = ref('')

function handleLogin() {
  if (!identifier.value || !password.value) {
    error.value = 'Veuillez remplir tous les champs.'
    return
  }
  error.value = ''
  isLoggedIn.value = true
  router.push('/parchemin')
}
</script>

<style scoped>
/* ── Page ─────────────────────────────────── */
.page {
  min-height: 100vh;
  background: #090909;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem;
}

/* ── Box ──────────────────────────────────── */
.box {
  width: 100%;
  max-width: 420px;
  background: #141416;
  border: 1px solid rgba(255,255,255,0.08);
}

.box-header {
  padding: 2.5rem 2.5rem 0;
}

.box-label {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.35em;
  color: #8b1a1a;
  text-transform: uppercase;
  margin-bottom: 0.6rem;
}

.box-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.6rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.06em;
  margin: 0 0 1.8rem;
}

.box-divider {
  height: 1px;
  background: rgba(255,255,255,0.07);
}

/* ── Form ─────────────────────────────────── */
.form {
  padding: 2rem 2.5rem 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.field-label {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  color: rgba(255,255,255,0.4);
  text-transform: uppercase;
}

.field-input {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  color: #fff;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  padding: 0.65rem 0.9rem;
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
  box-sizing: border-box;
}

.field-input::placeholder {
  color: rgba(255,255,255,0.18);
}

.field-input:focus {
  border-color: rgba(139, 26, 26, 0.6);
}

.error-msg {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.92rem;
  color: #8b1a1a;
}

.submit-btn {
  margin-top: 0.4rem;
  background: #8b1a1a;
  border: none;
  color: #fff;
  font-family: 'Cinzel', serif;
  font-size: 0.68rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  padding: 0.85rem;
  cursor: pointer;
  transition: background 0.15s;
  width: 100%;
}

.submit-btn:hover {
  background: #a82020;
}
</style>

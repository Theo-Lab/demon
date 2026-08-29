<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal">

      <div class="modal-header">
        <p class="modal-label">Ordre Démoniaque</p>
        <h2 class="modal-title">{{ mode === 'login' ? 'Connexion' : 'Créer un compte' }}</h2>
      </div>

      <div class="modal-divider"></div>

      <form class="modal-form" @submit.prevent="handleSubmit">

        <div class="field">
          <label class="field-label">Identifiant</label>
          <input v-model="identifiant" class="field-input" type="text" placeholder="Votre identifiant" autocomplete="username" />
        </div>

        <div v-if="mode === 'register'" class="field">
          <label class="field-label">Nom</label>
          <input v-model="nom" class="field-input" type="text" placeholder="Votre nom" />
        </div>

        <div class="field">
          <label class="field-label">Mot de passe</label>
          <input v-model="mot_de_passe" class="field-input" type="password" placeholder="••••••••" autocomplete="current-password" />
        </div>

        <p v-if="error" class="error-msg">{{ error }}</p>

        <button class="submit-btn" type="submit" :disabled="loading">
          {{ loading ? '...' : (mode === 'login' ? 'Se connecter' : 'Créer le compte') }}
        </button>

      </form>

      <div class="modal-footer">
        <span class="modal-toggle-text">
          {{ mode === 'login' ? 'Pas encore de compte ?' : 'Déjà un compte ?' }}
        </span>
        <button class="modal-toggle-btn" @click="switchMode">
          {{ mode === 'login' ? 'Créer un compte' : 'Se connecter' }}
        </button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { isLoggedIn, currentUser } from '../auth.js'
import { login, register } from '../api.js'

const emit = defineEmits(['close'])

const mode = ref('login')
const identifiant = ref('')
const nom = ref('')
const mot_de_passe = ref('')
const error = ref('')
const loading = ref(false)

function switchMode() {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  error.value = ''
}

async function handleSubmit() {
  if (!identifiant.value || !mot_de_passe.value || (mode.value === 'register' && !nom.value)) {
    error.value = 'Veuillez remplir tous les champs.'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const user = mode.value === 'login'
      ? await login(identifiant.value, mot_de_passe.value)
      : await register(identifiant.value, nom.value, mot_de_passe.value)

    currentUser.value = user
    isLoggedIn.value = true
    emit('close')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  width: 100%;
  max-width: 400px;
  background: #141416;
  border: 1px solid rgba(255,255,255,0.08);
  margin: 1.5rem;
}

.modal-header {
  padding: 2rem 2rem 0;
}

.modal-label {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.35em;
  color: #8b1a1a;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}

.modal-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.4rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.06em;
  margin: 0 0 1.5rem;
}

.modal-divider {
  height: 1px;
  background: rgba(255,255,255,0.07);
}

.modal-form {
  padding: 1.8rem 2rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field-label {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  color: rgba(255,255,255,0.35);
  text-transform: uppercase;
}

.field-input {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  color: #fff;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  padding: 0.6rem 0.85rem;
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
  box-sizing: border-box;
}

.field-input::placeholder { color: rgba(255,255,255,0.15); }
.field-input:focus { border-color: rgba(139,26,26,0.6); }

.error-msg {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.9rem;
  color: #8b1a1a;
}

.submit-btn {
  background: #8b1a1a;
  border: none;
  color: #fff;
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  padding: 0.8rem;
  cursor: pointer;
  transition: background 0.15s;
  width: 100%;
  margin-top: 0.2rem;
}

.submit-btn:hover:not(:disabled) { background: #a82020; }
.submit-btn:disabled { opacity: 0.5; cursor: default; }

.modal-footer {
  padding: 1rem 2rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-top: 1px solid rgba(255,255,255,0.05);
}

.modal-toggle-text {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.92rem;
  color: rgba(255,255,255,0.3);
}

.modal-toggle-btn {
  background: none;
  border: none;
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  color: #8b1a1a;
  cursor: pointer;
  text-transform: uppercase;
  padding: 0;
  transition: color 0.15s;
}

.modal-toggle-btn:hover { color: #c02020; }
</style>

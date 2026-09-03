<template>
  <div class="page">
    <div class="page-inner">

      <div v-if="loading" class="state-msg">Chargement...</div>
      <div v-else-if="error" class="state-msg state-msg--error">{{ error }}</div>

      <template v-else>

        <div class="rapport-header">
          <div class="rapport-meta">
            <span class="rapport-type" :class="`rapport-type--${rapport.type}`">{{ typeLabel(rapport.type) }}</span>
            <span class="rapport-statut" :class="`rapport-statut--${rapport.statut}`">{{ statutLabel(rapport.statut) }}</span>
          </div>
          <h1 class="rapport-titre">{{ rapport.titre }}</h1>
          <p class="rapport-info">
            Par <span class="rapport-auteur">{{ rapport.auteur_nom }}</span>
            · {{ formatDate(rapport.created_at) }}
          </p>
          <p v-if="rapport.auteur_grade" class="rapport-auteur-grade">{{ rapport.auteur_grade }}</p>
          <p v-if="rapport.auteur_pouvoir" class="rapport-auteur-pouvoir">{{ rapport.auteur_pouvoir }}</p>
          <p v-if="rapport.auteur_spheres" class="rapport-auteur-spheres">{{ rapport.auteur_spheres }}</p>
        </div>

        <div class="rapport-divider"></div>

        <BlocRenderer :blocs="parseBlocs(rapport.contenu)" />

        <div v-if="rapport.auteur_signature" class="rapport-signature">
          <div class="signature-line"></div>
          <p class="signature-text">{{ rapport.auteur_signature }}</p>
        </div>

        <div class="rapport-footer">
          <div v-if="isLoggedIn" class="footer-actions">
            <template v-if="currentUser?.role === 'admin'">
              <button
                v-if="rapport.statut !== 'valide'"
                class="action-btn action-btn--valid"
                @click="changeStatut('valide')"
              >Valider</button>
              <button
                v-if="rapport.statut !== 'refuse'"
                class="action-btn action-btn--refuse"
                @click="changeStatut('refuse')"
              >Refuser</button>
            </template>
            <button
              v-if="currentUser?.id === rapport.auteur_id || currentUser?.role === 'admin'"
              class="action-btn action-btn--delete"
              @click="supprimer"
            >Supprimer</button>
          </div>
        </div>

      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BlocRenderer from './BlocRenderer.vue'
import { isLoggedIn, currentUser } from '../auth.js'
import { getRapport, updateStatutRapport, deleteRapport } from '../api.js'

const route = useRoute()
const router = useRouter()

const rapport = ref(null)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    rapport.value = await getRapport(route.params.token)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

async function changeStatut(statut) {
  try {
    await updateStatutRapport(rapport.value.token, statut)
    rapport.value.statut = statut
  } catch (e) {
    alert(e.message)
  }
}

async function supprimer() {
  try {
    await deleteRapport(rapport.value.token)
    router.push('/rapports')
  } catch (e) {
    alert(e.message)
  }
}

function typeLabel(type) {
  return { mission: 'Mission', journalier: 'Journalier', sphere: 'Sphère' }[type] ?? type
}

function statutLabel(s) {
  return { en_attente: 'En attente', valide: 'Validé', refuse: 'Refusé' }[s] ?? s
}

function parseBlocs(contenu) {
  try {
    const parsed = JSON.parse(contenu)
    if (Array.isArray(parsed)) return parsed
  } catch {}
  return [{ type: 'texte', contenu }]
}

function formatDate(dt) {
  return new Date(dt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #090909;
}

.page-inner {
  max-width: 720px;
  margin: 0 auto;
  padding: 3.5rem 2rem 6rem;
}

.state-msg {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  color: rgba(255,255,255,0.2);
  font-size: 0.98rem;
  padding: 2rem 0;
}
.state-msg--error { color: #8b1a1a; }

/* ── Header ───────────────────────────────── */
.rapport-header {
  margin-bottom: 2rem;
}

.rapport-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.rapport-type {
  font-family: 'Cinzel', serif;
  font-size: 0.52rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.2rem 0.5rem;
  border: 1px solid;
}

.rapport-type--mission    { color: #8b1a1a; border-color: rgba(139,26,26,0.3); }
.rapport-type--journalier { color: rgba(255,255,255,0.4); border-color: rgba(255,255,255,0.12); }
.rapport-type--sphere     { color: #6a7fa0; border-color: rgba(106,127,160,0.3); }

.rapport-statut {
  font-family: 'Cinzel', serif;
  font-size: 0.5rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.rapport-statut--en_attente { color: rgba(255,255,255,0.25); }
.rapport-statut--valide     { color: #3a7a3a; }
.rapport-statut--refuse     { color: #8b1a1a; }

.rapport-titre {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.9rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.05em;
  margin: 0 0 0.7rem;
  line-height: 1.3;
}

.rapport-info {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.95rem;
  color: rgba(255,255,255,0.25);
}

.rapport-auteur {
  color: rgba(255,255,255,0.45);
  font-style: italic;
}

.rapport-auteur-grade {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.88rem;
  color: rgba(139,26,26,0.85);
  margin-top: 0.3rem;
}

.rapport-auteur-pouvoir {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.85rem;
  color: rgba(106,127,160,0.8);
  margin-top: 0.15rem;
}

.rapport-auteur-spheres {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.8rem;
  color: rgba(255,255,255,0.2);
  margin-top: 0.15rem;
}

.rapport-divider {
  height: 1px;
  background: rgba(255,255,255,0.07);
  margin-bottom: 2.5rem;
}

/* ── Signature ────────────────────────────── */
.rapport-signature {
  margin: 2.5rem 0 1.5rem;
}

.signature-line {
  height: 1px;
  background: rgba(255,255,255,0.06);
  margin-bottom: 1rem;
}

.signature-text {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.95rem;
  color: rgba(255,255,255,0.3);
  white-space: pre-wrap;
  line-height: 1.6;
}

/* ── Footer ───────────────────────────────── */
.rapport-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.back-link {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.25);
  text-decoration: none;
  text-transform: uppercase;
  transition: color 0.15s;
}
.back-link:hover { color: rgba(255,255,255,0.5); }

.footer-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  background: none;
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.35rem 0.8rem;
  cursor: pointer;
  border: 1px solid;
  transition: all 0.12s;
}

.action-btn--valid  { color: #3a7a3a; border-color: rgba(58,122,58,0.3); }
.action-btn--valid:hover  { background: rgba(58,122,58,0.1); }
.action-btn--refuse { color: #8b1a1a; border-color: rgba(139,26,26,0.3); }
.action-btn--refuse:hover { background: rgba(139,26,26,0.1); }
.action-btn--delete { color: rgba(255,255,255,0.25); border-color: rgba(255,255,255,0.1); }
.action-btn--delete:hover { color: #8b1a1a; border-color: rgba(139,26,26,0.3); }

@media (max-width: 600px) {
  .page-inner { padding: 2rem 1.2rem 4rem; }
  .rapport-titre { font-size: 1.4rem; }
  .rapport-footer { flex-direction: column; align-items: flex-start; }
}
</style>

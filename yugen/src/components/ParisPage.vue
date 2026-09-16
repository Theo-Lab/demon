<template>
  <div class="page">
    <AppNavbar />

    <div class="page-inner">

      <div class="page-header">
        <div>
          <p class="page-label">Ordre Démoniaque</p>
          <h1 class="page-title">Paris</h1>
        </div>
        <button v-if="isAdmin" class="btn-new" @click="toggleFormCreation">
          {{ showFormCreation ? 'Annuler' : 'Nouveau pari' }}
        </button>
      </div>

      <div class="page-divider"></div>

      <!-- Onglets -->
      <div class="onglets">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="['onglet', ongletActif === tab.key ? 'onglet--actif' : '']"
          @click="ongletActif = tab.key"
        >
          {{ tab.label }}
          <span v-if="tab.count !== undefined" class="onglet-count">{{ tab.count }}</span>
        </button>
      </div>

      <!-- Barre de recherche + tris (masqués sur Stats) -->
      <template v-if="ongletActif !== 'stats'">
        <div class="search-bar">
          <span class="search-icon">⌕</span>
          <input v-model="recherche" class="search-input" type="text" placeholder="Rechercher un pari, un joueur…" />
          <button v-if="recherche" class="search-clear" @click="recherche = ''">×</button>
        </div>

        <div class="tris">
          <button
            v-for="t in trisDisponibles" :key="t.key"
            :class="['tri-btn', triActif === t.key ? 'tri-btn--actif' : '']"
            @click="triActif = t.key"
          >{{ t.label }}</button>
        </div>
      </template>

      <!-- Panneau Stats -->
      <div v-if="ongletActif === 'stats'" class="stats-panel">

        <div class="stats-grid">
          <div class="stat-card">
            <p class="stat-label">En jeu (paris ouverts)</p>
            <p class="stat-value">{{ stats.enJeu.toLocaleString() }} ¥</p>
          </div>
          <div class="stat-card">
            <p class="stat-label">Total distribué (gains)</p>
            <p class="stat-value">{{ stats.totalDistribue.toLocaleString() }} ¥</p>
          </div>
          <div class="stat-card">
            <p class="stat-label">Total misé (tous paris)</p>
            <p class="stat-value">{{ stats.totalMise.toLocaleString() }} ¥</p>
          </div>
          <div class="stat-card">
            <p class="stat-label">Paris ouverts</p>
            <p class="stat-value">{{ stats.nbOuverts }}</p>
          </div>
          <div class="stat-card">
            <p class="stat-label">Paris résolus</p>
            <p class="stat-value">{{ stats.nbResolus }}</p>
          </div>
          <div class="stat-card">
            <p class="stat-label">Nombre de mises total</p>
            <p class="stat-value">{{ stats.nbMises }}</p>
          </div>
        </div>

        <div v-if="stats.topJoueurs.length" class="stats-section">
          <p class="stats-section-titre">Joueurs les plus actifs</p>
          <div class="stats-list">
            <div v-for="(j, i) in stats.topJoueurs" :key="j.nom" class="stats-row">
              <span class="stats-rank">#{{ i + 1 }}</span>
              <span class="stats-nom">{{ j.nom }}</span>
              <span class="stats-detail">{{ j.nbMises }} mise{{ j.nbMises > 1 ? 's' : '' }}</span>
              <span class="stats-montant">{{ j.total.toLocaleString() }} ¥ misés</span>
            </div>
          </div>
        </div>

        <div v-if="stats.grossesMises.length" class="stats-section">
          <p class="stats-section-titre">Plus grosses mises</p>
          <div class="stats-list">
            <div v-for="(m, i) in stats.grossesMises" :key="i" class="stats-row">
              <span class="stats-rank">#{{ i + 1 }}</span>
              <span class="stats-nom">{{ m.joueur_nom }}</span>
              <span class="stats-detail">{{ m.issue_label }} (×{{ m.cote }})</span>
              <span class="stats-montant">{{ m.montant.toLocaleString() }} ¥</span>
            </div>
          </div>
        </div>

      </div>

      <!-- Formulaire création -->
      <div v-if="showFormCreation && ongletActif !== 'stats'" class="form-card">
        <h2 class="form-title">Nouveau pari</h2>

        <div class="form-row">
          <div class="field field--grow">
            <label class="field-label">Titre</label>
            <input v-model="formCreation.titre" class="field-input" type="text" placeholder="Ex : Combat de la Lune Supérieure 3" />
          </div>
        </div>

        <div class="field">
          <label class="field-label">Description</label>
          <textarea v-model="formCreation.description" class="field-input field-textarea" placeholder="Contexte du pari…"></textarea>
        </div>

        <div class="issues-section">
          <div class="issues-header">
            <span class="field-label">Issues</span>
            <button class="btn-add-issue" @click="ajouterIssue">+ Ajouter une issue</button>
          </div>
          <div v-for="(issue, i) in formCreation.issues" :key="i" class="issue-row">
            <input v-model="issue.label" class="field-input issue-label" type="text" placeholder="Ex : Akaza gagne" />
            <div class="cote-field">
              <span class="cote-prefix">×</span>
              <input v-model="issue.cote" class="field-input issue-cote" type="number" step="0.1" min="1" placeholder="2.0" />
            </div>
            <button class="btn-remove-issue" @click="supprimerIssue(i)" :disabled="formCreation.issues.length <= 2">×</button>
          </div>
        </div>

        <div v-if="erreurCreation" class="form-erreur">{{ erreurCreation }}</div>

        <div class="form-actions">
          <button class="btn-submit" @click="soumettrePari" :disabled="loadingCreation">
            {{ loadingCreation ? 'Création…' : 'Créer le pari' }}
          </button>
        </div>
      </div>

      <!-- Liste des paris -->
      <template v-if="ongletActif !== 'stats'">
      <div v-if="loading" class="loading">Chargement…</div>
      <div v-else-if="parisFiltres.length === 0" class="vide">Aucun pari dans cette catégorie.</div>

      <div v-for="pari in parisFiltres" :key="pari.id" class="pari-card">

        <div class="pari-header">
          <div class="pari-meta">
            <span :class="['pari-statut', pari.statut === 'resolu' ? 'statut-resolu' : 'statut-ouvert']">
              {{ pari.statut === 'resolu' ? 'Résolu' : 'Ouvert' }}
            </span>
            <h2 class="pari-titre">{{ pari.titre }}</h2>
          </div>
          <button v-if="isAdmin" class="btn-supprimer" @click="supprimerPari(pari.id)" title="Supprimer">×</button>
        </div>

        <p v-if="pari.description" class="pari-description">{{ pari.description }}</p>

        <!-- Issues -->
        <div class="issues-list">
          <div
            v-for="issue in pari.issues"
            :key="issue.id"
            :class="['issue-item', pari.statut === 'resolu' && pari.issue_gagnante_id === issue.id ? 'issue-gagnante' : '']"
          >
            <span class="issue-label-text">{{ issue.label }}</span>
            <span class="issue-cote-badge">× {{ issue.cote }}</span>
            <span v-if="pari.statut === 'resolu' && pari.issue_gagnante_id === issue.id" class="issue-win-tag">GAGNANT</span>
          </div>
        </div>

        <!-- Mises -->
        <div v-if="pari.mises.length > 0" class="mises-section">
          <p class="mises-titre">Mises enregistrées</p>
          <div class="mises-list">
            <div v-for="mise in pari.mises" :key="mise.id" class="mise-row">
              <span class="mise-nom">{{ mise.joueur_nom }}</span>
              <span class="mise-issue">{{ mise.issue_label }}</span>
              <span class="mise-montant">{{ mise.montant }} ¥</span>
              <span class="mise-gain-potentiel">→ {{ Math.round(mise.montant * mise.cote) }} ¥</span>
              <button v-if="isAdmin && pari.statut === 'ouvert'" class="btn-remove-mise" @click="retirerMise(pari, mise.id)" title="Retirer">×</button>
            </div>
          </div>
        </div>

        <!-- Panel admin -->
        <div v-if="isAdmin && pari.statut === 'ouvert'" class="admin-panel">

          <!-- Ajouter une mise -->
          <div class="admin-section">
            <button class="btn-secondary" @click="toggleFormMise(pari.id)">
              {{ formMise.pariId === pari.id ? 'Annuler la mise' : '+ Ajouter une mise' }}
            </button>

            <div v-if="formMise.pariId === pari.id" class="form-mise">
              <div class="form-mise-row">
                <input v-model="formMise.user_nom" class="field-input" type="text" placeholder="Nom du joueur" />
                <select v-model="formMise.issue_id" class="field-input">
                  <option value="">Issue…</option>
                  <option v-for="issue in pari.issues" :key="issue.id" :value="issue.id">{{ issue.label }} (×{{ issue.cote }})</option>
                </select>
                <input v-model="formMise.montant" class="field-input mise-input" type="number" min="1" placeholder="Montant" />
                <button class="btn-submit" @click="soumettreMise(pari)" :disabled="loadingMise">OK</button>
              </div>
              <div v-if="erreurMise" class="form-erreur">{{ erreurMise }}</div>
            </div>
          </div>

          <!-- Résoudre -->
          <div class="admin-section">
            <button class="btn-secondary btn-resoudre" @click="toggleFormResolution(pari.id)">
              {{ formResolution.pariId === pari.id ? 'Annuler' : 'Résoudre le pari' }}
            </button>

            <div v-if="formResolution.pariId === pari.id" class="form-resolution">
              <select v-model="formResolution.issue_gagnante_id" class="field-input">
                <option value="">Issue gagnante…</option>
                <option v-for="issue in pari.issues" :key="issue.id" :value="issue.id">{{ issue.label }}</option>
              </select>
              <button class="btn-submit" @click="soumettrResolution(pari)" :disabled="loadingResolution">Confirmer</button>
              <div v-if="erreurResolution" class="form-erreur">{{ erreurResolution }}</div>
            </div>
          </div>

        </div>

      </div>
      </template>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import AppNavbar from './AppNavbar.vue'
import { currentUser } from '../auth.js'
import { getParis, createPari, deletePari, addMise, deleteMise, resoudrePari, getUsers } from '../api.js'

const isAdmin = computed(() => currentUser.value?.role === 'admin')

const ongletActif = ref('ouvert')
const recherche = ref('')
const triActif = ref('recent')

const trisDisponibles = [
  { key: 'recent',   label: 'Plus récent'  },
  { key: 'ancien',   label: 'Plus ancien'  },
  { key: 'gros',     label: 'Plus grosse mise' },
  { key: 'petit',    label: 'Plus petite mise' },
]

function totalMises(p) {
  return p.mises.reduce((s, m) => s + m.montant, 0)
}

function appliquerTri(liste) {
  return [...liste].sort((a, b) => {
    if (triActif.value === 'recent') return new Date(b.created_at) - new Date(a.created_at)
    if (triActif.value === 'ancien') return new Date(a.created_at) - new Date(b.created_at)
    if (triActif.value === 'gros')   return totalMises(b) - totalMises(a)
    if (triActif.value === 'petit')  return totalMises(a) - totalMises(b)
    return 0
  })
}

function matchRecherche(p) {
  const q = recherche.value.trim().toLowerCase()
  if (!q) return true
  return (
    p.titre.toLowerCase().includes(q) ||
    (p.description || '').toLowerCase().includes(q) ||
    p.mises.some(m => m.joueur_nom.toLowerCase().includes(q)) ||
    p.issues.some(i => i.label.toLowerCase().includes(q))
  )
}

const parisParStatut = computed(() =>
  ongletActif.value === 'tous' ? paris.value : paris.value.filter(p => p.statut === ongletActif.value)
)

const tabs = computed(() => [
  { key: 'ouvert', label: 'En cours', count: paris.value.filter(p => p.statut === 'ouvert' && matchRecherche(p)).length },
  { key: 'resolu', label: 'Résolus',  count: paris.value.filter(p => p.statut === 'resolu' && matchRecherche(p)).length },
  { key: 'tous',   label: 'Tous',     count: paris.value.filter(matchRecherche).length },
  { key: 'stats',  label: 'Stats' },
])

const stats = computed(() => {
  const tousLesMises = paris.value.flatMap(p => p.mises)
  const ouvertsMises = paris.value.filter(p => p.statut === 'ouvert').flatMap(p => p.mises)
  const resolus = paris.value.filter(p => p.statut === 'resolu')

  const enJeu = ouvertsMises.reduce((s, m) => s + m.montant, 0)
  const totalMise = tousLesMises.reduce((s, m) => s + m.montant, 0)

  let totalDistribue = 0
  for (const p of resolus) {
    const issueGagnante = p.issues.find(i => i.id === p.issue_gagnante_id)
    if (!issueGagnante) continue
    for (const m of p.mises.filter(m => m.issue_id === p.issue_gagnante_id)) {
      totalDistribue += Math.round(m.montant * issueGagnante.cote)
    }
  }

  // Top joueurs
  const parJoueur = {}
  for (const m of tousLesMises) {
    if (!parJoueur[m.joueur_nom]) parJoueur[m.joueur_nom] = { nom: m.joueur_nom, nbMises: 0, total: 0 }
    parJoueur[m.joueur_nom].nbMises++
    parJoueur[m.joueur_nom].total += m.montant
  }
  const topJoueurs = Object.values(parJoueur).sort((a, b) => b.total - a.total).slice(0, 5)

  const grossesMises = [...tousLesMises].sort((a, b) => b.montant - a.montant).slice(0, 5)

  return {
    enJeu,
    totalMise,
    totalDistribue,
    nbOuverts: paris.value.filter(p => p.statut === 'ouvert').length,
    nbResolus: resolus.length,
    nbMises: tousLesMises.length,
    topJoueurs,
    grossesMises,
  }
})

const parisFiltres = computed(() => appliquerTri(parisParStatut.value.filter(matchRecherche)))

const paris = ref([])
const users = ref([])
const loading = ref(true)

// Formulaire création
const showFormCreation = ref(false)
const loadingCreation = ref(false)
const erreurCreation = ref('')
const formCreation = ref({ titre: '', description: '', issues: [{ label: '', cote: '' }, { label: '', cote: '' }] })

// Formulaire mise
const formMise = ref({ pariId: null, user_nom: '', issue_id: '', montant: '' })
const loadingMise = ref(false)
const erreurMise = ref('')

// Formulaire résolution
const formResolution = ref({ pariId: null, issue_gagnante_id: '' })
const loadingResolution = ref(false)
const erreurResolution = ref('')

onMounted(async () => {
  try {
    paris.value = await getParis()
    try { users.value = await getUsers() } catch (e) { console.error('getUsers:', e) }
  } finally {
    loading.value = false
  }
})

function toggleFormCreation() {
  showFormCreation.value = !showFormCreation.value
  erreurCreation.value = ''
  formCreation.value = { titre: '', description: '', issues: [{ label: '', cote: '' }, { label: '', cote: '' }] }
}

function ajouterIssue() {
  formCreation.value.issues.push({ label: '', cote: '' })
}

function supprimerIssue(i) {
  formCreation.value.issues.splice(i, 1)
}

async function soumettrePari() {
  erreurCreation.value = ''
  try {
    loadingCreation.value = true
    const pari = await createPari(
      formCreation.value.titre,
      formCreation.value.description,
      formCreation.value.issues
    )
    paris.value.unshift(pari)
    showFormCreation.value = false
  } catch (e) {
    erreurCreation.value = e.message
  } finally {
    loadingCreation.value = false
  }
}

async function supprimerPari(id) {
  if (!confirm('Supprimer ce pari ?')) return
  await deletePari(id)
  paris.value = paris.value.filter(p => p.id !== id)
}

function toggleFormMise(pariId) {
  formMise.value = formMise.value.pariId === pariId
    ? { pariId: null, user_nom: '', issue_id: '', montant: '' }
    : { pariId, user_nom: '', issue_id: '', montant: '' }
  erreurMise.value = ''
}

async function soumettreMise(pari) {
  erreurMise.value = ''
  try {
    loadingMise.value = true
    const updated = await addMise(pari.id, formMise.value.user_nom, formMise.value.issue_id, parseInt(formMise.value.montant))
    const idx = paris.value.findIndex(p => p.id === pari.id)
    paris.value[idx] = updated
    formMise.value = { pariId: null, user_nom: '', issue_id: '', montant: '' }
    users.value = await getUsers()
  } catch (e) {
    erreurMise.value = e.message
  } finally {
    loadingMise.value = false
  }
}

async function retirerMise(pari, miseId) {
  const updated = await deleteMise(pari.id, miseId)
  const idx = paris.value.findIndex(p => p.id === pari.id)
  paris.value[idx] = updated
  users.value = await getUsers()
}

function toggleFormResolution(pariId) {
  formResolution.value = formResolution.value.pariId === pariId
    ? { pariId: null, issue_gagnante_id: '' }
    : { pariId, issue_gagnante_id: '' }
  erreurResolution.value = ''
}

async function soumettrResolution(pari) {
  erreurResolution.value = ''
  try {
    loadingResolution.value = true
    const updated = await resoudrePari(pari.id, formResolution.value.issue_gagnante_id)
    const idx = paris.value.findIndex(p => p.id === pari.id)
    paris.value[idx] = updated
    formResolution.value = { pariId: null, issue_gagnante_id: '' }
    users.value = await getUsers()
  } catch (e) {
    erreurResolution.value = e.message
  } finally {
    loadingResolution.value = false
  }
}
</script>

<style scoped>
.page { min-height: 100vh; background: #090909; color: #fff; }

.page-inner {
  max-width: 860px;
  margin: 0 auto;
  padding: 48px 24px 80px;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 24px;
}

.page-label {
  font-family: 'Cinzel', serif;
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
  margin: 0 0 6px;
}

.page-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.7rem;
  font-weight: 400;
  margin: 0;
  letter-spacing: 0.06em;
}

.page-divider {
  height: 1px;
  background: rgba(255,255,255,0.06);
  margin-bottom: 32px;
}

.btn-new {
  font-family: 'Cinzel', serif;
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  background: #8b1a1a;
  color: #fff;
  border: none;
  padding: 8px 18px;
  cursor: pointer;
}
.btn-new:hover { background: #a82020; }

/* Formulaire création */
.form-card {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.06);
  padding: 28px 28px 24px;
  margin-bottom: 32px;
}

.form-title {
  font-family: 'Cinzel', serif;
  font-size: 0.85rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.5);
  margin: 0 0 20px;
  font-weight: 400;
}

.form-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.field { display: flex; flex-direction: column; gap: 6px; }
.field--grow { flex: 1; }

.field-label {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
}

.field-input {
  background: #0f0f10;
  border: 1px solid rgba(255,255,255,0.08);
  color: #d4cfc9;
  padding: 8px 12px;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  outline: none;
}
.field-input:focus { border-color: rgba(139,26,26,0.5); }

.field-textarea {
  resize: vertical;
  min-height: 64px;
  width: 100%;
  box-sizing: border-box;
}

.field { margin-bottom: 16px; }

/* Issues formulaire */
.issues-section { margin-bottom: 20px; }

.issues-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.btn-add-issue {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.45);
  padding: 4px 10px;
  cursor: pointer;
}
.btn-add-issue:hover { border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.7); }

.issue-row {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 8px;
}

.issue-label { flex: 1; }

.cote-field {
  display: flex;
  align-items: center;
  background: #0f0f10;
  border: 1px solid rgba(255,255,255,0.08);
  width: 90px;
}
.cote-prefix {
  padding: 0 8px;
  color: rgba(255,255,255,0.3);
  font-family: 'Cinzel', serif;
  font-size: 0.8rem;
}
.issue-cote {
  border: none;
  width: 50px;
  padding: 8px 8px 8px 0;
}

.btn-remove-issue {
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.25);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 4px 8px;
  line-height: 1;
}
.btn-remove-issue:hover:not(:disabled) { color: #8b1a1a; }
.btn-remove-issue:disabled { opacity: 0.2; cursor: default; }

.form-erreur {
  color: #c05050;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.95rem;
  font-style: italic;
  margin-bottom: 12px;
}

.form-actions { display: flex; justify-content: flex-end; }

.btn-submit {
  font-family: 'Cinzel', serif;
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  background: #8b1a1a;
  color: #fff;
  border: none;
  padding: 8px 20px;
  cursor: pointer;
}
.btn-submit:hover:not(:disabled) { background: #a82020; }
.btn-submit:disabled { opacity: 0.5; cursor: default; }

/* Carte pari */
/* Barre de recherche */
.search-bar {
  display: flex;
  align-items: center;
  background: #141416;
  border: 1px solid rgba(255,255,255,0.07);
  margin-bottom: 20px;
  padding: 0 14px;
  gap: 10px;
}

.search-icon {
  color: rgba(255,255,255,0.2);
  font-size: 1.15rem;
  line-height: 1;
  user-select: none;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #d4cfc9;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  padding: 11px 0;
}
.search-input::placeholder { color: rgba(255,255,255,0.2); font-style: italic; }

.search-clear {
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.25);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
}
.search-clear:hover { color: rgba(255,255,255,0.6); }

/* Tris */
.tris {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.tri-btn {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.3);
  padding: 5px 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.tri-btn:hover { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.6); }
.tri-btn--actif {
  background: rgba(139,26,26,0.15);
  border-color: rgba(139,26,26,0.4);
  color: #c05050;
}

/* Onglets */
.onglets {
  display: flex;
  gap: 0;
  margin-bottom: 28px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.onglet {
  font-family: 'Cinzel', serif;
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: rgba(255,255,255,0.3);
  padding: 10px 20px 10px;
  cursor: pointer;
  margin-bottom: -1px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: color 0.15s;
}
.onglet:hover { color: rgba(255,255,255,0.6); }
.onglet--actif {
  color: #fff;
  border-bottom-color: #8b1a1a;
}

.onglet-count {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  background: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.4);
  padding: 1px 6px;
  border-radius: 2px;
}
.onglet--actif .onglet-count {
  background: rgba(139,26,26,0.25);
  color: #c05050;
}

/* Stats */
.stats-panel { display: flex; flex-direction: column; gap: 32px; }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.stat-card {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.06);
  padding: 20px 22px;
}

.stat-label {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.3);
  margin: 0 0 10px;
}

.stat-value {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.4rem;
  font-weight: 400;
  margin: 0;
  color: #fff;
}

.stats-section { }

.stats-section-titre {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.25);
  margin: 0 0 12px;
}

.stats-list { display: flex; flex-direction: column; gap: 6px; }

.stats-row {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #141416;
  border: 1px solid rgba(255,255,255,0.05);
  padding: 10px 16px;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  color: #d4cfc9;
}

.stats-rank {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  color: rgba(255,255,255,0.25);
  min-width: 24px;
}

.stats-nom { min-width: 120px; }
.stats-detail { flex: 1; font-style: italic; color: rgba(255,255,255,0.4); }
.stats-montant { color: rgba(255,255,255,0.7); font-weight: 600; }

.loading, .vide {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1.05rem;
  font-style: italic;
  color: rgba(255,255,255,0.3);
  padding: 40px 0;
  text-align: center;
}

.pari-card {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.06);
  padding: 24px 28px;
  margin-bottom: 20px;
}

.pari-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
}

.pari-meta { display: flex; align-items: baseline; gap: 12px; }

.pari-statut {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  padding: 3px 8px;
}
.statut-ouvert { background: rgba(58,122,58,0.2); color: #6aaa6a; border: 1px solid rgba(58,122,58,0.3); }
.statut-resolu { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.3); border: 1px solid rgba(255,255,255,0.08); }

.pari-titre {
  font-family: 'Cinzel', serif;
  font-size: 1rem;
  font-weight: 400;
  margin: 0;
  letter-spacing: 0.06em;
}

.btn-supprimer {
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.2);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.btn-supprimer:hover { color: #8b1a1a; }

.pari-description {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  font-style: italic;
  color: #d4cfc9;
  margin: 0 0 16px;
}

/* Issues liste */
.issues-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.issue-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  background: #0f0f10;
  border: 1px solid rgba(255,255,255,0.05);
}

.issue-gagnante {
  border-color: rgba(139,26,26,0.4);
  background: rgba(139,26,26,0.08);
}

.issue-label-text {
  flex: 1;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  color: #d4cfc9;
}

.issue-cote-badge {
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  color: rgba(255,255,255,0.4);
  letter-spacing: 0.06em;
}

.issue-win-tag {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #8b1a1a;
  border: 1px solid rgba(139,26,26,0.4);
  padding: 2px 7px;
}

/* Mises */
.mises-section {
  border-top: 1px solid rgba(255,255,255,0.05);
  padding-top: 14px;
  margin-bottom: 16px;
}

.mises-titre {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.25);
  margin: 0 0 10px;
}

.mises-list { display: flex; flex-direction: column; gap: 5px; }

.mise-row {
  display: flex;
  align-items: center;
  gap: 14px;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.95rem;
  color: #d4cfc9;
}

.mise-nom { min-width: 100px; }
.mise-issue { flex: 1; font-style: italic; color: rgba(255,255,255,0.45); }
.mise-montant { color: rgba(255,255,255,0.7); min-width: 70px; text-align: right; }
.mise-gain-potentiel { color: rgba(255,255,255,0.35); font-size: 0.88rem; min-width: 80px; }

.btn-remove-mise {
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.2);
  cursor: pointer;
  font-size: 1rem;
  padding: 0 4px;
}
.btn-remove-mise:hover { color: #8b1a1a; }

/* Panel admin */
.admin-panel {
  border-top: 1px solid rgba(255,255,255,0.05);
  padding-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.admin-section { display: flex; flex-direction: column; gap: 10px; }

.btn-secondary {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.45);
  padding: 6px 14px;
  cursor: pointer;
  align-self: flex-start;
}
.btn-secondary:hover { border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.7); }
.btn-resoudre:hover { border-color: rgba(139,26,26,0.4); color: #8b1a1a; }

.form-mise { display: flex; flex-direction: column; gap: 8px; }

.form-mise-row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.mise-input { width: 100px; }

.form-resolution {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
</style>

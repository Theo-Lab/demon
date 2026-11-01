<template>
  <AppNavbar />
  <div class="page">

    <!-- En-tête -->
    <div class="page-header">
      <div class="header-left">
        <div class="header-ornament"></div>
        <div>
          <h1 class="page-title">REGISTRE DES DÉMONS</h1>
          <p class="page-subtitle">Suivi et encadrement — Rangs Faible &amp; Fort</p>
        </div>
        <div class="header-ornament"></div>
      </div>
      <button v-if="isDirigeant" class="btn-primary" @click="showCreateDemon = true">+ Ajouter un démon</button>
    </div>

    <!-- Navigation onglets -->
    <div class="tabs-nav">
      <button v-for="tab in tabs" :key="tab.id"
        class="tab-btn" :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id">
        {{ tab.label }}
      </button>
    </div>

    <!-- ── Tableau de bord ───────────────────────────────────────────── -->
    <div v-if="activeTab === 'dashboard'" class="tab-content">
      <div v-if="loadingDashboard" class="loading">Chargement...</div>
      <template v-else-if="dashboard">

        <!-- Stats -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ dashboard.stats.total }}</div>
            <div class="stat-label">Démons enregistrés</div>
          </div>
          <div class="stat-card stat-card--faible">
            <div class="stat-value">{{ dashboard.stats.faibles }}</div>
            <div class="stat-label">Rang Faible</div>
          </div>
          <div class="stat-card stat-card--fort">
            <div class="stat-value">{{ dashboard.stats.forts }}</div>
            <div class="stat-label">Rang Fort</div>
          </div>
          <div class="stat-card stat-card--positive">
            <div class="stat-value">{{ dashboard.stats.positives }}</div>
            <div class="stat-label">Remarques positives</div>
          </div>
          <div class="stat-card stat-card--negative">
            <div class="stat-value">{{ dashboard.stats.negatives }}</div>
            <div class="stat-label">Remarques négatives</div>
          </div>
          <div class="stat-card stat-card--warning">
            <div class="stat-value">{{ dashboard.stats.a_suivre }}</div>
            <div class="stat-label">Nécessitent un suivi</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ dashboard.stats.reunions }}</div>
            <div class="stat-label">Réunions organisées</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ dashboard.stats.objectifs_en_cours }}</div>
            <div class="stat-label">Objectifs en cours</div>
          </div>
        </div>

        <div class="dashboard-cols">

          <!-- Dernières remarques -->
          <div class="dash-block">
            <h3 class="block-title">Dernières remarques</h3>
            <div v-if="!dashboard.dernieres_remarques.length" class="empty">Aucune remarque.</div>
            <div v-for="r in dashboard.dernieres_remarques" :key="r.id" class="remarque-row"
              :class="`remarque-row--${r.type}`">
              <div class="rrow-top">
                <span class="badge-type" :class="`badge--${r.type}`">{{ labelType(r.type) }}</span>
                <span class="rrow-categorie">{{ r.categorie }}</span>
                <span class="rrow-date">{{ fmtDate(r.date_evenement) }}</span>
              </div>
              <div class="rrow-demon">
                <RouterLink :to="`/registre-demons/${r.demon_id}`" class="demon-link">
                  {{ r.demon_nom }}
                </RouterLink>
                <span class="rrow-auteur">par {{ r.auteur_nom }}</span>
              </div>
              <p class="rrow-desc">{{ r.description }}</p>
            </div>
          </div>

          <div class="dash-right">
            <!-- Démons à suivre -->
            <div class="dash-block">
              <h3 class="block-title">Démons nécessitant un suivi</h3>
              <div v-if="!dashboard.demons_a_suivre.length" class="empty">Aucun démon en suivi actif.</div>
              <div v-for="d in dashboard.demons_a_suivre" :key="d.id" class="suivre-row">
                <RouterLink :to="`/registre-demons/${d.id}`" class="demon-link">{{ d.nom }}</RouterLink>
                <span class="badge-rang" :class="`rang--${d.rang.toLowerCase()}`">{{ d.rang }}</span>
              </div>
            </div>

            <!-- Dernières activités -->
            <div class="dash-block">
              <h3 class="block-title">Dernières activités</h3>
              <div v-if="!dashboard.dernieres_activites.length" class="empty">Aucune activité.</div>
              <div v-for="a in dashboard.dernieres_activites" :key="a.id" class="activity-row">
                <span class="act-label">{{ labelAction(a.action) }}</span>
                <span v-if="a.demon_id" class="act-demon">
                  <RouterLink :to="`/registre-demons/${a.demon_id}`" class="demon-link">{{ a.demon_label }}</RouterLink>
                </span>
                <span class="act-auteur">{{ a.auteur_nom }}</span>
                <span class="act-date">{{ fmtDatetime(a.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- ── Liste des démons ──────────────────────────────────────────── -->
    <div v-if="activeTab === 'liste'" class="tab-content">

      <!-- Filtres -->
      <div class="filters-bar">
        <input v-model="filtres.q" class="search-input" placeholder="Rechercher un démon..." @input="loadDemons" />
        <select v-model="filtres.rang" class="filter-select" @change="loadDemons">
          <option value="">Tous les rangs</option>
          <option value="Faible">Faible</option>
          <option value="Fort">Fort</option>
        </select>
        <select v-model="filtres.statut" class="filter-select" @change="loadDemons">
          <option value="">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="a_suivre">À suivre</option>
          <option value="inactif">Inactif</option>
        </select>
        <select v-model="filtres.sort" class="filter-select" @change="loadDemons">
          <option value="">Trier par nom</option>
          <option value="activite">Dernière activité</option>
          <option value="positives">+ Remarques +</option>
          <option value="negatives">+ Remarques −</option>
        </select>
        <label class="archive-toggle">
          <input type="checkbox" v-model="filtres.archive" @change="loadDemons" />
          Archivés
        </label>
      </div>

      <!-- Tableau -->
      <div v-if="loadingDemons" class="loading">Chargement...</div>
      <div v-else-if="!demons.length" class="empty-state">Aucun démon enregistré.</div>
      <div v-else class="table-wrapper">
        <table class="demon-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Pouvoir</th>
              <th>Rang</th>
              <th>Statut</th>
              <th>+</th>
              <th>−</th>
              <th>Activité</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in demons" :key="d.id">
              <td class="td-nom">{{ d.nom }}</td>
              <td class="td-pouvoir">{{ d.pouvoir_sanguinaire || '—' }}</td>
              <td><span class="badge-rang" :class="`rang--${d.rang.toLowerCase()}`">{{ d.rang }}</span></td>
              <td><span class="badge-statut" :class="`statut--${d.statut}`">{{ labelStatut(d.statut) }}</span></td>
              <td class="td-num positive">{{ d.nb_positives }}</td>
              <td class="td-num negative">{{ d.nb_negatives }}</td>
              <td class="td-date">{{ d.derniere_remarque ? fmtDate(d.derniere_remarque) : '—' }}</td>
              <td>
                <RouterLink :to="`/registre-demons/${d.id}`" class="btn-voir">Voir</RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Réunions ───────────────────────────────────────────────────── -->
    <div v-if="activeTab === 'reunions'" class="tab-content">
      <div class="section-header">
        <h2 class="section-title">Réunions</h2>
        <button v-if="isDirigeant" class="btn-primary" @click="openCreateReunion">+ Nouvelle réunion</button>
      </div>

      <div v-if="loadingReunions" class="loading">Chargement...</div>
      <div v-else-if="!reunions.length" class="empty-state">Aucune réunion enregistrée.</div>
      <div v-else class="reunions-list">
        <div v-for="r in reunions" :key="r.id" class="reunion-card" @click="openReunion(r)">
          <div class="reunion-header">
            <span class="reunion-titre">{{ r.titre }}</span>
            <span class="reunion-date">{{ fmtDate(r.date_reunion) }}{{ r.heure ? ' — ' + r.heure : '' }}</span>
          </div>
          <div class="reunion-meta">
            <span v-if="r.responsable_nom">Responsable : {{ r.responsable_nom }}</span>
            <span>{{ r.nb_presents }}/{{ r.nb_invites }} présents</span>
          </div>
          <p v-if="r.description" class="reunion-desc">{{ r.description }}</p>
        </div>
      </div>
    </div>

  </div>

  <!-- ── Modal Créer un démon ────────────────────────────────────────── -->
  <div v-if="showCreateDemon" class="modal-backdrop" @click.self="showCreateDemon = false">
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">Nouveau démon</h2>
        <button class="modal-close" @click="showCreateDemon = false">✕</button>
      </div>
      <form @submit.prevent="submitCreateDemon" class="modal-form">
        <div class="form-group">
          <label>Nom <span class="req">*</span></label>
          <input v-model="newDemon.nom" required />
        </div>
        <div class="form-group">
          <label>Pouvoir Sanguinaire</label>
          <input v-model="newDemon.pouvoir_sanguinaire" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Rang <span class="req">*</span></label>
            <select v-model="newDemon.rang" required>
              <option value="Faible">Faible</option>
              <option value="Fort">Fort</option>
            </select>
          </div>
          <div class="form-group">
            <label>Statut</label>
            <select v-model="newDemon.statut">
              <option value="actif">Actif</option>
              <option value="a_suivre">À suivre</option>
              <option value="inactif">Inactif</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Date d'arrivée</label>
            <input type="date" v-model="newDemon.date_arrivee" />
          </div>
          <div class="form-group">
            <label>Responsable référent</label>
            <input v-model="newDemon.responsable_nom_libre" placeholder="Nom du responsable" />
          </div>
        </div>
        <div class="form-group">
          <label>Notes générales</label>
          <textarea v-model="newDemon.notes_generales" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label>Objectifs actuels</label>
          <textarea v-model="newDemon.objectifs_actuels" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label>Photo</label>
          <div class="upload-zone" @click="$refs.photoInput.click()" :class="{ 'upload-zone--has': newDemon.photo_url }">
            <img v-if="newDemon.photo_url" :src="serverUrl + newDemon.photo_url" class="upload-preview" />
            <span v-else class="upload-hint">Cliquer pour choisir une image</span>
            <input ref="photoInput" type="file" accept="image/*" style="display:none" @change="handlePhotoUpload" />
          </div>
          <div v-if="uploadingPhoto" class="upload-status">Envoi en cours...</div>
        </div>
        <div v-if="createDemonError" class="form-error">{{ createDemonError }}</div>
        <div class="form-actions">
          <button type="button" class="btn-cancel" @click="showCreateDemon = false">Annuler</button>
          <button type="submit" class="btn-primary" :disabled="creating">{{ creating ? 'Enregistrement...' : 'Créer le démon' }}</button>
        </div>
      </form>
    </div>
  </div>

  <!-- ── Modal Créer/Voir une réunion ──────────────────────────────── -->
  <div v-if="showReunionModal" class="modal-backdrop" @click.self="closeReunionModal">
    <div class="modal modal--large">
      <div class="modal-header">
        <h2 class="modal-title">{{ reunionEdit ? 'Détail de la réunion' : 'Nouvelle réunion' }}</h2>
        <button class="modal-close" @click="closeReunionModal">✕</button>
      </div>

      <!-- Vue détail -->
      <div v-if="reunionEdit && !editingReunion" class="reunion-detail">
        <div class="reunion-info-grid">
          <div><span class="info-label">Titre</span><span>{{ reunionEdit.titre }}</span></div>
          <div><span class="info-label">Date</span><span>{{ fmtDate(reunionEdit.date_reunion) }}{{ reunionEdit.heure ? ' — ' + reunionEdit.heure : '' }}</span></div>
          <div v-if="reunionEdit.responsable_nom"><span class="info-label">Responsable</span><span>{{ reunionEdit.responsable_nom }}</span></div>
        </div>
        <div v-if="reunionEdit.description" class="reunion-section"><strong>Description</strong><p>{{ reunionEdit.description }}</p></div>
        <div v-if="reunionEdit.ordre_du_jour" class="reunion-section"><strong>Ordre du jour</strong><p>{{ reunionEdit.ordre_du_jour }}</p></div>
        <div v-if="reunionEdit.sujets_abordes" class="reunion-section"><strong>Sujets abordés</strong><p>{{ reunionEdit.sujets_abordes }}</p></div>
        <div v-if="reunionEdit.decisions" class="reunion-section"><strong>Décisions prises</strong><p>{{ reunionEdit.decisions }}</p></div>
        <div v-if="reunionEdit.objectifs_fixes" class="reunion-section"><strong>Objectifs fixés</strong><p>{{ reunionEdit.objectifs_fixes }}</p></div>

        <div v-if="reunionEdit.participants?.length" class="reunion-section">
          <strong>Participants</strong>
          <div class="participants-list">
            <div v-for="p in reunionEdit.participants" :key="p.id" class="participant-row">
              <span>{{ p.nom }} {{ p.prenom }}</span>
              <span class="badge-rang" :class="`rang--${p.rang.toLowerCase()}`">{{ p.rang }}</span>
              <span class="badge-presence" :class="`presence--${p.presence}`">{{ labelPresence(p.presence) }}</span>
            </div>
          </div>
        </div>

        <div v-if="isDirigeant" class="form-actions" style="margin-top:1.5rem">
          <button class="btn-secondary" @click="editingReunion = true">Modifier / Compléter</button>
        </div>
      </div>

      <!-- Formulaire création/édition -->
      <form v-else @submit.prevent="submitReunion" class="modal-form">
        <div class="form-row">
          <div class="form-group">
            <label>Titre <span class="req">*</span></label>
            <input v-model="reunionForm.titre" required />
          </div>
          <div class="form-group">
            <label>Date <span class="req">*</span></label>
            <input type="date" v-model="reunionForm.date_reunion" required />
          </div>
          <div class="form-group">
            <label>Heure</label>
            <input type="time" v-model="reunionForm.heure" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Responsable</label>
            <select v-model="reunionForm.responsable_id">
              <option v-for="u in users" :key="u.id" :value="u.id">{{ u.nom }}</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea v-model="reunionForm.description" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label>Ordre du jour</label>
          <textarea v-model="reunionForm.ordre_du_jour" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label>Sujets abordés</label>
          <textarea v-model="reunionForm.sujets_abordes" rows="2"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Décisions prises</label>
            <textarea v-model="reunionForm.decisions" rows="2"></textarea>
          </div>
          <div class="form-group">
            <label>Objectifs fixés</label>
            <textarea v-model="reunionForm.objectifs_fixes" rows="2"></textarea>
          </div>
        </div>

        <!-- Participants -->
        <div class="form-group">
          <label>Participants</label>
          <div class="participants-select">
            <div v-for="d in demons.filter(x => x.statut !== 'archive')" :key="d.id" class="participant-check">
              <label class="check-label">
                <input type="checkbox" :checked="isParticipant(d.id)" @change="toggleParticipant(d.id)" />
                {{ d.nom }} {{ d.prenom }} ({{ d.rang }})
              </label>
              <select v-if="isParticipant(d.id)" v-model="getParticipant(d.id).presence" class="presence-select">
                <option value="present">Présent</option>
                <option value="absent">Absent</option>
                <option value="excuse">Excusé</option>
              </select>
            </div>
          </div>
        </div>

        <div v-if="reunionError" class="form-error">{{ reunionError }}</div>
        <div class="form-actions">
          <button type="button" class="btn-cancel" @click="closeReunionModal">Annuler</button>
          <button type="submit" class="btn-primary" :disabled="savingReunion">
            {{ savingReunion ? 'Enregistrement...' : (reunionEdit ? 'Enregistrer' : 'Créer la réunion') }}
          </button>
        </div>
      </form>
    </div>
  </div>

</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import AppNavbar from './AppNavbar.vue'
import { currentUser } from '../auth.js'
import {
  rdDashboard, rdGetDemons, rdCreateDemon,
  rdGetReunions, rdGetReunion, rdCreateReunion, rdUpdateReunion,
  rdGetUsers, uploadImage
} from '../api.js'
import { SERVER_URL } from '../api.js'

const serverUrl = SERVER_URL

// ── Permissions ──────────────────────────────────────────────────────────────

const isDirigeant = computed(() =>
  !!(currentUser.value?.demons_dirigeant || currentUser.value?.role === 'admin')
)

// ── Onglets ──────────────────────────────────────────────────────────────────

const tabs = [
  { id: 'dashboard', label: 'Tableau de bord' },
  { id: 'liste', label: 'Liste des démons' },
  { id: 'reunions', label: 'Réunions' },
]
const activeTab = ref('dashboard')

// ── Tableau de bord ───────────────────────────────────────────────────────────

const dashboard = ref(null)
const loadingDashboard = ref(false)

async function loadDashboard() {
  loadingDashboard.value = true
  try { dashboard.value = await rdDashboard() }
  catch (e) { console.error(e) }
  finally { loadingDashboard.value = false }
}

// ── Liste des démons ──────────────────────────────────────────────────────────

const demons = ref([])
const loadingDemons = ref(false)
const filtres = ref({ q: '', rang: '', statut: '', sort: '', archive: false })

async function loadDemons() {
  loadingDemons.value = true
  try {
    demons.value = await rdGetDemons({
      q: filtres.value.q || undefined,
      rang: filtres.value.rang || undefined,
      statut: filtres.value.statut || undefined,
      sort: filtres.value.sort || undefined,
      archive: filtres.value.archive ? '1' : undefined,
    })
  } catch (e) { console.error(e) }
  finally { loadingDemons.value = false }
}

// ── Réunions ─────────────────────────────────────────────────────────────────

const reunions = ref([])
const loadingReunions = ref(false)
const showReunionModal = ref(false)
const reunionEdit = ref(null)
const editingReunion = ref(false)
const reunionError = ref('')
const savingReunion = ref(false)
const reunionForm = ref(emptyReunionForm())
const reunionParticipants = ref([])

function emptyReunionForm() {
  return { titre: '', date_reunion: '', heure: '', responsable_id: '', description: '', ordre_du_jour: '', sujets_abordes: '', decisions: '', objectifs_fixes: '' }
}

async function loadReunions() {
  loadingReunions.value = true
  try { reunions.value = await rdGetReunions() }
  catch (e) { console.error(e) }
  finally { loadingReunions.value = false }
}

function openCreateReunion() {
  reunionEdit.value = null
  editingReunion.value = false
  reunionForm.value = emptyReunionForm()
  reunionParticipants.value = []
  showReunionModal.value = true
}

async function openReunion(r) {
  try {
    reunionEdit.value = await rdGetReunion(r.id)
    editingReunion.value = false
    reunionForm.value = { ...reunionEdit.value }
    reunionParticipants.value = (reunionEdit.value.participants || []).map(p => ({ demon_id: p.demon_id, presence: p.presence }))
    showReunionModal.value = true
  } catch (e) { console.error(e) }
}

function closeReunionModal() {
  showReunionModal.value = false
  reunionEdit.value = null
  editingReunion.value = false
}

function isParticipant(demonId) {
  return reunionParticipants.value.some(p => p.demon_id === demonId)
}

function getParticipant(demonId) {
  return reunionParticipants.value.find(p => p.demon_id === demonId)
}

function toggleParticipant(demonId) {
  const idx = reunionParticipants.value.findIndex(p => p.demon_id === demonId)
  if (idx >= 0) reunionParticipants.value.splice(idx, 1)
  else reunionParticipants.value.push({ demon_id: demonId, presence: 'present' })
}

async function submitReunion() {
  savingReunion.value = true
  reunionError.value = ''
  try {
    const body = { ...reunionForm.value, participants: reunionParticipants.value }
    if (reunionEdit.value) {
      await rdUpdateReunion(reunionEdit.value.id, body)
    } else {
      await rdCreateReunion(body)
    }
    await loadReunions()
    closeReunionModal()
  } catch (e) {
    reunionError.value = e.message
  } finally {
    savingReunion.value = false
  }
}

// ── Créer un démon ────────────────────────────────────────────────────────────

const showCreateDemon = ref(false)
const creating = ref(false)
const createDemonError = ref('')
const users = ref([])
const newDemon = ref(emptyDemonForm())
const uploadingPhoto = ref(false)

function emptyDemonForm() {
  return { nom: '', pouvoir_sanguinaire: '', rang: 'Faible', statut: 'actif', date_arrivee: '', responsable_nom_libre: '', notes_generales: '', objectifs_actuels: '', photo_url: '' }
}

async function handlePhotoUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  uploadingPhoto.value = true
  try {
    newDemon.value.photo_url = await uploadImage(file)
  } catch (err) {
    createDemonError.value = err.message
  } finally {
    uploadingPhoto.value = false
  }
}

async function submitCreateDemon() {
  creating.value = true
  createDemonError.value = ''
  try {
    const body = { ...newDemon.value, prenom: '' }
    await rdCreateDemon(body)
    showCreateDemon.value = false
    newDemon.value = emptyDemonForm()
    await loadDemons()
    await loadDashboard()
  } catch (e) {
    createDemonError.value = e.message
  } finally {
    creating.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—'
  const dt = new Date(d)
  return isNaN(dt) ? d : dt.toLocaleDateString('fr-FR')
}

function fmtDatetime(d) {
  if (!d) return ''
  const dt = new Date(d)
  return isNaN(dt) ? d : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function labelType(t) {
  return { positive: 'Positive', negative: 'Négative', neutre: 'Neutre' }[t] || t
}

function labelStatut(s) {
  return { actif: 'Actif', a_suivre: 'À suivre', inactif: 'Inactif', archive: 'Archivé' }[s] || s
}

function labelPresence(p) {
  return { present: 'Présent', absent: 'Absent', excuse: 'Excusé' }[p] || p
}

function labelAction(a) {
  const map = {
    creation: 'Nouvelle fiche',
    modification: 'Fiche modifiée',
    remarque_ajoutee: 'Remarque ajoutée',
    reunion_creee: 'Réunion créée',
    objectif_cree: 'Objectif créé',
    changement_rang: 'Changement de rang',
    archivage: 'Archivage',
  }
  return map[a] || a
}

// ── Init ─────────────────────────────────────────────────────────────────────

onMounted(async () => {
  await Promise.all([loadDashboard(), loadDemons(), loadReunions()])
  if (isDirigeant.value) {
    try { users.value = await rdGetUsers() } catch {}
  }
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #090909;
  color: #d4cfc9;
  padding: 2rem;
  font-family: 'Crimson Text', Georgia, serif;
}

/* En-tête */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1.2rem;
}

.header-ornament {
  width: 40px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(139,26,26,0.6), transparent);
}

.page-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.4rem;
  letter-spacing: 0.15em;
  color: #fff;
  margin: 0;
}

.page-subtitle {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.9rem;
  color: rgba(255,255,255,0.35);
  margin: 0.2rem 0 0;
}

/* Onglets nav */
.tabs-nav {
  display: flex;
  gap: 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 2rem;
}

.tab-btn {
  font-family: 'Cinzel', serif;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.35);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0.75rem 1.4rem;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  margin-bottom: -1px;
}

.tab-btn:hover { color: rgba(255,255,255,0.65); }
.tab-btn.active { color: #fff; border-bottom-color: #8b1a1a; }

.tab-content { animation: fadeIn 0.2s; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.06);
  padding: 1.2rem;
  text-align: center;
}

.stat-value {
  font-family: 'Cinzel', serif;
  font-size: 2rem;
  color: #fff;
  line-height: 1;
}

.stat-label {
  font-size: 0.75rem;
  font-style: italic;
  color: rgba(255,255,255,0.35);
  margin-top: 0.4rem;
}

.stat-card--faible .stat-value { color: #9b7fd4; }
.stat-card--fort .stat-value { color: #d47f7f; }
.stat-card--positive .stat-value { color: #5a9a5a; }
.stat-card--negative .stat-value { color: #c04040; }
.stat-card--warning .stat-value { color: #c08030; }

/* Dashboard colonnes */
.dashboard-cols {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 1.5rem;
}

.dash-right { display: flex; flex-direction: column; gap: 1.5rem; }

.dash-block {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.06);
  padding: 1.2rem;
}

.block-title {
  font-family: 'Cinzel', serif;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.5);
  text-transform: uppercase;
  margin: 0 0 1rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

/* Remarques rows */
.remarque-row {
  padding: 0.8rem;
  margin-bottom: 0.6rem;
  border-left: 3px solid transparent;
  background: rgba(255,255,255,0.02);
}

.remarque-row--positive { border-left-color: #4a7a4a; }
.remarque-row--negative { border-left-color: #8b2020; }
.remarque-row--neutre { border-left-color: #5a5a8a; }

.rrow-top { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.3rem; }
.rrow-categorie { font-size: 0.8rem; color: rgba(255,255,255,0.4); }
.rrow-date { font-size: 0.75rem; color: rgba(255,255,255,0.3); margin-left: auto; }
.rrow-demon { display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.3rem; }
.rrow-auteur { font-size: 0.8rem; font-style: italic; color: rgba(255,255,255,0.3); }
.rrow-desc { font-size: 0.9rem; color: rgba(255,255,255,0.6); margin: 0; font-style: italic; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

/* À suivre rows */
.suivre-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

/* Activités */
.activity-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  font-size: 0.85rem;
  flex-wrap: wrap;
}

.act-label { color: rgba(255,255,255,0.6); }
.act-demon { flex: 1; }
.act-auteur { font-style: italic; color: rgba(255,255,255,0.3); }
.act-date { font-size: 0.75rem; color: rgba(255,255,255,0.25); margin-left: auto; }

/* Filtres */
.filters-bar {
  display: flex;
  gap: 0.8rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.search-input {
  flex: 1;
  min-width: 200px;
  background: #141416;
  border: 1px solid rgba(255,255,255,0.08);
  color: #d4cfc9;
  padding: 0.5rem 0.8rem;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.95rem;
}

.search-input::placeholder { color: rgba(255,255,255,0.25); }

.filter-select {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.08);
  color: #d4cfc9;
  padding: 0.5rem 0.8rem;
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.05em;
  cursor: pointer;
}

.archive-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
}

/* Tableau */
.table-wrapper { overflow-x: auto; }

.demon-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.demon-table th {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.3);
  text-align: left;
  padding: 0.5rem 0.8rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  text-transform: uppercase;
}

.demon-table td {
  padding: 0.75rem 0.8rem;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  color: #d4cfc9;
}

.demon-table tbody tr:hover td { background: rgba(255,255,255,0.02); }

.td-nom { font-family: 'Cinzel', serif; font-size: 0.82rem; color: #fff; }
.td-pouvoir { font-style: italic; color: rgba(255,255,255,0.5); font-size: 0.85rem; }
.td-num { text-align: center; font-family: 'Cinzel', serif; }
.td-num.positive { color: #5a9a5a; }
.td-num.negative { color: #c04040; }
.td-date { font-size: 0.8rem; color: rgba(255,255,255,0.35); }

/* Badges */
.badge-type {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  padding: 0.2rem 0.5rem;
  text-transform: uppercase;
}

.badge--positive { background: rgba(74,122,74,0.2); color: #7ac47a; border: 1px solid rgba(74,122,74,0.3); }
.badge--negative { background: rgba(139,32,32,0.2); color: #e05050; border: 1px solid rgba(139,32,32,0.3); }
.badge--neutre { background: rgba(90,90,138,0.2); color: #9090c8; border: 1px solid rgba(90,90,138,0.3); }

.badge-rang {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  padding: 0.2rem 0.5rem;
  text-transform: uppercase;
}

.rang--faible { background: rgba(90,60,160,0.15); color: #9b7fd4; border: 1px solid rgba(90,60,160,0.25); }
.rang--fort { background: rgba(160,60,60,0.15); color: #d47f7f; border: 1px solid rgba(160,60,60,0.25); }

.badge-statut {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.05em;
  padding: 0.2rem 0.5rem;
  text-transform: uppercase;
}

.statut--actif { background: rgba(40,100,40,0.15); color: #78b878; border: 1px solid rgba(40,100,40,0.25); }
.statut--a_suivre { background: rgba(180,100,0,0.15); color: #d4a040; border: 1px solid rgba(180,100,0,0.25); }
.statut--inactif { background: rgba(80,80,80,0.15); color: #909090; border: 1px solid rgba(80,80,80,0.25); }
.statut--archive { background: rgba(50,50,50,0.15); color: #606060; border: 1px solid rgba(50,50,50,0.25); }

/* Réunions */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.section-title {
  font-family: 'Cinzel', serif;
  font-size: 0.9rem;
  letter-spacing: 0.12em;
  color: rgba(255,255,255,0.6);
  text-transform: uppercase;
  margin: 0;
}

.reunions-list { display: flex; flex-direction: column; gap: 0.8rem; }

.reunion-card {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.06);
  padding: 1.1rem 1.3rem;
  cursor: pointer;
  transition: border-color 0.15s;
}

.reunion-card:hover { border-color: rgba(255,255,255,0.12); }

.reunion-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.4rem;
}

.reunion-titre {
  font-family: 'Cinzel', serif;
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  color: #fff;
}

.reunion-date {
  font-size: 0.82rem;
  font-style: italic;
  color: rgba(255,255,255,0.4);
}

.reunion-meta {
  display: flex;
  gap: 1.5rem;
  font-size: 0.82rem;
  color: rgba(255,255,255,0.3);
  font-style: italic;
}

.reunion-desc { font-size: 0.88rem; color: rgba(255,255,255,0.4); margin: 0.4rem 0 0; }

/* Détail réunion dans modale */
.reunion-detail { font-size: 0.95rem; }

.reunion-info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1.2rem;
  padding-bottom: 1.2rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.info-label {
  display: block;
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.3);
  text-transform: uppercase;
  margin-bottom: 0.2rem;
}

.reunion-section {
  margin-bottom: 1rem;
}

.reunion-section strong {
  display: block;
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.4);
  text-transform: uppercase;
  margin-bottom: 0.4rem;
}

.reunion-section p { margin: 0; color: rgba(255,255,255,0.7); line-height: 1.6; }

.participants-list { display: flex; flex-direction: column; gap: 0.4rem; }

.participant-row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  font-size: 0.88rem;
  padding: 0.3rem 0;
}

.badge-presence {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.4rem;
  text-transform: uppercase;
}

.presence--present { background: rgba(40,100,40,0.15); color: #78b878; border: 1px solid rgba(40,100,40,0.25); }
.presence--absent { background: rgba(139,26,26,0.15); color: #c05050; border: 1px solid rgba(139,26,26,0.25); }
.presence--excuse { background: rgba(120,100,0,0.15); color: #c0a040; border: 1px solid rgba(120,100,0,0.25); }

/* Formulaire participants */
.participants-select {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.4rem;
  max-height: 200px;
  overflow-y: auto;
  padding: 0.6rem;
  background: #0f0f10;
  border: 1px solid rgba(255,255,255,0.06);
}

.participant-check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.check-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  flex: 1;
}

.presence-select {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.08);
  color: #d4cfc9;
  padding: 0.2rem 0.4rem;
  font-size: 0.75rem;
}

/* Modals */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.08);
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal--large { max-width: 750px; }

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.2rem 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.modal-title {
  font-family: 'Cinzel', serif;
  font-size: 0.85rem;
  letter-spacing: 0.1em;
  color: #fff;
  text-transform: uppercase;
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  color: rgba(255,255,255,0.3);
  font-size: 1rem;
  cursor: pointer;
  padding: 0.2rem;
}

.modal-close:hover { color: rgba(255,255,255,0.7); }

.modal-form { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }

.form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }

.form-group { display: flex; flex-direction: column; gap: 0.4rem; }

.form-group label {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.4);
  text-transform: uppercase;
}

.form-group input,
.form-group select,
.form-group textarea {
  background: #0f0f10;
  border: 1px solid rgba(255,255,255,0.08);
  color: #d4cfc9;
  padding: 0.55rem 0.8rem;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.95rem;
  transition: border-color 0.15s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: rgba(139,26,26,0.5);
}

.form-group textarea { resize: vertical; }

.req { color: #8b1a1a; }

.form-error {
  color: #e05050;
  font-size: 0.85rem;
  padding: 0.5rem 0.8rem;
  background: rgba(139,26,26,0.1);
  border-left: 3px solid #8b1a1a;
}

.form-actions {
  display: flex;
  gap: 0.8rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

/* Boutons */
.btn-primary {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: #8b1a1a;
  color: #fff;
  border: none;
  padding: 0.65rem 1.4rem;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary:hover:not(:disabled) { background: #a82020; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: none;
  color: rgba(255,255,255,0.5);
  border: 1px solid rgba(255,255,255,0.12);
  padding: 0.65rem 1.2rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-secondary:hover { border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.8); }

.btn-cancel {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: none;
  color: rgba(255,255,255,0.3);
  border: 1px solid rgba(255,255,255,0.06);
  padding: 0.65rem 1.2rem;
  cursor: pointer;
}

.btn-cancel:hover { color: rgba(255,255,255,0.6); }

.btn-voir {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  color: rgba(255,255,255,0.4);
  border: 1px solid rgba(255,255,255,0.08);
  padding: 0.3rem 0.7rem;
  text-decoration: none;
  transition: all 0.15s;
}

.btn-voir:hover { color: #fff; border-color: rgba(255,255,255,0.2); }

/* Liens */
.demon-link {
  font-family: 'Cinzel', serif;
  font-size: 0.78rem;
  color: rgba(255,255,255,0.65);
  text-decoration: none;
  letter-spacing: 0.04em;
}

.demon-link:hover { color: #fff; }

/* États */
.loading { color: rgba(255,255,255,0.3); font-style: italic; padding: 2rem 0; text-align: center; }
.empty { color: rgba(255,255,255,0.25); font-style: italic; font-size: 0.9rem; }
.empty-state { color: rgba(255,255,255,0.25); font-style: italic; text-align: center; padding: 3rem 0; }

/* Upload */
.upload-zone {
  background: #0f0f10;
  border: 1px dashed rgba(255,255,255,0.12);
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.15s;
  overflow: hidden;
}
.upload-zone:hover { border-color: rgba(255,255,255,0.25); }
.upload-zone--has { border-style: solid; border-color: rgba(255,255,255,0.1); }
.upload-preview { max-height: 120px; max-width: 100%; object-fit: cover; display: block; }
.upload-hint { font-size: 0.82rem; color: rgba(255,255,255,0.25); font-style: italic; }
.upload-status { font-size: 0.78rem; color: rgba(255,255,255,0.35); font-style: italic; margin-top: 0.3rem; }

/* Responsive */
@media (max-width: 900px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .dashboard-cols { grid-template-columns: 1fr; }
  .reunion-info-grid { grid-template-columns: 1fr; }
}

@media (max-width: 600px) {
  .page { padding: 1rem; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .page-title { font-size: 1rem; }
}
</style>

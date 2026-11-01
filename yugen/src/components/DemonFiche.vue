<template>
  <AppNavbar />
  <div class="page">

    <!-- Retour -->
    <div class="back-row">
      <RouterLink to="/registre-demons" class="back-link">← Registre des Démons</RouterLink>
    </div>

    <div v-if="loading" class="loading">Chargement...</div>
    <div v-else-if="!demon" class="error-state">Démon introuvable.</div>

    <template v-else>
      <!-- En-tête fiche -->
      <div class="fiche-header">
        <div class="fiche-identity">
          <div class="fiche-avatar">
          <img v-if="demon.photo_url" :src="serverUrl + demon.photo_url" class="avatar-img" />
          <span v-else>{{ demon.nom[0] }}</span>
        </div>
          <div>
            <div class="fiche-nom">{{ demon.nom }}</div>
            <div class="fiche-pouvoir" v-if="demon.pouvoir_sanguinaire">{{ demon.pouvoir_sanguinaire }}</div>
            <div class="fiche-meta">
              <span class="badge-rang" :class="`rang--${demon.rang.toLowerCase()}`">{{ demon.rang }}</span>
              <span class="badge-statut" :class="`statut--${demon.statut}`">{{ labelStatut(demon.statut) }}</span>
              <span v-if="demon.responsable_nom" class="meta-resp">Responsable : {{ demon.responsable_nom }}</span>
              <span v-if="demon.date_arrivee" class="meta-date">Arrivée : {{ fmtDate(demon.date_arrivee) }}</span>
            </div>
          </div>
        </div>
        <div class="fiche-actions" v-if="isDirigeant">
          <button class="btn-secondary" @click="openEdit">Modifier</button>
          <button v-if="demon.rang === 'Faible'" class="btn-rang" @click="showChangerRang = true">Passer Fort</button>
          <button v-else class="btn-rang" @click="showChangerRang = true">Passer Faible</button>
        </div>
      </div>

      <!-- Résumé indicateurs -->
      <div class="summary-cards">
        <div class="sum-card sum-card--positive">
          <div class="sum-value">{{ demon.nb_positives }}</div>
          <div class="sum-label">Remarques +</div>
        </div>
        <div class="sum-card sum-card--negative">
          <div class="sum-value">{{ demon.nb_negatives }}</div>
          <div class="sum-label">Remarques −</div>
        </div>
        <div class="sum-card sum-card--neutre">
          <div class="sum-value">{{ demon.nb_neutres }}</div>
          <div class="sum-label">Observations</div>
        </div>
        <div class="sum-card">
          <div class="sum-value">{{ demon.nb_objectifs_cours }}</div>
          <div class="sum-label">Objectifs en cours</div>
        </div>
        <div class="sum-card">
          <div class="sum-value">{{ demon.nb_objectifs_termines }}</div>
          <div class="sum-label">Objectifs terminés</div>
        </div>
        <div class="sum-card">
          <div class="sum-value">{{ demon.derniere_reunion ? fmtDate(demon.derniere_reunion) : '—' }}</div>
          <div class="sum-label">Dernière réunion</div>
        </div>
      </div>

      <!-- Onglets internes -->
      <div class="inner-tabs">
        <button v-for="t in innerTabs" :key="t.id"
          class="inner-tab" :class="{ active: innerTab === t.id }"
          @click="innerTab = t.id; loadTab(t.id)">
          {{ t.label }}
        </button>
      </div>

      <!-- ── Infos ─────────────────────────────────────────────────────── -->
      <div v-if="innerTab === 'infos'" class="inner-content">
        <div class="infos-grid">
          <div class="info-block">
            <span class="info-label">Nom</span>
            <span>{{ demon.nom }}</span>
          </div>
          <div class="info-block">
            <span class="info-label">Pouvoir Sanguinaire</span>
            <span>{{ demon.pouvoir_sanguinaire || '—' }}</span>
          </div>
          <div class="info-block">
            <span class="info-label">Rang</span>
            <span class="badge-rang" :class="`rang--${demon.rang.toLowerCase()}`">{{ demon.rang }}</span>
          </div>
          <div class="info-block">
            <span class="info-label">Statut</span>
            <span class="badge-statut" :class="`statut--${demon.statut}`">{{ labelStatut(demon.statut) }}</span>
          </div>
          <div class="info-block">
            <span class="info-label">Date d'arrivée</span>
            <span>{{ demon.date_arrivee ? fmtDate(demon.date_arrivee) : '—' }}</span>
          </div>
          <div class="info-block">
            <span class="info-label">Responsable</span>
            <span>{{ demon.responsable_nom || '—' }}</span>
          </div>
          <div v-if="demon.user_nom" class="info-block">
            <span class="info-label">Compte lié</span>
            <span>{{ demon.user_nom }}</span>
          </div>
        </div>

        <div v-if="demon.notes_generales" class="notes-block">
          <h4 class="notes-title">Notes générales</h4>
          <p>{{ demon.notes_generales }}</p>
        </div>

        <div v-if="demon.objectifs_actuels" class="notes-block">
          <h4 class="notes-title">Objectifs actuels</h4>
          <p>{{ demon.objectifs_actuels }}</p>
        </div>
      </div>

      <!-- ── Remarques ───────────────────────────────────────────────── -->
      <div v-if="innerTab === 'remarques'" class="inner-content">
        <div class="tab-toolbar">
          <div class="toolbar-filters">
            <button v-for="t in ['all','positive','negative','neutre']" :key="t"
              class="filter-btn" :class="{ active: remarqueFilter === t }"
              @click="remarqueFilter = t">
              {{ t === 'all' ? 'Toutes' : labelType(t) }}
            </button>
          </div>
          <div class="toolbar-right">
            <label class="archive-toggle">
              <input type="checkbox" v-model="showArchived" @change="loadRemarques" />
              Archivées
            </label>
            <button class="btn-primary" @click="showAddRemarque = true">+ Remarque</button>
          </div>
        </div>

        <div v-if="loadingRemarques" class="loading">Chargement...</div>
        <div v-else-if="!filteredRemarques.length" class="empty-state">Aucune remarque.</div>
        <div v-else class="remarques-list">
          <div v-for="r in filteredRemarques" :key="r.id" class="remarque-card"
            :class="`remarque-card--${r.type}`">
            <div class="rc-header">
              <span class="badge-type" :class="`badge--${r.type}`">{{ labelType(r.type) }}</span>
              <span class="rc-categorie">{{ r.categorie }}</span>
              <span class="rc-statut" :class="`rstatut--${r.statut_suivi}`">{{ labelSuivi(r.statut_suivi) }}</span>
              <span class="rc-date">{{ fmtDate(r.date_evenement) }}</span>
              <div class="rc-actions" v-if="isDirigeant">
                <button class="rc-btn" @click="editRemarque(r)">Modifier</button>
                <button class="rc-btn rc-btn--danger" @click="archiverRemarque(r.id)" v-if="!showArchived">Archiver</button>
              </div>
            </div>
            <p class="rc-desc">{{ r.description }}</p>
            <div class="rc-footer">
              <span class="rc-auteur">{{ r.auteur_nom }}{{ r.auteur_grade ? ' — ' + r.auteur_grade : '' }}</span>
              <span class="rc-enregistre">Enregistré le {{ fmtDate(r.created_at) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Objectifs ──────────────────────────────────────────────── -->
      <div v-if="innerTab === 'objectifs'" class="inner-content">
        <div class="tab-toolbar">
          <div></div>
          <button v-if="isDirigeant" class="btn-primary" @click="showAddObjectif = true">+ Objectif</button>
        </div>

        <div v-if="loadingObjectifs" class="loading">Chargement...</div>
        <div v-else-if="!objectifs.length" class="empty-state">Aucun objectif.</div>
        <div v-else class="objectifs-list">
          <div v-for="o in objectifs" :key="o.id" class="objectif-card">
            <div class="obj-header">
              <span class="obj-titre">{{ o.titre }}</span>
              <span class="badge-statut-obj" :class="`objstatut--${o.statut}`">{{ labelStatutObj(o.statut) }}</span>
              <div v-if="isDirigeant" class="rc-actions">
                <button class="rc-btn" @click="editObjectif(o)">Modifier</button>
              </div>
            </div>
            <p v-if="o.description" class="obj-desc">{{ o.description }}</p>
            <div class="obj-footer">
              <span v-if="o.echeance" class="obj-echeance">Échéance : {{ fmtDate(o.echeance) }}</span>
              <span class="obj-resp">{{ o.responsable_nom }}</span>
            </div>
            <p v-if="o.note_suivi" class="obj-note">Note : {{ o.note_suivi }}</p>
          </div>
        </div>
      </div>

      <!-- ── Réunions ────────────────────────────────────────────────── -->
      <div v-if="innerTab === 'reunions-demon'" class="inner-content">
        <div v-if="loadingDemonReunions" class="loading">Chargement...</div>
        <div v-else-if="!demonReunions.length" class="empty-state">Aucune réunion enregistrée pour ce démon.</div>
        <div v-else class="reunions-list">
          <div v-for="r in demonReunions" :key="r.id" class="reunion-card">
            <div class="reunion-header">
              <span class="reunion-titre">{{ r.titre }}</span>
              <span class="badge-presence" :class="`presence--${r.presence}`">{{ labelPresence(r.presence) }}</span>
              <span class="reunion-date">{{ fmtDate(r.date_reunion) }}{{ r.heure ? ' — ' + r.heure : '' }}</span>
            </div>
            <div v-if="r.responsable_nom" class="reunion-meta">Responsable : {{ r.responsable_nom }}</div>
          </div>
        </div>
      </div>

      <!-- ── Évolution ───────────────────────────────────────────────── -->
      <div v-if="innerTab === 'evolution'" class="inner-content">
        <div v-if="loadingHistorique" class="loading">Chargement...</div>
        <div v-else-if="!historique.length" class="empty-state">Aucun événement enregistré.</div>
        <div v-else class="timeline">
          <div v-for="(e, idx) in historique" :key="idx" class="timeline-item"
            :class="`tl--${e.type}`">
            <div class="tl-dot"></div>
            <div class="tl-content">
              <div class="tl-label">{{ e.label }}</div>
              <div class="tl-date">{{ fmtDatetime(e.date) }}</div>
              <div v-if="e.type === 'remarque'" class="tl-extra">
                <span class="badge-type" :class="`badge--${e.details.type}`">{{ labelType(e.details.type) }}</span>
                <span v-if="e.details.auteur_nom" class="tl-auteur">{{ e.details.auteur_nom }}</span>
              </div>
              <div v-if="e.type === 'changement_rang'" class="tl-extra">
                <span>{{ e.details.ancien_rang }} → {{ e.details.nouveau_rang }}</span>
                <span v-if="e.details.responsable_nom" class="tl-auteur">{{ e.details.responsable_nom }}</span>
              </div>
              <div v-if="e.type === 'reunion'" class="tl-extra">
                <span class="badge-presence" :class="`presence--${e.details.presence}`">{{ labelPresence(e.details.presence) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </template>

  </div>

  <!-- ── Modal Modifier démon ──────────────────────────────────────────── -->
  <div v-if="showEdit" class="modal-backdrop" @click.self="showEdit = false">
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">Modifier la fiche</h2>
        <button class="modal-close" @click="showEdit = false">✕</button>
      </div>
      <form @submit.prevent="submitEdit" class="modal-form">
        <div class="form-group">
          <label>Nom <span class="req">*</span></label>
          <input v-model="editForm.nom" required />
        </div>
        <div class="form-group">
          <label>Pouvoir Sanguinaire</label>
          <input v-model="editForm.pouvoir_sanguinaire" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Statut</label>
            <select v-model="editForm.statut">
              <option value="actif">Actif</option>
              <option value="a_suivre">À suivre</option>
              <option value="inactif">Inactif</option>
              <option value="archive">Archivé</option>
            </select>
          </div>
          <div class="form-group">
            <label>Date d'arrivée</label>
            <input type="date" v-model="editForm.date_arrivee" />
          </div>
        </div>
        <div class="form-group">
          <label>Responsable référent</label>
          <input v-model="editForm.responsable_nom_libre" placeholder="Nom du responsable" />
        </div>
        <div class="form-group">
          <label>Notes générales</label>
          <textarea v-model="editForm.notes_generales" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label>Objectifs actuels</label>
          <textarea v-model="editForm.objectifs_actuels" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label>Photo</label>
          <div class="upload-zone" @click="$refs.editPhotoInput.click()" :class="{ 'upload-zone--has': editForm.photo_url }">
            <img v-if="editForm.photo_url" :src="serverUrl + editForm.photo_url" class="upload-preview" />
            <span v-else class="upload-hint">Cliquer pour choisir une image</span>
            <input ref="editPhotoInput" type="file" accept="image/*" style="display:none" @change="handleEditPhotoUpload" />
          </div>
          <div v-if="uploadingPhoto" class="upload-status">Envoi en cours...</div>
        </div>
        <div v-if="editError" class="form-error">{{ editError }}</div>
        <div class="form-actions">
          <button type="button" class="btn-cancel" @click="showEdit = false">Annuler</button>
          <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? 'Enregistrement...' : 'Enregistrer' }}</button>
        </div>
      </form>
    </div>
  </div>

  <!-- ── Modal Changer de rang ─────────────────────────────────────────── -->
  <div v-if="showChangerRang" class="modal-backdrop" @click.self="showChangerRang = false">
    <div class="modal modal--small">
      <div class="modal-header">
        <h2 class="modal-title">Changement de rang</h2>
        <button class="modal-close" @click="showChangerRang = false">✕</button>
      </div>
      <form @submit.prevent="submitChangerRang" class="modal-form">
        <p class="confirm-text">
          Confirmer le passage de <strong>{{ demon?.nom }}</strong>
          de <span class="badge-rang" :class="`rang--${demon?.rang?.toLowerCase()}`">{{ demon?.rang }}</span>
          vers <span class="badge-rang" :class="demon?.rang === 'Faible' ? 'rang--fort' : 'rang--faible'">{{ demon?.rang === 'Faible' ? 'Fort' : 'Faible' }}</span> ?
        </p>
        <div class="form-group">
          <label>Motif (facultatif)</label>
          <textarea v-model="rangMotif" rows="2" placeholder="Raison du changement de rang..."></textarea>
        </div>
        <div v-if="rangError" class="form-error">{{ rangError }}</div>
        <div class="form-actions">
          <button type="button" class="btn-cancel" @click="showChangerRang = false">Annuler</button>
          <button type="submit" class="btn-primary" :disabled="savingRang">{{ savingRang ? '...' : 'Confirmer' }}</button>
        </div>
      </form>
    </div>
  </div>

  <!-- ── Modal Ajouter une remarque ────────────────────────────────────── -->
  <div v-if="showAddRemarque" class="modal-backdrop" @click.self="showAddRemarque = false">
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">{{ editingRemarque ? 'Modifier la remarque' : 'Nouvelle remarque' }}</h2>
        <button class="modal-close" @click="closeRemarqueModal">✕</button>
      </div>
      <form @submit.prevent="submitRemarque" class="modal-form">
        <div class="form-row">
          <div class="form-group">
            <label>Type <span class="req">*</span></label>
            <select v-model="remarqueForm.type" required>
              <option value="positive">Positive</option>
              <option value="negative">Négative</option>
              <option value="neutre">Observation neutre</option>
            </select>
          </div>
          <div class="form-group">
            <label>Catégorie</label>
            <select v-model="remarqueForm.categorie">
              <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Date de l'événement <span class="req">*</span></label>
            <input type="date" v-model="remarqueForm.date_evenement" required />
          </div>
          <div class="form-group">
            <label>Statut de suivi</label>
            <select v-model="remarqueForm.statut_suivi">
              <option value="Information">Information</option>
              <option value="A_surveiller">À surveiller</option>
              <option value="En_cours">En cours</option>
              <option value="Resolu">Résolu</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Description <span class="req">*</span></label>
          <textarea v-model="remarqueForm.description" rows="4" required placeholder="Décrivez précisément les faits..."></textarea>
        </div>
        <div class="form-note" v-if="!editingRemarque">
          Auteur : <strong>{{ currentUser?.nom }}</strong> (automatique)
        </div>
        <div v-if="remarqueError" class="form-error">{{ remarqueError }}</div>
        <div class="form-actions">
          <button type="button" class="btn-cancel" @click="closeRemarqueModal">Annuler</button>
          <button type="submit" class="btn-primary" :disabled="savingRemarque">
            {{ savingRemarque ? 'Enregistrement...' : (editingRemarque ? 'Modifier' : 'Ajouter la remarque') }}
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- ── Modal Ajouter/modifier un objectif ────────────────────────────── -->
  <div v-if="showAddObjectif" class="modal-backdrop" @click.self="showAddObjectif = false">
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">{{ editingObjectif ? 'Modifier l\'objectif' : 'Nouvel objectif' }}</h2>
        <button class="modal-close" @click="closeObjectifModal">✕</button>
      </div>
      <form @submit.prevent="submitObjectif" class="modal-form">
        <div class="form-group">
          <label>Titre <span class="req">*</span></label>
          <input v-model="objectifForm.titre" required />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea v-model="objectifForm.description" rows="3"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Échéance</label>
            <input type="date" v-model="objectifForm.echeance" />
          </div>
          <div class="form-group">
            <label>Statut</label>
            <select v-model="objectifForm.statut">
              <option value="a_faire">À faire</option>
              <option value="en_cours">En cours</option>
              <option value="termine">Terminé</option>
              <option value="abandonne">Abandonné</option>
            </select>
          </div>
        </div>
        <div class="form-group" v-if="editingObjectif">
          <label>Note de suivi</label>
          <textarea v-model="objectifForm.note_suivi" rows="2"></textarea>
        </div>
        <div v-if="objectifError" class="form-error">{{ objectifError }}</div>
        <div class="form-actions">
          <button type="button" class="btn-cancel" @click="closeObjectifModal">Annuler</button>
          <button type="submit" class="btn-primary" :disabled="savingObjectif">
            {{ savingObjectif ? '...' : (editingObjectif ? 'Enregistrer' : 'Créer l\'objectif') }}
          </button>
        </div>
      </form>
    </div>
  </div>

</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppNavbar from './AppNavbar.vue'
import { currentUser } from '../auth.js'
import {
  rdGetDemon, rdUpdateDemon, rdChangerRang,
  rdGetRemarques, rdAddRemarque, rdUpdateRemarque, rdArchiverRemarque,
  rdGetObjectifs, rdAddObjectif, rdUpdateObjectif,
  rdGetDemonReunions, rdGetHistorique, rdGetUsers,
  uploadImage
} from '../api.js'
import { SERVER_URL } from '../api.js'

const serverUrl = SERVER_URL

const route = useRoute()
const demonId = route.params.id

// ── Permissions ──────────────────────────────────────────────────────────────

const isDirigeant = computed(() =>
  !!(currentUser.value?.demons_dirigeant || currentUser.value?.role === 'admin')
)

// ── Démon ────────────────────────────────────────────────────────────────────

const demon = ref(null)
const loading = ref(true)
const users = ref([])

async function loadDemon() {
  loading.value = true
  try { demon.value = await rdGetDemon(demonId) }
  catch (e) { console.error(e) }
  finally { loading.value = false }
}

// ── Onglets internes ─────────────────────────────────────────────────────────

const innerTabs = [
  { id: 'infos', label: 'Informations' },
  { id: 'remarques', label: 'Remarques' },
  { id: 'objectifs', label: 'Objectifs' },
  { id: 'reunions-demon', label: 'Réunions' },
  { id: 'evolution', label: 'Évolution' },
]
const innerTab = ref('infos')

function loadTab(id) {
  if (id === 'remarques' && !remarquesLoaded.value) loadRemarques()
  if (id === 'objectifs' && !objectifsLoaded.value) loadObjectifs()
  if (id === 'reunions-demon' && !demonReunionsLoaded.value) loadDemonReunions()
  if (id === 'evolution' && !historiqueLoaded.value) loadHistorique()
}

// ── Remarques ─────────────────────────────────────────────────────────────────

const remarques = ref([])
const loadingRemarques = ref(false)
const remarquesLoaded = ref(false)
const remarqueFilter = ref('all')
const showArchived = ref(false)
const showAddRemarque = ref(false)
const editingRemarque = ref(null)
const remarqueError = ref('')
const savingRemarque = ref(false)
const remarqueForm = ref(emptyRemarqueForm())

const categories = ['Comportement', 'Discipline', 'Respect de la hiérarchie', 'Entraînement', 'Patrouille', 'Implication', 'Initiative', 'Activité', 'Absence', 'Progression', 'Autre']

function emptyRemarqueForm() {
  const today = new Date().toISOString().split('T')[0]
  return { type: 'positive', categorie: 'Comportement', description: '', date_evenement: today, statut_suivi: 'Information' }
}

const filteredRemarques = computed(() => {
  if (remarqueFilter.value === 'all') return remarques.value
  return remarques.value.filter(r => r.type === remarqueFilter.value)
})

async function loadRemarques() {
  loadingRemarques.value = true
  try { remarques.value = await rdGetRemarques(demonId, showArchived.value) }
  catch (e) { console.error(e) }
  finally { loadingRemarques.value = false; remarquesLoaded.value = true }
}

function editRemarque(r) {
  editingRemarque.value = r
  remarqueForm.value = { type: r.type, categorie: r.categorie, description: r.description, date_evenement: r.date_evenement, statut_suivi: r.statut_suivi }
  showAddRemarque.value = true
}

function closeRemarqueModal() {
  showAddRemarque.value = false
  editingRemarque.value = null
  remarqueForm.value = emptyRemarqueForm()
  remarqueError.value = ''
}

async function submitRemarque() {
  savingRemarque.value = true
  remarqueError.value = ''
  try {
    if (editingRemarque.value) {
      await rdUpdateRemarque(demonId, editingRemarque.value.id, remarqueForm.value)
    } else {
      await rdAddRemarque(demonId, remarqueForm.value)
    }
    await loadRemarques()
    await loadDemon()
    closeRemarqueModal()
  } catch (e) {
    remarqueError.value = e.message
  } finally {
    savingRemarque.value = false
  }
}

async function archiverRemarque(id) {
  if (!confirm('Archiver cette remarque ?')) return
  try {
    await rdArchiverRemarque(demonId, id)
    await loadRemarques()
  } catch (e) { alert(e.message) }
}

// ── Objectifs ─────────────────────────────────────────────────────────────────

const objectifs = ref([])
const loadingObjectifs = ref(false)
const objectifsLoaded = ref(false)
const showAddObjectif = ref(false)
const editingObjectif = ref(null)
const objectifError = ref('')
const savingObjectif = ref(false)
const objectifForm = ref(emptyObjectifForm())

function emptyObjectifForm() {
  return { titre: '', description: '', echeance: '', statut: 'a_faire', note_suivi: '' }
}

async function loadObjectifs() {
  loadingObjectifs.value = true
  try { objectifs.value = await rdGetObjectifs(demonId) }
  catch (e) { console.error(e) }
  finally { loadingObjectifs.value = false; objectifsLoaded.value = true }
}

function editObjectif(o) {
  editingObjectif.value = o
  objectifForm.value = { titre: o.titre, description: o.description, echeance: o.echeance, statut: o.statut, note_suivi: o.note_suivi }
  showAddObjectif.value = true
}

function closeObjectifModal() {
  showAddObjectif.value = false
  editingObjectif.value = null
  objectifForm.value = emptyObjectifForm()
  objectifError.value = ''
}

async function submitObjectif() {
  savingObjectif.value = true
  objectifError.value = ''
  try {
    if (editingObjectif.value) {
      await rdUpdateObjectif(demonId, editingObjectif.value.id, objectifForm.value)
    } else {
      await rdAddObjectif(demonId, objectifForm.value)
    }
    await loadObjectifs()
    await loadDemon()
    closeObjectifModal()
  } catch (e) {
    objectifError.value = e.message
  } finally {
    savingObjectif.value = false
  }
}

// ── Réunions du démon ─────────────────────────────────────────────────────────

const demonReunions = ref([])
const loadingDemonReunions = ref(false)
const demonReunionsLoaded = ref(false)

async function loadDemonReunions() {
  loadingDemonReunions.value = true
  try { demonReunions.value = await rdGetDemonReunions(demonId) }
  catch (e) { console.error(e) }
  finally { loadingDemonReunions.value = false; demonReunionsLoaded.value = true }
}

// ── Historique ────────────────────────────────────────────────────────────────

const historique = ref([])
const loadingHistorique = ref(false)
const historiqueLoaded = ref(false)

async function loadHistorique() {
  loadingHistorique.value = true
  try { historique.value = await rdGetHistorique(demonId) }
  catch (e) { console.error(e) }
  finally { loadingHistorique.value = false; historiqueLoaded.value = true }
}

// ── Modifier démon ────────────────────────────────────────────────────────────

const showEdit = ref(false)
const editForm = ref({})
const editError = ref('')
const saving = ref(false)
const uploadingPhoto = ref(false)

function openEdit() {
  editForm.value = {
    nom: demon.value.nom,
    pouvoir_sanguinaire: demon.value.pouvoir_sanguinaire,
    statut: demon.value.statut,
    date_arrivee: demon.value.date_arrivee,
    responsable_nom_libre: demon.value.responsable_nom_libre || demon.value.responsable_nom || '',
    notes_generales: demon.value.notes_generales,
    objectifs_actuels: demon.value.objectifs_actuels,
    photo_url: demon.value.photo_url || '',
  }
  showEdit.value = true
}

async function handleEditPhotoUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  uploadingPhoto.value = true
  try {
    editForm.value.photo_url = await uploadImage(file)
  } catch (err) {
    editError.value = err.message
  } finally {
    uploadingPhoto.value = false
  }
}

async function submitEdit() {
  saving.value = true
  editError.value = ''
  try {
    const body = { ...editForm.value }
    if (!body.responsable_id) body.responsable_id = null
    await rdUpdateDemon(demonId, body)
    await loadDemon()
    showEdit.value = false
  } catch (e) {
    editError.value = e.message
  } finally {
    saving.value = false
  }
}

// ── Changer de rang ───────────────────────────────────────────────────────────

const showChangerRang = ref(false)
const rangMotif = ref('')
const rangError = ref('')
const savingRang = ref(false)

async function submitChangerRang() {
  savingRang.value = true
  rangError.value = ''
  try {
    const nouveau_rang = demon.value.rang === 'Faible' ? 'Fort' : 'Faible'
    await rdChangerRang(demonId, { nouveau_rang, motif: rangMotif.value })
    await loadDemon()
    showChangerRang.value = false
    rangMotif.value = ''
  } catch (e) {
    rangError.value = e.message
  } finally {
    savingRang.value = false
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
  return isNaN(dt) ? d : dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function labelType(t) {
  return { positive: 'Positive', negative: 'Négative', neutre: 'Neutre' }[t] || t
}

function labelStatut(s) {
  return { actif: 'Actif', a_suivre: 'À suivre', inactif: 'Inactif', archive: 'Archivé' }[s] || s
}

function labelStatutObj(s) {
  return { a_faire: 'À faire', en_cours: 'En cours', termine: 'Terminé', abandonne: 'Abandonné' }[s] || s
}

function labelSuivi(s) {
  return { Information: 'Info', A_surveiller: 'À surveiller', En_cours: 'En cours', Resolu: 'Résolu' }[s] || s
}

function labelPresence(p) {
  return { present: 'Présent', absent: 'Absent', excuse: 'Excusé' }[p] || p
}

// ── Init ─────────────────────────────────────────────────────────────────────

onMounted(async () => {
  await loadDemon()
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

.back-row { margin-bottom: 1.5rem; }

.back-link {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.3);
  text-decoration: none;
  transition: color 0.15s;
}
.back-link:hover { color: rgba(255,255,255,0.65); }

/* En-tête fiche */
.fiche-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.fiche-identity { display: flex; align-items: flex-start; gap: 1.2rem; }

.fiche-avatar {
  width: 72px;
  height: 72px;
  background: #1a0808;
  border: 1px solid rgba(139,26,26,0.3);
  color: #8b1a1a;
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

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

.fiche-nom {
  font-family: 'Cinzel', serif;
  font-size: 1.3rem;
  letter-spacing: 0.1em;
  color: #fff;
  margin-bottom: 0.3rem;
}

.fiche-pouvoir {
  font-style: italic;
  color: rgba(255,255,255,0.4);
  margin-bottom: 0.6rem;
}

.fiche-meta { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; }

.meta-resp { font-size: 0.85rem; color: rgba(255,255,255,0.4); font-style: italic; }
.meta-date { font-size: 0.82rem; color: rgba(255,255,255,0.3); font-style: italic; }

.fiche-actions { display: flex; gap: 0.6rem; align-items: center; }

/* Résumé */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.8rem;
  margin-bottom: 2rem;
}

.sum-card {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.06);
  padding: 1rem;
  text-align: center;
}

.sum-value {
  font-family: 'Cinzel', serif;
  font-size: 1.6rem;
  color: #fff;
  line-height: 1;
}

.sum-label {
  font-size: 0.7rem;
  font-style: italic;
  color: rgba(255,255,255,0.3);
  margin-top: 0.3rem;
}

.sum-card--positive .sum-value { color: #5a9a5a; }
.sum-card--negative .sum-value { color: #c04040; }
.sum-card--neutre .sum-value { color: #7070b0; }

/* Onglets internes */
.inner-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 2rem;
}

.inner-tab {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.07em;
  color: rgba(255,255,255,0.3);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0.7rem 1.2rem;
  cursor: pointer;
  transition: all 0.15s;
  margin-bottom: -1px;
  text-transform: uppercase;
}

.inner-tab:hover { color: rgba(255,255,255,0.6); }
.inner-tab.active { color: #fff; border-bottom-color: #8b1a1a; }

.inner-content { animation: fadeIn 0.2s; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

/* Infos */
.infos-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.2rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

.info-block { display: flex; flex-direction: column; gap: 0.3rem; }

.info-label {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.3);
  text-transform: uppercase;
}

.notes-block {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.06);
  padding: 1rem;
  margin-bottom: 1rem;
}

.notes-title {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.4);
  text-transform: uppercase;
  margin: 0 0 0.6rem;
}

.notes-block p { margin: 0; line-height: 1.7; color: rgba(255,255,255,0.65); }

/* Toolbar */
.tab-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.2rem;
  flex-wrap: wrap;
  gap: 0.8rem;
}

.toolbar-filters { display: flex; gap: 0.3rem; }
.toolbar-right { display: flex; align-items: center; gap: 0.8rem; }

.filter-btn {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: none;
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.3);
  padding: 0.35rem 0.8rem;
  cursor: pointer;
  transition: all 0.15s;
}

.filter-btn:hover { color: rgba(255,255,255,0.65); border-color: rgba(255,255,255,0.15); }
.filter-btn.active { color: #fff; border-color: rgba(255,255,255,0.25); background: rgba(255,255,255,0.04); }

/* Remarques */
.remarques-list { display: flex; flex-direction: column; gap: 0.8rem; }

.remarque-card {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.06);
  border-left: 4px solid transparent;
  padding: 1rem 1.2rem;
}

.remarque-card--positive { border-left-color: #4a7a4a; }
.remarque-card--negative { border-left-color: #8b2020; }
.remarque-card--neutre { border-left-color: #5a5a8a; }

.rc-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.6rem;
  flex-wrap: wrap;
}

.rc-categorie { font-size: 0.82rem; color: rgba(255,255,255,0.4); }

.rc-statut {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.4rem;
  text-transform: uppercase;
}

.rstatut--Information { background: rgba(80,80,80,0.2); color: #909090; border: 1px solid rgba(80,80,80,0.3); }
.rstatut--A_surveiller { background: rgba(180,100,0,0.15); color: #d4a040; border: 1px solid rgba(180,100,0,0.25); }
.rstatut--En_cours { background: rgba(40,80,160,0.15); color: #6090d0; border: 1px solid rgba(40,80,160,0.25); }
.rstatut--Resolu { background: rgba(40,100,40,0.15); color: #78b878; border: 1px solid rgba(40,100,40,0.25); }

.rc-date { font-size: 0.78rem; font-style: italic; color: rgba(255,255,255,0.3); margin-left: auto; }
.rc-actions { display: flex; gap: 0.4rem; }

.rc-btn {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.05em;
  background: none;
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.3);
  padding: 0.2rem 0.5rem;
  cursor: pointer;
  transition: all 0.12s;
  text-transform: uppercase;
}

.rc-btn:hover { color: rgba(255,255,255,0.7); border-color: rgba(255,255,255,0.2); }
.rc-btn--danger:hover { color: #c04040; border-color: rgba(192,64,64,0.3); }

.rc-desc {
  font-size: 0.95rem;
  line-height: 1.6;
  color: rgba(255,255,255,0.7);
  margin: 0 0 0.7rem;
}

.rc-footer {
  display: flex;
  justify-content: space-between;
  font-size: 0.78rem;
  font-style: italic;
  color: rgba(255,255,255,0.3);
}

/* Objectifs */
.objectifs-list { display: flex; flex-direction: column; gap: 0.8rem; }

.objectif-card {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.06);
  padding: 1rem 1.2rem;
}

.obj-header {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-bottom: 0.4rem;
}

.obj-titre {
  font-family: 'Cinzel', serif;
  font-size: 0.8rem;
  letter-spacing: 0.05em;
  color: #fff;
  flex: 1;
}

.badge-statut-obj {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.4rem;
  text-transform: uppercase;
}

.objstatut--a_faire { background: rgba(80,80,80,0.15); color: #909090; border: 1px solid rgba(80,80,80,0.25); }
.objstatut--en_cours { background: rgba(40,80,160,0.15); color: #6090d0; border: 1px solid rgba(40,80,160,0.25); }
.objstatut--termine { background: rgba(40,100,40,0.15); color: #78b878; border: 1px solid rgba(40,100,40,0.25); }
.objstatut--abandonne { background: rgba(80,40,40,0.15); color: #a06060; border: 1px solid rgba(80,40,40,0.25); }

.obj-desc { font-size: 0.9rem; color: rgba(255,255,255,0.5); margin: 0 0 0.5rem; font-style: italic; }

.obj-footer {
  display: flex;
  justify-content: space-between;
  font-size: 0.78rem;
  color: rgba(255,255,255,0.3);
  font-style: italic;
}

.obj-echeance { color: rgba(255,255,255,0.4); }
.obj-note { font-size: 0.85rem; color: rgba(255,255,255,0.45); margin: 0.5rem 0 0; font-style: italic; }

/* Réunions */
.reunions-list { display: flex; flex-direction: column; gap: 0.6rem; }

.reunion-card {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.06);
  padding: 0.9rem 1.2rem;
}

.reunion-header {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;
}

.reunion-titre { font-family: 'Cinzel', serif; font-size: 0.78rem; letter-spacing: 0.05em; color: #fff; flex: 1; }
.reunion-date { font-size: 0.8rem; font-style: italic; color: rgba(255,255,255,0.35); }
.reunion-meta { font-size: 0.82rem; color: rgba(255,255,255,0.3); font-style: italic; margin-top: 0.3rem; }

/* Timeline */
.timeline { position: relative; padding-left: 2rem; }

.timeline::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(255,255,255,0.06);
}

.timeline-item {
  position: relative;
  margin-bottom: 1.5rem;
}

.tl-dot {
  position: absolute;
  left: -1.65rem;
  top: 4px;
  width: 10px;
  height: 10px;
  border: 1px solid rgba(255,255,255,0.15);
  background: #0f0f10;
  border-radius: 50%;
}

.tl--creation .tl-dot { background: #8b1a1a; border-color: #8b1a1a; }
.tl--changement_rang .tl-dot { background: #4a6a9a; border-color: #4a6a9a; }
.tl--remarque .tl-dot { background: #5a5a8a; border-color: #5a5a8a; }
.tl--objectif_termine .tl-dot { background: #4a7a4a; border-color: #4a7a4a; }

.tl-content {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.05);
  padding: 0.7rem 1rem;
}

.tl-label { font-family: 'Cinzel', serif; font-size: 0.72rem; letter-spacing: 0.05em; color: rgba(255,255,255,0.7); }
.tl-date { font-size: 0.75rem; font-style: italic; color: rgba(255,255,255,0.25); margin-top: 0.2rem; }
.tl-extra { display: flex; align-items: center; gap: 0.6rem; margin-top: 0.4rem; }
.tl-auteur { font-size: 0.78rem; font-style: italic; color: rgba(255,255,255,0.3); }

/* Confirmation */
.confirm-text { font-size: 0.95rem; line-height: 1.7; color: rgba(255,255,255,0.7); margin: 0; }
.confirm-text strong { color: #fff; }

.form-note { font-size: 0.82rem; color: rgba(255,255,255,0.35); font-style: italic; }

/* Badges communs */
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
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: none;
  color: rgba(255,255,255,0.5);
  border: 1px solid rgba(255,255,255,0.12);
  padding: 0.55rem 1.1rem;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-secondary:hover { border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.8); }

.btn-rang {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: rgba(74,106,154,0.1);
  color: #6a96c4;
  border: 1px solid rgba(74,106,154,0.25);
  padding: 0.55rem 1.1rem;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-rang:hover { background: rgba(74,106,154,0.2); border-color: rgba(74,106,154,0.4); }

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

/* Archive toggle */
.archive-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
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

.modal--small { max-width: 420px; }

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
}
.modal-close:hover { color: rgba(255,255,255,0.7); }

.modal-form { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }

.form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; }
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
.form-group textarea:focus { outline: none; border-color: rgba(139,26,26,0.5); }

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

/* États */
.loading { color: rgba(255,255,255,0.3); font-style: italic; padding: 2rem 0; text-align: center; }
.empty-state { color: rgba(255,255,255,0.25); font-style: italic; text-align: center; padding: 3rem 0; }
.error-state { color: rgba(255,255,255,0.3); font-style: italic; text-align: center; padding: 4rem 0; }

/* Responsive */
@media (max-width: 900px) {
  .summary-cards { grid-template-columns: repeat(3, 1fr); }
  .infos-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 600px) {
  .page { padding: 1rem; }
  .summary-cards { grid-template-columns: repeat(2, 1fr); }
  .fiche-header { flex-direction: column; gap: 1rem; }
  .sum-value { font-size: 1.2rem; }
}
</style>

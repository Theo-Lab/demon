<template>
  <div class="entr-page">
    <AppNavbar />

    <div v-if="loading" class="entr-loading">Chargement…</div>

    <div v-else class="entr-inner">

      <!-- Header statut -->
      <div class="entr-header">
        <h1 class="entr-title">Tableau d'Entraînement</h1>
        <div class="entr-statut-row">
          <span class="entr-badge" :class="me.paye ? 'entr-badge--ok' : 'entr-badge--non'">
            {{ me.paye ? '✓ Contribution versée' : '✗ Contribution non versée' }}
          </span>
          <span v-if="me.paye" class="entr-badge" :class="me.inscrit ? 'entr-badge--ok' : 'entr-badge--warn'">
            {{ me.inscrit ? '✓ Inscrit cette semaine' : '— Non inscrit cette semaine' }}
          </span>
          <span class="entr-badge entr-badge--pts">{{ me.points }} pt{{ me.points !== 1 ? 's' : '' }}</span>
        </div>
      </div>

      <!-- Onglets -->
      <div class="entr-tabs">
        <button
          v-for="t in tabsVisible"
          :key="t.key"
          class="entr-tab"
          :class="{ 'entr-tab--active': onglet === t.key }"
          @click="onglet = t.key"
        >{{ t.label }}</button>
      </div>

      <!-- ══ CLASSEMENT ═══════════════════════════════════════════════ -->
      <div v-if="onglet === 'classement'" class="entr-section">
        <div class="entr-section-header">
          <h2 class="entr-section-title">Classement</h2>
          <span class="entr-count">{{ classement.length }} demon{{ classement.length !== 1 ? 's' : '' }}</span>
        </div>

        <div v-if="classement.length === 0" class="entr-vide">Aucun démon inscrit au système d'entraînement.</div>

        <div class="entr-classement-list">
          <div
            v-for="(demon, idx) in classement"
            :key="demon.id"
            class="entr-rank-row"
            :class="{ 'entr-rank-row--self': demon.id === currentUser?.id }"
          >
            <span class="entr-rank-num" :class="idx === 0 ? 'entr-rank-num--1' : idx === 1 ? 'entr-rank-num--2' : idx === 2 ? 'entr-rank-num--3' : ''">
              #{{ idx + 1 }}
            </span>
            <div class="entr-rank-info">
              <span class="entr-rank-nom">{{ demon.nom }}</span>
              <span class="entr-rank-grade">{{ demon.grade }}</span>
            </div>
            <span class="entr-rank-pts">{{ demon.points }} <span class="entr-rank-pts-label">pt{{ demon.points !== 1 ? 's' : '' }}</span></span>
          </div>
        </div>
      </div>

      <!-- ══ CETTE SEMAINE ════════════════════════════════════════════ -->
      <div v-if="onglet === 'semaine'" class="entr-section">

        <div class="entr-semaine-header">
          <h2 class="entr-section-title">Semaine du {{ formatSemaine(semaine.semaine) }}</h2>
          <div class="entr-delai" :class="semaine.ouvert ? 'entr-delai--ouvert' : 'entr-delai--ferme'">
            {{ semaine.ouvert ? '⏳ Inscriptions ouvertes — délai : mercredi 19h00' : '🔒 Inscriptions fermées' }}
          </div>
        </div>

        <!-- Inscription -->
        <div v-if="me.paye" class="entr-inscription-box">
          <div v-if="me.inscrit" class="entr-inscrit-msg">
            <span>✓ Vous êtes inscrit pour cette semaine.</span>
            <button v-if="semaine.ouvert" class="entr-btn entr-btn--ghost entr-btn--sm" @click="seDesinscrire">Se désinscrire</button>
          </div>
          <div v-else-if="semaine.ouvert" class="entr-inscrit-msg">
            <span>Vous n'êtes pas encore inscrit pour cette semaine.</span>
            <button class="entr-btn entr-btn--sm" @click="sInscrire">S'inscrire</button>
          </div>
          <div v-else class="entr-inscrit-msg entr-inscrit-msg--warn">
            Les inscriptions sont fermées. Revenez lundi prochain.
          </div>
        </div>
        <div v-else class="entr-inscription-box entr-inscription-box--non-paye">
          Pour participer, versez la contribution de <strong>100 000 ¥</strong> auprès de l'Intendance.
        </div>

        <!-- Inscrits de la semaine -->
        <div class="entr-subsection">
          <h3 class="entr-subsection-title">Inscrits ({{ semaine.inscriptions?.length || 0 }})</h3>
          <div v-if="!semaine.inscriptions?.length" class="entr-vide-sm">Aucun inscrit.</div>
          <div class="entr-inscrits-grid">
            <span v-for="ins in semaine.inscriptions" :key="ins.user_id" class="entr-inscrit-chip">{{ ins.nom }}</span>
          </div>
        </div>

        <!-- Séances -->
        <div class="entr-subsection">
          <h3 class="entr-subsection-title">Séances ({{ semaine.seances?.length || 0 }})</h3>
          <div v-if="!semaine.seances?.length" class="entr-vide-sm">Aucune séance cette semaine.</div>
          <div class="entr-seances-list">
            <div v-for="s in semaine.seances" :key="s.id" class="entr-seance-card">
              <div class="entr-seance-head">
                <span class="entr-seance-titre">{{ s.titre }}</span>
                <span v-if="s.multiplicateur > 1" class="entr-multi-badge">×{{ s.multiplicateur }}</span>
              </div>
              <div class="entr-seance-participants">
                <div v-for="p in s.participations" :key="p.user_id" class="entr-participant-chip" :class="p.role === 'organisateur' ? 'entr-participant-chip--org' : ''">
                  {{ p.nom }}
                  <span class="entr-participant-role">{{ p.role === 'organisateur' ? '+' + (2 * s.multiplicateur) : '+' + s.multiplicateur }}</span>
                </div>
                <div v-if="!s.participations?.length" class="entr-vide-sm">Aucun participant enregistré.</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- ══ GESTION ══════════════════════════════════════════════════ -->
      <div v-if="onglet === 'gestion'" class="entr-section">

        <!-- Paiements -->
        <div class="entr-subsection">
          <div class="entr-section-header">
            <h3 class="entr-subsection-title">Paiements ({{ paiements.length }})</h3>
            <button class="entr-btn entr-btn--sm" @click="showAddPaiement = true">+ Ajouter</button>
          </div>
          <div class="entr-paiements-list">
            <div v-for="p in paiements" :key="p.user_id" class="entr-paiement-row">
              <span class="entr-paiement-nom">{{ p.nom }}</span>
              <span class="entr-paiement-id">{{ p.identifiant }}</span>
              <button class="entr-btn entr-btn--sm entr-btn--danger" @click="deletePaiement(p.user_id)">Retirer</button>
            </div>
            <div v-if="!paiements.length" class="entr-vide-sm">Aucun paiement enregistré.</div>
          </div>
        </div>

        <!-- Inscriptions manuelles -->
        <div class="entr-subsection">
          <div class="entr-section-header">
            <h3 class="entr-subsection-title">Inscrits cette semaine</h3>
            <button class="entr-btn entr-btn--sm" @click="showAddInscription = true">+ Ajouter</button>
          </div>
          <div class="entr-paiements-list">
            <div v-for="ins in semaine.inscriptions" :key="ins.user_id" class="entr-paiement-row">
              <span class="entr-paiement-nom">{{ ins.nom }}</span>
              <span class="entr-paiement-id">{{ ins.identifiant }}</span>
              <button class="entr-btn entr-btn--sm entr-btn--danger" @click="deleteInscription(ins.user_id)">Retirer</button>
            </div>
            <div v-if="!semaine.inscriptions?.length" class="entr-vide-sm">Aucun inscrit.</div>
          </div>
        </div>

        <!-- Séances -->
        <div class="entr-subsection">
          <div class="entr-section-header">
            <h3 class="entr-subsection-title">Séances</h3>
            <button class="entr-btn entr-btn--sm" @click="openNewSeance">+ Nouvelle séance</button>
          </div>
          <div class="entr-seances-list">
            <div v-for="s in semaine.seances" :key="s.id" class="entr-seance-card entr-seance-card--gestion">
              <div class="entr-seance-head">
                <span class="entr-seance-titre">{{ s.titre }}</span>
                <span v-if="s.multiplicateur > 1" class="entr-multi-badge">×{{ s.multiplicateur }}</span>
                <div class="entr-seance-actions">
                  <button class="entr-btn entr-btn--sm entr-btn--ghost" @click="openEditSeance(s)">Modifier</button>
                  <button class="entr-btn entr-btn--sm entr-btn--danger" @click="deleteSeance(s.id)">Supprimer</button>
                </div>
              </div>
              <div class="entr-seance-participants">
                <div v-for="p in s.participations" :key="p.user_id" class="entr-participant-chip" :class="p.role === 'organisateur' ? 'entr-participant-chip--org' : ''">
                  {{ p.nom }}
                  <span class="entr-participant-role">{{ p.role === 'organisateur' ? 'Org +' + (2 * s.multiplicateur) : '+' + s.multiplicateur }}</span>
                  <button class="entr-chip-del" @click="deleteParticipation(s.id, p.user_id)">✕</button>
                </div>
                <button class="entr-btn entr-btn--sm entr-btn--ghost" @click="openAddParticipation(s)">+ Participant</button>
              </div>
            </div>
            <div v-if="!semaine.seances?.length" class="entr-vide-sm">Aucune séance.</div>
          </div>
        </div>

      </div>
    </div>

    <!-- ══ MODAL PAIEMENT ══════════════════════════════════════════════ -->
    <div v-if="showAddPaiement" class="entr-modal-overlay" @click.self="showAddPaiement = false">
      <div class="entr-modal">
        <h2 class="entr-modal-title">Ajouter un paiement</h2>
        <div class="entr-field">
          <label class="entr-field-label">Utilisateur</label>
          <div class="entr-user-search">
            <input v-model="paiementSearch" class="entr-field-input" type="text" placeholder="Rechercher…" autocomplete="off" @focus="paiementSearchOpen = true" @blur="closePaiementSearch" />
            <div v-if="paiementSearchOpen && paiementSearch && paiementSuggestions.length" class="entr-user-dropdown">
              <div v-for="u in paiementSuggestions" :key="u.id" class="entr-user-option" @mousedown.prevent="selectPaiementUser(u)">
                {{ u.nom }} <span class="entr-user-id">{{ u.identifiant }}</span>
              </div>
            </div>
            <p v-if="paiementUserId" class="entr-user-selected">✓ {{ paiementSearch }}</p>
          </div>
        </div>
        <div v-if="modalError" class="entr-modal-error">{{ modalError }}</div>
        <div class="entr-modal-actions">
          <button class="entr-btn entr-btn--ghost" @click="showAddPaiement = false">Annuler</button>
          <button class="entr-btn" @click="addPaiement">Ajouter</button>
        </div>
      </div>
    </div>

    <!-- ══ MODAL INSCRIPTION ═══════════════════════════════════════════ -->
    <div v-if="showAddInscription" class="entr-modal-overlay" @click.self="showAddInscription = false">
      <div class="entr-modal">
        <h2 class="entr-modal-title">Ajouter une inscription</h2>
        <div class="entr-field">
          <label class="entr-field-label">Utilisateur</label>
          <div class="entr-user-search">
            <input v-model="inscriptionSearch" class="entr-field-input" type="text" placeholder="Rechercher…" autocomplete="off" @focus="inscriptionSearchOpen = true" @blur="closeInscriptionSearch" />
            <div v-if="inscriptionSearchOpen && inscriptionSearch && inscriptionSuggestions.length" class="entr-user-dropdown">
              <div v-for="u in inscriptionSuggestions" :key="u.id" class="entr-user-option" @mousedown.prevent="selectInscriptionUser(u)">
                {{ u.nom }} <span class="entr-user-id">{{ u.identifiant }}</span>
              </div>
            </div>
            <p v-if="inscriptionUserId" class="entr-user-selected">✓ {{ inscriptionSearch }}</p>
          </div>
        </div>
        <div v-if="modalError" class="entr-modal-error">{{ modalError }}</div>
        <div class="entr-modal-actions">
          <button class="entr-btn entr-btn--ghost" @click="showAddInscription = false">Annuler</button>
          <button class="entr-btn" @click="addInscription">Ajouter</button>
        </div>
      </div>
    </div>

    <!-- ══ MODAL SEANCE ════════════════════════════════════════════════ -->
    <div v-if="showSeanceModal" class="entr-modal-overlay" @click.self="closeSeanceModal">
      <div class="entr-modal">
        <h2 class="entr-modal-title">{{ editingSeance ? 'Modifier la séance' : 'Nouvelle séance' }}</h2>
        <div class="entr-field">
          <label class="entr-field-label">Titre *</label>
          <input v-model="seanceForm.titre" class="entr-field-input" type="text" placeholder="Nom de la séance" />
        </div>
        <div class="entr-field">
          <label class="entr-field-label">Multiplicateur</label>
          <div class="entr-multi-row">
            <button class="entr-multi-btn" :class="seanceForm.multiplicateur === 1 ? 'entr-multi-btn--active' : ''" @click="seanceForm.multiplicateur = 1">×1 (normal)</button>
            <button class="entr-multi-btn" :class="seanceForm.multiplicateur === 2 ? 'entr-multi-btn--active' : ''" @click="seanceForm.multiplicateur = 2">×2 (spécial)</button>
          </div>
        </div>
        <div v-if="modalError" class="entr-modal-error">{{ modalError }}</div>
        <div class="entr-modal-actions">
          <button class="entr-btn entr-btn--ghost" @click="closeSeanceModal">Annuler</button>
          <button class="entr-btn" :disabled="savingSeance" @click="saveSeance">
            {{ savingSeance ? '…' : (editingSeance ? 'Enregistrer' : 'Créer') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ══ MODAL PARTICIPATION ═════════════════════════════════════════ -->
    <div v-if="showParticipationModal" class="entr-modal-overlay" @click.self="showParticipationModal = false">
      <div class="entr-modal">
        <h2 class="entr-modal-title">Ajouter un participant — {{ participationSeance?.titre }}</h2>
        <div class="entr-field">
          <label class="entr-field-label">Utilisateur</label>
          <div class="entr-user-search">
            <input v-model="participationSearch" class="entr-field-input" type="text" placeholder="Rechercher…" autocomplete="off" @focus="participationSearchOpen = true" @blur="closeParticipationSearch" />
            <div v-if="participationSearchOpen && participationSearch && participationSuggestions.length" class="entr-user-dropdown">
              <div v-for="u in participationSuggestions" :key="u.id" class="entr-user-option" @mousedown.prevent="selectParticipationUser(u)">
                {{ u.nom }} <span class="entr-user-id">{{ u.identifiant }}</span>
              </div>
            </div>
            <p v-if="participationUserId" class="entr-user-selected">✓ {{ participationSearch }}</p>
          </div>
        </div>
        <div class="entr-field">
          <label class="entr-field-label">Rôle</label>
          <div class="entr-multi-row">
            <button class="entr-multi-btn" :class="participationRole === 'participant' ? 'entr-multi-btn--active' : ''" @click="participationRole = 'participant'">Participant (+{{ participationSeance?.multiplicateur || 1 }})</button>
            <button class="entr-multi-btn" :class="participationRole === 'organisateur' ? 'entr-multi-btn--active' : ''" @click="participationRole = 'organisateur'">Organisateur (+{{ (participationSeance?.multiplicateur || 1) * 2 }})</button>
          </div>
        </div>
        <div v-if="modalError" class="entr-modal-error">{{ modalError }}</div>
        <div class="entr-modal-actions">
          <button class="entr-btn entr-btn--ghost" @click="showParticipationModal = false">Annuler</button>
          <button class="entr-btn" @click="addParticipation">Ajouter</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import AppNavbar from './AppNavbar.vue'
import { currentUser } from '../auth.js'
import {
  entrainementMe, entrainementClassement, entrainementSemaine,
  entrainementInscrire, entrainementDesinscrire,
  entrainementGetPaiements, entrainementAddPaiement, entrainementDeletePaiement,
  entrainementAddInscription, entrainementDeleteInscription,
  entrainementCreateSeance, entrainementUpdateSeance, entrainementDeleteSeance,
  entrainementAddParticipation, entrainementDeleteParticipation, entrainementGetUsers,
} from '../api.js'

// ── State ─────────────────────────────────────────────────────────────────────
const loading    = ref(true)
const me         = ref({ paye: false, inscrit: false, points: 0, ouvert: false, semaine: '', intendance: false })
const classement = ref([])
const semaine    = ref({ semaine: '', inscriptions: [], seances: [], ouvert: false })
const paiements  = ref([])
const allUsers   = ref([])
const onglet     = ref('classement')
const modalError = ref('')

const tabs = [
  { key: 'classement', label: 'Classement' },
  { key: 'semaine',    label: 'Cette semaine' },
  { key: 'gestion',    label: 'Gestion' },
]
const tabsVisible = computed(() => {
  if (me.value.intendance) return tabs
  return tabs.filter(t => t.key !== 'gestion')
})

onMounted(async () => {
  try {
    const [meData, classData, semaineData] = await Promise.all([
      entrainementMe(), entrainementClassement(), entrainementSemaine()
    ])
    me.value        = meData
    classement.value = classData
    semaine.value   = semaineData
    if (meData.intendance) {
      const [pays, users] = await Promise.all([entrainementGetPaiements(), entrainementGetUsers()])
      paiements.value = pays
      allUsers.value  = users
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
})

function formatSemaine(key) {
  if (!key) return ''
  try {
    const d = new Date(key)
    const fin = new Date(d); fin.setDate(d.getDate() + 6)
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) + ' — ' + fin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return key }
}

// ── Inscription ───────────────────────────────────────────────────────────────
async function sInscrire() {
  try {
    await entrainementInscrire()
    me.value.inscrit = true
    await reloadSemaine()
  } catch (e) { alert(e.message) }
}
async function seDesinscrire() {
  if (!confirm('Se désinscrire de cette semaine ?')) return
  try {
    await entrainementDesinscrire()
    me.value.inscrit = false
    await reloadSemaine()
  } catch (e) { alert(e.message) }
}
async function reloadSemaine() {
  semaine.value = await entrainementSemaine()
}
async function reloadClassement() {
  classement.value = await entrainementClassement()
}

// ── Paiements ─────────────────────────────────────────────────────────────────
const showAddPaiement   = ref(false)
const paiementSearch    = ref('')
const paiementUserId    = ref(null)
const paiementSearchOpen = ref(false)

const paiementSuggestions = computed(() => {
  const q = paiementSearch.value.trim().toLowerCase()
  if (!q) return []
  return allUsers.value.filter(u => u.nom.toLowerCase().includes(q) || u.identifiant.toLowerCase().includes(q)).slice(0, 8)
})
function selectPaiementUser(u) { paiementUserId.value = u.id; paiementSearch.value = u.nom; paiementSearchOpen.value = false }
function closePaiementSearch() { setTimeout(() => { paiementSearchOpen.value = false }, 150) }

async function addPaiement() {
  modalError.value = ''
  if (!paiementUserId.value) { modalError.value = 'Sélectionnez un utilisateur.'; return }
  try {
    await entrainementAddPaiement(paiementUserId.value)
    paiements.value = await entrainementGetPaiements()
    showAddPaiement.value = false
    paiementSearch.value = ''; paiementUserId.value = null
  } catch (e) { modalError.value = e.message }
}
async function deletePaiement(userId) {
  if (!confirm('Retirer ce paiement ?')) return
  try {
    await entrainementDeletePaiement(userId)
    paiements.value = paiements.value.filter(p => p.user_id !== userId)
  } catch (e) { alert(e.message) }
}

// ── Inscriptions admin ────────────────────────────────────────────────────────
const showAddInscription    = ref(false)
const inscriptionSearch     = ref('')
const inscriptionUserId     = ref(null)
const inscriptionSearchOpen = ref(false)

const inscriptionSuggestions = computed(() => {
  const q = inscriptionSearch.value.trim().toLowerCase()
  if (!q) return []
  return allUsers.value.filter(u => u.nom.toLowerCase().includes(q) || u.identifiant.toLowerCase().includes(q)).slice(0, 8)
})
function selectInscriptionUser(u) { inscriptionUserId.value = u.id; inscriptionSearch.value = u.nom; inscriptionSearchOpen.value = false }
function closeInscriptionSearch() { setTimeout(() => { inscriptionSearchOpen.value = false }, 150) }

async function addInscription() {
  modalError.value = ''
  if (!inscriptionUserId.value) { modalError.value = 'Sélectionnez un utilisateur.'; return }
  try {
    await entrainementAddInscription(inscriptionUserId.value, semaine.value.semaine)
    await reloadSemaine()
    showAddInscription.value = false
    inscriptionSearch.value = ''; inscriptionUserId.value = null
  } catch (e) { modalError.value = e.message }
}
async function deleteInscription(userId) {
  if (!confirm('Retirer cet inscrit ?')) return
  try {
    await entrainementDeleteInscription(userId, semaine.value.semaine)
    await reloadSemaine()
  } catch (e) { alert(e.message) }
}

// ── Séances ───────────────────────────────────────────────────────────────────
const showSeanceModal = ref(false)
const editingSeance   = ref(null)
const savingSeance    = ref(false)
const seanceForm      = ref({ titre: '', multiplicateur: 1 })

function openNewSeance() { seanceForm.value = { titre: '', multiplicateur: 1 }; modalError.value = ''; editingSeance.value = null; showSeanceModal.value = true }
function openEditSeance(s) { seanceForm.value = { titre: s.titre, multiplicateur: s.multiplicateur }; modalError.value = ''; editingSeance.value = s; showSeanceModal.value = true }
function closeSeanceModal() { showSeanceModal.value = false; editingSeance.value = null }

async function saveSeance() {
  modalError.value = ''
  if (!seanceForm.value.titre.trim()) { modalError.value = 'Titre requis.'; return }
  savingSeance.value = true
  try {
    if (editingSeance.value) {
      const updated = await entrainementUpdateSeance(editingSeance.value.id, seanceForm.value)
      const idx = semaine.value.seances.findIndex(s => s.id === updated.id)
      if (idx !== -1) semaine.value.seances[idx] = updated
    } else {
      const created = await entrainementCreateSeance({ ...seanceForm.value, semaine: semaine.value.semaine })
      semaine.value.seances.push(created)
    }
    closeSeanceModal()
  } catch (e) { modalError.value = e.message } finally { savingSeance.value = false }
}
async function deleteSeance(id) {
  if (!confirm('Supprimer cette séance et toutes ses participations ?')) return
  try {
    await entrainementDeleteSeance(id)
    semaine.value.seances = semaine.value.seances.filter(s => s.id !== id)
    await reloadClassement()
  } catch (e) { alert(e.message) }
}

// ── Participations ────────────────────────────────────────────────────────────
const showParticipationModal = ref(false)
const participationSeance    = ref(null)
const participationSearch    = ref('')
const participationUserId    = ref(null)
const participationRole      = ref('participant')
const participationSearchOpen = ref(false)

const participationSuggestions = computed(() => {
  const q = participationSearch.value.trim().toLowerCase()
  if (!q) return []
  return allUsers.value.filter(u => u.nom.toLowerCase().includes(q) || u.identifiant.toLowerCase().includes(q)).slice(0, 8)
})
function selectParticipationUser(u) { participationUserId.value = u.id; participationSearch.value = u.nom; participationSearchOpen.value = false }
function closeParticipationSearch() { setTimeout(() => { participationSearchOpen.value = false }, 150) }

function openAddParticipation(s) {
  participationSeance.value = s
  participationSearch.value = ''; participationUserId.value = null; participationRole.value = 'participant'
  modalError.value = ''
  showParticipationModal.value = true
}
async function addParticipation() {
  modalError.value = ''
  if (!participationUserId.value) { modalError.value = 'Sélectionnez un utilisateur.'; return }
  try {
    await entrainementAddParticipation(participationSeance.value.id, participationUserId.value, participationRole.value)
    await reloadSemaine()
    await reloadClassement()
    showParticipationModal.value = false
    participationSearch.value = ''; participationUserId.value = null
  } catch (e) { modalError.value = e.message }
}
async function deleteParticipation(seanceId, userId) {
  try {
    await entrainementDeleteParticipation(seanceId, userId)
    const s = semaine.value.seances.find(s => s.id === seanceId)
    if (s) s.participations = s.participations.filter(p => p.user_id !== userId)
    await reloadClassement()
  } catch (e) { alert(e.message) }
}
</script>

<style scoped>
.entr-page {
  min-height: 100vh;
  background: #090909;
  color: #d4cfc9;
  font-family: 'Crimson Text', Georgia, serif;
}
.entr-loading {
  display: flex; align-items: center; justify-content: center;
  height: 60vh; font-style: italic; color: rgba(255,255,255,0.25);
}
.entr-inner {
  max-width: 900px;
  margin: 0 auto;
  padding: 48px 24px 80px;
}

/* Header */
.entr-header { margin-bottom: 32px; }
.entr-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.8rem; font-weight: 400;
  letter-spacing: 0.06em; color: #e8e3dd; margin: 0 0 16px;
}
.entr-statut-row { display: flex; gap: 10px; flex-wrap: wrap; }
.entr-badge {
  font-family: 'Cinzel', serif; font-size: 0.58rem;
  letter-spacing: 0.12em; text-transform: uppercase;
  padding: 4px 12px; border: 1px solid;
}
.entr-badge--ok   { border-color: rgba(80,192,120,0.4); color: #50c078; }
.entr-badge--non  { border-color: rgba(192,80,80,0.4);  color: #c05050; }
.entr-badge--warn { border-color: rgba(201,168,76,0.4); color: #c9a84c; }
.entr-badge--pts  { border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.5); }

/* Tabs */
.entr-tabs {
  display: flex; gap: 2px; margin-bottom: 36px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.entr-tab {
  font-family: 'Cinzel', serif; font-size: 0.65rem;
  letter-spacing: 0.16em; text-transform: uppercase;
  background: transparent; border: none;
  color: rgba(255,255,255,0.28); padding: 10px 20px;
  cursor: pointer; border-bottom: 2px solid transparent;
  margin-bottom: -1px; transition: color 0.15s, border-color 0.15s;
}
.entr-tab:hover { color: rgba(255,255,255,0.6); }
.entr-tab--active { color: #c9a84c; border-bottom-color: #c9a84c; }

/* Section */
.entr-section {}
.entr-section-header {
  display: flex; align-items: center;
  justify-content: space-between; margin-bottom: 20px;
}
.entr-section-title {
  font-family: 'Cinzel', serif; font-size: 0.75rem;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: rgba(255,255,255,0.3); margin: 0; font-weight: 400;
}
.entr-count {
  font-family: 'Cinzel', serif; font-size: 0.55rem;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: rgba(255,255,255,0.2);
}
.entr-vide {
  font-style: italic; color: rgba(255,255,255,0.2);
  padding: 40px 0; text-align: center;
}
.entr-vide-sm {
  font-style: italic; color: rgba(255,255,255,0.2);
  font-size: 0.9rem; padding: 8px 0;
}

/* Subsections */
.entr-subsection { margin-bottom: 40px; }
.entr-subsection-title {
  font-family: 'Cinzel', serif; font-size: 0.68rem;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: rgba(255,255,255,0.25); margin: 0 0 14px; font-weight: 400;
}

/* Classement */
.entr-classement-list { display: flex; flex-direction: column; gap: 4px; }
.entr-rank-row {
  background: #111113; border: 1px solid rgba(255,255,255,0.05);
  padding: 12px 18px; display: flex; align-items: center; gap: 16px;
  transition: border-color 0.15s;
}
.entr-rank-row:hover { border-color: rgba(201,168,76,0.2); }
.entr-rank-row--self { border-color: rgba(201,168,76,0.35) !important; background: #13120e; }

.entr-rank-num {
  font-family: 'Cinzel', serif; font-size: 0.72rem;
  letter-spacing: 0.1em; color: rgba(255,255,255,0.2);
  min-width: 36px;
}
.entr-rank-num--1 { color: #c9a84c; font-size: 0.85rem; }
.entr-rank-num--2 { color: rgba(200,200,200,0.7); }
.entr-rank-num--3 { color: rgba(180,130,80,0.7); }

.entr-rank-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.entr-rank-nom { font-family: 'Cinzel', serif; font-size: 0.82rem; letter-spacing: 0.06em; color: #d4cfc9; }
.entr-rank-grade { font-family: 'Crimson Text', Georgia, serif; font-size: 0.85rem; font-style: italic; color: #8b1a1a; }

.entr-rank-pts {
  font-family: 'Cinzel', serif; font-size: 1.1rem;
  font-weight: 400; color: #c9a84c; letter-spacing: 0.04em;
}
.entr-rank-pts-label { font-size: 0.55rem; color: rgba(201,168,76,0.6); letter-spacing: 0.12em; }

/* Semaine header */
.entr-semaine-header { margin-bottom: 24px; }
.entr-delai {
  font-family: 'Cinzel', serif; font-size: 0.62rem;
  letter-spacing: 0.1em; margin-top: 8px;
}
.entr-delai--ouvert { color: rgba(80,192,120,0.7); }
.entr-delai--ferme  { color: rgba(192,80,80,0.5); }

/* Inscription box */
.entr-inscription-box {
  background: #111113; border: 1px solid rgba(201,168,76,0.15);
  padding: 16px 20px; margin-bottom: 32px;
  font-family: 'Cinzel', serif; font-size: 0.65rem;
  letter-spacing: 0.08em; color: rgba(255,255,255,0.5);
}
.entr-inscription-box--non-paye {
  border-color: rgba(192,80,80,0.15);
  color: rgba(192,80,80,0.6);
}
.entr-inscrit-msg {
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
}
.entr-inscrit-msg--warn { color: rgba(201,168,76,0.6); }

/* Inscrits chips */
.entr-inscrits-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.entr-inscrit-chip {
  font-family: 'Cinzel', serif; font-size: 0.6rem;
  letter-spacing: 0.1em; text-transform: uppercase;
  padding: 4px 12px; border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.45);
}

/* Séances */
.entr-seances-list { display: flex; flex-direction: column; gap: 12px; }
.entr-seance-card {
  background: #111113; border: 1px solid rgba(255,255,255,0.05);
  padding: 16px 20px;
}
.entr-seance-head {
  display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
  flex-wrap: wrap;
}
.entr-seance-card--gestion .entr-seance-head { flex-wrap: nowrap; }
.entr-seance-titre {
  font-family: 'Cinzel', serif; font-size: 0.82rem;
  letter-spacing: 0.06em; color: #e8e3dd; flex: 1;
}
.entr-seance-actions { display: flex; gap: 6px; margin-left: auto; }
.entr-multi-badge {
  font-family: 'Cinzel', serif; font-size: 0.58rem;
  letter-spacing: 0.1em; padding: 2px 8px;
  border: 1px solid rgba(201,168,76,0.4); color: #c9a84c;
}

.entr-seance-participants { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.entr-participant-chip {
  font-family: 'Cinzel', serif; font-size: 0.55rem;
  letter-spacing: 0.1em; text-transform: uppercase;
  padding: 3px 10px; border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.45); display: flex; align-items: center; gap: 5px;
}
.entr-participant-chip--org {
  border-color: rgba(201,168,76,0.35); color: #c9a84c;
}
.entr-participant-role {
  font-size: 0.5rem; color: rgba(255,255,255,0.3);
  border-left: 1px solid rgba(255,255,255,0.1); padding-left: 5px;
}
.entr-participant-chip--org .entr-participant-role { color: rgba(201,168,76,0.6); border-color: rgba(201,168,76,0.2); }
.entr-chip-del {
  background: none; border: none; color: rgba(192,80,80,0.5);
  cursor: pointer; font-size: 0.6rem; padding: 0 2px; line-height: 1;
}
.entr-chip-del:hover { color: #c05050; }

/* Paiements list */
.entr-paiements-list { display: flex; flex-direction: column; gap: 4px; }
.entr-paiement-row {
  background: #111113; border: 1px solid rgba(255,255,255,0.05);
  padding: 10px 18px; display: flex; align-items: center; gap: 12px;
}
.entr-paiement-nom { font-family: 'Cinzel', serif; font-size: 0.78rem; letter-spacing: 0.06em; color: #d4cfc9; flex: 1; }
.entr-paiement-id {
  font-family: 'Cinzel', serif; font-size: 0.52rem;
  letter-spacing: 0.1em; color: rgba(255,255,255,0.2);
  text-transform: uppercase;
}

/* Boutons */
.entr-btn {
  font-family: 'Cinzel', serif; font-size: 0.65rem;
  letter-spacing: 0.14em; text-transform: uppercase;
  background: #8b1a1a; color: #fff; border: none;
  padding: 9px 18px; cursor: pointer; transition: background 0.15s;
}
.entr-btn:hover:not(:disabled) { background: #a82020; }
.entr-btn:disabled { opacity: 0.5; cursor: default; }
.entr-btn--sm { padding: 5px 12px; font-size: 0.58rem; }
.entr-btn--ghost {
  background: transparent; border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.4);
}
.entr-btn--ghost:hover:not(:disabled) { border-color: rgba(201,168,76,0.35); color: #c9a84c; background: transparent; }
.entr-btn--danger {
  background: transparent; border: 1px solid rgba(139,26,26,0.3);
  color: rgba(192,57,43,0.7);
}
.entr-btn--danger:hover:not(:disabled) { background: rgba(139,26,26,0.12); color: #c0392b; border-color: rgba(139,26,26,0.6); }

/* Multiplicateur */
.entr-multi-row { display: flex; gap: 8px; }
.entr-multi-btn {
  font-family: 'Cinzel', serif; font-size: 0.6rem; letter-spacing: 0.1em;
  background: transparent; border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.35); padding: 7px 14px; cursor: pointer;
  transition: border-color 0.12s, color 0.12s;
}
.entr-multi-btn:hover { border-color: rgba(201,168,76,0.3); color: rgba(201,168,76,0.7); }
.entr-multi-btn--active { border-color: rgba(201,168,76,0.5); color: #c9a84c; background: rgba(201,168,76,0.05); }

/* Modal */
.entr-modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.75);
  display: flex; align-items: center; justify-content: center;
  z-index: 200; padding: 24px;
}
.entr-modal {
  background: #111113; border: 1px solid rgba(201,168,76,0.15);
  padding: 28px; width: 100%; max-width: 420px; max-height: 90vh; overflow-y: auto;
}
.entr-modal-title {
  font-family: 'Cinzel', serif; font-size: 0.82rem;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: #c9a84c; margin: 0 0 20px; font-weight: 400;
}
.entr-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.entr-modal-error { font-size: 0.9rem; font-style: italic; color: #c05050; margin-top: 8px; }

/* Form */
.entr-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.entr-field-label {
  font-family: 'Cinzel', serif; font-size: 0.55rem;
  letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.28);
}
.entr-field-input {
  background: #0f0f10; border: 1px solid rgba(255,255,255,0.08);
  color: #d4cfc9; padding: 9px 12px;
  font-family: 'Crimson Text', Georgia, serif; font-size: 1rem;
  outline: none; width: 100%; box-sizing: border-box;
}
.entr-field-input:focus { border-color: rgba(201,168,76,0.3); }

/* Autocomplete */
.entr-user-search { position: relative; }
.entr-user-dropdown {
  position: absolute; top: 100%; left: 0; right: 0;
  background: #1a1a1d; border: 1px solid rgba(201,168,76,0.2);
  border-top: none; z-index: 50; max-height: 200px; overflow-y: auto;
}
.entr-user-option {
  padding: 8px 12px; font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem; color: #d4cfc9; cursor: pointer;
  display: flex; align-items: baseline; gap: 8px;
}
.entr-user-option:hover { background: rgba(201,168,76,0.08); }
.entr-user-id {
  font-family: 'Cinzel', serif; font-size: 0.52rem;
  letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.25);
}
.entr-user-selected {
  font-family: 'Crimson Text', Georgia, serif; font-size: 0.9rem;
  font-style: italic; color: rgba(201,168,76,0.7); margin: 4px 0 0;
}
</style>

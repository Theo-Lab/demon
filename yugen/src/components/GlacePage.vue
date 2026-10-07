<template>
  <div class="glace-page">
    <AppNavbar />

    <div v-if="!access && !accesDenie" class="glace-loading">
      <p>Chargement...</p>
    </div>

    <div v-else-if="accesDenie" class="jeu-indispo">
      <p class="jeu-indispo-title">Acces restreint</p>
      <p class="jeu-indispo-sub">Cette section est reservee aux membres de la Glace.</p>
      <RouterLink to="/parchemin" class="jeu-indispo-link">&#8592; Retour</RouterLink>
    </div>

    <div v-else class="glace-inner">

      <!-- En-tete -->
      <div class="glace-header">
        <h1 class="glace-title">La Glace</h1>
        <p v-if="access.dirigeant" class="glace-role-badge glace-role-badge--dir">Dirigeant</p>
        <p v-else-if="access.role" class="glace-role-badge" :style="{ borderColor: access.role.couleur, color: access.role.couleur }">{{ access.role.nom }}</p>
      </div>

      <!-- Onglets -->
      <div class="glace-tabs">
        <button
          v-for="t in tabsVisible"
          :key="t.key"
          class="glace-tab"
          :class="{ 'glace-tab--active': onglet === t.key }"
          @click="onglet = t.key"
        >{{ t.label }}</button>
      </div>

      <!-- ══ ACTIVITES ══════════════════════════════════════════════════ -->
      <div v-if="onglet === 'activites'" class="glace-section">

        <div class="glace-section-header">
          <h2 class="glace-section-title">Activites</h2>
          <button class="glace-btn" @click="openNewActivite">+ Nouvelle activite</button>
        </div>

        <!-- Recherche + filtres -->
        <div class="glace-toolbar">
          <input v-model="recherche" class="glace-search-input" type="text" placeholder="Rechercher…" autocomplete="off" />
          <select v-model="filtreType" class="glace-filter-select">
            <option value="">Tous les types</option>
            <option v-for="(label, val) in typeLabels" :key="val" :value="val">{{ label }}</option>
          </select>
          <span class="glace-count">{{ activitesFiltrees.length }} activite{{ activitesFiltrees.length !== 1 ? 's' : '' }}</span>
        </div>

        <div v-if="activitesPaged.length === 0" class="glace-vide">Aucune activite enregistree.</div>

        <div class="glace-activites-grid">
          <div
            v-for="act in activitesPaged"
            :key="act.id"
            class="glace-act-card"
          >
            <RouterLink :to="'/glace/' + act.id" class="glace-act-body">
            <div v-if="parseImages(act.image_url).length" class="glace-act-img">
              <img :src="SERVER_URL + parseImages(act.image_url)[0]" :alt="act.titre" />
            </div>
              <div class="glace-act-meta">
                <span class="glace-type-badge" :class="'glace-type-badge--' + act.type">{{ typeLabels[act.type] || act.type }}</span>
                <span v-if="act.date_activite" class="glace-act-date">{{ formatDate(act.date_activite) }}</span>
              </div>
              <h3 class="glace-act-title">{{ act.titre }}</h3>
              <p v-if="act.description" class="glace-act-desc">{{ truncate(act.description, 120) }}</p>
              <div class="glace-act-footer">
                <span v-if="act.nb_participants" class="glace-act-participants">{{ act.nb_participants }} participant{{ act.nb_participants > 1 ? 's' : '' }}</span>
                <span class="glace-act-auteur">par {{ act.auteur_nom || '?' }}</span>
              </div>
            </RouterLink>
            <div v-if="canDelete(act)" class="glace-act-actions">
              <button class="glace-btn glace-btn--sm glace-btn--ghost" @click="openEditActivite(act)">Modifier</button>
              <button class="glace-btn glace-btn--sm glace-btn--danger" @click="deleteActivite(act.id)">Supprimer</button>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="glace-pagination">
          <button class="glace-btn glace-btn--sm glace-btn--ghost" :disabled="page === 1" @click="page--">&#8592;</button>
          <span class="glace-page-info">{{ page }} / {{ totalPages }}</span>
          <button class="glace-btn glace-btn--sm glace-btn--ghost" :disabled="page === totalPages" @click="page++">&#8594;</button>
        </div>

      </div>

      <!-- ══ MEMBRES ════════════════════════════════════════════════════ -->
      <div v-if="onglet === 'membres'" class="glace-section">

        <div class="glace-section-header">
          <h2 class="glace-section-title">Membres</h2>
          <button v-if="access.dirigeant" class="glace-btn" @click="showAddMembre = true">+ Ajouter un membre</button>
        </div>

        <div v-if="membres.length === 0" class="glace-vide">Aucun membre enregistre.</div>

        <div class="glace-membres-list">
          <div v-for="m in membres" :key="m.user_id" class="glace-membre-row">
            <div class="glace-membre-info">
              <span class="glace-membre-nom">{{ m.nom }}</span>
              <span class="glace-membre-id">{{ m.identifiant }}</span>
            </div>
            <div class="glace-membre-role">
              <span
                v-if="m.role_nom"
                class="glace-role-chip"
                :style="{ borderColor: m.role_couleur || '#7fb3c8', color: m.role_couleur || '#7fb3c8' }"
              >{{ m.role_nom }}</span>
              <span v-else class="glace-role-chip glace-role-chip--none">Sans role</span>
            </div>
            <div v-if="access.dirigeant" class="glace-membre-actions">
              <button class="glace-btn glace-btn--sm glace-btn--ghost" @click="openEditMembre(m)">Role</button>
              <button class="glace-btn glace-btn--sm glace-btn--danger" @click="deleteMembre(m.user_id)">Retirer</button>
            </div>
          </div>
        </div>

      </div>

      <!-- ══ GESTION ════════════════════════════════════════════════════ -->
      <div v-if="onglet === 'gestion' && access.dirigeant" class="glace-section">

        <div class="glace-section-header">
          <h2 class="glace-section-title">Gestion des roles</h2>
          <button class="glace-btn" @click="openNewRole">+ Nouveau role</button>
        </div>

        <div v-if="roles.length === 0" class="glace-vide">Aucun role cree.</div>

        <div class="glace-roles-list">
          <div v-for="r in roles" :key="r.id" class="glace-role-row">
            <span class="glace-role-dot" :style="{ background: r.couleur }"></span>
            <span class="glace-role-name">{{ r.nom }}</span>
            <div class="glace-role-perms">
              <span v-if="r.can_see_all" class="glace-perm-chip">Voit tout</span>
              <span v-if="r.can_delete_others" class="glace-perm-chip glace-perm-chip--del">Supprime</span>
            </div>
            <div class="glace-role-actions">
              <button class="glace-btn glace-btn--sm glace-btn--ghost" @click="openEditRole(r)">Modifier</button>
              <button class="glace-btn glace-btn--sm glace-btn--danger" @click="deleteRole(r.id)">Supprimer</button>
            </div>
          </div>
        </div>

      </div>

    </div>

    <!-- ══ MODAL ACTIVITE ══════════════════════════════════════════════ -->
    <div v-if="showActiviteModal" class="glace-modal-overlay" @click.self="closeActiviteModal">
      <div class="glace-modal">
        <h2 class="glace-modal-title">{{ editingActivite ? 'Modifier l\'activite' : 'Nouvelle activite' }}</h2>

        <div class="glace-form-grid">
          <div class="glace-field glace-field--full">
            <label class="glace-field-label">Titre *</label>
            <input v-model="form.titre" class="glace-field-input" type="text" placeholder="Nom de l'activite" />
          </div>
          <div class="glace-field">
            <label class="glace-field-label">Type</label>
            <select v-model="form.type" class="glace-field-input glace-field-select">
              <option v-for="(label, val) in typeLabels" :key="val" :value="val">{{ label }}</option>
            </select>
          </div>
          <div class="glace-field">
            <label class="glace-field-label">Date</label>
            <input v-model="form.date_activite" class="glace-field-input" type="date" />
          </div>
          <div class="glace-field">
            <label class="glace-field-label">Nombre de participants</label>
            <input v-model.number="form.nb_participants" class="glace-field-input" type="number" min="0" />
          </div>
          <div class="glace-field glace-field--full">
            <label class="glace-field-label">Participants (liste)</label>
            <textarea v-model="form.participants" class="glace-field-input glace-field-textarea" rows="3" placeholder="Un participant par ligne…"></textarea>
          </div>
          <div class="glace-field glace-field--full">
            <label class="glace-field-label">Description</label>
            <textarea v-model="form.description" class="glace-field-input glace-field-textarea" rows="4" placeholder="Description de l'activite…" @paste="handleImagePaste"></textarea>
          </div>
          <div class="glace-field glace-field--full">
            <label class="glace-field-label">Images</label>
            <input type="file" accept="image/*" class="glace-field-input" multiple @change="handleImageUpload" />
            <div v-if="uploadingImage" class="glace-upload-hint">Envoi en cours…</div>
            <div v-if="form.images.length" class="glace-imgs-preview">
              <div v-for="(url, i) in form.images" :key="i" class="glace-img-preview">
                <img :src="SERVER_URL + url" alt="preview" />
                <button class="glace-btn glace-btn--sm glace-btn--danger" @click="form.images.splice(i, 1)">Retirer</button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="formError" class="glace-form-error">{{ formError }}</div>

        <div class="glace-modal-actions">
          <button class="glace-btn glace-btn--ghost" @click="closeActiviteModal">Annuler</button>
          <button class="glace-btn" :disabled="savingActivite" @click="saveActivite">
            {{ savingActivite ? '…' : (editingActivite ? 'Enregistrer' : 'Creer') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ══ MODAL ROLE ══════════════════════════════════════════════════ -->
    <div v-if="showRoleModal" class="glace-modal-overlay" @click.self="showRoleModal = false">
      <div class="glace-modal glace-modal--sm">
        <h2 class="glace-modal-title">{{ editingRole ? 'Modifier le role' : 'Nouveau role' }}</h2>
        <div class="glace-form-grid">
          <div class="glace-field glace-field--full">
            <label class="glace-field-label">Nom *</label>
            <input v-model="roleForm.nom" class="glace-field-input" type="text" placeholder="Nom du role" />
          </div>
          <div class="glace-field glace-field--full">
            <label class="glace-field-label">Couleur</label>
            <div class="glace-color-row">
              <input v-model="roleForm.couleur" class="glace-field-input" type="text" placeholder="#7fb3c8" />
              <input v-model="roleForm.couleur" type="color" class="glace-color-picker" />
            </div>
          </div>
          <div class="glace-field glace-field--full">
            <label class="glace-field-label">Permissions</label>
            <label class="glace-check-label">
              <input type="checkbox" v-model="roleForm.can_see_all" />
              Peut voir toutes les activites
            </label>
            <label class="glace-check-label">
              <input type="checkbox" v-model="roleForm.can_delete_others" />
              Peut supprimer les activites des autres
            </label>
          </div>
        </div>
        <div v-if="formError" class="glace-form-error">{{ formError }}</div>
        <div class="glace-modal-actions">
          <button class="glace-btn glace-btn--ghost" @click="showRoleModal = false">Annuler</button>
          <button class="glace-btn" :disabled="savingRole" @click="saveRole">
            {{ savingRole ? '…' : (editingRole ? 'Enregistrer' : 'Creer') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ══ MODAL AJOUTER MEMBRE ═══════════════════════════════════════ -->
    <div v-if="showAddMembre" class="glace-modal-overlay" @click.self="showAddMembre = false">
      <div class="glace-modal glace-modal--sm">
        <h2 class="glace-modal-title">Ajouter un membre</h2>
        <div class="glace-form-grid">
          <div class="glace-field glace-field--full">
            <label class="glace-field-label">Utilisateur *</label>
            <div class="glace-user-search">
              <input
                v-model="membreSearch"
                class="glace-field-input"
                type="text"
                placeholder="Rechercher un utilisateur…"
                autocomplete="off"
                @input="membreForm.userId = ''"
                @focus="membreSearchOpen = true"
                @blur="closeMembreSearch"
              />
              <div v-if="membreSearchOpen && membreSearch && membreSuggestions.length" class="glace-user-dropdown">
                <div
                  v-for="u in membreSuggestions"
                  :key="u.id"
                  class="glace-user-option"
                  @mousedown.prevent="selectMembre(u)"
                >{{ u.nom }} <span class="glace-user-id">{{ u.identifiant }}</span></div>
              </div>
              <p v-if="membreForm.userId" class="glace-user-selected">✓ {{ membreSearch }}</p>
            </div>
          </div>
          <div class="glace-field glace-field--full">
            <label class="glace-field-label">Role</label>
            <select v-model="membreForm.roleId" class="glace-field-input glace-field-select">
              <option :value="null">— Sans role —</option>
              <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.nom }}</option>
            </select>
          </div>
        </div>
        <div v-if="formError" class="glace-form-error">{{ formError }}</div>
        <div class="glace-modal-actions">
          <button class="glace-btn glace-btn--ghost" @click="showAddMembre = false">Annuler</button>
          <button class="glace-btn" :disabled="savingMembre" @click="addMembre">
            {{ savingMembre ? '…' : 'Ajouter' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ══ MODAL EDITER ROLE MEMBRE ════════════════════════════════════ -->
    <div v-if="showEditMembre" class="glace-modal-overlay" @click.self="showEditMembre = false">
      <div class="glace-modal glace-modal--sm">
        <h2 class="glace-modal-title">Modifier le role de {{ editMembreTarget?.nom }}</h2>
        <div class="glace-form-grid">
          <div class="glace-field glace-field--full">
            <label class="glace-field-label">Role</label>
            <select v-model="membreForm.roleId" class="glace-field-input glace-field-select">
              <option :value="null">— Sans role —</option>
              <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.nom }}</option>
            </select>
          </div>
        </div>
        <div v-if="formError" class="glace-form-error">{{ formError }}</div>
        <div class="glace-modal-actions">
          <button class="glace-btn glace-btn--ghost" @click="showEditMembre = false">Annuler</button>
          <button class="glace-btn" :disabled="savingMembre" @click="updateMembre">
            {{ savingMembre ? '…' : 'Enregistrer' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import AppNavbar from './AppNavbar.vue'
import { currentUser } from '../auth.js'
import {
  glaceMe, glaceGetMembres, glaceAddMembre, glaceUpdateMembre, glaceDeleteMembre,
  glaceGetRoles, glaceCreateRole, glaceUpdateRole, glaceDeleteRole,
  glaceGetUsers, glaceGetActivites, glaceCreateActivite, glaceUpdateActivite, glaceDeleteActivite,
  uploadImage, SERVER_URL
} from '../api.js'

// ── State ─────────────────────────────────────────────────────────────────────
const access       = ref(null)
const accesDenie   = ref(false)
const activites    = ref([])
const membres      = ref([])
const roles        = ref([])
const allUsers     = ref([])
const onglet       = ref('activites')
const page         = ref(1)
const PAGE_SIZE    = 10
const recherche    = ref('')
const filtreType   = ref('')

const typeLabels = {
  entrainement: 'Entrainement',
  reunion:      'Reunion',
  mission:      'Mission',
  evenement:    'Evenement',
  autre:        'Autre',
}

const tabs = [
  { key: 'activites', label: 'Activites' },
  { key: 'membres',   label: 'Membres'   },
  { key: 'gestion',   label: 'Gestion'   },
]

const tabsVisible = computed(() => {
  if (access.value?.dirigeant) return tabs
  return tabs.filter(t => t.key !== 'gestion')
})

// ── Init ──────────────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const [a, rols, mems] = await Promise.all([glaceMe(), glaceGetRoles(), glaceGetMembres()])
    access.value  = a
    roles.value   = rols
    membres.value = mems
    if (a.dirigeant) allUsers.value = await glaceGetUsers()
    activites.value = await glaceGetActivites()
  } catch {
    accesDenie.value = true
    access.value = {}
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseImages(raw) {
  if (!raw) return []
  if (raw.startsWith('[')) { try { return JSON.parse(raw) } catch {} }
  return [raw]
}

const currentUserId = computed(() => currentUser.value?.id)

function canDelete(act) {
  return access.value?.dirigeant || act.created_by === currentUserId.value || !!(access.value?.role?.can_delete_others)
}

function truncate(str, len) {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '…' : str
}

function formatDate(d) {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch { return d }
}

// ── Filtres + Pagination activites ───────────────────────────────────────────
const activitesFiltrees = computed(() => {
  let list = activites.value
  if (filtreType.value) list = list.filter(a => a.type === filtreType.value)
  if (recherche.value.trim()) {
    const q = recherche.value.trim().toLowerCase()
    list = list.filter(a =>
      a.titre.toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q) ||
      (a.participants || '').toLowerCase().includes(q) ||
      (a.auteur_nom || '').toLowerCase().includes(q)
    )
  }
  return list
})
const totalPages = computed(() => Math.max(1, Math.ceil(activitesFiltrees.value.length / PAGE_SIZE)))
const activitesPaged = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return activitesFiltrees.value.slice(start, start + PAGE_SIZE)
})
watch([recherche, filtreType], () => { page.value = 1 })

// ── Activites ─────────────────────────────────────────────────────────────────
const showActiviteModal = ref(false)
const editingActivite   = ref(null)
const savingActivite    = ref(false)
const uploadingImage    = ref(false)
const formError         = ref('')

const form = ref({
  titre: '', type: 'entrainement', date_activite: '',
  nb_participants: 0, participants: '', description: '', images: [],
})

function resetForm() {
  form.value = { titre: '', type: 'entrainement', date_activite: '', nb_participants: 0, participants: '', description: '', images: [] }
  formError.value = ''
}

function openNewActivite() {
  resetForm()
  editingActivite.value = null
  showActiviteModal.value = true
}

function openEditActivite(act) {
  form.value = {
    titre:           act.titre           || '',
    type:            act.type            || 'entrainement',
    date_activite:   act.date_activite   || '',
    nb_participants: act.nb_participants || 0,
    participants:    act.participants    || '',
    description:     act.description    || '',
    images:          parseImages(act.image_url),
  }
  formError.value = ''
  editingActivite.value = act
  showActiviteModal.value = true
}

function closeActiviteModal() {
  showActiviteModal.value = false
  editingActivite.value = null
}

async function saveActivite() {
  formError.value = ''
  if (!form.value.titre.trim()) { formError.value = 'Le titre est requis.'; return }
  savingActivite.value = true
  try {
    const { images, ...rest } = form.value
    const payload = { ...rest, image_url: JSON.stringify(images) }
    if (editingActivite.value) {
      const updated = await glaceUpdateActivite(editingActivite.value.id, payload)
      const idx = activites.value.findIndex(a => a.id === updated.id)
      if (idx !== -1) activites.value[idx] = updated
    } else {
      const created = await glaceCreateActivite(payload)
      activites.value.unshift(created)
    }
    closeActiviteModal()
  } catch (e) {
    formError.value = e.message
  } finally {
    savingActivite.value = false
  }
}

async function deleteActivite(id) {
  if (!confirm('Supprimer cette activite ?')) return
  try {
    await glaceDeleteActivite(id)
    activites.value = activites.value.filter(a => a.id !== id)
    if (page.value > totalPages.value) page.value = totalPages.value
  } catch (e) {
    alert(e.message)
  }
}

// ── Image upload ──────────────────────────────────────────────────────────────
async function uploadImageFile(file) {
  if (!file) return
  uploadingImage.value = true
  try {
    const url = await uploadImage(file)
    form.value.images.push(url)
  } catch (e) {
    formError.value = e.message
  } finally {
    uploadingImage.value = false
  }
}
function handleImageUpload(e) {
  for (const file of e.target.files) uploadImageFile(file)
}
function handleImagePaste(e) {
  const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'))
  if (item) uploadImageFile(item.getAsFile())
}

// ── Roles ─────────────────────────────────────────────────────────────────────
const showRoleModal = ref(false)
const editingRole   = ref(null)
const savingRole    = ref(false)
const roleForm      = ref({ nom: '', couleur: '#7fb3c8', can_see_all: false, can_delete_others: false })

function openNewRole() {
  roleForm.value = { nom: '', couleur: '#7fb3c8', can_see_all: false, can_delete_others: false }
  formError.value = ''
  editingRole.value = null
  showRoleModal.value = true
}

function openEditRole(r) {
  roleForm.value = { nom: r.nom, couleur: r.couleur || '#7fb3c8', can_see_all: !!r.can_see_all, can_delete_others: !!r.can_delete_others }
  formError.value = ''
  editingRole.value = r
  showRoleModal.value = true
}

async function saveRole() {
  formError.value = ''
  if (!roleForm.value.nom.trim()) { formError.value = 'Le nom est requis.'; return }
  savingRole.value = true
  try {
    if (editingRole.value) {
      const updated = await glaceUpdateRole(editingRole.value.id, roleForm.value)
      const idx = roles.value.findIndex(r => r.id === updated.id)
      if (idx !== -1) roles.value[idx] = updated
    } else {
      const created = await glaceCreateRole(roleForm.value)
      roles.value.push(created)
      roles.value.sort((a, b) => a.nom.localeCompare(b.nom))
    }
    showRoleModal.value = false
  } catch (e) {
    formError.value = e.message
  } finally {
    savingRole.value = false
  }
}

async function deleteRole(id) {
  if (!confirm('Supprimer ce role ? Les membres qui l\'ont ne seront pas retires, juste leur role sera efface.')) return
  try {
    await glaceDeleteRole(id)
    roles.value = roles.value.filter(r => r.id !== id)
    membres.value = membres.value.map(m => m.role_id === id ? { ...m, role_id: null, role_nom: null, role_couleur: null } : m)
  } catch (e) {
    alert(e.message)
  }
}

// ── Membres ───────────────────────────────────────────────────────────────────
const showAddMembre    = ref(false)
const showEditMembre   = ref(false)
const editMembreTarget = ref(null)
const savingMembre     = ref(false)
const membreForm       = ref({ userId: '', roleId: null })
const membreSearch     = ref('')
const membreSearchOpen = ref(false)

const membreSuggestions = computed(() => {
  const q = membreSearch.value.trim().toLowerCase()
  if (!q) return []
  return allUsers.value.filter(u =>
    u.nom.toLowerCase().includes(q) || u.identifiant.toLowerCase().includes(q)
  ).slice(0, 8)
})

function selectMembre(u) {
  membreForm.value.userId = u.id
  membreSearch.value = u.nom
  membreSearchOpen.value = false
}

function closeMembreSearch() {
  setTimeout(() => { membreSearchOpen.value = false }, 150)
}

function openEditMembre(m) {
  editMembreTarget.value = m
  membreForm.value = { userId: m.user_id, roleId: m.role_id || null }
  formError.value = ''
  showEditMembre.value = true
}

async function addMembre() {
  formError.value = ''
  if (!membreForm.value.userId) { formError.value = 'Veuillez choisir un utilisateur.'; return }
  savingMembre.value = true
  try {
    await glaceAddMembre({ userId: membreForm.value.userId, roleId: membreForm.value.roleId })
    membres.value = await glaceGetMembres()
    showAddMembre.value = false
    membreForm.value = { userId: '', roleId: null }
    membreSearch.value = ''
  } catch (e) {
    formError.value = e.message
  } finally {
    savingMembre.value = false
  }
}

async function updateMembre() {
  formError.value = ''
  savingMembre.value = true
  try {
    await glaceUpdateMembre(editMembreTarget.value.user_id, { roleId: membreForm.value.roleId })
    membres.value = await glaceGetMembres()
    showEditMembre.value = false
  } catch (e) {
    formError.value = e.message
  } finally {
    savingMembre.value = false
  }
}

async function deleteMembre(userId) {
  if (!confirm('Retirer ce membre de la Glace ?')) return
  try {
    await glaceDeleteMembre(userId)
    membres.value = membres.value.filter(m => m.user_id !== userId)
  } catch (e) {
    alert(e.message)
  }
}
</script>

<style scoped>
/* ── Base ──────────────────────────────────────────────────────────────────── */
.glace-page {
  min-height: 100vh;
  background: #090909;
  color: #d4cfc9;
  font-family: 'Crimson Text', Georgia, serif;
}

.glace-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60vh;
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  color: rgba(255,255,255,0.25);
}

.jeu-indispo {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 70vh;
  gap: 12px;
  text-align: center;
  padding: 24px;
}
.jeu-indispo-title {
  font-family: 'Cinzel', serif;
  font-size: 1.2rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.5);
  margin: 0;
}
.jeu-indispo-sub {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  font-style: italic;
  color: rgba(255,255,255,0.25);
  margin: 0;
}
.jeu-indispo-link {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(139,168,200,0.6);
  text-decoration: none;
  margin-top: 8px;
}
.jeu-indispo-link:hover { color: #a8d8ea; }

/* ── Inner layout ──────────────────────────────────────────────────────────── */
.glace-inner {
  max-width: 900px;
  margin: 0 auto;
  padding: 48px 24px 80px;
}

/* ── Header ────────────────────────────────────────────────────────────────── */
.glace-header {
  display: flex;
  align-items: baseline;
  gap: 16px;
  margin-bottom: 32px;
}

.glace-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.8rem;
  font-weight: 400;
  margin: 0;
  letter-spacing: 0.06em;
  color: #e8e3dd;
}

.glace-role-badge {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  padding: 3px 10px;
  border: 1px solid rgba(167,211,234,0.4);
  color: #a8d8ea;
  margin: 0;
}
.glace-role-badge--dir {
  border-color: rgba(139,26,26,0.4);
  color: #c05050;
}

/* ── Tabs ──────────────────────────────────────────────────────────────────── */
.glace-tabs {
  display: flex;
  gap: 2px;
  margin-bottom: 36px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.glace-tab {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.28);
  padding: 10px 20px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}
.glace-tab:hover { color: rgba(255,255,255,0.6); }
.glace-tab--active {
  color: #a8d8ea;
  border-bottom-color: #7fb3c8;
}

/* ── Section ───────────────────────────────────────────────────────────────── */
.glace-section {}

.glace-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.glace-section-title {
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.3);
  margin: 0;
  font-weight: 400;
}

.glace-vide {
  font-style: italic;
  color: rgba(255,255,255,0.2);
  padding: 40px 0;
  text-align: center;
}

/* ── Boutons ───────────────────────────────────────────────────────────────── */
.glace-btn {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  background: #8b1a1a;
  color: #fff;
  border: none;
  padding: 9px 18px;
  cursor: pointer;
  transition: background 0.15s;
}
.glace-btn:hover:not(:disabled) { background: #a82020; }
.glace-btn:disabled { opacity: 0.5; cursor: default; }

.glace-btn--sm { padding: 5px 12px; font-size: 0.58rem; }

.glace-btn--ghost {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.4);
}
.glace-btn--ghost:hover:not(:disabled) {
  border-color: rgba(167,211,234,0.35);
  color: #a8d8ea;
  background: transparent;
}

.glace-btn--danger {
  background: transparent;
  border: 1px solid rgba(139,26,26,0.3);
  color: rgba(192,57,43,0.7);
}
.glace-btn--danger:hover:not(:disabled) {
  background: rgba(139,26,26,0.12);
  color: #c0392b;
  border-color: rgba(139,26,26,0.6);
}

/* ── Toolbar recherche ─────────────────────────────────────────────────────── */
.glace-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.glace-search-input {
  flex: 1;
  min-width: 160px;
  background: #0f0f10;
  border: 1px solid rgba(255,255,255,0.08);
  color: #d4cfc9;
  padding: 8px 12px;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  outline: none;
}
.glace-search-input:focus { border-color: rgba(127,179,200,0.3); }

.glace-filter-select {
  background: #0f0f10;
  border: 1px solid rgba(255,255,255,0.08);
  color: #d4cfc9;
  padding: 8px 28px 8px 10px;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.95rem;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='rgba(255,255,255,0.25)'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-color: #0f0f10;
  cursor: pointer;
}

.glace-count {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.2);
  white-space: nowrap;
}

/* ── Activites grid ────────────────────────────────────────────────────────── */
.glace-activites-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.glace-act-card {
  background: #111113;
  border: 1px solid rgba(255,255,255,0.05);
  transition: border-color 0.15s, background 0.15s;
  cursor: pointer;
}
.glace-act-card:hover { border-color: rgba(127,179,200,0.3); background: #161618; }

.glace-act-img {
  width: 100%;
  max-height: 240px;
  overflow: hidden;
}
.glace-act-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.glace-act-body {
  padding: 18px 20px 14px;
  display: block;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}

.glace-act-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.glace-type-badge {
  font-family: 'Cinzel', serif;
  font-size: 0.52rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  padding: 2px 8px;
  border: 1px solid rgba(127,179,200,0.3);
  color: #7fb3c8;
}
.glace-type-badge--mission  { border-color: rgba(192,80,80,0.3); color: #c05050; }
.glace-type-badge--evenement { border-color: rgba(201,168,76,0.3); color: #c9a84c; }
.glace-type-badge--reunion  { border-color: rgba(127,179,200,0.3); color: #7fb3c8; }
.glace-type-badge--autre    { border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.4); }

.glace-act-date {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.25);
}

.glace-act-title {
  font-family: 'Cinzel', serif;
  font-size: 0.95rem;
  font-weight: 400;
  letter-spacing: 0.06em;
  color: #e8e3dd;
  margin: 0 0 8px;
}

.glace-act-desc {
  font-size: 0.95rem;
  font-style: italic;
  color: rgba(255,255,255,0.45);
  margin: 0 0 10px;
  line-height: 1.45;
}

.glace-act-footer {
  display: flex;
  gap: 12px;
  align-items: center;
}

.glace-act-participants {
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  color: rgba(167,211,234,0.5);
}

.glace-act-auteur {
  font-size: 0.82rem;
  font-style: italic;
  color: rgba(255,255,255,0.2);
}

.glace-act-actions {
  display: flex;
  gap: 8px;
  padding: 10px 20px 14px;
  border-top: 1px solid rgba(255,255,255,0.04);
}

/* ── Pagination ─────────────────────────────────────────────────────────────── */
.glace-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
}

.glace-page-info {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.25);
}

/* ── Membres ────────────────────────────────────────────────────────────────── */
.glace-membres-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.glace-membre-row {
  background: #111113;
  border: 1px solid rgba(255,255,255,0.05);
  padding: 12px 18px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.glace-membre-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}

.glace-membre-nom {
  font-family: 'Cinzel', serif;
  font-size: 0.82rem;
  letter-spacing: 0.06em;
  color: #d4cfc9;
}

.glace-membre-id {
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.2);
  text-transform: uppercase;
}

.glace-membre-role { min-width: 120px; }

.glace-role-chip {
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 2px 8px;
  border: 1px solid rgba(127,179,200,0.35);
  color: #7fb3c8;
}
.glace-role-chip--none {
  border-color: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.2);
}

.glace-membre-actions {
  display: flex;
  gap: 6px;
}

/* ── Roles list ─────────────────────────────────────────────────────────────── */
.glace-roles-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.glace-role-row {
  background: #111113;
  border: 1px solid rgba(255,255,255,0.05);
  padding: 12px 18px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.glace-role-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.glace-role-name {
  font-family: 'Cinzel', serif;
  font-size: 0.82rem;
  letter-spacing: 0.06em;
  color: #d4cfc9;
  flex: 1;
}

.glace-role-actions {
  display: flex;
  gap: 6px;
}

.glace-role-perms {
  display: flex;
  gap: 6px;
  flex: 1;
}

.glace-perm-chip {
  font-family: 'Cinzel', serif;
  font-size: 0.5rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 2px 7px;
  border: 1px solid rgba(127,179,200,0.3);
  color: rgba(127,179,200,0.7);
}
.glace-perm-chip--del {
  border-color: rgba(192,80,80,0.3);
  color: rgba(192,80,80,0.7);
}

.glace-check-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.45);
  cursor: pointer;
  margin-top: 4px;
}
.glace-check-label input { accent-color: #7fb3c8; cursor: pointer; }

/* ── Autocomplete utilisateur ───────────────────────────────────────────────── */
.glace-user-search { position: relative; }

.glace-user-dropdown {
  position: absolute;
  top: 100%;
  left: 0; right: 0;
  background: #1a1a1d;
  border: 1px solid rgba(127,179,200,0.2);
  border-top: none;
  z-index: 50;
  max-height: 200px;
  overflow-y: auto;
}

.glace-user-option {
  padding: 8px 12px;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  color: #d4cfc9;
  cursor: pointer;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.glace-user-option:hover { background: rgba(127,179,200,0.08); }

.glace-user-id {
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.25);
}

.glace-user-selected {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.9rem;
  font-style: italic;
  color: rgba(127,179,200,0.7);
  margin: 4px 0 0;
}

/* ── Modal ──────────────────────────────────────────────────────────────────── */
.glace-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 24px;
}

.glace-modal {
  background: #111113;
  border: 1px solid rgba(127,179,200,0.15);
  padding: 28px 28px 22px;
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
}
.glace-modal--sm { max-width: 400px; }

.glace-modal-title {
  font-family: 'Cinzel', serif;
  font-size: 0.85rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #a8d8ea;
  margin: 0 0 22px;
  font-weight: 400;
}

.glace-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

/* ── Form ───────────────────────────────────────────────────────────────────── */
.glace-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 20px;
}

.glace-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.glace-field--full { grid-column: 1 / -1; }

.glace-field-label {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.28);
}

.glace-field-input {
  background: #0f0f10;
  border: 1px solid rgba(255,255,255,0.08);
  color: #d4cfc9;
  padding: 9px 12px;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}
.glace-field-input:focus { border-color: rgba(127,179,200,0.3); }

.glace-field-select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='rgba(255,255,255,0.25)'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-color: #0f0f10;
  cursor: pointer;
}

.glace-field-textarea {
  resize: vertical;
  min-height: 72px;
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  line-height: 1.45;
}

.glace-color-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.glace-color-picker {
  width: 40px;
  height: 36px;
  border: 1px solid rgba(255,255,255,0.1);
  background: transparent;
  cursor: pointer;
  padding: 2px;
  flex-shrink: 0;
}

.glace-upload-hint {
  font-size: 0.82rem;
  font-style: italic;
  color: rgba(167,211,234,0.5);
}

.glace-imgs-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
}
.glace-img-preview {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.glace-img-preview img {
  max-width: 160px;
  max-height: 120px;
  object-fit: cover;
  border: 1px solid rgba(255,255,255,0.08);
}

.glace-form-error {
  font-size: 0.95rem;
  font-style: italic;
  color: #c05050;
  margin-top: 10px;
}
</style>

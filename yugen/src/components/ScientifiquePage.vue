<template>
  <div class="sci-page">
    <AppNavbar />

    <div v-if="!access" class="sci-loading">
      <p>Chargement…</p>
    </div>

    <div v-else-if="accesDenie" class="jeu-indispo">
      <p class="jeu-indispo-title">Accès restreint</p>
      <p class="jeu-indispo-sub">Cette section est réservée aux membres de la Scientifique.</p>
      <RouterLink to="/parchemin" class="jeu-indispo-link">← Retour</RouterLink>
    </div>

    <div v-else class="sci-inner">

      <!-- En-tête -->
      <div class="sci-header">
        <h1 class="sci-title">La Scientifique</h1>
        <p v-if="access.dirigeant" class="sci-role-badge sci-role-badge--dir">Dirigeant</p>
        <p v-else-if="access.role" class="sci-role-badge">{{ access.role.role_nom }}</p>
      </div>

      <!-- Onglets principaux -->
      <div class="sci-tabs">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="sci-tab"
          :class="{ 'sci-tab--active': onglet === t.key }"
          @click="onglet = t.key"
        >{{ t.label }}</button>
      </div>

      <!-- ── CATALOGUE ──────────────────────────────────────────────── -->
      <div v-if="onglet === 'catalogue'" class="sci-section">

        <!-- Vue fiche item -->
        <div v-if="selectedItem" class="sci-fiche">
          <button class="sci-back" @click="selectedItem = null">← {{ selectedCat?.nom || 'Retour' }}</button>
          <div class="sci-fiche-header">
            <h2 class="sci-fiche-title">{{ selectedItem.nom }}</h2>
            <span class="sci-fiche-meta">{{ selectedCat?.nom }}</span>
            <span class="sci-fiche-auteur">Fiche créée par {{ selectedItem.auteur || '?' }}</span>
          </div>
          <div class="sci-fiche-body">
            <div v-for="champ in selectedCat?.champs || []" :key="champ.id" class="sci-fiche-champ">
              <p class="sci-champ-label">{{ champ.nom }}</p>
              <template v-if="champ.type === 'image' && selectedItem.valeurs?.[champ.id]">
                <img :src="selectedItem.valeurs[champ.id]" class="sci-fiche-img" alt="" />
              </template>
              <p v-else class="sci-champ-val">{{ selectedItem.valeurs?.[champ.id] || '—' }}</p>
            </div>
          </div>
          <div v-if="canEdit || access.dirigeant" class="sci-fiche-actions">
            <button class="sci-btn sci-btn--sm" @click="openEditItem(selectedItem)">Modifier</button>
            <button v-if="canDelete || access.dirigeant" class="sci-btn sci-btn--danger sci-btn--sm" @click="deleteItem(selectedItem.id)">Supprimer</button>
          </div>
        </div>

        <!-- Vue liste items d'une catégorie -->
        <div v-else-if="selectedCat">
          <div class="sci-cat-header">
            <button class="sci-back" @click="selectedCat = null; items = []">← Catalogue</button>
            <h2 class="sci-cat-title">{{ selectedCat.nom }}</h2>
            <button v-if="canCreate || access.dirigeant" class="sci-btn" @click="openCreateItem">+ Nouvelle fiche</button>
          </div>
          <p v-if="loadingItems" class="sci-hint">Chargement…</p>
          <p v-else-if="!items.length" class="sci-hint">Aucune fiche dans cette catégorie.</p>
          <div v-else class="sci-items-grid">
            <div
              v-for="item in items"
              :key="item.id"
              class="sci-item-card"
              @click="openItem(item)"
            >
              <p class="sci-item-name">{{ item.nom }}</p>
              <p class="sci-item-meta">{{ item.auteur }}</p>
            </div>
          </div>
        </div>

        <!-- Vue grille catégories -->
        <div v-else>
          <p v-if="!categories.length" class="sci-hint">Aucune catégorie. Le Dirigeant doit en créer.</p>
          <div v-else class="sci-cat-grid">
            <div
              v-for="cat in categories"
              :key="cat.id"
              class="sci-cat-card"
              @click="selectCat(cat)"
            >
              <span class="sci-cat-icone">{{ cat.icone || '⬡' }}</span>
              <p class="sci-cat-nom">{{ cat.nom }}</p>
              <p class="sci-cat-count">{{ itemCounts[cat.id] ?? '…' }} fiche(s)</p>
            </div>
          </div>
        </div>

        <!-- Modal créer/éditer item -->
        <Transition name="sci-modal">
          <div v-if="showItemForm" class="sci-modal-overlay" @click.self="showItemForm = false">
            <div class="sci-modal">
              <h3 class="sci-modal-title">{{ editingItem ? 'Modifier la fiche' : 'Nouvelle fiche' }}</h3>
              <div class="sci-form-group">
                <label class="sci-label">Nom *</label>
                <input v-model="itemForm.nom" class="sci-input" placeholder="Nom de l'objet" />
              </div>
              <div v-for="champ in selectedCat?.champs || []" :key="champ.id" class="sci-form-group">
                <label class="sci-label">{{ champ.nom }}<span v-if="champ.requis" class="sci-req"> *</span></label>
                <textarea v-if="champ.type === 'long'" v-model="itemForm.valeurs[champ.id]" class="sci-textarea" rows="3" />
                <input v-else-if="champ.type === 'nombre'" v-model="itemForm.valeurs[champ.id]" type="number" class="sci-input" />
                <input v-else-if="champ.type === 'image'" v-model="itemForm.valeurs[champ.id]" class="sci-input" placeholder="URL de l'image" />
                <select v-else-if="champ.type === 'select'" v-model="itemForm.valeurs[champ.id]" class="sci-select">
                  <option value="">— Choisir —</option>
                  <option v-for="opt in parseOptions(champ.options)" :key="opt" :value="opt">{{ opt }}</option>
                </select>
                <input v-else v-model="itemForm.valeurs[champ.id]" class="sci-input" />
              </div>
              <p v-if="itemErr" class="sci-err">{{ itemErr }}</p>
              <div class="sci-modal-actions">
                <button class="sci-btn" :disabled="savingItem" @click="saveItem">{{ savingItem ? '…' : (editingItem ? 'Enregistrer' : 'Créer') }}</button>
                <button class="sci-btn sci-btn--ghost" @click="showItemForm = false">Annuler</button>
              </div>
            </div>
          </div>
        </Transition>

      </div>

      <!-- ── MEMBRES ────────────────────────────────────────────────── -->
      <div v-if="onglet === 'membres'" class="sci-section">
        <p v-if="!membres.length" class="sci-hint">Aucun membre pour l'instant.</p>
        <div v-else class="sci-membres-list">
          <div v-for="m in membres" :key="m.id" class="sci-membre-row">
            <div class="sci-membre-info">
              <span class="sci-membre-nom">{{ m.nom }}</span>
              <span class="sci-membre-grade">{{ m.grade }}</span>
            </div>
            <span class="sci-membre-role" :style="{ borderColor: roleColor(m.ordre) }">{{ m.role_nom }}</span>
          </div>
        </div>
      </div>

      <!-- ── GESTION (dirigeant) ────────────────────────────────────── -->
      <div v-if="onglet === 'gestion' && access.dirigeant" class="sci-section">

        <div class="sci-subtabs">
          <button v-for="st in gestionSubtabs" :key="st.key" class="sci-subtab" :class="{ 'sci-subtab--active': gestionOnglet === st.key }" @click="gestionOnglet = st.key">{{ st.label }}</button>
        </div>

        <!-- ── Rôles ── -->
        <div v-if="gestionOnglet === 'roles'" class="sci-gestion-block">
          <div class="sci-gestion-header">
            <h3 class="sci-gestion-title">Rôles</h3>
            <button class="sci-btn" @click="openCreateRole">+ Nouveau rôle</button>
          </div>
          <p v-if="!roles.length" class="sci-hint">Aucun rôle créé.</p>
          <div v-else class="sci-roles-list">
            <div v-for="role in roles" :key="role.id" class="sci-role-row">
              <div class="sci-role-info">
                <span class="sci-role-nom">{{ role.nom }}</span>
                <span class="sci-role-ordre">Niveau {{ role.ordre }}</span>
                <div class="sci-role-perms">
                  <span v-if="role.can_create_items" class="sci-perm">Créer fiches</span>
                  <span v-if="role.can_edit_items" class="sci-perm">Modifier fiches</span>
                  <span v-if="role.can_delete_items" class="sci-perm">Supprimer fiches</span>
                  <span v-if="role.can_add_members" class="sci-perm">Gérer membres inférieurs</span>
                </div>
              </div>
              <div class="sci-row-actions">
                <button class="sci-btn sci-btn--sm" @click="openEditRole(role)">Modifier</button>
                <button class="sci-btn sci-btn--danger sci-btn--sm" @click="deleteRole(role.id)">Supprimer</button>
              </div>
            </div>
          </div>

          <!-- Form rôle -->
          <Transition name="sci-modal">
            <div v-if="showRoleForm" class="sci-modal-overlay" @click.self="showRoleForm = false">
              <div class="sci-modal">
                <h3 class="sci-modal-title">{{ editingRole ? 'Modifier le rôle' : 'Nouveau rôle' }}</h3>
                <div class="sci-form-row">
                  <div class="sci-form-group">
                    <label class="sci-label">Nom *</label>
                    <input v-model="roleForm.nom" class="sci-input" />
                  </div>
                  <div class="sci-form-group">
                    <label class="sci-label">Niveau (hiérarchie)</label>
                    <input v-model.number="roleForm.ordre" type="number" class="sci-input" placeholder="0" />
                  </div>
                </div>
                <p class="sci-label" style="margin-bottom:8px">Permissions</p>
                <div class="sci-perms-grid">
                  <label class="sci-check"><input type="checkbox" v-model="roleForm.can_create_items" /> Créer des fiches</label>
                  <label class="sci-check"><input type="checkbox" v-model="roleForm.can_edit_items" /> Modifier des fiches</label>
                  <label class="sci-check"><input type="checkbox" v-model="roleForm.can_delete_items" /> Supprimer des fiches</label>
                  <label class="sci-check"><input type="checkbox" v-model="roleForm.can_add_members" /> Gérer des membres inférieurs</label>
                </div>
                <p v-if="roleErr" class="sci-err">{{ roleErr }}</p>
                <div class="sci-modal-actions">
                  <button class="sci-btn" :disabled="savingRole" @click="saveRole">{{ savingRole ? '…' : (editingRole ? 'Enregistrer' : 'Créer') }}</button>
                  <button class="sci-btn sci-btn--ghost" @click="showRoleForm = false">Annuler</button>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <!-- ── Membres (gestion) ── -->
        <div v-if="gestionOnglet === 'membres'" class="sci-gestion-block">
          <div class="sci-gestion-header">
            <h3 class="sci-gestion-title">Membres</h3>
            <button class="sci-btn" @click="openAddMembre">+ Ajouter un membre</button>
          </div>
          <p v-if="!membres.length" class="sci-hint">Aucun membre.</p>
          <div v-else class="sci-roles-list">
            <div v-for="m in membres" :key="m.id" class="sci-role-row">
              <div class="sci-role-info">
                <span class="sci-role-nom">{{ m.nom }}</span>
                <span class="sci-role-ordre">{{ m.role_nom }}</span>
              </div>
              <div class="sci-row-actions">
                <button class="sci-btn sci-btn--sm" @click="openChangeMembre(m)">Changer rôle</button>
                <button class="sci-btn sci-btn--danger sci-btn--sm" @click="removeMembre(m.id)">Retirer</button>
              </div>
            </div>
          </div>

          <!-- Form membre -->
          <Transition name="sci-modal">
            <div v-if="showMembreForm" class="sci-modal-overlay" @click.self="showMembreForm = false">
              <div class="sci-modal">
                <h3 class="sci-modal-title">{{ editingMembre ? 'Changer le rôle' : 'Ajouter un membre' }}</h3>
                <div v-if="!editingMembre" class="sci-form-group">
                  <label class="sci-label">Utilisateur</label>
                  <select v-model="membreForm.userId" class="sci-select">
                    <option value="">— Choisir —</option>
                    <option v-for="u in allUsers" :key="u.id" :value="u.id">{{ u.nom }} ({{ u.identifiant }})</option>
                  </select>
                </div>
                <div v-else class="sci-form-group">
                  <p class="sci-label" style="color:#fff">{{ editingMembre.nom }}</p>
                </div>
                <div class="sci-form-group">
                  <label class="sci-label">Rôle</label>
                  <select v-model="membreForm.roleId" class="sci-select">
                    <option value="">— Choisir —</option>
                    <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.nom }} (niv. {{ r.ordre }})</option>
                  </select>
                </div>
                <p v-if="membreErr" class="sci-err">{{ membreErr }}</p>
                <div class="sci-modal-actions">
                  <button class="sci-btn" :disabled="savingMembre" @click="saveMembre">{{ savingMembre ? '…' : (editingMembre ? 'Enregistrer' : 'Ajouter') }}</button>
                  <button class="sci-btn sci-btn--ghost" @click="showMembreForm = false">Annuler</button>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <!-- ── Catégories & Champs ── -->
        <div v-if="gestionOnglet === 'categories'" class="sci-gestion-block">
          <div class="sci-gestion-header">
            <h3 class="sci-gestion-title">Catégories</h3>
            <button class="sci-btn" @click="openCreateCat">+ Nouvelle catégorie</button>
          </div>
          <p v-if="!categories.length" class="sci-hint">Aucune catégorie.</p>
          <div v-else class="sci-cat-manage-list">
            <div v-for="cat in categories" :key="cat.id" class="sci-cat-manage-row">
              <div class="sci-cat-manage-top">
                <div class="sci-role-info">
                  <span class="sci-role-nom">{{ cat.icone }} {{ cat.nom }}</span>
                  <span class="sci-role-ordre">{{ cat.champs.length }} champ(s)</span>
                </div>
                <div class="sci-row-actions">
                  <button class="sci-btn sci-btn--sm" @click="openEditCat(cat)">Modifier</button>
                  <button class="sci-btn sci-btn--sm" @click="toggleCatChamps(cat.id)">Champs {{ openChamps === cat.id ? '▲' : '▼' }}</button>
                  <button class="sci-btn sci-btn--danger sci-btn--sm" @click="deleteCat(cat.id)">Supprimer</button>
                </div>
              </div>

              <!-- Champs de la catégorie -->
              <div v-if="openChamps === cat.id" class="sci-champs-panel">
                <div v-for="ch in cat.champs" :key="ch.id" class="sci-champ-row">
                  <span class="sci-champ-nom">{{ ch.nom }}</span>
                  <span class="sci-champ-type">{{ ch.type }}</span>
                  <span v-if="ch.requis" class="sci-perm">Requis</span>
                  <div class="sci-row-actions">
                    <button class="sci-btn sci-btn--sm" @click="openEditChamp(ch)">Modifier</button>
                    <button class="sci-btn sci-btn--danger sci-btn--sm" @click="deleteChamp(ch.id, cat.id)">Supprimer</button>
                  </div>
                </div>
                <button class="sci-btn sci-btn--sm sci-btn--outline" @click="openAddChamp(cat.id)">+ Ajouter un champ</button>
              </div>
            </div>
          </div>

          <!-- Form catégorie -->
          <Transition name="sci-modal">
            <div v-if="showCatForm" class="sci-modal-overlay" @click.self="showCatForm = false">
              <div class="sci-modal">
                <h3 class="sci-modal-title">{{ editingCat ? 'Modifier la catégorie' : 'Nouvelle catégorie' }}</h3>
                <div class="sci-form-row">
                  <div class="sci-form-group">
                    <label class="sci-label">Nom *</label>
                    <input v-model="catForm.nom" class="sci-input" />
                  </div>
                  <div class="sci-form-group">
                    <label class="sci-label">Icône (emoji)</label>
                    <input v-model="catForm.icone" class="sci-input" style="max-width:80px" />
                  </div>
                  <div class="sci-form-group">
                    <label class="sci-label">Ordre</label>
                    <input v-model.number="catForm.ordre" type="number" class="sci-input" style="max-width:80px" />
                  </div>
                </div>
                <p v-if="catErr" class="sci-err">{{ catErr }}</p>
                <div class="sci-modal-actions">
                  <button class="sci-btn" :disabled="savingCat" @click="saveCat">{{ savingCat ? '…' : (editingCat ? 'Enregistrer' : 'Créer') }}</button>
                  <button class="sci-btn sci-btn--ghost" @click="showCatForm = false">Annuler</button>
                </div>
              </div>
            </div>
          </Transition>

          <!-- Form champ -->
          <Transition name="sci-modal">
            <div v-if="showChampForm" class="sci-modal-overlay" @click.self="showChampForm = false">
              <div class="sci-modal">
                <h3 class="sci-modal-title">{{ editingChamp ? 'Modifier le champ' : 'Nouveau champ' }}</h3>
                <div class="sci-form-row">
                  <div class="sci-form-group">
                    <label class="sci-label">Nom *</label>
                    <input v-model="champForm.nom" class="sci-input" />
                  </div>
                  <div class="sci-form-group">
                    <label class="sci-label">Type</label>
                    <select v-model="champForm.type" class="sci-select">
                      <option value="texte">Texte court</option>
                      <option value="long">Texte long</option>
                      <option value="nombre">Nombre</option>
                      <option value="image">Image (URL)</option>
                      <option value="select">Liste de choix</option>
                    </select>
                  </div>
                  <div class="sci-form-group">
                    <label class="sci-label">Ordre</label>
                    <input v-model.number="champForm.ordre" type="number" class="sci-input" style="max-width:80px" />
                  </div>
                </div>
                <div v-if="champForm.type === 'select'" class="sci-form-group">
                  <label class="sci-label">Options (une par ligne)</label>
                  <textarea v-model="champOptionsRaw" class="sci-textarea" rows="4" placeholder="Option 1&#10;Option 2&#10;Option 3" />
                </div>
                <label class="sci-check" style="margin-bottom:12px"><input type="checkbox" v-model="champForm.requis" /> Champ requis</label>
                <p v-if="champErr" class="sci-err">{{ champErr }}</p>
                <div class="sci-modal-actions">
                  <button class="sci-btn" :disabled="savingChamp" @click="saveChamp">{{ savingChamp ? '…' : (editingChamp ? 'Enregistrer' : 'Ajouter') }}</button>
                  <button class="sci-btn sci-btn--ghost" @click="showChampForm = false">Annuler</button>
                </div>
              </div>
            </div>
          </Transition>

        </div><!-- /gestion categories -->
      </div><!-- /gestion -->

    </div><!-- /sci-inner -->
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import AppNavbar from './AppNavbar.vue'
import {
  sciMe, sciGetRoles, sciCreateRole, sciUpdateRole, sciDeleteRole,
  sciGetMembres, sciAddMembre, sciUpdateMembre, sciRemoveMembre,
  sciGetCategories, sciCreateCategorie, sciUpdateCategorie, sciDeleteCategorie,
  sciAddChamp, sciUpdateChamp, sciDeleteChamp,
  sciGetItems, sciGetItem, sciCreateItem, sciUpdateItem, sciDeleteItem,
  sciGetUsers,
} from '../api.js'

// ── State principal ───────────────────────────────────────────────────────────

const access      = ref(null)
const accesDenie  = ref(false)
const onglet      = ref('catalogue')
const gestionOnglet = ref('roles')

const categories  = ref([])
const roles       = ref([])
const membres     = ref([])
const items       = ref([])
const itemCounts  = ref({})
const allUsers    = ref([])

const selectedCat  = ref(null)
const selectedItem = ref(null)
const loadingItems = ref(false)

const tabs = computed(() => {
  const t = [
    { key: 'catalogue', label: 'Catalogue' },
    { key: 'membres',   label: 'Membres' },
  ]
  if (access.value?.dirigeant) t.push({ key: 'gestion', label: 'Gestion' })
  return t
})

const gestionSubtabs = [
  { key: 'roles',      label: 'Rôles' },
  { key: 'membres',    label: 'Membres' },
  { key: 'categories', label: 'Catégories' },
]

const canCreate = computed(() => !!access.value?.role?.can_create_items)
const canEdit   = computed(() => !!access.value?.role?.can_edit_items)
const canDelete = computed(() => !!access.value?.role?.can_delete_items)

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseOptions(raw) {
  try { return JSON.parse(raw) } catch { return [] }
}

function roleColor(ordre) {
  if (ordre >= 8) return '#c9a84c'
  if (ordre >= 5) return '#8b1a1a'
  return 'rgba(255,255,255,0.2)'
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function loadAll() {
  try {
    const [a, cats, rols, mems] = await Promise.all([
      sciMe(),
      sciGetCategories(),
      sciGetRoles(),
      sciGetMembres(),
    ])
    access.value     = a
    categories.value = cats
    roles.value      = rols
    membres.value    = mems
    for (const cat of cats) {
      sciGetItems(cat.id).then(its => { itemCounts.value[cat.id] = its.length })
    }
    if (a?.dirigeant) {
      allUsers.value = await sciGetUsers()
    }
  } catch (e) {
    accesDenie.value = true
    access.value     = {}
  }
}

onMounted(loadAll)

// ── Catalogue ─────────────────────────────────────────────────────────────────

async function selectCat(cat) {
  selectedCat.value  = cat
  selectedItem.value = null
  loadingItems.value = true
  try { items.value = await sciGetItems(cat.id) } finally { loadingItems.value = false }
}

async function openItem(item) {
  const full = await sciGetItem(item.id)
  selectedItem.value = full
}

// ── Form item ─────────────────────────────────────────────────────────────────

const showItemForm  = ref(false)
const editingItem   = ref(null)
const savingItem    = ref(false)
const itemErr       = ref('')
const itemForm      = ref({ nom: '', valeurs: {} })

function openCreateItem() {
  editingItem.value  = null
  itemForm.value     = { nom: '', valeurs: {} }
  itemErr.value      = ''
  showItemForm.value = true
}

function openEditItem(item) {
  editingItem.value = item
  itemForm.value    = { nom: item.nom, valeurs: { ...item.valeurs } }
  itemErr.value     = ''
  showItemForm.value = true
}

async function saveItem() {
  itemErr.value = ''
  if (!itemForm.value.nom.trim()) { itemErr.value = 'Nom requis.'; return }
  savingItem.value = true
  try {
    const payload = { nom: itemForm.value.nom, categorie_id: selectedCat.value.id, valeurs: itemForm.value.valeurs }
    if (editingItem.value) {
      const updated = await sciUpdateItem(editingItem.value.id, payload)
      selectedItem.value = { ...updated }
      const idx = items.value.findIndex(i => i.id === updated.id)
      if (idx !== -1) items.value[idx] = updated
    } else {
      const created = await sciCreateItem(payload)
      items.value.push(created)
      itemCounts.value[selectedCat.value.id] = (itemCounts.value[selectedCat.value.id] || 0) + 1
    }
    showItemForm.value = false
  } catch (e) { itemErr.value = e.message } finally { savingItem.value = false }
}

async function deleteItem(id) {
  if (!confirm('Supprimer cette fiche ?')) return
  try {
    await sciDeleteItem(id)
    items.value = items.value.filter(i => i.id !== id)
    itemCounts.value[selectedCat.value.id] = Math.max(0, (itemCounts.value[selectedCat.value.id] || 1) - 1)
    selectedItem.value = null
  } catch (e) { alert(e.message) }
}

// ── Form rôle ─────────────────────────────────────────────────────────────────

const showRoleForm  = ref(false)
const editingRole   = ref(null)
const savingRole    = ref(false)
const roleErr       = ref('')
const roleForm      = ref({ nom: '', ordre: 0, can_create_items: false, can_edit_items: false, can_delete_items: false, can_add_members: false })

function openCreateRole() {
  editingRole.value  = null
  roleForm.value     = { nom: '', ordre: 0, can_create_items: false, can_edit_items: false, can_delete_items: false, can_add_members: false }
  roleErr.value      = ''
  showRoleForm.value = true
}

function openEditRole(role) {
  editingRole.value = role
  roleForm.value    = {
    nom: role.nom, ordre: role.ordre,
    can_create_items: !!role.can_create_items, can_edit_items: !!role.can_edit_items,
    can_delete_items: !!role.can_delete_items, can_add_members: !!role.can_add_members,
  }
  roleErr.value      = ''
  showRoleForm.value = true
}

async function saveRole() {
  roleErr.value = ''
  if (!roleForm.value.nom.trim()) { roleErr.value = 'Nom requis.'; return }
  savingRole.value = true
  try {
    if (editingRole.value) {
      const updated = await sciUpdateRole(editingRole.value.id, roleForm.value)
      const idx = roles.value.findIndex(r => r.id === updated.id)
      if (idx !== -1) roles.value[idx] = updated
    } else {
      roles.value.push(await sciCreateRole(roleForm.value))
    }
    showRoleForm.value = false
  } catch (e) { roleErr.value = e.message } finally { savingRole.value = false }
}

async function deleteRole(id) {
  if (!confirm('Supprimer ce rôle ?')) return
  try { await sciDeleteRole(id); roles.value = roles.value.filter(r => r.id !== id) } catch (e) { alert(e.message) }
}

// ── Form membre ───────────────────────────────────────────────────────────────

const showMembreForm  = ref(false)
const editingMembre   = ref(null)
const savingMembre    = ref(false)
const membreErr       = ref('')
const membreForm      = ref({ userId: '', roleId: '' })

function openAddMembre() {
  editingMembre.value  = null
  membreForm.value     = { userId: '', roleId: '' }
  membreErr.value      = ''
  showMembreForm.value = true
}

function openChangeMembre(m) {
  editingMembre.value  = m
  membreForm.value     = { userId: m.id, roleId: m.role_id }
  membreErr.value      = ''
  showMembreForm.value = true
}

async function saveMembre() {
  membreErr.value = ''
  if (!membreForm.value.roleId) { membreErr.value = 'Rôle requis.'; return }
  savingMembre.value = true
  try {
    if (editingMembre.value) {
      await sciUpdateMembre(editingMembre.value.id, membreForm.value.roleId)
    } else {
      if (!membreForm.value.userId) { membreErr.value = 'Utilisateur requis.'; return }
      await sciAddMembre(membreForm.value.userId, membreForm.value.roleId)
    }
    membres.value = await sciGetMembres()
    showMembreForm.value = false
  } catch (e) { membreErr.value = e.message } finally { savingMembre.value = false }
}

async function removeMembre(userId) {
  if (!confirm('Retirer ce membre ?')) return
  try { await sciRemoveMembre(userId); membres.value = membres.value.filter(m => m.id !== userId) } catch (e) { alert(e.message) }
}

// ── Form catégorie ────────────────────────────────────────────────────────────

const showCatForm  = ref(false)
const editingCat   = ref(null)
const savingCat    = ref(false)
const catErr       = ref('')
const catForm      = ref({ nom: '', icone: '', ordre: 0 })

function openCreateCat() {
  editingCat.value  = null
  catForm.value     = { nom: '', icone: '', ordre: 0 }
  catErr.value      = ''
  showCatForm.value = true
}

function openEditCat(cat) {
  editingCat.value  = cat
  catForm.value     = { nom: cat.nom, icone: cat.icone, ordre: cat.ordre }
  catErr.value      = ''
  showCatForm.value = true
}

async function saveCat() {
  catErr.value = ''
  if (!catForm.value.nom.trim()) { catErr.value = 'Nom requis.'; return }
  savingCat.value = true
  try {
    if (editingCat.value) {
      const updated = await sciUpdateCategorie(editingCat.value.id, catForm.value)
      const idx = categories.value.findIndex(c => c.id === updated.id)
      if (idx !== -1) categories.value[idx] = { ...categories.value[idx], ...updated }
    } else {
      categories.value.push(await sciCreateCategorie(catForm.value))
    }
    showCatForm.value = false
  } catch (e) { catErr.value = e.message } finally { savingCat.value = false }
}

async function deleteCat(id) {
  if (!confirm('Supprimer cette catégorie ? (toutes ses fiches doivent être supprimées d\'abord)')) return
  try { await sciDeleteCategorie(id); categories.value = categories.value.filter(c => c.id !== id) } catch (e) { alert(e.message) }
}

// ── Form champ ────────────────────────────────────────────────────────────────

const showChampForm   = ref(false)
const editingChamp    = ref(null)
const champCatId      = ref(null)
const savingChamp     = ref(false)
const champErr        = ref('')
const champOptionsRaw = ref('')
const champForm       = ref({ nom: '', type: 'texte', requis: false, ordre: 0 })
const openChamps      = ref(null)

function toggleCatChamps(catId) {
  openChamps.value = openChamps.value === catId ? null : catId
}

function openAddChamp(catId) {
  editingChamp.value    = null
  champCatId.value      = catId
  champForm.value       = { nom: '', type: 'texte', requis: false, ordre: 0 }
  champOptionsRaw.value = ''
  champErr.value        = ''
  showChampForm.value   = true
}

function openEditChamp(ch) {
  editingChamp.value    = ch
  champCatId.value      = ch.categorie_id
  champForm.value       = { nom: ch.nom, type: ch.type, requis: !!ch.requis, ordre: ch.ordre }
  champOptionsRaw.value = parseOptions(ch.options).join('\n')
  champErr.value        = ''
  showChampForm.value   = true
}

async function saveChamp() {
  champErr.value = ''
  if (!champForm.value.nom.trim()) { champErr.value = 'Nom requis.'; return }
  const options = champOptionsRaw.value.split('\n').map(s => s.trim()).filter(Boolean)
  savingChamp.value = true
  try {
    const payload = { ...champForm.value, options }
    if (editingChamp.value) {
      const updated = await sciUpdateChamp(editingChamp.value.id, payload)
      const cat = categories.value.find(c => c.id === champCatId.value)
      if (cat) {
        const idx = cat.champs.findIndex(ch => ch.id === updated.id)
        if (idx !== -1) cat.champs[idx] = updated
      }
    } else {
      const created = await sciAddChamp(champCatId.value, payload)
      const cat = categories.value.find(c => c.id === champCatId.value)
      if (cat) cat.champs.push(created)
    }
    showChampForm.value = false
  } catch (e) { champErr.value = e.message } finally { savingChamp.value = false }
}

async function deleteChamp(id, catId) {
  if (!confirm('Supprimer ce champ ? Les valeurs existantes seront perdues.')) return
  try {
    await sciDeleteChamp(id)
    const cat = categories.value.find(c => c.id === catId)
    if (cat) cat.champs = cat.champs.filter(ch => ch.id !== id)
  } catch (e) { alert(e.message) }
}
</script>

<style scoped>
/* ── Base ──────────────────────────────────────────────────────── */
.sci-page { min-height: 100vh; background: #080b11; color: #fff; font-family: 'Crimson Text', Georgia, serif; }
.sci-inner { max-width: 960px; margin: 0 auto; padding: 32px 24px 64px; }
.sci-loading { display: flex; align-items: center; justify-content: center; min-height: 60vh; color: rgba(255,255,255,0.3); font-family: 'Cinzel', serif; font-size: 0.75rem; letter-spacing: 0.1em; }

.jeu-indispo { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:calc(100vh - 60px); gap:12px; text-align:center; padding:40px; }
.jeu-indispo-title { font-family:'Cinzel',serif; font-size:1.4rem; letter-spacing:0.06em; color:rgba(255,255,255,0.7); }
.jeu-indispo-sub { font-family:'Crimson Text',Georgia,serif; font-style:italic; color:rgba(255,255,255,0.3); font-size:1rem; }
.jeu-indispo-link { margin-top:16px; font-family:'Cinzel',serif; font-size:0.65rem; letter-spacing:0.15em; text-transform:uppercase; color:rgba(139,26,26,0.7); text-decoration:none; }
.jeu-indispo-link:hover { color:rgba(139,26,26,1); }

/* ── Header ────────────────────────────────────────────────────── */
.sci-header { display: flex; align-items: baseline; gap: 16px; margin-bottom: 28px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.sci-title { font-family: 'Cinzel Decorative', 'Cinzel', serif; font-size: 1.4rem; letter-spacing: 0.08em; color: #fff; margin: 0; }
.sci-role-badge { font-family: 'Cinzel', serif; font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase; border: 1px solid rgba(139,26,26,0.5); color: rgba(139,26,26,0.9); padding: 3px 10px; }
.sci-role-badge--dir { border-color: rgba(201,168,76,0.5); color: #c9a84c; }

/* ── Tabs ──────────────────────────────────────────────────────── */
.sci-tabs { display: flex; gap: 4px; margin-bottom: 28px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.sci-tab { background: none; border: none; border-bottom: 2px solid transparent; padding: 8px 18px; font-family: 'Cinzel', serif; font-size: 0.65rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.35); cursor: pointer; transition: color 0.15s, border-color 0.15s; margin-bottom: -1px; }
.sci-tab:hover { color: rgba(255,255,255,0.65); }
.sci-tab--active { color: #fff; border-bottom-color: #8b1a1a; }

.sci-subtabs { display: flex; gap: 4px; margin-bottom: 24px; }
.sci-subtab { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); padding: 6px 16px; font-family: 'Cinzel', serif; font-size: 0.6rem; letter-spacing: 0.08em; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.15s; }
.sci-subtab:hover { color: rgba(255,255,255,0.7); }
.sci-subtab--active { background: rgba(139,26,26,0.12); border-color: rgba(139,26,26,0.3); color: rgba(255,255,255,0.85); }

/* ── Buttons ───────────────────────────────────────────────────── */
.sci-btn { background: rgba(139,26,26,0.15); border: 1px solid rgba(139,26,26,0.4); color: rgba(255,255,255,0.8); font-family: 'Cinzel', serif; font-size: 0.62rem; letter-spacing: 0.08em; padding: 7px 16px; cursor: pointer; transition: all 0.15s; }
.sci-btn:hover:not(:disabled) { background: rgba(139,26,26,0.28); border-color: rgba(139,26,26,0.7); color: #fff; }
.sci-btn:disabled { opacity: 0.4; cursor: default; }
.sci-btn--sm { padding: 4px 10px; font-size: 0.58rem; }
.sci-btn--ghost { background: transparent; border-color: rgba(255,255,255,0.12); color: rgba(255,255,255,0.4); }
.sci-btn--ghost:hover { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.7); }
.sci-btn--danger { background: rgba(139,26,26,0.08); border-color: rgba(139,26,26,0.3); color: rgba(139,26,26,0.8); }
.sci-btn--danger:hover:not(:disabled) { background: rgba(139,26,26,0.18); color: #c02020; }
.sci-btn--outline { background: transparent; border-color: rgba(255,255,255,0.12); color: rgba(255,255,255,0.5); }
.sci-btn--outline:hover { border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.8); }

/* ── Catalogue — grille catégories ────────────────────────────── */
.sci-cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
.sci-cat-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); padding: 24px 20px; cursor: pointer; transition: border-color 0.15s, background 0.15s; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
.sci-cat-card:hover { border-color: rgba(139,26,26,0.4); background: rgba(139,26,26,0.05); }
.sci-cat-icone { font-size: 2rem; line-height: 1; }
.sci-cat-nom { font-family: 'Cinzel', serif; font-size: 0.72rem; letter-spacing: 0.06em; color: rgba(255,255,255,0.85); }
.sci-cat-count { font-size: 0.8rem; color: rgba(255,255,255,0.3); font-style: italic; }

/* ── Catalogue — liste items ───────────────────────────────────── */
.sci-cat-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.sci-cat-title { font-family: 'Cinzel', serif; font-size: 1rem; letter-spacing: 0.06em; flex: 1; }
.sci-back { background: none; border: none; color: rgba(255,255,255,0.35); font-family: 'Cinzel', serif; font-size: 0.6rem; letter-spacing: 0.1em; cursor: pointer; padding: 0; transition: color 0.12s; }
.sci-back:hover { color: rgba(255,255,255,0.7); }

.sci-items-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.sci-item-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); padding: 16px; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.sci-item-card:hover { border-color: rgba(201,168,76,0.3); background: rgba(201,168,76,0.04); }
.sci-item-name { font-family: 'Cinzel', serif; font-size: 0.72rem; letter-spacing: 0.04em; color: rgba(255,255,255,0.85); margin: 0 0 6px; }
.sci-item-meta { font-size: 0.8rem; color: rgba(255,255,255,0.3); font-style: italic; margin: 0; }

/* ── Fiche item ────────────────────────────────────────────────── */
.sci-fiche { max-width: 640px; }
.sci-fiche-header { margin: 16px 0 24px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.sci-fiche-title { font-family: 'Cinzel', serif; font-size: 1.3rem; letter-spacing: 0.06em; margin: 0 0 6px; }
.sci-fiche-meta { font-size: 0.85rem; color: rgba(201,168,76,0.7); font-style: italic; display: block; }
.sci-fiche-auteur { font-size: 0.78rem; color: rgba(255,255,255,0.25); font-style: italic; display: block; margin-top: 4px; }
.sci-fiche-body { display: flex; flex-direction: column; gap: 20px; margin-bottom: 24px; }
.sci-fiche-champ { }
.sci-champ-label { font-family: 'Cinzel', serif; font-size: 0.58rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin: 0 0 6px; }
.sci-champ-val { font-size: 1rem; color: rgba(255,255,255,0.8); margin: 0; white-space: pre-wrap; }
.sci-fiche-img { max-width: 100%; max-height: 300px; object-fit: cover; border: 1px solid rgba(255,255,255,0.08); }
.sci-fiche-actions { display: flex; gap: 8px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.06); }

/* ── Membres ───────────────────────────────────────────────────── */
.sci-membres-list { display: flex; flex-direction: column; gap: 2px; }
.sci-membre-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); }
.sci-membre-info { display: flex; flex-direction: column; gap: 2px; }
.sci-membre-nom { font-family: 'Cinzel', serif; font-size: 0.75rem; color: rgba(255,255,255,0.85); }
.sci-membre-grade { font-size: 0.78rem; color: rgba(255,255,255,0.3); font-style: italic; }
.sci-membre-role { font-family: 'Cinzel', serif; font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; border: 1px solid; padding: 3px 10px; color: rgba(255,255,255,0.6); }

/* ── Gestion ───────────────────────────────────────────────────── */
.sci-gestion-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.sci-gestion-title { font-family: 'Cinzel', serif; font-size: 0.9rem; letter-spacing: 0.06em; }
.sci-roles-list { display: flex; flex-direction: column; gap: 2px; margin-bottom: 16px; }
.sci-role-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); gap: 12px; }
.sci-role-info { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
.sci-role-nom { font-family: 'Cinzel', serif; font-size: 0.75rem; color: rgba(255,255,255,0.85); }
.sci-role-ordre { font-size: 0.78rem; color: rgba(255,255,255,0.3); font-style: italic; }
.sci-role-perms { display: flex; gap: 6px; flex-wrap: wrap; }
.sci-row-actions { display: flex; gap: 6px; flex-shrink: 0; }

.sci-perm { font-family: 'Cinzel', serif; font-size: 0.52rem; letter-spacing: 0.08em; border: 1px solid rgba(201,168,76,0.25); color: rgba(201,168,76,0.6); padding: 2px 7px; }

.sci-hint { color: rgba(255,255,255,0.25); font-style: italic; font-size: 0.9rem; }

/* ── Gestion catégories ────────────────────────────────────────── */
.sci-cat-manage-list { display: flex; flex-direction: column; gap: 4px; }
.sci-cat-manage-row { border: 1px solid rgba(255,255,255,0.06); }
.sci-cat-manage-top { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: rgba(255,255,255,0.02); gap: 12px; }
.sci-champs-panel { border-top: 1px solid rgba(255,255,255,0.05); padding: 12px 16px; background: rgba(0,0,0,0.2); display: flex; flex-direction: column; gap: 8px; }
.sci-champ-row { display: flex; align-items: center; gap: 10px; }
.sci-champ-nom { font-family: 'Cinzel', serif; font-size: 0.68rem; color: rgba(255,255,255,0.75); flex: 1; }
.sci-champ-type { font-size: 0.72rem; color: rgba(255,255,255,0.3); font-style: italic; }

/* ── Modale ────────────────────────────────────────────────────── */
.sci-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 300; display: flex; align-items: center; justify-content: center; padding: 24px; }
.sci-modal { background: #0e1117; border: 1px solid rgba(255,255,255,0.1); padding: 28px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
.sci-modal-title { font-family: 'Cinzel', serif; font-size: 0.9rem; letter-spacing: 0.06em; color: #fff; margin: 0; }
.sci-modal-actions { display: flex; gap: 10px; padding-top: 8px; }

.sci-form-group { display: flex; flex-direction: column; gap: 6px; }
.sci-form-row { display: flex; gap: 12px; flex-wrap: wrap; }
.sci-form-row .sci-form-group { flex: 1; min-width: 120px; }
.sci-label { font-family: 'Cinzel', serif; font-size: 0.58rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.4); }
.sci-req { color: #8b1a1a; }
.sci-input { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 8px 12px; font-family: 'Crimson Text', Georgia, serif; font-size: 0.95rem; width: 100%; box-sizing: border-box; }
.sci-input:focus { outline: none; border-color: rgba(139,26,26,0.5); }
.sci-textarea { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 8px 12px; font-family: 'Crimson Text', Georgia, serif; font-size: 0.95rem; width: 100%; resize: vertical; box-sizing: border-box; }
.sci-textarea:focus { outline: none; border-color: rgba(139,26,26,0.5); }
.sci-select { background: #0e1117; border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 8px 12px; font-family: 'Crimson Text', Georgia, serif; font-size: 0.95rem; width: 100%; cursor: pointer; }
.sci-select:focus { outline: none; }
.sci-check { display: flex; align-items: center; gap: 8px; font-family: 'Cinzel', serif; font-size: 0.62rem; letter-spacing: 0.06em; color: rgba(255,255,255,0.6); cursor: pointer; }
.sci-check input { accent-color: #8b1a1a; cursor: pointer; }
.sci-perms-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.sci-err { color: #c02020; font-size: 0.85rem; font-style: italic; }

/* ── Transitions ───────────────────────────────────────────────── */
.sci-modal-enter-active, .sci-modal-leave-active { transition: opacity 0.2s; }
.sci-modal-enter-from, .sci-modal-leave-to { opacity: 0; }
</style>

<template>
  <div class="page">
    <AppNavbar />

    <div class="page-inner">

      <!-- En-tête -->
      <div class="page-header">
        <div>
          <p class="page-label">Ordre Démoniaque</p>
          <h1 class="page-title">Rapports</h1>
        </div>
        <button class="btn-new" @click="ouvrirCreation">
          {{ showForm && !editRapport ? 'Annuler' : 'Nouveau rapport' }}
        </button>
      </div>

      <div class="page-divider"></div>

      <!-- Formulaire création / édition -->
      <div v-if="showForm" class="form-card">
        <div class="form-header">
          <h2 class="form-title">{{ editRapport ? 'Modifier le rapport' : 'Nouveau rapport' }}</h2>
          <button class="form-close" @click="fermerForm">✕</button>
        </div>

        <div class="form-row">
          <div class="field">
            <label class="field-label">Type</label>
            <select v-model="form.type" class="field-input">
              <option value="mission">Mission</option>
              <option value="journalier">Journalier</option>
              <option value="sphere">Sphère</option>
            </select>
          </div>
          <div class="field field--grow">
            <label class="field-label">Titre</label>
            <input v-model="form.titre" class="field-input" type="text" placeholder="Intitulé du rapport" />
          </div>
        </div>

        <!-- Éditeur de blocs -->
        <div class="blocks-editor">
          <div
            v-for="(bloc, i) in form.blocs"
            :key="bloc._id"
            class="bloc"
          >
            <div class="bloc-controls">
              <button class="bloc-ctrl" @click="monterBloc(i)" :disabled="i === 0" title="Monter">↑</button>
              <button class="bloc-ctrl" @click="descendreBloc(i)" :disabled="i === form.blocs.length - 1" title="Descendre">↓</button>
              <button class="bloc-ctrl bloc-ctrl--del" @click="supprimerBloc(i)" title="Supprimer">×</button>
            </div>

            <!-- Bloc section -->
            <div v-if="bloc.type === 'section'" class="bloc-inner">
              <span class="bloc-badge">Section</span>
              <input v-model="bloc.titre" class="field-input bloc-section-titre" type="text" placeholder="Titre de section" />
              <textarea v-model="bloc.contenu" class="field-input field-textarea" placeholder="Contenu de la section..."></textarea>
              <div class="album-editor">
                <div v-for="(img, j) in (bloc.images || [])" :key="j" class="album-editor-item">
                  <div class="album-editor-thumb">
                    <img :src="`${mediaBase}${img.url}`" alt="" />
                    <button class="album-thumb-del" @click="bloc.images.splice(j, 1)">×</button>
                  </div>
                  <input v-model="img.legende" class="field-input album-img-legende" type="text" placeholder="Légende..." />
                </div>
                <label class="album-editor-add">
                  <input type="file" accept="image/*" multiple class="upload-input" @change="e => handleSectionUpload(e, bloc)" />
                  <span>+</span>
                </label>
              </div>
            </div>

            <!-- Bloc texte -->
            <div v-else-if="bloc.type === 'texte'" class="bloc-inner">
              <span class="bloc-badge">Texte</span>
              <textarea v-model="bloc.contenu" class="field-input field-textarea" placeholder="Texte libre..."></textarea>
            </div>

            <!-- Bloc image -->
            <div v-else-if="bloc.type === 'image'" class="bloc-inner">
              <span class="bloc-badge">Image</span>
              <div
                class="drop-zone"
                :class="{ 'drop-zone--over': bloc._dragOver, 'drop-zone--filled': bloc.url }"
                @dragover.prevent="bloc._dragOver = true"
                @dragleave="bloc._dragOver = false"
                @drop.prevent="e => handleDrop(e, bloc)"
                @paste.prevent="e => handlePaste(e, bloc)"
                tabindex="0"
              >
                <img v-if="bloc.url" :src="`${mediaBase}${bloc.url}`" alt="" class="drop-zone-img" />
                <div v-else class="drop-zone-hint">
                  <span>Glisser une image ici</span>
                  <span class="drop-zone-or">ou</span>
                  <label class="upload-label">
                    <input type="file" accept="image/*" class="upload-input" @change="e => handleUpload(e, bloc)" />
                    Choisir un fichier
                  </label>
                  <span class="drop-zone-or">ou coller (Ctrl+V)</span>
                </div>
                <div v-if="bloc.url" class="drop-zone-overlay">
                  <label class="upload-label">
                    <input type="file" accept="image/*" class="upload-input" @change="e => handleUpload(e, bloc)" />
                    Changer
                  </label>
                </div>
              </div>
              <input v-model="bloc.legende" class="field-input" type="text" placeholder="Légende (optionnel)" />
            </div>

            <!-- Bloc album -->
            <div v-else-if="bloc.type === 'album'" class="bloc-inner">
              <span class="bloc-badge">Album</span>
              <input v-model="bloc.titre" class="field-input" type="text" placeholder="Titre de l'album (optionnel)" />
              <div class="album-editor">
                <div v-for="(img, j) in bloc.images" :key="j" class="album-editor-item">
                  <div class="album-editor-thumb">
                    <img :src="`${mediaBase}${img.url}`" alt="" />
                    <button class="album-thumb-del" @click="bloc.images.splice(j, 1)">×</button>
                  </div>
                  <input v-model="img.legende" class="field-input album-img-legende" type="text" placeholder="Légende..." />
                </div>
                <label class="album-editor-add">
                  <input type="file" accept="image/*" multiple class="upload-input" @change="e => handleAlbumUpload(e, bloc)" />
                  <span>+</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Boutons ajout de blocs -->
        <div class="add-blocs">
          <button class="add-bloc-btn" @click="ajouterBloc('section')">+ Section</button>
          <button class="add-bloc-btn" @click="ajouterBloc('texte')">+ Texte</button>
          <button class="add-bloc-btn" @click="ajouterBloc('image')">+ Image</button>
          <button class="add-bloc-btn" @click="ajouterBloc('album')">+ Album</button>
          <button class="add-bloc-btn add-bloc-btn--preview" @click="showPreview = !showPreview">
            {{ showPreview ? 'Masquer' : 'Prévisualiser' }}
          </button>
        </div>

        <!-- Prévisualisation -->
        <div v-if="showPreview" class="preview-panel">
          <div class="preview-header">
            <span class="preview-label">Aperçu</span>
          </div>
          <div class="preview-body">
            <h1 class="preview-titre">{{ form.titre || 'Sans titre' }}</h1>
            <div class="preview-divider"></div>
            <BlocRenderer v-if="form.blocs.length" :blocs="previewBlocs" />
            <p v-else class="preview-empty">Aucun bloc.</p>
          </div>
        </div>

        <p v-if="formError" class="error-msg">{{ formError }}</p>

        <div class="form-actions">
          <button class="btn-submit" @click="doSubmit(false)" :disabled="formLoading">
            {{ formLoading ? '...' : editRapport ? 'Enregistrer' : 'Soumettre' }}
          </button>
          <button class="btn-brouillon" @click="doSubmit(true)" :disabled="formLoading">
            {{ formLoading ? '...' : 'Brouillon' }}
          </button>
        </div>
      </div>

      <!-- Filtres -->
      <div class="filters">
        <button
          v-for="f in filterOptions"
          :key="f.value"
          class="filter-btn"
          :class="{ 'filter-btn--active': activeFilter === f.value }"
          @click="activeFilter = f.value"
        >{{ f.label }}</button>
      </div>

      <!-- Liste -->
      <div v-if="loading" class="state-msg">Chargement...</div>
      <div v-else-if="error" class="state-msg state-msg--error">{{ error }}</div>
      <div v-else-if="filteredRapports.length === 0" class="state-msg">Aucun rapport.</div>

      <div v-else class="rapport-list">
        <div
          v-for="r in filteredRapports"
          :key="r.id"
          class="rapport-item"
          @click="selected = selected?.id === r.id ? null : r"
        >
          <div class="rapport-top">
            <div class="rapport-meta">
              <span class="rapport-type" :class="`rapport-type--${r.type}`">{{ typeLabel(r.type) }}</span>
              <RouterLink :to="`/rapports/${r.token}`" class="rapport-titre" @click.stop>{{ r.titre }}</RouterLink>
            </div>
            <div class="rapport-right">
              <span v-if="r.brouillon" class="rapport-statut rapport-statut--brouillon">Brouillon</span>
              <span v-else class="rapport-statut" :class="`rapport-statut--${r.statut}`">{{ statutLabel(r.statut) }}</span>
              <span class="rapport-date">{{ formatDate(r.created_at) }}</span>
            </div>
          </div>
          <p class="rapport-auteur">Par {{ r.auteur_nom }}</p>

          <!-- Détail dépliable -->
          <div v-if="selected?.id === r.id" class="rapport-detail">
            <div class="rapport-sep"></div>
            <BlocRenderer :blocs="parseBlocs(r.contenu)" />

            <div class="rapport-actions">
              <template v-if="currentUser?.role === 'admin' && !r.brouillon">
                <button v-if="r.statut !== 'valide'" class="action-btn action-btn--valid" @click.stop="changeStatut(r, 'valide')">Valider</button>
                <button v-if="r.statut !== 'refuse'" class="action-btn action-btn--refuse" @click.stop="changeStatut(r, 'refuse')">Refuser</button>
              </template>
              <button
                v-if="currentUser?.id === r.auteur_id"
                class="action-btn action-btn--edit"
                @click.stop="ouvrirEdition(r)"
              >Modifier</button>
              <button
                v-if="currentUser?.id === r.auteur_id && r.brouillon"
                class="action-btn action-btn--publish"
                @click.stop="publierRapport(r)"
              >Publier</button>
              <button class="action-btn action-btn--delete" @click.stop="supprimerRapport(r)">Supprimer</button>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import AppNavbar from './AppNavbar.vue'
import BlocRenderer from './BlocRenderer.vue'
import { currentUser } from '../auth.js'
import { getRapports, createRapport, updateRapport, updateStatutRapport, deleteRapport, uploadImage } from '../api.js'
import { MEDIA_BASE } from '../config.js'
const mediaBase = MEDIA_BASE

const rapports = ref([])
const loading = ref(true)
const error = ref('')
const selected = ref(null)

const showForm = ref(false)
const formLoading = ref(false)
const formError = ref('')
const form = ref({ type: 'mission', titre: '', blocs: [] })
const editRapport = ref(null)
const showPreview = ref(false)

const previewBlocs = computed(() =>
  form.value.blocs.map(bloc => {
    if (bloc.type === 'album') return { type: 'album', titre: bloc.titre, images: bloc.images || [] }
    if (bloc.type === 'section') return { type: 'section', titre: bloc.titre, contenu: bloc.contenu, images: bloc.images || [] }
    return { type: bloc.type, titre: bloc.titre, contenu: bloc.contenu, url: bloc.url, legende: bloc.legende }
  })
)

const activeFilter = ref('tous')
const filterOptions = [
  { value: 'tous',       label: 'Tous' },
  { value: 'mission',    label: 'Mission' },
  { value: 'journalier', label: 'Journalier' },
  { value: 'sphere',     label: 'Sphère' },
]

const filteredRapports = computed(() => {
  if (activeFilter.value === 'tous') return rapports.value
  return rapports.value.filter(r => r.type === activeFilter.value)
})

async function load() {
  try {
    rapports.value = await getRapports()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(load)

let _bid = 0
function ajouterBloc(type) {
  const base = { _id: ++_bid, type, titre: '', contenu: '', url: '', legende: '' }
  if (type === 'album' || type === 'section') base.images = []
  form.value.blocs.push(base)
}

function ouvrirCreation() {
  if (showForm.value && !editRapport.value) { fermerForm(); return }
  fermerForm()
  showForm.value = true
}

function ouvrirEdition(rapport) {
  fermerForm()
  form.value.type = rapport.type
  form.value.titre = rapport.titre
  form.value.blocs = parseBlocs(rapport.contenu).map(b => {
    const bloc = { ...b, _id: ++_bid }
    if (b.type === 'album' || b.type === 'section') bloc.images = (b.images || []).map(img => ({ ...img }))
    return bloc
  })
  editRapport.value = rapport
  showForm.value = true
  selected.value = null
}

function fermerForm() {
  showForm.value = false
  editRapport.value = null
  showPreview.value = false
  form.value = { type: 'mission', titre: '', blocs: [] }
  formError.value = ''
}

function supprimerBloc(i) {
  form.value.blocs.splice(i, 1)
}

function monterBloc(i) {
  if (i === 0) return
  const b = form.value.blocs
  ;[b[i - 1], b[i]] = [b[i], b[i - 1]]
}

function descendreBloc(i) {
  const b = form.value.blocs
  if (i === b.length - 1) return
  ;[b[i], b[i + 1]] = [b[i + 1], b[i]]
}

async function uploadBloc(file, bloc) {
  if (!file || !file.type.startsWith('image/')) return
  try {
    bloc.url = await uploadImage(file)
  } catch (err) {
    alert(err.message)
  }
}

async function handleUpload(e, bloc) {
  await uploadBloc(e.target.files[0], bloc)
}

async function handleDrop(e, bloc) {
  bloc._dragOver = false
  const file = e.dataTransfer.files[0]
  await uploadBloc(file, bloc)
}

async function handlePaste(e, bloc) {
  const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'))
  if (!item) return
  await uploadBloc(item.getAsFile(), bloc)
}

async function handleSectionUpload(e, bloc) {
  if (!bloc.images) bloc.images = []
  const files = [...e.target.files]
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    try {
      const url = await uploadImage(file)
      bloc.images.push({ url, legende: '' })
    } catch (err) {
      alert(err.message)
    }
  }
}

async function handleAlbumUpload(e, bloc) {
  const files = [...e.target.files]
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    try {
      const url = await uploadImage(file)
      bloc.images.push({ url, legende: '' })
    } catch (err) {
      alert(err.message)
    }
  }
}

async function doSubmit(asBrouillon) {
  if (!form.value.titre) { formError.value = 'Ajoutez un titre.'; return }
  formLoading.value = true
  formError.value = ''
  try {
    const contenu = JSON.stringify(form.value.blocs.map(bloc => {
      if (bloc.type === 'album') return { type: 'album', titre: bloc.titre, images: (bloc.images || []).map(({ url, legende }) => ({ url, legende })) }
      if (bloc.type === 'section') return { type: 'section', titre: bloc.titre, contenu: bloc.contenu, images: (bloc.images || []).map(({ url, legende }) => ({ url, legende })) }
      return { type: bloc.type, titre: bloc.titre, contenu: bloc.contenu, url: bloc.url, legende: bloc.legende }
    }))
    if (editRapport.value) {
      const updated = await updateRapport(editRapport.value.token, {
        type: form.value.type,
        titre: form.value.titre,
        contenu,
        brouillon: asBrouillon,
      })
      const idx = rapports.value.findIndex(r => r.id === updated.id)
      if (idx !== -1) rapports.value[idx] = updated
    } else {
      const r = await createRapport(form.value.type, form.value.titre, contenu, asBrouillon)
      rapports.value.unshift(r)
    }
    fermerForm()
  } catch (e) {
    formError.value = e.message
  } finally {
    formLoading.value = false
  }
}

async function publierRapport(rapport) {
  try {
    const updated = await updateRapport(rapport.token, { brouillon: false })
    const idx = rapports.value.findIndex(r => r.id === rapport.id)
    if (idx !== -1) rapports.value[idx] = updated
  } catch (e) {
    alert(e.message)
  }
}

async function changeStatut(rapport, statut) {
  try {
    await updateStatutRapport(rapport.token, statut)
    rapport.statut = statut
  } catch (e) {
    alert(e.message)
  }
}

async function supprimerRapport(rapport) {
  try {
    await deleteRapport(rapport.token)
    rapports.value = rapports.value.filter(r => r.id !== rapport.id)
    selected.value = null
  } catch (e) {
    alert(e.message)
  }
}

function parseBlocs(contenu) {
  try {
    const parsed = JSON.parse(contenu)
    if (Array.isArray(parsed)) return parsed
  } catch {}
  return [{ type: 'texte', contenu }]
}

function typeLabel(type) {
  return { mission: 'Mission', journalier: 'Journalier', sphere: 'Sphère' }[type] ?? type
}

function statutLabel(s) {
  return { en_attente: 'En attente', valide: 'Validé', refuse: 'Refusé' }[s] ?? s
}

function formatDate(dt) {
  return new Date(dt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #090909;
}

.page-inner {
  max-width: 860px;
  margin: 0 auto;
  padding: 3.5rem 2rem 6rem;
}

/* ── En-tête ──────────────────────────────── */
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 1.8rem;
  gap: 1rem;
}

.page-label {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.35em;
  color: #8b1a1a;
  text-transform: uppercase;
  margin-bottom: 0.4rem;
}

.page-title {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.06em;
  margin: 0;
}

.btn-new {
  background: rgba(139,26,26,0.12);
  border: 1px solid rgba(139,26,26,0.3);
  color: #8b1a1a;
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 0.55rem 1.1rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  white-space: nowrap;
}

.btn-new:hover {
  background: rgba(139,26,26,0.2);
  border-color: rgba(139,26,26,0.5);
  color: #c02020;
}

.page-divider {
  height: 1px;
  background: rgba(255,255,255,0.07);
  margin-bottom: 2rem;
}

/* ── Formulaire ───────────────────────────── */
.form-card {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.07);
  padding: 1.8rem 2rem;
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.form-title {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.2em;
  color: rgba(255,255,255,0.3);
  text-transform: uppercase;
  margin: 0;
}

.form-close {
  background: none;
  border: none;
  color: rgba(255,255,255,0.25);
  font-size: 1rem;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  transition: color 0.15s;
}
.form-close:hover { color: #fff; }

.form-actions {
  display: flex;
  gap: 0.6rem;
  align-items: center;
}

.form-row {
  display: flex;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field--grow { flex: 1; }

.field-label {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  color: rgba(255,255,255,0.3);
  text-transform: uppercase;
}

.field-input {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  color: #fff;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  padding: 0.55rem 0.8rem;
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
  box-sizing: border-box;
}

.field-input:focus { border-color: rgba(139,26,26,0.5); }
.field-input option { background: #141416; }

.field-textarea {
  resize: vertical;
  min-height: 110px;
  line-height: 1.6;
}

/* ── Blocs éditeur ────────────────────────── */
.blocks-editor {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.bloc {
  border: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.02);
  display: flex;
  gap: 0.8rem;
  padding: 1rem;
}

.bloc-controls {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex-shrink: 0;
}

.bloc-ctrl {
  background: none;
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.3);
  font-size: 0.75rem;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.12s, border-color 0.12s;
  padding: 0;
}

.bloc-ctrl:hover:not(:disabled) { color: #fff; border-color: rgba(255,255,255,0.2); }
.bloc-ctrl:disabled { opacity: 0.2; cursor: default; }
.bloc-ctrl--del:hover:not(:disabled) { color: #8b1a1a; border-color: rgba(139,26,26,0.4); }

.bloc-inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 0;
}

.bloc-badge {
  font-family: 'Cinzel', serif;
  font-size: 0.52rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.2);
}

.bloc-section-titre {
  font-family: 'Cinzel', serif !important;
  font-size: 0.85rem !important;
}

/* ── Drop zone ────────────────────────────── */
.drop-zone {
  position: relative;
  border: 1px dashed rgba(255,255,255,0.12);
  min-height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, background 0.15s;
  outline: none;
  cursor: default;
}

.drop-zone--over {
  border-color: rgba(139,26,26,0.6);
  background: rgba(139,26,26,0.05);
}

.drop-zone--filled {
  border-style: solid;
  border-color: rgba(255,255,255,0.06);
  min-height: unset;
}

.drop-zone-img {
  width: 100%;
  max-height: 240px;
  object-fit: cover;
  display: block;
}

.drop-zone-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem;
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.9rem;
  color: rgba(255,255,255,0.2);
  text-align: center;
}

.drop-zone-or {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.12);
}

.drop-zone-overlay {
  position: absolute;
  bottom: 0.5rem;
  right: 0.5rem;
}

.upload-label {
  display: inline-block;
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  border: 1px solid rgba(255,255,255,0.1);
  padding: 0.4rem 0.8rem;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  background: rgba(0,0,0,0.4);
}

.upload-label:hover { color: #fff; border-color: rgba(255,255,255,0.25); }

.upload-input { display: none; }

/* ── Album éditeur ────────────────────────── */
.album-editor {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-start;
}

.album-editor-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100px;
  flex-shrink: 0;
}

.album-editor-thumb {
  position: relative;
  width: 100px;
  height: 80px;
}

.album-editor-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border: 1px solid rgba(255,255,255,0.08);
}

.album-thumb-del {
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(0,0,0,0.7);
  border: none;
  color: rgba(255,255,255,0.7);
  font-size: 0.75rem;
  width: 18px;
  height: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
}
.album-thumb-del:hover { color: #fff; background: rgba(139,26,26,0.8); }

.album-img-legende {
  font-size: 0.78rem !important;
  padding: 0.3rem 0.5rem !important;
}

.album-editor-add {
  width: 100px;
  height: 80px;
  border: 1px dashed rgba(255,255,255,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgba(255,255,255,0.3);
  font-size: 1.4rem;
  transition: border-color 0.15s, color 0.15s;
  flex-shrink: 0;
  align-self: flex-start;
}
.album-editor-add:hover { border-color: rgba(255,255,255,0.3); color: #fff; }

/* ── Ajout de blocs ───────────────────────── */
.add-blocs {
  display: flex;
  gap: 0.5rem;
}

.add-bloc-btn {
  background: none;
  border: 1px solid rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.3);
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.45rem 0.9rem;
  cursor: pointer;
  transition: all 0.15s;
}

.add-bloc-btn:hover { color: #fff; border-color: rgba(255,255,255,0.2); }

/* ── Prévisualisation ─────────────────────── */
.add-bloc-btn--preview {
  margin-left: auto;
  color: rgba(139,26,26,0.7);
  border-color: rgba(139,26,26,0.2);
}
.add-bloc-btn--preview:hover { color: #8b1a1a; border-color: rgba(139,26,26,0.4); }

.preview-panel {
  border: 1px solid rgba(255,255,255,0.06);
  background: #0d0d0e;
}

.preview-header {
  padding: 0.6rem 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.preview-label {
  font-family: 'Cinzel', serif;
  font-size: 0.52rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.15);
}

.preview-body {
  padding: 2rem 1.5rem;
}

.preview-titre {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.05em;
  margin: 0 0 1.2rem;
}

.preview-divider {
  height: 1px;
  background: rgba(255,255,255,0.07);
  margin-bottom: 1.8rem;
}

.preview-empty {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  color: rgba(255,255,255,0.15);
  font-size: 0.95rem;
  margin: 0;
}

.error-msg {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.9rem;
  color: #8b1a1a;
}

.btn-submit {
  align-self: flex-start;
  background: #8b1a1a;
  border: none;
  color: #fff;
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  padding: 0.7rem 1.4rem;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-submit:hover:not(:disabled) { background: #a82020; }
.btn-submit:disabled { opacity: 0.5; cursor: default; }

.btn-brouillon {
  background: none;
  border: 1px solid rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.4);
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  padding: 0.7rem 1.2rem;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-brouillon:hover:not(:disabled) { color: #fff; border-color: rgba(255,255,255,0.25); }
.btn-brouillon:disabled { opacity: 0.5; cursor: default; }

/* ── Filtres ──────────────────────────────── */
.filters {
  display: flex;
  gap: 0.3rem;
  margin-bottom: 1.2rem;
}

.filter-btn {
  background: none;
  border: 1px solid rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.3);
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.4rem 0.85rem;
  cursor: pointer;
  transition: all 0.15s;
}

.filter-btn:hover { color: rgba(255,255,255,0.6); border-color: rgba(255,255,255,0.14); }
.filter-btn--active { color: #fff; border-color: rgba(255,255,255,0.25); background: rgba(255,255,255,0.04); }

/* ── Liste ────────────────────────────────── */
.state-msg {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  color: rgba(255,255,255,0.2);
  font-size: 0.98rem;
  padding: 2rem 0;
}

.state-msg--error { color: #8b1a1a; }

.rapport-list {
  border: 1px solid rgba(255,255,255,0.06);
}

.rapport-item {
  padding: 1.2rem 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  cursor: pointer;
  transition: background 0.12s;
}

.rapport-item:last-child { border-bottom: none; }
.rapport-item:hover { background: rgba(255,255,255,0.02); }

.rapport-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.3rem;
}

.rapport-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.rapport-type {
  font-family: 'Cinzel', serif;
  font-size: 0.52rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.2rem 0.5rem;
  border: 1px solid;
  white-space: nowrap;
}

.rapport-type--mission    { color: #8b1a1a; border-color: rgba(139,26,26,0.3); }
.rapport-type--journalier { color: rgba(255,255,255,0.4); border-color: rgba(255,255,255,0.12); }
.rapport-type--sphere     { color: #6a7fa0; border-color: rgba(106,127,160,0.3); }

.rapport-titre {
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  color: #fff;
  letter-spacing: 0.04em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-decoration: none;
  transition: color 0.15s;
}
.rapport-titre:hover { color: rgba(255,255,255,0.6); }

.rapport-right {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
}

.rapport-statut {
  font-family: 'Cinzel', serif;
  font-size: 0.5rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.rapport-statut--en_attente { color: rgba(255,255,255,0.25); }
.rapport-statut--valide     { color: #3a7a3a; }
.rapport-statut--refuse     { color: #8b1a1a; }
.rapport-statut--brouillon  { color: #6a5a20; }

.rapport-date {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.82rem;
  color: rgba(255,255,255,0.2);
  white-space: nowrap;
}

.rapport-auteur {
  font-family: 'Crimson Text', Georgia, serif;
  font-style: italic;
  font-size: 0.85rem;
  color: rgba(255,255,255,0.2);
}

/* ── Détail dépliable ─────────────────────── */
.rapport-sep {
  height: 1px;
  background: rgba(255,255,255,0.06);
  margin: 1rem 0;
}

.rapport-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
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
.action-btn--edit { color: rgba(255,255,255,0.35); border-color: rgba(255,255,255,0.1); }
.action-btn--edit:hover { color: #fff; border-color: rgba(255,255,255,0.3); }
.action-btn--publish { color: #6a9a3a; border-color: rgba(106,154,58,0.3); }
.action-btn--publish:hover { background: rgba(106,154,58,0.1); }
.action-btn--delete { color: rgba(255,255,255,0.25); border-color: rgba(255,255,255,0.1); margin-left: auto; }
.action-btn--delete:hover { color: #8b1a1a; border-color: rgba(139,26,26,0.3); }

@media (max-width: 600px) {
  .page-inner { padding: 2rem 1.2rem 4rem; }
  .form-row { flex-direction: column; }
  .rapport-top { flex-direction: column; align-items: flex-start; gap: 0.4rem; }
  .rapport-right { gap: 0.6rem; }
  .add-blocs { flex-wrap: wrap; }
}
</style>

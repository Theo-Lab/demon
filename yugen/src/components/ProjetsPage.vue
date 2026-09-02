<template>
  <div class="page">
    <AppNavbar />

    <div class="page-inner">

      <div class="page-header">
        <div>
          <p class="page-label">Ordre Démoniaque</p>
          <h1 class="page-title">Mes Projets</h1>
        </div>
        <button class="btn-new" @click="showForm = !showForm">
          {{ showForm ? 'Annuler' : 'Nouveau projet' }}
        </button>
      </div>

      <div class="page-divider"></div>

      <!-- Formulaire création -->
      <div v-if="showForm" class="form-card">
        <h2 class="form-title">Nouveau projet</h2>

        <div class="field">
          <label class="field-label">Titre du projet</label>
          <input v-model="form.titre" class="field-input" type="text" placeholder="Nom du projet" />
        </div>

        <div class="field">
          <label class="field-label">Titre du document <span class="field-hint">(affiché dans l'onglet du navigateur)</span></label>
          <input v-model="form.doc_titre" class="field-input" type="text" placeholder="Ex: Ordre Démoniaque — Projet Obscur" />
        </div>

        <!-- Éditeur de blocs -->
        <div class="blocks-editor">
          <div v-for="(bloc, i) in form.blocs" :key="bloc._id" class="bloc">
            <div class="bloc-controls">
              <button class="bloc-ctrl" @click="monterBloc(i)" :disabled="i === 0">↑</button>
              <button class="bloc-ctrl" @click="descendreBloc(i)" :disabled="i === form.blocs.length - 1">↓</button>
              <button class="bloc-ctrl bloc-ctrl--del" @click="supprimerBloc(i)">×</button>
            </div>

            <div v-if="bloc.type === 'section'" class="bloc-inner">
              <span class="bloc-badge">Section</span>
              <input v-model="bloc.titre" class="field-input bloc-section-titre" type="text" placeholder="Titre de section" />
              <textarea v-model="bloc.contenu" class="field-input field-textarea" placeholder="Contenu..."></textarea>
            </div>

            <div v-else-if="bloc.type === 'texte'" class="bloc-inner">
              <span class="bloc-badge">Texte</span>
              <textarea v-model="bloc.contenu" class="field-input field-textarea" placeholder="Texte libre..."></textarea>
            </div>

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

        <div class="add-blocs">
          <button class="add-bloc-btn" @click="ajouterBloc('section')">+ Section</button>
          <button class="add-bloc-btn" @click="ajouterBloc('texte')">+ Texte</button>
          <button class="add-bloc-btn" @click="ajouterBloc('image')">+ Image</button>
          <button class="add-bloc-btn" @click="ajouterBloc('album')">+ Album</button>
        </div>

        <p v-if="formError" class="error-msg">{{ formError }}</p>

        <button class="btn-submit" @click="submitProjet" :disabled="formLoading">
          {{ formLoading ? '...' : 'Créer le projet' }}
        </button>
      </div>

      <!-- Liste -->
      <div v-if="loading" class="state-msg">Chargement...</div>
      <div v-else-if="projets.length === 0 && !showForm" class="state-msg">Aucun projet créé.</div>

      <div v-else-if="projets.length > 0" class="projets-list">
        <div v-for="p in projets" :key="p.id" class="projet-item">
          <div class="projet-info">
            <RouterLink :to="`/projets/${p.token}`" class="projet-titre">{{ p.titre }}</RouterLink>
            <span class="projet-date">{{ formatDate(p.created_at) }}</span>
          </div>
          <div class="projet-actions">
            <button class="action-btn action-btn--copy" @click="copierLien(p.token)">Copier le lien</button>
            <button class="action-btn action-btn--delete" @click="supprimerProjet(p)">Supprimer</button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppNavbar from './AppNavbar.vue'
import { getMesProjets, createProjet, deleteProjet, uploadImage } from '../api.js'

import { MEDIA_BASE } from '../config.js'

const mediaBase = MEDIA_BASE
const projets = ref([])
const loading = ref(true)

const showForm = ref(false)
const formLoading = ref(false)
const formError = ref('')
const form = ref({ titre: '', doc_titre: '', blocs: [] })

onMounted(async () => {
  try { projets.value = await getMesProjets() } catch {}
  loading.value = false
})

let _bid = 0
function ajouterBloc(type) {
  const base = { _id: ++_bid, type, titre: '', contenu: '', url: '', legende: '' }
  if (type === 'album') base.images = []
  form.value.blocs.push(base)
}
function supprimerBloc(i) { form.value.blocs.splice(i, 1) }
function monterBloc(i) {
  if (i === 0) return
  const b = form.value.blocs;[b[i-1], b[i]] = [b[i], b[i-1]]
}
function descendreBloc(i) {
  const b = form.value.blocs
  if (i === b.length - 1) return;[b[i], b[i+1]] = [b[i+1], b[i]]
}

async function uploadBloc(file, bloc) {
  if (!file || !file.type.startsWith('image/')) return
  try { bloc.url = await uploadImage(file) } catch (e) { alert(e.message) }
}
async function handleUpload(e, bloc) { await uploadBloc(e.target.files[0], bloc) }
async function handleDrop(e, bloc) { bloc._dragOver = false; await uploadBloc(e.dataTransfer.files[0], bloc) }
async function handlePaste(e, bloc) {
  const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'))
  if (item) await uploadBloc(item.getAsFile(), bloc)
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

async function submitProjet() {
  if (!form.value.titre || !form.value.doc_titre) {
    formError.value = 'Titre et titre du document requis.'
    return
  }
  formLoading.value = true
  formError.value = ''
  try {
    const contenu = JSON.stringify(form.value.blocs.map(bloc => {
      if (bloc.type === 'album') return { type: 'album', images: bloc.images.map(({ url, legende }) => ({ url, legende })) }
      return { type: bloc.type, titre: bloc.titre, contenu: bloc.contenu, url: bloc.url, legende: bloc.legende }
    }))
    const p = await createProjet(form.value.titre, form.value.doc_titre, contenu)
    projets.value.unshift(p)
    form.value = { titre: '', doc_titre: '', blocs: [] }
    showForm.value = false
  } catch (e) {
    formError.value = e.message
  } finally {
    formLoading.value = false
  }
}

async function supprimerProjet(p) {
  try {
    await deleteProjet(p.token)
    projets.value = projets.value.filter(x => x.id !== p.id)
  } catch (e) { alert(e.message) }
}

function copierLien(token) {
  navigator.clipboard.writeText(`${window.location.origin}/projets/${token}`)
}

function formatDate(dt) {
  return new Date(dt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.page { min-height: 100vh; background: #090909; }
.page-inner { max-width: 860px; margin: 0 auto; padding: 3.5rem 2rem 6rem; }

.page-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 1.8rem; gap: 1rem; }
.page-label { font-family: 'Cinzel', serif; font-size: 0.6rem; letter-spacing: 0.35em; color: #8b1a1a; text-transform: uppercase; margin-bottom: 0.4rem; }
.page-title { font-family: 'Cinzel Decorative', 'Cinzel', serif; font-size: 2rem; font-weight: 700; color: #fff; letter-spacing: 0.06em; margin: 0; }

.btn-new { background: rgba(139,26,26,0.12); border: 1px solid rgba(139,26,26,0.3); color: #8b1a1a; font-family: 'Cinzel', serif; font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase; padding: 0.55rem 1.1rem; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
.btn-new:hover { background: rgba(139,26,26,0.2); border-color: rgba(139,26,26,0.5); color: #c02020; }

.page-divider { height: 1px; background: rgba(255,255,255,0.07); margin-bottom: 2rem; }

.form-card { background: #141416; border: 1px solid rgba(255,255,255,0.07); padding: 1.8rem 2rem; margin-bottom: 2rem; display: flex; flex-direction: column; gap: 1.2rem; }
.form-title { font-family: 'Cinzel', serif; font-size: 0.65rem; letter-spacing: 0.2em; color: rgba(255,255,255,0.3); text-transform: uppercase; margin: 0; }

.field { display: flex; flex-direction: column; gap: 0.4rem; }
.field-label { font-family: 'Cinzel', serif; font-size: 0.58rem; letter-spacing: 0.12em; color: rgba(255,255,255,0.3); text-transform: uppercase; }
.field-hint { font-family: 'Crimson Text', serif; font-style: italic; font-size: 0.85rem; color: rgba(255,255,255,0.15); text-transform: none; letter-spacing: 0; }
.field-input { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: #fff; font-family: 'Crimson Text', Georgia, serif; font-size: 1rem; padding: 0.55rem 0.8rem; outline: none; transition: border-color 0.15s; width: 100%; box-sizing: border-box; }
.field-input:focus { border-color: rgba(139,26,26,0.5); }
.field-textarea { resize: vertical; min-height: 110px; line-height: 1.6; }

.blocks-editor { display: flex; flex-direction: column; gap: 0.8rem; }
.bloc { border: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.02); display: flex; gap: 0.8rem; padding: 1rem; }
.bloc-controls { display: flex; flex-direction: column; gap: 0.3rem; flex-shrink: 0; }
.bloc-ctrl { background: none; border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.3); font-size: 0.75rem; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.12s; padding: 0; }
.bloc-ctrl:hover:not(:disabled) { color: #fff; border-color: rgba(255,255,255,0.2); }
.bloc-ctrl:disabled { opacity: 0.2; cursor: default; }
.bloc-ctrl--del:hover:not(:disabled) { color: #8b1a1a; border-color: rgba(139,26,26,0.4); }
.bloc-inner { flex: 1; display: flex; flex-direction: column; gap: 0.6rem; min-width: 0; }
.bloc-badge { font-family: 'Cinzel', serif; font-size: 0.52rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.2); }
.bloc-section-titre { font-family: 'Cinzel', serif !important; font-size: 0.85rem !important; }

.drop-zone { position: relative; border: 1px dashed rgba(255,255,255,0.12); min-height: 140px; display: flex; align-items: center; justify-content: center; transition: border-color 0.15s, background 0.15s; outline: none; }
.drop-zone--over { border-color: rgba(139,26,26,0.6); background: rgba(139,26,26,0.05); }
.drop-zone--filled { border-style: solid; border-color: rgba(255,255,255,0.06); min-height: unset; }
.drop-zone-img { width: 100%; max-height: 240px; object-fit: cover; display: block; }
.drop-zone-hint { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 1.5rem; font-family: 'Crimson Text', serif; font-style: italic; font-size: 0.9rem; color: rgba(255,255,255,0.2); text-align: center; }
.drop-zone-or { font-size: 0.75rem; color: rgba(255,255,255,0.12); }
.drop-zone-overlay { position: absolute; bottom: 0.5rem; right: 0.5rem; }
.upload-label { display: inline-block; font-family: 'Cinzel', serif; font-size: 0.55rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.4); border: 1px solid rgba(255,255,255,0.1); padding: 0.4rem 0.8rem; cursor: pointer; transition: all 0.15s; background: rgba(0,0,0,0.4); }
.upload-label:hover { color: #fff; border-color: rgba(255,255,255,0.25); }
.upload-input { display: none; }

.album-editor { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-start; }
.album-editor-item { display: flex; flex-direction: column; gap: 4px; width: 100px; flex-shrink: 0; }
.album-editor-thumb { position: relative; width: 100px; height: 80px; }
.album-editor-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; border: 1px solid rgba(255,255,255,0.08); }
.album-thumb-del { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.7); border: none; color: rgba(255,255,255,0.7); font-size: 0.75rem; width: 18px; height: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1; }
.album-thumb-del:hover { color: #fff; background: rgba(139,26,26,0.8); }
.album-img-legende { font-size: 0.78rem !important; padding: 0.3rem 0.5rem !important; }
.album-editor-add { width: 100px; height: 80px; border: 1px dashed rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; cursor: pointer; color: rgba(255,255,255,0.3); font-size: 1.4rem; transition: border-color 0.15s, color 0.15s; flex-shrink: 0; align-self: flex-start; }
.album-editor-add:hover { border-color: rgba(255,255,255,0.3); color: #fff; }

.add-blocs { display: flex; gap: 0.5rem; }
.add-bloc-btn { background: none; border: 1px solid rgba(255,255,255,0.07); color: rgba(255,255,255,0.3); font-family: 'Cinzel', serif; font-size: 0.58rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.45rem 0.9rem; cursor: pointer; transition: all 0.15s; }
.add-bloc-btn:hover { color: #fff; border-color: rgba(255,255,255,0.2); }

.error-msg { font-family: 'Crimson Text', serif; font-style: italic; font-size: 0.9rem; color: #8b1a1a; }
.btn-submit { align-self: flex-start; background: #8b1a1a; border: none; color: #fff; font-family: 'Cinzel', serif; font-size: 0.6rem; letter-spacing: 0.15em; text-transform: uppercase; padding: 0.7rem 1.4rem; cursor: pointer; transition: background 0.15s; }
.btn-submit:hover:not(:disabled) { background: #a82020; }
.btn-submit:disabled { opacity: 0.5; cursor: default; }

.state-msg { font-family: 'Crimson Text', serif; font-style: italic; color: rgba(255,255,255,0.2); font-size: 0.98rem; padding: 2rem 0; }

.projets-list { border: 1px solid rgba(255,255,255,0.06); }
.projet-item { display: flex; align-items: center; justify-content: space-between; padding: 1.1rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.04); gap: 1rem; }
.projet-item:last-child { border-bottom: none; }
.projet-info { display: flex; flex-direction: column; gap: 0.2rem; }
.projet-titre { font-family: 'Cinzel', serif; font-size: 0.8rem; color: #fff; letter-spacing: 0.04em; text-decoration: none; transition: color 0.15s; }
.projet-titre:hover { color: rgba(255,255,255,0.6); }
.projet-date { font-family: 'Crimson Text', serif; font-style: italic; font-size: 0.82rem; color: rgba(255,255,255,0.2); }
.projet-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }
.action-btn { background: none; font-family: 'Cinzel', serif; font-size: 0.52rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.32rem 0.7rem; cursor: pointer; border: 1px solid; transition: all 0.12s; }
.action-btn--copy { color: rgba(255,255,255,0.3); border-color: rgba(255,255,255,0.1); }
.action-btn--copy:hover { color: #fff; border-color: rgba(255,255,255,0.25); }
.action-btn--delete { color: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.07); }
.action-btn--delete:hover { color: #8b1a1a; border-color: rgba(139,26,26,0.3); }
</style>

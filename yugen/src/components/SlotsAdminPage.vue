<template>
  <div class="page">
    <AppNavbar />

    <div class="page-inner">

      <div class="page-header">
        <div>
          <p class="page-label">Casino — Administration</p>
          <h1 class="page-title">Panel Admin</h1>
        </div>
        <RouterLink to="/casino/admin" class="back-link">← Tous les jeux</RouterLink>
      </div>

      <div class="page-divider"></div>

      <!-- Sélecteur de jeu -->
      <div class="jeux-tabs">
        <button :class="['jeu-tab', jeu === 'slots' ? 'jeu-tab--actif' : '']" @click="jeu = 'slots'">
          Machine à Sous
        </button>
        <!-- futurs jeux ici -->
      </div>

      <!-- ── Onglets du jeu sélectionné ── -->
      <div class="onglets">
        <button
          v-for="tab in ['symboles', 'config', 'joueurs', 'logs', 'stats']"
          :key="tab"
          :class="['onglet', onglet === tab ? 'onglet--actif' : '']"
          @click="onglet = tab; if(tab==='joueurs') chargerJoueurs(); if(tab==='logs') chargerLogs(); if(tab==='stats') chargerStats()"
        >{{ { symboles: 'Symboles', config: 'Configuration', joueurs: 'Joueurs', logs: 'Logs', stats: 'Statistiques' }[tab] }}</button>
      </div>

      <!-- ── Onglet Symboles ── -->
      <template v-if="onglet === 'symboles'">

        <!-- Formulaire création / édition -->
        <div class="form-card">
          <h2 class="form-title">{{ editId ? 'Modifier le symbole' : 'Nouveau symbole' }}</h2>

          <div class="form-grid">

            <div class="field">
              <label class="field-label">Nom</label>
              <input v-model="form.nom" class="field-input" type="text" placeholder="Ex : Masque démoniaque" />
            </div>

            <div class="field">
              <label class="field-label">Image</label>
              <label class="upload-zone" :class="{ 'upload-zone--has': previewUrl }">
                <img v-if="previewUrl" :src="previewUrl" class="upload-preview" alt="Aperçu" />
                <span v-else class="upload-placeholder">Choisir une image</span>
                <input type="file" accept="image/*" class="upload-input" @change="onImageChange" />
              </label>
              <p v-if="editId && !form.imageFile && symboleEnEdition?.image_url" class="upload-current">
                Image actuelle conservée
              </p>
            </div>

            <div class="field">
              <label class="field-label">Poids de tirage</label>
              <input v-model.number="form.poids" class="field-input" type="number" min="1" max="100" placeholder="10" />
              <p class="field-hint">Plus le poids est élevé, plus le symbole apparaît fréquemment.</p>
            </div>

            <div class="field">
              <label class="field-label">Multiplicateur ×2</label>
              <input v-model.number="form.mult_2" class="field-input" type="number" min="0" step="0.5" placeholder="2" />
              <p class="field-hint">Gain si 2 symboles identiques de gauche.</p>
            </div>

            <div class="field">
              <label class="field-label">Multiplicateur ×3</label>
              <input v-model.number="form.mult_3" class="field-input" type="number" min="0" step="1" placeholder="10" />
              <p class="field-hint">Gain si 3 symboles identiques sur la ligne.</p>
            </div>

            <div class="field field--actif">
              <label class="field-label">Actif</label>
              <label class="toggle">
                <input type="checkbox" v-model="form.actif" />
                <span class="toggle-track"></span>
              </label>
            </div>

          </div>

          <div v-if="erreurForm" class="form-erreur">{{ erreurForm }}</div>

          <div class="form-actions">
            <button v-if="editId" class="btn-secondary" @click="annulerEdit">Annuler</button>
            <button class="btn-submit" :disabled="loadingForm" @click="soumettre">
              {{ loadingForm ? '…' : editId ? 'Enregistrer' : 'Créer le symbole' }}
            </button>
          </div>
        </div>

        <!-- Liste des symboles -->
        <div v-if="loadingSymboles" class="loading">Chargement…</div>
        <div v-else-if="symboles.length === 0" class="vide">Aucun symbole configuré.</div>

        <div v-else class="symbols-list">
          <div v-for="s in symboles" :key="s.id" class="symbol-row">

            <div class="symbol-img-cell">
              <img v-if="s.image_url" :src="IMG_BASE + s.image_url" :alt="s.nom" class="symbol-img" />
              <div v-else class="symbol-img-empty">?</div>
            </div>

            <div class="symbol-info">
              <span class="symbol-nom">{{ s.nom }}</span>
              <span :class="['symbol-actif', s.actif ? 'actif--on' : 'actif--off']">
                {{ s.actif ? 'Actif' : 'Inactif' }}
              </span>
            </div>

            <div class="symbol-stats">
              <span class="stat-item">
                <span class="stat-k">Poids</span>
                <span class="stat-v">{{ s.poids }}</span>
              </span>
              <span class="stat-item">
                <span class="stat-k">×2</span>
                <span class="stat-v">{{ s.mult_2 }}</span>
              </span>
              <span class="stat-item">
                <span class="stat-k">×3</span>
                <span class="stat-v">{{ s.mult_3 }}</span>
              </span>
            </div>

            <div class="symbol-actions">
              <button class="btn-edit" @click="editer(s)">Modifier</button>
              <button class="btn-delete" @click="supprimer(s.id)">×</button>
            </div>

          </div>
        </div>

      </template>

      <!-- ── Onglet Config ── -->
      <template v-if="onglet === 'config'">

        <div class="form-card">
          <h2 class="form-title">Configuration de la machine</h2>

          <div class="form-grid">
            <div class="field">
              <label class="field-label">Nombre de colonnes (rouleaux)</label>
              <input v-model.number="configForm.nb_colonnes" class="field-input" type="number" min="3" max="7" step="1" />
              <p class="field-hint">3 à 7 colonnes. Plus de colonnes → plus difficile de gagner → augmentez les mises en conséquence.</p>
            </div>
            <div class="field"></div>
            <div class="field">
              <label class="field-label">Mise minimum (¥)</label>
              <input v-model.number="configForm.mise_min" class="field-input" type="number" min="1000" step="1000" />
            </div>
            <div class="field">
              <label class="field-label">Mise maximum (¥)</label>
              <input v-model.number="configForm.mise_max" class="field-input" type="number" min="1000" step="10000" />
            </div>
          </div>

          <div v-if="erreurConfig" class="form-erreur">{{ erreurConfig }}</div>

          <div class="form-actions">
            <button class="btn-submit" :disabled="loadingConfig" @click="sauvegarderConfig">
              {{ loadingConfig ? '…' : 'Enregistrer' }}
            </button>
          </div>
        </div>

        <div v-if="configOk" class="form-ok">Configuration enregistrée.</div>

      </template>

      <!-- ── Onglet Joueurs ── -->
      <template v-if="onglet === 'joueurs'">

        <div class="joueurs-search">
          <input
            v-model="recherche"
            class="field-input recherche-input"
            type="text"
            placeholder="Rechercher un joueur…"
            autocomplete="off"
          />
          <span v-if="recherche" class="recherche-count">{{ joueursFiltres.length }} résultat{{ joueursFiltres.length !== 1 ? 's' : '' }}</span>
        </div>

        <div v-if="loadingJoueurs" class="loading">Chargement…</div>
        <div v-else-if="joueursFiltres.length === 0" class="vide">{{ recherche ? 'Aucun joueur trouvé.' : 'Aucun joueur.' }}</div>

        <div v-else class="joueurs-list">
          <div v-for="j in joueursFiltres" :key="j.id" class="joueur-row">

            <div class="joueur-info">
              <span class="joueur-nom">{{ j.nom }}</span>
              <span class="joueur-id">{{ j.identifiant }}</span>
            </div>

            <div class="joueur-solde">
              <span class="solde-val">{{ (j.solde ?? 0).toLocaleString('fr-FR') }} ¥</span>
            </div>

            <div class="joueur-actions">
              <input
                v-model.number="montants[j.id]"
                class="field-input solde-input"
                type="number"
                min="0"
                step="10000"
                placeholder="Montant"
              />
              <button class="btn-op btn-add"    @click="opSolde(j, 'add')">+</button>
              <button class="btn-op btn-remove" @click="opSolde(j, 'remove')">−</button>
              <button class="btn-op btn-set"    @click="opSolde(j, 'set')">= Définir</button>
            </div>

            <div v-if="erreurs[j.id]" class="joueur-err">{{ erreurs[j.id] }}</div>

          </div>
        </div>

      </template>

      <!-- ── Onglet Stats ── -->
      <template v-if="onglet === 'stats'">
        <div v-if="loadingStats" class="loading">Chargement…</div>
        <template v-else-if="stats">

          <!-- KPIs globaux -->
          <div class="kpi-grid">
            <div class="kpi-card">
              <span class="kpi-label">Parties jouées</span>
              <span class="kpi-val">{{ stats.global.nb_parties.toLocaleString('fr-FR') }}</span>
              <span class="kpi-sub">{{ stats.global.nb_joueurs }} joueur{{ stats.global.nb_joueurs !== 1 ? 's' : '' }} actif{{ stats.global.nb_joueurs !== 1 ? 's' : '' }}</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Total misé</span>
              <span class="kpi-val">{{ fmtYen(stats.global.total_mise) }}</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Redistribué</span>
              <span class="kpi-val kpi-val--dim">{{ fmtYen(stats.global.total_redistribue) }}</span>
              <span class="kpi-sub">RTP {{ rtp }}%</span>
            </div>
            <div class="kpi-card kpi-card--accent">
              <span class="kpi-label">Bénéfice Casino</span>
              <span class="kpi-val" :class="stats.global.benefice_casino >= 0 ? 'kpi-val--pos' : 'kpi-val--neg'">
                {{ fmtYen(stats.global.benefice_casino) }}
              </span>
            </div>
          </div>

          <!-- Par jeu -->
          <div class="stats-section">
            <p class="stats-section-title">Par jeu</p>
            <table class="stats-table">
              <thead>
                <tr>
                  <th>Jeu</th>
                  <th>Parties</th>
                  <th>Total misé</th>
                  <th>Redistribué</th>
                  <th>RTP</th>
                  <th>Bénéfice</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="j in stats.parJeu" :key="j.jeu" class="stats-row">
                  <td class="stats-jeu">{{ j.jeu }}</td>
                  <td>{{ j.nb_parties.toLocaleString('fr-FR') }}</td>
                  <td>{{ fmtYen(j.total_mise) }}</td>
                  <td>{{ fmtYen(j.total_redistribue) }}</td>
                  <td class="stats-rtp">{{ rtpJeu(j) }}%</td>
                  <td :class="j.benefice_casino >= 0 ? 'gain--pos' : 'gain--neg'">
                    {{ fmtYen(j.benefice_casino) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Top joueurs -->
          <div class="stats-section">
            <p class="stats-section-title">Top joueurs</p>
            <table class="stats-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Joueur</th>
                  <th>Parties</th>
                  <th>Total misé</th>
                  <th>Pertes nettes</th>
                  <th>Solde actuel</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(j, i) in stats.topJoueurs" :key="j.identifiant" class="stats-row">
                  <td class="stats-rank">{{ i + 1 }}</td>
                  <td>
                    <span class="log-nom">{{ j.nom }}</span>
                    <span class="log-id">{{ j.identifiant }}</span>
                  </td>
                  <td>{{ j.nb_parties.toLocaleString('fr-FR') }}</td>
                  <td>{{ fmtYen(j.total_mise) }}</td>
                  <td :class="j.pertes_nettes > 0 ? 'gain--pos' : j.pertes_nettes < 0 ? 'gain--neg' : ''">
                    {{ fmtYen(j.pertes_nettes) }}
                  </td>
                  <td class="stats-solde">{{ fmtYen(j.solde) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Activité 30 jours -->
          <div v-if="stats.parJour.length" class="stats-section">
            <p class="stats-section-title">Activité — 30 derniers jours</p>
            <table class="stats-table">
              <thead>
                <tr>
                  <th>Jour</th>
                  <th>Parties</th>
                  <th>Total misé</th>
                  <th>Bénéfice</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="j in [...stats.parJour].reverse()" :key="j.jour" class="stats-row">
                  <td class="col-date">{{ j.jour }}</td>
                  <td>{{ j.nb_parties }}</td>
                  <td>{{ fmtYen(j.total_mise) }}</td>
                  <td :class="j.benefice >= 0 ? 'gain--pos' : 'gain--neg'">{{ fmtYen(j.benefice) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

        </template>
      </template>

      <!-- ── Onglet Logs ── -->
      <template v-if="onglet === 'logs'">

        <div class="logs-toolbar">
          <input
            v-model="logsRecherche"
            class="field-input recherche-input"
            type="text"
            placeholder="Filtrer par joueur…"
            autocomplete="off"
            @input="debounceLogs"
          />
          <span class="recherche-count">{{ logsTotal }} transaction{{ logsTotal !== 1 ? 's' : '' }}</span>
        </div>

        <div v-if="loadingLogs" class="loading">Chargement…</div>
        <div v-else-if="logs.length === 0" class="vide">Aucune transaction.</div>

        <div v-else class="logs-table-wrap">
          <table class="logs-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Joueur</th>
                <th>Jeu</th>
                <th>Mise</th>
                <th>Résultat</th>
                <th class="col-gain">Gain net</th>
                <th>Solde après</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in logs" :key="l.source + l.id" :class="['log-row', l.source === 'admin' ? 'log--admin' : l.gain_net > 0 ? 'log--win' : l.gain_net === 0 ? 'log--even' : 'log--loss']">
                <td class="col-date">{{ formatDate(l.created_at) }}</td>
                <td class="col-joueur">
                  <span class="log-nom">{{ l.joueur_nom }}</span>
                  <span class="log-id">{{ l.joueur_identifiant }}</span>
                </td>
                <td class="col-jeu">
                  <span v-if="l.source === 'admin'" class="badge-admin">Admin</span>
                  <span v-else>{{ l.jeu }}</span>
                </td>
                <td class="col-mise">{{ (l.mise ?? 0).toLocaleString('fr-FR') }} ¥</td>
                <td class="col-res">
                  <template v-if="l.source === 'admin'">
                    <span class="admin-op">{{ { add: 'Ajout', remove: 'Retrait', set: 'Définir' }[l.operation] }}</span>
                    <span class="admin-by"> par {{ l.admin_nom }}</span>
                  </template>
                  <template v-else>{{ formatResultat(l.resultat) }}</template>
                </td>
                <td class="col-gain">
                  <span :class="['gain-val', l.gain_net > 0 ? 'gain--pos' : l.gain_net < 0 ? 'gain--neg' : '']">
                    {{ l.gain_net > 0 ? '+' : '' }}{{ (l.gain_net ?? 0).toLocaleString('fr-FR') }} ¥
                  </span>
                </td>
                <td class="col-solde">{{ (l.solde_apres ?? 0).toLocaleString('fr-FR') }} ¥</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="logsTotal > logsLimit" class="logs-pagination">
          <button class="btn-secondary" :disabled="logsOffset === 0" @click="logsPage(-1)">← Précédent</button>
          <span class="pagination-info">{{ logsOffset + 1 }}–{{ Math.min(logsOffset + logsLimit, logsTotal) }} / {{ logsTotal }}</span>
          <button class="btn-secondary" :disabled="logsOffset + logsLimit >= logsTotal" @click="logsPage(1)">Suivant →</button>
        </div>

      </template>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import AppNavbar from './AppNavbar.vue'
import {
  getSlotsAdminSymbols, createSlotsSymbol, updateSlotsSymbol, deleteSlotsSymbol,
  getSlotsAdminConfig, updateSlotsConfig, IMG_BASE,
  getSlotsAdminJoueurs, updateJoueurSolde,
  getSlotsAdminLogs, getSlotsAdminStats,
} from '../api.js'

const onglet = ref('symboles')
const jeu    = ref('slots')

// ── Symboles ────────────────────────────────────────────────────────────────
const symboles       = ref([])
const loadingSymboles = ref(true)

const editId              = ref(null)
const symboleEnEdition    = computed(() => symboles.value.find(s => s.id === editId.value))
const loadingForm         = ref(false)
const erreurForm          = ref('')
const previewUrl          = ref('')

const form = ref({ nom: '', imageFile: null, poids: 10, mult_2: 2, mult_3: 10, actif: true })

function resetForm() {
  form.value  = { nom: '', imageFile: null, poids: 10, mult_2: 2, mult_3: 10, actif: true }
  previewUrl.value = ''
  editId.value    = null
  erreurForm.value = ''
}

function onImageChange(e) {
  const file = e.target.files[0]
  if (!file) return
  form.value.imageFile = file
  previewUrl.value = URL.createObjectURL(file)
}

function editer(s) {
  editId.value = s.id
  form.value = { nom: s.nom, imageFile: null, poids: s.poids, mult_2: s.mult_2, mult_3: s.mult_3, actif: !!s.actif }
  previewUrl.value = s.image_url ? IMG_BASE + s.image_url : ''
  erreurForm.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function annulerEdit() { resetForm() }

async function soumettre() {
  erreurForm.value = ''
  if (!form.value.nom.trim()) { erreurForm.value = 'Nom requis.'; return }

  const fd = new FormData()
  fd.append('nom',    form.value.nom.trim())
  fd.append('poids',  form.value.poids)
  fd.append('mult_2', form.value.mult_2)
  fd.append('mult_3', form.value.mult_3)
  fd.append('actif',  form.value.actif ? '1' : '0')
  if (form.value.imageFile) fd.append('image', form.value.imageFile)

  try {
    loadingForm.value = true
    if (editId.value) {
      const updated = await updateSlotsSymbol(editId.value, fd)
      const idx = symboles.value.findIndex(s => s.id === editId.value)
      symboles.value[idx] = updated
    } else {
      const created = await createSlotsSymbol(fd)
      symboles.value.push(created)
    }
    resetForm()
  } catch (e) {
    erreurForm.value = e.message
  } finally {
    loadingForm.value = false
  }
}

async function supprimer(id) {
  if (!confirm('Supprimer ce symbole ?')) return
  await deleteSlotsSymbol(id)
  symboles.value = symboles.value.filter(s => s.id !== id)
  if (editId.value === id) resetForm()
}

// ── Config ──────────────────────────────────────────────────────────────────
const configForm   = ref({ mise_min: 10000, mise_max: 1000000, nb_colonnes: 3 })
const loadingConfig = ref(false)
const erreurConfig  = ref('')
const configOk      = ref(false)

async function sauvegarderConfig() {
  erreurConfig.value = ''
  configOk.value     = false
  try {
    loadingConfig.value = true
    await updateSlotsConfig(configForm.value.mise_min, configForm.value.mise_max, configForm.value.nb_colonnes)
    configOk.value = true
    setTimeout(() => { configOk.value = false }, 3000)
  } catch (e) {
    erreurConfig.value = e.message
  } finally {
    loadingConfig.value = false
  }
}

// ── Joueurs ─────────────────────────────────────────────────────────────────
const joueurs        = ref([])
const loadingJoueurs = ref(false)
const montants       = ref({})
const erreurs        = ref({})
const recherche      = ref('')

const joueursFiltres = computed(() => {
  const q = recherche.value.trim().toLowerCase()
  if (!q) return joueurs.value
  return joueurs.value.filter(j =>
    j.nom.toLowerCase().includes(q) || j.identifiant.toLowerCase().includes(q)
  )
})

async function chargerJoueurs() {
  if (joueurs.value.length) return
  loadingJoueurs.value = true
  try {
    joueurs.value = await getSlotsAdminJoueurs()
  } finally {
    loadingJoueurs.value = false
  }
}

async function opSolde(j, operation) {
  erreurs.value[j.id] = ''
  const m = montants.value[j.id]
  if (m === undefined || m === null || m === '' || isNaN(m) || m < 0) {
    erreurs.value[j.id] = 'Montant invalide.'
    return
  }
  try {
    const updated = await updateJoueurSolde(j.id, m, operation)
    const idx = joueurs.value.findIndex(x => x.id === j.id)
    if (idx !== -1) joueurs.value[idx] = updated
    montants.value[j.id] = null
  } catch (e) {
    erreurs.value[j.id] = e.message
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────
const stats        = ref(null)
const loadingStats = ref(false)

const rtp = computed(() => {
  if (!stats.value || !stats.value.global.total_mise) return '—'
  return (stats.value.global.total_redistribue / stats.value.global.total_mise * 100).toFixed(1)
})

function rtpJeu(j) {
  if (!j.total_mise) return '—'
  return (j.total_redistribue / j.total_mise * 100).toFixed(1)
}

function fmtYen(n) {
  if (n == null) return '—'
  return (n < 0 ? '-¥' : '¥') + Math.abs(n).toLocaleString('fr-FR')
}

async function chargerStats() {
  if (stats.value) return
  loadingStats.value = true
  try {
    stats.value = await getSlotsAdminStats()
  } finally {
    loadingStats.value = false
  }
}

// ── Logs ─────────────────────────────────────────────────────────────────────
const logs          = ref([])
const logsTotal     = ref(0)
const loadingLogs   = ref(false)
const logsRecherche = ref('')
const logsLimit     = 100
const logsOffset    = ref(0)
let   logsTimer     = null

async function chargerLogs() {
  loadingLogs.value = true
  try {
    const data = await getSlotsAdminLogs({ limit: logsLimit, offset: logsOffset.value, joueur: logsRecherche.value })
    logs.value      = data.logs
    logsTotal.value = data.total
  } finally {
    loadingLogs.value = false
  }
}

function debounceLogs() {
  clearTimeout(logsTimer)
  logsOffset.value = 0
  logsTimer = setTimeout(chargerLogs, 300)
}

function logsPage(dir) {
  logsOffset.value = Math.max(0, logsOffset.value + dir * logsLimit)
  chargerLogs()
}

function formatDate(str) {
  const d = new Date(str.replace(' ', 'T') + 'Z')
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatResultat(json) {
  try {
    const r = JSON.parse(json)
    if (r.type === 'three') return `×3 ${r.run} identiques (×${r.multiplicateur})`
    if (r.type === 'two')   return `×2 identiques (×${r.multiplicateur})`
    return 'Pas de combinaison'
  } catch { return '—' }
}

onMounted(async () => {
  try {
    symboles.value = await getSlotsAdminSymbols()
  } finally {
    loadingSymboles.value = false
  }
  try {
    const cfg = await getSlotsAdminConfig()
    configForm.value = { mise_min: cfg.mise_min, mise_max: cfg.mise_max, nb_colonnes: cfg.nb_colonnes ?? 3 }
  } catch {}
})
</script>

<style scoped>
.page { min-height: 100vh; background: #090909; color: #fff; }

.page-inner {
  max-width: 760px;
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

.back-link {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.25);
  text-decoration: none;
  transition: color 0.15s;
}
.back-link:hover { color: rgba(255,255,255,0.6); }

/* Sélecteur de jeu */
.jeux-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.jeu-tab {
  font-family: 'Cinzel', serif;
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.35);
  padding: 8px 18px;
  cursor: pointer;
  transition: all 0.15s;
}
.jeu-tab:hover { color: rgba(255,255,255,0.7); border-color: rgba(255,255,255,0.18); }
.jeu-tab--actif {
  background: rgba(139,26,26,0.15);
  border-color: rgba(139,26,26,0.35);
  color: #d4cfc9;
}

/* Onglets */
.onglets {
  display: flex;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 32px;
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
  padding: 10px 20px;
  cursor: pointer;
  margin-bottom: -1px;
  transition: color 0.15s;
}
.onglet:hover { color: rgba(255,255,255,0.6); }
.onglet--actif { color: #fff; border-bottom-color: #8b1a1a; }

/* Formulaire */
.form-card {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.06);
  padding: 28px;
  margin-bottom: 32px;
}

.form-title {
  font-family: 'Cinzel', serif;
  font-size: 0.8rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  margin: 0 0 24px;
  font-weight: 400;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px 24px;
  margin-bottom: 20px;
}

.field { display: flex; flex-direction: column; gap: 6px; }

.field--actif { justify-content: flex-start; padding-top: 4px; }

.field-label {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.3);
}

.field-input {
  background: #0f0f10;
  border: 1px solid rgba(255,255,255,0.08);
  color: #d4cfc9;
  padding: 9px 12px;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  outline: none;
}
.field-input:focus { border-color: rgba(139,26,26,0.4); }

.field-hint {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.82rem;
  font-style: italic;
  color: rgba(255,255,255,0.2);
  margin: 0;
}

/* Upload image */
.upload-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f0f10;
  border: 1px dashed rgba(255,255,255,0.1);
  cursor: pointer;
  min-height: 80px;
  position: relative;
  overflow: hidden;
  transition: border-color 0.15s;
}
.upload-zone:hover { border-color: rgba(255,255,255,0.25); }
.upload-zone--has { border-style: solid; border-color: rgba(255,255,255,0.08); }

.upload-preview {
  width: 100%;
  height: 100%;
  max-height: 120px;
  object-fit: contain;
}

.upload-placeholder {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.2);
}

.upload-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
}

.upload-current {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.82rem;
  font-style: italic;
  color: rgba(255,255,255,0.2);
  margin: 0;
}

/* Toggle actif */
.toggle { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.toggle input { display: none; }

.toggle-track {
  width: 36px;
  height: 20px;
  background: rgba(255,255,255,0.1);
  border-radius: 10px;
  position: relative;
  transition: background 0.2s;
}
.toggle-track::after {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  background: rgba(255,255,255,0.4);
  border-radius: 50%;
  top: 3px;
  left: 3px;
  transition: transform 0.2s, background 0.2s;
}
.toggle input:checked ~ .toggle-track { background: rgba(139,26,26,0.6); }
.toggle input:checked ~ .toggle-track::after { transform: translateX(16px); background: #c05050; }

.form-erreur {
  color: #c05050;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.95rem;
  font-style: italic;
  margin-bottom: 12px;
}

.form-ok {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.95rem;
  font-style: italic;
  color: #6aaa6a;
  margin-top: -16px;
  margin-bottom: 24px;
}

.form-actions { display: flex; gap: 12px; justify-content: flex-end; }

.btn-submit {
  font-family: 'Cinzel', serif;
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  background: #8b1a1a;
  color: #fff;
  border: none;
  padding: 9px 22px;
  cursor: pointer;
}
.btn-submit:hover:not(:disabled) { background: #a82020; }
.btn-submit:disabled { opacity: 0.5; cursor: default; }

.btn-secondary {
  font-family: 'Cinzel', serif;
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.4);
  padding: 9px 18px;
  cursor: pointer;
}
.btn-secondary:hover { border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.7); }

/* Liste symboles */
.loading, .vide {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1.05rem;
  font-style: italic;
  color: rgba(255,255,255,0.25);
  padding: 40px 0;
  text-align: center;
}

.symbols-list { display: flex; flex-direction: column; gap: 8px; }

.symbol-row {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #141416;
  border: 1px solid rgba(255,255,255,0.05);
  padding: 12px 16px;
}

.symbol-img-cell {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  background: #0f0f10;
  border: 1px solid rgba(255,255,255,0.05);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.symbol-img { width: 100%; height: 100%; object-fit: cover; }

.symbol-img-empty {
  font-family: 'Cinzel', serif;
  font-size: 1rem;
  color: rgba(255,255,255,0.1);
}

.symbol-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 140px;
}

.symbol-nom {
  font-family: 'Cinzel', serif;
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  color: #d4cfc9;
}

.symbol-actif {
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  padding: 2px 7px;
  align-self: flex-start;
}
.actif--on  { color: #6aaa6a; background: rgba(58,122,58,0.15); border: 1px solid rgba(58,122,58,0.25); }
.actif--off { color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); }

.symbol-stats {
  flex: 1;
  display: flex;
  gap: 20px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-k {
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.2);
}

.stat-v {
  font-family: 'Cinzel', serif;
  font-size: 0.85rem;
  color: rgba(255,255,255,0.65);
}

.symbol-actions { display: flex; gap: 8px; }

.btn-edit {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.4);
  padding: 5px 12px;
  cursor: pointer;
}
.btn-edit:hover { border-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.7); }

.btn-delete {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.2);
  font-size: 1rem;
  padding: 5px 10px;
  cursor: pointer;
  line-height: 1;
}
.btn-delete:hover { border-color: rgba(139,26,26,0.3); color: #8b1a1a; }

/* Joueurs */
.joueurs-search {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

.recherche-input { flex: 1; }

.recherche-count {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.2);
  white-space: nowrap;
}

.joueurs-list { display: flex; flex-direction: column; gap: 8px; }

.joueur-row {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.05);
  padding: 14px 16px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.joueur-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 160px;
}

.joueur-nom {
  font-family: 'Cinzel', serif;
  font-size: 0.82rem;
  letter-spacing: 0.06em;
  color: #d4cfc9;
}

.joueur-id {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.25);
  text-transform: uppercase;
}

.joueur-solde {
  min-width: 130px;
}

.solde-val {
  font-family: 'Cinzel', serif;
  font-size: 0.88rem;
  letter-spacing: 0.04em;
  color: rgba(255,255,255,0.7);
}

.joueur-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.solde-input {
  width: 120px;
  padding: 7px 10px;
  font-size: 0.9rem;
}

.btn-op {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border: none;
  padding: 7px 13px;
  cursor: pointer;
  line-height: 1;
  white-space: nowrap;
}

.btn-add    { background: rgba(58,122,58,0.25); color: #6aaa6a; }
.btn-remove { background: rgba(139,26,26,0.2);  color: #c05050; }
.btn-set    { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); }

.btn-add:hover    { background: rgba(58,122,58,0.4); }
.btn-remove:hover { background: rgba(139,26,26,0.4); }
.btn-set:hover    { background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.8); }

.joueur-err {
  width: 100%;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.9rem;
  font-style: italic;
  color: #c05050;
  margin-top: -4px;
}

/* Logs */
.logs-toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

.logs-table-wrap {
  overflow-x: auto;
  margin-bottom: 20px;
}

.logs-table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.95rem;
}

.logs-table th {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.2);
  font-weight: 400;
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  white-space: nowrap;
}

.log-row td {
  padding: 9px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  vertical-align: middle;
  color: rgba(255,255,255,0.55);
  white-space: nowrap;
}

.log-row:hover td { background: rgba(255,255,255,0.02); }

.log--win   td:first-child { border-left: 2px solid rgba(58,122,58,0.5); }
.log--loss  td:first-child { border-left: 2px solid rgba(139,26,26,0.4); }
.log--even  td:first-child { border-left: 2px solid transparent; }
.log--admin td:first-child { border-left: 2px solid rgba(180,140,60,0.6); }
.log--admin td { color: rgba(255,255,255,0.45); }

.col-date { font-size: 0.82rem; color: rgba(255,255,255,0.25); }

.col-joueur { display: flex; flex-direction: column; gap: 1px; }
.log-nom { color: #d4cfc9; font-size: 0.95rem; }
.log-id  { font-family: 'Cinzel', serif; font-size: 0.55rem; letter-spacing: 0.08em; color: rgba(255,255,255,0.2); text-transform: uppercase; }

.col-jeu { font-family: 'Cinzel', serif; font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.3); }

.col-mise { color: rgba(255,255,255,0.4); }

.col-res { font-style: italic; color: rgba(255,255,255,0.35); max-width: 200px; white-space: normal; }

.badge-admin {
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(180,140,60,0.9);
  background: rgba(180,140,60,0.1);
  border: 1px solid rgba(180,140,60,0.25);
  padding: 2px 6px;
  font-style: normal;
}

.admin-op { font-style: normal; color: rgba(255,255,255,0.5); }
.admin-by { font-size: 0.85rem; color: rgba(255,255,255,0.25); }

.gain-val { font-weight: 600; }
.gain--pos { color: #6aaa6a; }
.gain--neg { color: #c05050; }

.col-solde { color: rgba(255,255,255,0.5); }

.logs-pagination {
  display: flex;
  align-items: center;
  gap: 16px;
  justify-content: center;
  padding-top: 8px;
}

.pagination-info {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.25);
}

/* ── Stats ─────────────────────────────────────────── */

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 36px;
}

.kpi-card {
  background: #141416;
  border: 1px solid rgba(255,255,255,0.06);
  padding: 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kpi-card--accent {
  border-color: rgba(139,26,26,0.25);
  background: rgba(139,26,26,0.06);
}

.kpi-label {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.25);
}

.kpi-val {
  font-family: 'Cinzel', serif;
  font-size: 1.15rem;
  letter-spacing: 0.04em;
  color: #d4cfc9;
  line-height: 1.1;
}
.kpi-val--dim  { color: rgba(255,255,255,0.5); }
.kpi-val--pos  { color: #6aaa6a; }
.kpi-val--neg  { color: #c05050; }

.kpi-sub {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.82rem;
  font-style: italic;
  color: rgba(255,255,255,0.22);
}

.stats-section { margin-bottom: 32px; }

.stats-section-title {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.25);
  margin: 0 0 12px;
}

.stats-table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.95rem;
}

.stats-table th {
  font-family: 'Cinzel', serif;
  font-size: 0.56rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.2);
  font-weight: 400;
  padding: 7px 12px;
  text-align: left;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  white-space: nowrap;
}

.stats-row td {
  padding: 9px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.5);
  white-space: nowrap;
  vertical-align: middle;
}
.stats-row:hover td { background: rgba(255,255,255,0.02); }

.stats-jeu {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.6);
}

.stats-rtp { color: rgba(255,255,255,0.4); }

.stats-rank {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  color: rgba(255,255,255,0.2);
  width: 28px;
}

.stats-solde { color: #c9a84c; }

@media (max-width: 640px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>

<template>
  <div class="page-mythiques">
    <AppNavbar />

    <!-- Toast -->
    <Transition name="toast">
      <div v-if="toast.visible" class="toast" :class="`toast--${toast.type}`">
        {{ toast.message }}
      </div>
    </Transition>

    <div class="page-inner">
      <!-- En-tête -->
      <header class="header">
        <div class="header-title-block">
          <p class="header-label">[ REGISTRE DES ARTEFACTS ]</p>
          <p class="header-subtitle">SAISON II — ORDRE DÉMONIAQUE</p>
        </div>
        <div class="header-badge" :style="{ borderColor: niveauColor, color: niveauColor }">
          NV.{{ me?.niveau }} — {{ niveauLabel }}
        </div>
        <div class="header-stats">
          <div class="stat-box">
            <span class="stat-val">{{ stats.catalogues }}</span>
            <span class="stat-lbl">CATALOGUÉS</span>
          </div>
          <div class="stat-sep"></div>
          <div class="stat-box">
            <span class="stat-val">{{ stats.acquis }}</span>
            <span class="stat-lbl">ACQUIS</span>
          </div>
          <div class="stat-sep"></div>
          <div class="stat-box">
            <span class="stat-val">{{ stats.membres }}</span>
            <span class="stat-lbl">MEMBRES</span>
          </div>
        </div>
      </header>

      <!-- Onglets principaux -->
      <div class="tabs-bar">
        <button class="tab-btn" :class="{ active: mainTab === 'catalogue' }" @click="mainTab = 'catalogue'">CATALOGUE</button>
        <button v-if="me?.niveau > 0 || me?.dirigeant" class="tab-btn" :class="{ active: mainTab === 'membres' }" @click="mainTab = 'membres'">MEMBRES</button>
        <button v-if="me?.niveau >= 5 || me?.dirigeant" class="tab-btn" :class="{ active: mainTab === 'admin' }" @click="mainTab = 'admin'">ADMIN</button>
        <button v-if="me?.dirigeant" class="tab-btn" :class="{ active: mainTab === 'config' }" @click="mainTab = 'config'">CONFIG</button>
      </div>

      <!-- ═══════════ CATALOGUE ═══════════ -->
      <div v-if="mainTab === 'catalogue'" class="catalogue-view">
        <div class="catalogue-toolbar">
          <input
            v-model="recherche"
            class="search-input"
            placeholder="Rechercher (nom, type, tags)…"
          />
          <select v-model="filtreStatut" class="status-select">
            <option value="">TOUS LES STATUTS</option>
            <option v-for="s in STATUT_OPTIONS" :key="s.value" :value="s.value">{{ s.value }}</option>
          </select>
        </div>

        <div v-if="loading" class="loading-msg">Chargement des artefacts…</div>
        <div v-else-if="objetsFiltres.length === 0" class="empty-msg">Aucun artefact trouvé.</div>
        <div v-else class="objets-grid">
          <div
            v-for="objet in objetsFiltres"
            :key="objet.id"
            class="objet-card"
            :class="{ locked: objet.locked }"
            :style="!objet.locked ? { '--rarity-color': objet.rarity_color } : {}"
            @click="!objet.locked && openModal(objet)"
          >
            <!-- Barre rarity -->
            <div class="card-rarity-bar" :style="{ background: objet.rarity_color }"></div>

            <!-- Contenu (floutage si locked) -->
            <div class="card-content" :class="{ blurred: objet.locked }">
              <div class="card-image" v-if="objet.image_url">
                <img :src="objet.image_url" :alt="objet.name" />
                <div class="card-image-overlay"></div>
              </div>
              <div class="card-image card-image--placeholder" v-else>
                <span class="placeholder-icon">◈</span>
              </div>

              <div class="card-body">
                <div class="card-badges">
                  <span v-if="!objet.locked && objet.status" class="badge" :style="{ background: objet.status_color + '22', color: objet.status_color, borderColor: objet.status_color + '66' }">{{ objet.status }}</span>
                  <span v-if="!objet.locked && objet.danger && objet.danger !== 'INCONNU'" class="badge badge--danger" :style="{ background: objet.danger_color + '22', color: objet.danger_color, borderColor: objet.danger_color + '66' }">⚠ {{ objet.danger }}</span>
                </div>
                <h3 class="card-name">{{ objet.name }}</h3>
                <p v-if="objet.type" class="card-type">{{ objet.type }}</p>
                <p v-if="!objet.locked && objet.description" class="card-desc">{{ objet.description }}</p>
                <div v-if="!objet.locked && objet.tags && objet.tags.length" class="card-tags">
                  <span v-for="tag in objet.tags.slice(0, 3)" :key="tag" class="tag">{{ tag }}</span>
                </div>
              </div>
            </div>

            <!-- Overlay locked -->
            <div v-if="objet.locked" class="lock-overlay">
              <span class="lock-icon">🔒</span>
              <span class="lock-text">NIVEAU {{ objet.min_level }} REQUIS</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════ MEMBRES ═══════════ -->
      <div v-if="mainTab === 'membres'" class="membres-view">
        <div v-if="membres.length === 0" class="loading-msg">Aucun membre.</div>
        <div v-else class="membres-grid">
          <div v-for="m in membres" :key="m.user_id" class="membre-card">
            <!-- Photo ou initiales -->
            <div class="membre-card-photo">
              <img v-if="m.photo_url" :src="m.photo_url" :alt="m.nom" class="membre-card-img" />
              <div v-else class="membre-card-initiales" :style="{ background: NIVEAU_COLORS[m.niveau] + '22', color: NIVEAU_COLORS[m.niveau], borderColor: NIVEAU_COLORS[m.niveau] + '55' }">
                {{ m.nom[0]?.toUpperCase() }}
              </div>
            </div>
            <!-- Infos -->
            <div class="membre-card-body">
              <h3 class="membre-card-nom">{{ m.nom }}</h3>
              <p v-if="m.grade" class="membre-card-grade">{{ m.grade }}</p>
              <span class="badge membre-card-badge" :style="{ background: NIVEAU_COLORS[m.niveau] + '22', color: NIVEAU_COLORS[m.niveau], borderColor: NIVEAU_COLORS[m.niveau] + '55' }">
                {{ niveauLabels[m.niveau] }}
              </span>
              <p v-if="m.description" class="membre-card-desc">{{ m.description }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════ CONFIG ═══════════ -->
      <div v-if="mainTab === 'config'" class="config-view">
        <div class="config-section">
          <h3 class="config-title">NOMS DES NIVEAUX</h3>
          <p class="config-hint">Personnalisez le nom affiché pour chaque rang de membre.</p>
          <div class="config-fields">
            <div v-for="n in [1,2,3,4,5]" :key="n" class="config-field-row">
              <span class="config-level-badge" :style="{ color: NIVEAU_COLORS[n], borderColor: NIVEAU_COLORS[n] + '66' }">NV.{{ n }}</span>
              <input class="form-input config-input" v-model="configForm[n]" :placeholder="`Nom du niveau ${n}`" />
              <span class="config-preview" :style="{ color: NIVEAU_COLORS[n] }">{{ configForm[n] || '—' }}</span>
            </div>
          </div>
          <div class="config-actions">
            <button class="btn-primary" @click="sauvegarderConfig">Sauvegarder</button>
          </div>
        </div>
      </div>

      <!-- ═══════════ ADMIN ═══════════ -->
      <div v-if="mainTab === 'admin'" class="admin-view">
        <div class="tabs-bar tabs-bar--sub">
          <button class="tab-btn tab-btn--sub" :class="{ active: adminTab === 'objets' }" @click="adminTab = 'objets'">OBJETS</button>
          <button class="tab-btn tab-btn--sub" :class="{ active: adminTab === 'membres' }" @click="adminTab = 'membres'">MEMBRES</button>
          <button class="tab-btn tab-btn--sub" :class="{ active: adminTab === 'stats' }" @click="adminTab = 'stats'">STATISTIQUES</button>
        </div>

        <!-- Admin > Objets -->
        <div v-if="adminTab === 'objets'" class="admin-section">
          <div class="admin-toolbar">
            <button class="btn-primary" @click="ouvrirEditeur(null)">+ Nouvel Objet</button>
          </div>
          <div class="admin-list">
            <div v-if="adminObjets.length === 0" class="empty-msg">Aucun objet enregistré.</div>
            <div v-for="obj in adminObjets" :key="obj.id" class="admin-list-row">
              <div class="admin-row-info">
                <span class="admin-row-name">{{ obj.name }}</span>
                <span class="admin-row-type">{{ obj.type }}</span>
                <span class="badge badge--sm" :style="{ background: obj.rarity_color + '22', color: obj.rarity_color, borderColor: obj.rarity_color + '55' }">{{ obj.rarity }}</span>
                <span class="admin-row-level">NV.{{ obj.min_level }}</span>
                <span class="badge badge--sm" :style="{ background: obj.status_color + '22', color: obj.status_color, borderColor: obj.status_color + '55' }">{{ obj.status }}</span>
              </div>
              <div class="admin-row-actions">
                <button class="btn-ghost" @click="ouvrirEditeur(obj)">Éditer</button>
                <button class="btn-ghost btn-ghost--danger" @click="supprimerObjet(obj)">Supprimer</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Admin > Membres -->
        <div v-if="adminTab === 'membres'" class="admin-section">
          <div class="admin-toolbar">
            <button class="btn-primary" @click="showAddMembre = true; addMembreSearch = ''; addMembreSelected = null; addMembreNiveau = 1">+ Ajouter un membre</button>
          </div>
          <div class="admin-list">
            <div v-if="adminMembres.length === 0" class="empty-msg">Aucun membre.</div>
            <div v-for="m in adminMembres" :key="m.user_id" class="admin-list-row">
              <div class="admin-row-info">
                <div class="avatar-initial" :style="{ background: NIVEAU_COLORS[m.niveau] + '33', color: NIVEAU_COLORS[m.niveau], borderColor: NIVEAU_COLORS[m.niveau] + '66' }">{{ m.nom[0] }}</div>
                <span class="admin-row-name">{{ m.nom }}</span>
                <span class="admin-row-ident">@{{ m.identifiant }}</span>
                <span class="badge" :style="{ background: NIVEAU_COLORS[m.niveau] + '22', color: NIVEAU_COLORS[m.niveau], borderColor: NIVEAU_COLORS[m.niveau] + '55' }">{{ niveauLabels[m.niveau] }}</span>
              </div>
              <div class="admin-row-actions">
                <select class="inline-select" :value="m.niveau" @change="changerNiveauMembre(m.user_id, $event.target.value)">
                  <option v-for="n in [1,2,3,4,5]" :key="n" :value="n">NV.{{ n }}</option>
                </select>
                <button class="btn-ghost" @click="ouvrirEditMembre(m)">Éditer profil</button>
                <button class="btn-ghost btn-ghost--danger" @click="supprimerMembre(m)">Supprimer</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Admin > Stats -->
        <div v-if="adminTab === 'stats'" class="admin-section">
          <div class="stats-grid">
            <div class="stats-counter-row">
              <div class="stats-counter">
                <span class="stats-counter-val">{{ adminStats.total }}</span>
                <span class="stats-counter-lbl">OBJETS TOTAL</span>
              </div>
              <div class="stats-counter">
                <span class="stats-counter-val" style="color:#22c55e">{{ adminStats.acquis }}</span>
                <span class="stats-counter-lbl">ACQUIS</span>
              </div>
              <div class="stats-counter">
                <span class="stats-counter-val" style="color:#4a90c4">{{ adminStats.membres }}</span>
                <span class="stats-counter-lbl">MEMBRES</span>
              </div>
            </div>

            <div class="stats-section">
              <h4 class="stats-title">RÉPARTITION PAR RARETÉ</h4>
              <div v-for="r in adminStats.parRarity" :key="r.rarity" class="stats-bar-row">
                <span class="stats-bar-label" :style="{ color: r.rarity_color }">{{ r.rarity }}</span>
                <div class="stats-bar-track">
                  <div class="stats-bar-fill" :style="{ width: adminStats.total ? (r.count / adminStats.total * 100) + '%' : '0%', background: r.rarity_color }"></div>
                </div>
                <span class="stats-bar-count">{{ r.count }}</span>
              </div>
            </div>

            <div class="stats-section">
              <h4 class="stats-title">RÉPARTITION PAR RANG</h4>
              <div v-for="n in [1,2,3,4,5]" :key="n" class="stats-bar-row">
                <span class="stats-bar-label" :style="{ color: NIVEAU_COLORS[n] }">{{ niveauLabels[n] }}</span>
                <div class="stats-bar-track">
                  <div class="stats-bar-fill" :style="{ width: adminStats.membres ? ((adminStats.parNiveau?.find(p => p.niveau === n)?.count || 0) / adminStats.membres * 100) + '%' : '0%', background: NIVEAU_COLORS[n] }"></div>
                </div>
                <span class="stats-bar-count">{{ adminStats.parNiveau?.find(p => p.niveau === n)?.count || 0 }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════ MODAL DÉTAIL ═══════════ -->
    <Teleport to="body">
      <div v-if="modalObjet" class="modal-overlay" @click.self="closeModal">
        <div class="modal-panel">
          <div class="modal-rarity-bar" :style="{ background: modalObjet.rarity_color }"></div>
          <div class="modal-header">
            <div>
              <h2 class="modal-title">{{ modalObjet.name }}</h2>
              <p v-if="modalObjet.type" class="modal-type">{{ modalObjet.type }}</p>
            </div>
            <div class="modal-header-right">
              <span class="badge" :style="{ background: modalObjet.rarity_color + '22', color: modalObjet.rarity_color, borderColor: modalObjet.rarity_color + '55' }">{{ modalObjet.rarity }}</span>
              <span v-if="modalObjet.min_level > 1" class="badge badge--level">NV.{{ modalObjet.min_level }} REQUIS</span>
              <button class="modal-close" @click="closeModal">✕</button>
            </div>
          </div>

          <div class="tabs-bar tabs-bar--modal">
            <button class="tab-btn tab-btn--modal" :class="{ active: modalTab === 'fiche' }" @click="modalTab = 'fiche'">FICHE</button>
            <button class="tab-btn tab-btn--modal" :class="{ active: modalTab === 'decouverte' }" @click="modalTab = 'decouverte'">DÉCOUVERTE</button>
            <button class="tab-btn tab-btn--modal" :class="{ active: modalTab === 'notes' }" @click="modalTab = 'notes'">NOTES INT.</button>
          </div>

          <div class="modal-body">
            <!-- Onglet FICHE -->
            <div v-if="modalTab === 'fiche'" class="modal-tab-content">
              <div class="modal-fiche-layout">
                <div v-if="modalObjet.image_url" class="modal-image-wrap">
                  <img :src="modalObjet.image_url" :alt="modalObjet.name" class="modal-image" />
                </div>
                <div class="modal-fiche-infos">
                  <div class="info-grid">
                    <div class="info-item">
                      <span class="info-label">NIVEAU REQUIS</span>
                      <span class="info-val" :style="{ color: NIVEAU_COLORS[modalObjet.min_level] }">{{ niveauLabels[modalObjet.min_level] }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">DANGER</span>
                      <span class="info-val" :style="{ color: modalObjet.danger_color }">{{ modalObjet.danger }}</span>
                    </div>
                    <div v-if="modalObjet.acquired" class="info-item">
                      <span class="info-label">ACQUISITION</span>
                      <span class="info-val">{{ modalObjet.acquired }}</span>
                    </div>
                    <div v-if="modalObjet.location" class="info-item">
                      <span class="info-label">LOCALISATION</span>
                      <span class="info-val">{{ modalObjet.location }}</span>
                    </div>
                    <div v-if="modalObjet.origin" class="info-item">
                      <span class="info-label">ORIGINE</span>
                      <span class="info-val">{{ modalObjet.origin }}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">STATUT</span>
                      <span class="info-val" :style="{ color: modalObjet.status_color }">{{ modalObjet.status }}</span>
                    </div>
                  </div>
                  <div v-if="modalObjet.description" class="modal-desc">
                    <p>{{ modalObjet.description }}</p>
                  </div>
                  <div v-if="modalObjet.tags && modalObjet.tags.length" class="card-tags">
                    <span v-for="tag in modalObjet.tags" :key="tag" class="tag">{{ tag }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Onglet DÉCOUVERTE -->
            <div v-if="modalTab === 'decouverte'" class="modal-tab-content">
              <div class="discovery-grid">
                <div v-if="modalObjet.discovered_by" class="discovery-item">
                  <span class="info-label">AGENT</span>
                  <span class="info-val">{{ modalObjet.discovered_by }}</span>
                </div>
                <div v-if="modalObjet.reference" class="discovery-item">
                  <span class="info-label">RÉFÉRENCE</span>
                  <span class="info-val info-val--code">{{ modalObjet.reference }}</span>
                </div>
                <div v-if="modalObjet.discovery_method" class="discovery-item">
                  <span class="info-label">MÉTHODE</span>
                  <span class="info-val">{{ modalObjet.discovery_method }}</span>
                </div>
                <div class="discovery-item">
                  <span class="info-label">DATE DE CLASSIFICATION</span>
                  <span class="info-val info-val--code">{{ formatDate(modalObjet.created_at) }}</span>
                </div>
              </div>
            </div>

            <!-- Onglet NOTES INT. -->
            <div v-if="modalTab === 'notes'" class="modal-tab-content">
              <div class="notes-banner">⚠ ACCÈS RESTREINT — LECTURE ENREGISTRÉE</div>
              <div class="notes-content">
                <p v-if="modalObjet.notes">{{ modalObjet.notes }}</p>
                <p v-else class="empty-msg">Aucune note interne.</p>
              </div>
              <div class="notes-danger-row" v-if="modalObjet.danger">
                <span class="info-label">DANGER</span>
                <span class="info-val" :style="{ color: modalObjet.danger_color }">{{ modalObjet.danger }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ═══════════ ÉDITEUR SPLIT-SCREEN ═══════════ -->
    <Teleport to="body">
      <div v-if="editeurOuvert" class="editeur-overlay">
        <div class="editeur-header">
          <span class="editeur-title">ÉDITEUR — {{ form.name || 'NOUVEL ARTEFACT' }}</span>
          <button class="btn-ghost editeur-close" @click="fermerEditeur">✕</button>
        </div>

        <div class="editeur-body">
          <!-- Gauche : formulaire -->
          <div class="editeur-form">
            <div class="form-group">
              <label class="form-label">NOM *</label>
              <input class="form-input" v-model="form.name" placeholder="Nom de l'artefact" />
            </div>
            <div class="form-group">
              <label class="form-label">TYPE</label>
              <input class="form-input" v-model="form.type" placeholder="Ex: Épée, Grimoire, Anneau…" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">NIVEAU MIN.</label>
                <select class="form-input" v-model.number="form.min_level">
                  <option v-for="n in [1,2,3,4,5]" :key="n" :value="n">NV.{{ n }}</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">RARETÉ</label>
                <select class="form-input" v-model="form.rarity" @change="onRarityChange">
                  <option v-for="r in RARETE_OPTIONS" :key="r.value" :value="r.value">{{ r.value }}</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">STATUT</label>
                <select class="form-input" v-model="form.status" @change="onStatusChange">
                  <option v-for="s in STATUT_OPTIONS" :key="s.value" :value="s.value">{{ s.value }}</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">DANGER</label>
                <select class="form-input" v-model="form.danger" @change="onDangerChange">
                  <option v-for="d in DANGER_OPTIONS" :key="d.value" :value="d.value">{{ d.value }}</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">IMAGE URL</label>
              <div class="upload-row">
                <input class="form-input" v-model="form.image_url" placeholder="https://… ou uploader ci-dessous" />
                <label class="btn-upload" :class="{ loading: uploadingImage }">
                  <input type="file" accept="image/*" style="display:none" @change="handleImageUpload" :disabled="uploadingImage" />
                  {{ uploadingImage ? '…' : '↑' }}
                </label>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">DESCRIPTION *</label>
              <textarea class="form-input form-textarea" v-model="form.description" rows="4" placeholder="Description de l'artefact…"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">TAGS (séparés par des virgules)</label>
              <input class="form-input" v-model="formTagsStr" placeholder="tag1, tag2, tag3" />
            </div>
            <div class="form-group">
              <label class="form-label">LOCALISATION</label>
              <input class="form-input" v-model="form.location" placeholder="Où se trouve l'objet…" />
            </div>
            <div class="form-group">
              <label class="form-label">ACQUISITION</label>
              <input class="form-input" v-model="form.acquired" placeholder="Comment a-t-il été acquis…" />
            </div>
            <div class="form-group">
              <label class="form-label">ORIGINE</label>
              <input class="form-input" v-model="form.origin" placeholder="Origine ou provenance…" />
            </div>
            <div class="form-group">
              <label class="form-label">DÉCOUVERT PAR</label>
              <input class="form-input" v-model="form.discovered_by" placeholder="Nom de l'agent…" />
            </div>
            <div class="form-group">
              <label class="form-label">RÉFÉRENCE</label>
              <input class="form-input" v-model="form.reference" placeholder="S2-017" />
            </div>
            <div class="form-group">
              <label class="form-label">MÉTHODE DE DÉCOUVERTE</label>
              <input class="form-input" v-model="form.discovery_method" placeholder="Comment a-t-il été découvert…" />
            </div>
            <div class="form-group">
              <label class="form-label">NOTES INTERNES</label>
              <textarea class="form-input form-textarea" v-model="form.notes" rows="3" placeholder="Notes confidentielles…"></textarea>
            </div>
            <div class="form-actions">
              <button class="btn-ghost" @click="fermerEditeur">Annuler</button>
              <button class="btn-primary" :disabled="!form.name || !form.description" @click="sauvegarderObjet">Sauvegarder</button>
            </div>
          </div>

          <!-- Droite : aperçu -->
          <div class="editeur-preview">
            <h4 class="preview-title">APERÇU CARTE</h4>
            <div class="preview-card-wrap">
              <div class="objet-card preview-card" :style="{ '--rarity-color': form.rarity_color }">
                <div class="card-rarity-bar" :style="{ background: form.rarity_color }"></div>
                <div class="card-content">
                  <div class="card-image" v-if="form.image_url">
                    <img :src="form.image_url" :alt="form.name" />
                    <div class="card-image-overlay"></div>
                  </div>
                  <div class="card-image card-image--placeholder" v-else>
                    <span class="placeholder-icon">◈</span>
                  </div>
                  <div class="card-body">
                    <div class="card-badges">
                      <span v-if="form.status" class="badge" :style="{ background: form.status_color + '22', color: form.status_color, borderColor: form.status_color + '66' }">{{ form.status }}</span>
                      <span v-if="form.danger && form.danger !== 'INCONNU'" class="badge badge--danger" :style="{ background: form.danger_color + '22', color: form.danger_color, borderColor: form.danger_color + '66' }">⚠ {{ form.danger }}</span>
                    </div>
                    <h3 class="card-name">{{ form.name || '—' }}</h3>
                    <p v-if="form.type" class="card-type">{{ form.type }}</p>
                    <p v-if="form.description" class="card-desc">{{ form.description }}</p>
                    <div v-if="formTags.length" class="card-tags">
                      <span v-for="tag in formTags.slice(0,3)" :key="tag" class="tag">{{ tag }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="preview-sep"></div>

            <h4 class="preview-title">APERÇU FICHE</h4>
            <div class="preview-fiche">
              <div class="tabs-bar tabs-bar--modal">
                <button class="tab-btn tab-btn--modal" :class="{ active: previewTab === 'fiche' }" @click="previewTab = 'fiche'">FICHE</button>
                <button class="tab-btn tab-btn--modal" :class="{ active: previewTab === 'decouverte' }" @click="previewTab = 'decouverte'">DÉCOUVERTE</button>
                <button class="tab-btn tab-btn--modal" :class="{ active: previewTab === 'notes' }" @click="previewTab = 'notes'">NOTES INT.</button>
              </div>
              <div class="modal-body preview-modal-body">
                <div v-if="previewTab === 'fiche'" class="modal-tab-content">
                  <div class="modal-fiche-layout">
                    <div v-if="form.image_url" class="modal-image-wrap">
                      <img :src="form.image_url" :alt="form.name" class="modal-image" />
                    </div>
                    <div class="modal-fiche-infos">
                      <div class="info-grid">
                        <div class="info-item">
                          <span class="info-label">NIVEAU REQUIS</span>
                          <span class="info-val" :style="{ color: NIVEAU_COLORS[form.min_level] }">{{ niveauLabels[form.min_level] }}</span>
                        </div>
                        <div class="info-item">
                          <span class="info-label">DANGER</span>
                          <span class="info-val" :style="{ color: form.danger_color }">{{ form.danger }}</span>
                        </div>
                        <div v-if="form.acquired" class="info-item">
                          <span class="info-label">ACQUISITION</span>
                          <span class="info-val">{{ form.acquired }}</span>
                        </div>
                        <div v-if="form.location" class="info-item">
                          <span class="info-label">LOCALISATION</span>
                          <span class="info-val">{{ form.location }}</span>
                        </div>
                        <div v-if="form.origin" class="info-item">
                          <span class="info-label">ORIGINE</span>
                          <span class="info-val">{{ form.origin }}</span>
                        </div>
                        <div class="info-item">
                          <span class="info-label">STATUT</span>
                          <span class="info-val" :style="{ color: form.status_color }">{{ form.status }}</span>
                        </div>
                      </div>
                      <div v-if="form.description" class="modal-desc">
                        <p>{{ form.description }}</p>
                      </div>
                      <div v-if="formTags.length" class="card-tags">
                        <span v-for="tag in formTags" :key="tag" class="tag">{{ tag }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="previewTab === 'decouverte'" class="modal-tab-content">
                  <div class="discovery-grid">
                    <div v-if="form.discovered_by" class="discovery-item">
                      <span class="info-label">AGENT</span>
                      <span class="info-val">{{ form.discovered_by }}</span>
                    </div>
                    <div v-if="form.reference" class="discovery-item">
                      <span class="info-label">RÉFÉRENCE</span>
                      <span class="info-val info-val--code">{{ form.reference }}</span>
                    </div>
                    <div v-if="form.discovery_method" class="discovery-item">
                      <span class="info-label">MÉTHODE</span>
                      <span class="info-val">{{ form.discovery_method }}</span>
                    </div>
                  </div>
                </div>
                <div v-if="previewTab === 'notes'" class="modal-tab-content">
                  <div class="notes-banner">⚠ ACCÈS RESTREINT — LECTURE ENREGISTRÉE</div>
                  <div class="notes-content">
                    <p v-if="form.notes">{{ form.notes }}</p>
                    <p v-else class="empty-msg">Aucune note interne.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ═══════════ MODAL ÉDITER PROFIL MEMBRE ═══════════ -->
    <Teleport to="body">
      <div v-if="showEditMembre" class="modal-overlay" @click.self="fermerEditMembre">
        <div class="modal-panel modal-panel--sm">
          <div class="modal-rarity-bar" style="background: #c9a84c"></div>
          <div class="modal-header">
            <h2 class="modal-title">ÉDITER LE PROFIL</h2>
            <button class="modal-close" @click="fermerEditMembre">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">PHOTO URL</label>
              <div class="upload-row">
                <input class="form-input" v-model="editMembreForm.photo_url" placeholder="https://… ou uploader ci-dessous" />
                <label class="btn-upload" :class="{ loading: uploadingMembreImage }">
                  <input type="file" accept="image/*" style="display:none" @change="handleMembreImageUpload" :disabled="uploadingMembreImage" />
                  {{ uploadingMembreImage ? '…' : '↑' }}
                </label>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">GRADE</label>
              <input class="form-input" v-model="editMembreForm.grade" placeholder="Ex: Archiviste des Âmes" />
            </div>
            <div class="form-group">
              <label class="form-label">DESCRIPTION</label>
              <textarea class="form-input form-textarea" v-model="editMembreForm.description" rows="4" placeholder="Description courte du membre…"></textarea>
            </div>
            <div class="modal-footer-actions">
              <button class="btn-ghost" @click="fermerEditMembre">Annuler</button>
              <button class="btn-primary" @click="sauvegarderProfilMembre">Sauvegarder</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ═══════════ MODAL AJOUTER MEMBRE ═══════════ -->
    <Teleport to="body">
      <div v-if="showAddMembre" class="modal-overlay" @click.self="fermerAddMembre">
        <div class="modal-panel modal-panel--sm">
          <div class="modal-rarity-bar" style="background: #9f5fd4"></div>
          <div class="modal-header">
            <h2 class="modal-title">AJOUTER UN MEMBRE</h2>
            <button class="modal-close" @click="fermerAddMembre">✕</button>
          </div>
          <div class="modal-body">

            <!-- Recherche -->
            <div class="form-group">
              <label class="form-label">RECHERCHER</label>
              <input
                ref="addMembreInput"
                class="form-input"
                v-model="addMembreSearch"
                placeholder="Nom ou identifiant…"
                autocomplete="off"
              />
            </div>

            <!-- Liste résultats -->
            <div class="membre-search-list">
              <div v-if="!addMembreSearch.trim()" class="membre-search-hint">Tapez pour rechercher un utilisateur</div>
              <div v-else-if="usersSuggestions.length === 0" class="membre-search-hint">Aucun résultat</div>
              <div
                v-for="u in usersSuggestions"
                :key="u.id"
                class="membre-search-row"
                :class="{ selected: addMembreSelected?.id === u.id }"
                @click="selectUser(u)"
              >
                <div class="membre-avatar-sm">{{ u.nom[0].toUpperCase() }}</div>
                <div class="membre-search-info">
                  <span class="membre-search-nom">{{ u.nom }}</span>
                  <span class="membre-search-ident">@{{ u.identifiant }}</span>
                </div>
                <span v-if="addMembreSelected?.id === u.id" class="membre-check">✓</span>
              </div>
            </div>

            <!-- Niveau -->
            <div class="form-group" style="margin-top:1rem">
              <label class="form-label">RANG ATTRIBUÉ</label>
              <div class="niveau-picker">
                <button
                  v-for="n in [1,2,3,4,5]"
                  :key="n"
                  class="niveau-pick-btn"
                  :class="{ active: addMembreNiveau === n }"
                  :style="addMembreNiveau === n ? { borderColor: NIVEAU_COLORS[n], color: NIVEAU_COLORS[n], background: NIVEAU_COLORS[n] + '22' } : {}"
                  @click="addMembreNiveau = n"
                >
                  <span class="niveau-pick-num">NV.{{ n }}</span>
                  <span class="niveau-pick-label">{{ niveauLabels[n] }}</span>
                </button>
              </div>
            </div>

            <div class="modal-footer-actions">
              <button class="btn-ghost" @click="fermerAddMembre">Annuler</button>
              <button class="btn-primary" :disabled="!addMembreSelected" @click="ajouterMembre">
                {{ addMembreSelected ? `Ajouter ${addMembreSelected.nom}` : 'Sélectionner un utilisateur' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import AppNavbar from './AppNavbar.vue'
import { currentUser } from '../auth.js'
import {
  mythiquesMe,
  mythiquesStats,
  mythiquesObjets,
  mythiquesConfig,
  mythiquesUpdateConfig,
  mythiquesMembres,
  mythiquesAdminObjets,
  mythiquesAdminCreateObjet,
  mythiquesAdminUpdateObjet,
  mythiquesAdminDeleteObjet,
  mythiquesAdminMembres,
  mythiquesAdminAddMembre,
  mythiquesAdminUpdateMembre,
  mythiquesAdminUpdateMembreProfile,
  mythiquesAdminDeleteMembre,
  mythiquesAdminUsers,
  mythiquesAdminStats,
  uploadImage,
  IMG_BASE,
} from '../api.js'

// ── Constantes ────────────────────────────────────────────────────────────────

const NIVEAU_COLORS = { 1: '#8b9ba8', 2: '#4a90c4', 3: '#c9a84c', 4: '#c47c3a', 5: '#9f5fd4' }
const niveauLabels = ref({ 1: 'RANG I', 2: 'RANG II', 3: 'RANG III', 4: 'RANG IV', 5: 'RANG SUPRÊME' })
const RARETE_OPTIONS = [
  { value: 'COMMUN',    color: '#6b7280' },
  { value: 'RARE',      color: '#4a90c4' },
  { value: 'ÉPIQUE',    color: '#a855f7' },
  { value: 'LÉGENDAIRE', color: '#f59e0b' },
  { value: 'DIVIN',     color: '#ec4899' },
  { value: '???',       color: '#ffffff' },
]
const STATUT_OPTIONS = [
  { value: 'ACQUIS',     color: '#22c55e' },
  { value: 'ACTIF',      color: '#4a90c4' },
  { value: 'EN TRANSIT', color: '#f59e0b' },
  { value: 'SCELLÉ',     color: '#8b5cf6' },
  { value: 'DÉTRUIT',    color: '#ef4444' },
  { value: 'INCONNU',    color: '#6b7280' },
]
const DANGER_OPTIONS = [
  { value: 'NUL',      color: '#22c55e' },
  { value: 'FAIBLE',   color: '#84cc16' },
  { value: 'MODÉRÉ',   color: '#f59e0b' },
  { value: 'ÉLEVÉ',    color: '#f97316' },
  { value: 'EXTRÊME',  color: '#ef4444' },
  { value: 'INCONNU',  color: '#6b7280' },
]

// ── State ─────────────────────────────────────────────────────────────────────

const loading = ref(true)
const me = ref(null)
const stats = ref({ catalogues: 0, acquis: 0, membres: 0 })
const objets = ref([])
const membres = ref([])
const adminObjets = ref([])
const adminMembres = ref([])
const adminStats = ref({ total: 0, acquis: 0, membres: 0, parRarity: [], parNiveau: [] })
const allUsers = ref([])

const showEditMembre = ref(false)
const editMembreUserId = ref(null)
const editMembreForm = ref({ photo_url: '', grade: '', description: '' })
const uploadingMembreImage = ref(false)

const mainTab = ref('catalogue')
const adminTab = ref('objets')
const recherche = ref('')
const filtreStatut = ref('')

const modalObjet = ref(null)
const modalTab = ref('fiche')

const editeurOuvert = ref(false)
const editeurObjetId = ref(null)
const previewTab = ref('fiche')

const showAddMembre = ref(false)
const addMembreSearch = ref('')
const addMembreSelected = ref(null)
const addMembreNiveau = ref(1)
const addMembreInput = ref(null)

const toast = ref({ visible: false, message: '', type: 'success' })
const configForm = ref({ 1: 'RANG I', 2: 'RANG II', 3: 'RANG III', 4: 'RANG IV', 5: 'RANG SUPRÊME' })
const uploadingImage = ref(false)

// ── Computed ──────────────────────────────────────────────────────────────────

const niveauColor = computed(() => NIVEAU_COLORS[me.value?.niveau] || '#8b9ba8')
const niveauLabel = computed(() => niveauLabels.value[me.value?.niveau] || 'RANG I')

const objetsFiltres = computed(() => {
  let list = objets.value
  if (filtreStatut.value) {
    list = list.filter(o => !o.locked && o.status === filtreStatut.value)
  }
  if (recherche.value.trim()) {
    const q = recherche.value.trim().toLowerCase()
    list = list.filter(o => {
      if (o.locked) return o.name.toLowerCase().includes(q) || (o.type || '').toLowerCase().includes(q)
      return (
        o.name.toLowerCase().includes(q) ||
        (o.type || '').toLowerCase().includes(q) ||
        (Array.isArray(o.tags) ? o.tags.some(t => t.toLowerCase().includes(q)) : false)
      )
    })
  }
  return list
})

const formTagsStr = ref('')
const membreIds = computed(() => new Set(adminMembres.value.map(m => m.user_id)))

const usersSuggestions = computed(() => {
  const q = addMembreSearch.value.trim().toLowerCase()
  if (!q) return []
  return allUsers.value
    .filter(u => !membreIds.value.has(u.id) && (u.nom.toLowerCase().includes(q) || u.identifiant.toLowerCase().includes(q)))
    .slice(0, 6)
})

const formTags = computed(() => {
  return formTagsStr.value
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
})

const form = ref({
  name: '', type: '', min_level: 1,
  rarity: 'COMMUN', rarity_color: '#6b7280',
  status: 'INCONNU', status_color: '#6b7280',
  danger: 'INCONNU', danger_color: '#6b7280',
  image_url: '', description: '', tags: [],
  location: '', acquired: '', notes: '',
  discovered_by: '', reference: '', discovery_method: '', origin: '',
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function showToast(message, type = 'success') {
  toast.value = { visible: true, message, type }
  setTimeout(() => { toast.value.visible = false }, 3000)
}

function formatDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function onRarityChange() {
  const opt = RARETE_OPTIONS.find(r => r.value === form.value.rarity)
  if (opt) form.value.rarity_color = opt.color
}

function onStatusChange() {
  const opt = STATUT_OPTIONS.find(s => s.value === form.value.status)
  if (opt) form.value.status_color = opt.color
}

function onDangerChange() {
  const opt = DANGER_OPTIONS.find(d => d.value === form.value.danger)
  if (opt) form.value.danger_color = opt.color
}

async function handleImageUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  uploadingImage.value = true
  try {
    const url = await uploadImage(file)
    form.value.image_url = `${IMG_BASE}${url}`
  } catch (e) {
    showToast('Erreur upload image.', 'error')
  } finally {
    uploadingImage.value = false
    event.target.value = ''
  }
}

// ── Chargement ────────────────────────────────────────────────────────────────

async function chargerBase() {
  try {
    const [meData, statsData, objetsData, configData, membresData] = await Promise.all([
      mythiquesMe(),
      mythiquesStats(),
      mythiquesObjets(),
      mythiquesConfig(),
      mythiquesMembres(),
    ])
    me.value = meData
    stats.value = statsData
    objets.value = objetsData
    membres.value = membresData
    if (configData) {
      niveauLabels.value = {
        1: configData.niveau_1 || 'RANG I',
        2: configData.niveau_2 || 'RANG II',
        3: configData.niveau_3 || 'RANG III',
        4: configData.niveau_4 || 'RANG IV',
        5: configData.niveau_5 || 'RANG SUPRÊME',
      }
      configForm.value = { ...niveauLabels.value }
    }
  } catch (e) {
    console.error('Erreur chargement mythiques:', e)
  } finally {
    loading.value = false
  }
}

async function chargerAdmin() {
  try {
    const [ao, am, as_, au] = await Promise.all([
      mythiquesAdminObjets(),
      mythiquesAdminMembres(),
      mythiquesAdminStats(),
      mythiquesAdminUsers(),
    ])
    adminObjets.value = ao
    adminMembres.value = am
    adminStats.value = as_
    allUsers.value = au
  } catch (e) {
    console.error('Erreur chargement admin mythiques:', e)
  }
}

onMounted(async () => {
  await chargerBase()
  if (me.value?.niveau >= 5 || me.value?.dirigeant) {
    await chargerAdmin()
  }
})

async function sauvegarderConfig() {
  try {
    const data = {
      niveau_1: configForm.value[1],
      niveau_2: configForm.value[2],
      niveau_3: configForm.value[3],
      niveau_4: configForm.value[4],
      niveau_5: configForm.value[5],
    }
    await mythiquesUpdateConfig(data)
    niveauLabels.value = { ...configForm.value }
    showToast('Configuration sauvegardée.')
  } catch (e) {
    showToast('Erreur lors de la sauvegarde.', 'error')
  }
}

// ── Modal détail ──────────────────────────────────────────────────────────────

function openModal(objet) {
  modalObjet.value = objet
  modalTab.value = 'fiche'
}

function closeModal() {
  modalObjet.value = null
}

// ── Éditeur ───────────────────────────────────────────────────────────────────

function ouvrirEditeur(objet) {
  editeurObjetId.value = objet?.id || null
  previewTab.value = 'fiche'
  if (objet) {
    form.value = {
      name: objet.name || '',
      type: objet.type || '',
      min_level: objet.min_level || 1,
      rarity: objet.rarity || 'COMMUN',
      rarity_color: objet.rarity_color || '#6b7280',
      status: objet.status || 'INCONNU',
      status_color: objet.status_color || '#6b7280',
      danger: objet.danger || 'INCONNU',
      danger_color: objet.danger_color || '#6b7280',
      image_url: objet.image_url || '',
      description: objet.description || '',
      tags: Array.isArray(objet.tags) ? objet.tags : [],
      location: objet.location || '',
      acquired: objet.acquired || '',
      notes: objet.notes || '',
      discovered_by: objet.discovered_by || '',
      reference: objet.reference || '',
      discovery_method: objet.discovery_method || '',
      origin: objet.origin || '',
    }
    formTagsStr.value = Array.isArray(objet.tags) ? objet.tags.join(', ') : ''
  } else {
    form.value = {
      name: '', type: '', min_level: 1,
      rarity: 'COMMUN', rarity_color: '#6b7280',
      status: 'INCONNU', status_color: '#6b7280',
      danger: 'INCONNU', danger_color: '#6b7280',
      image_url: '', description: '', tags: [],
      location: '', acquired: '', notes: '',
      discovered_by: '', reference: '', discovery_method: '', origin: '',
    }
    formTagsStr.value = ''
  }
  editeurOuvert.value = true
}

function fermerEditeur() {
  editeurOuvert.value = false
  editeurObjetId.value = null
}

async function sauvegarderObjet() {
  if (!form.value.name || !form.value.description) return
  try {
    const payload = { ...form.value, tags: formTags.value }
    if (editeurObjetId.value) {
      await mythiquesAdminUpdateObjet(editeurObjetId.value, payload)
      showToast('Artefact modifié avec succès.')
    } else {
      await mythiquesAdminCreateObjet(payload)
      showToast('Artefact créé avec succès.')
    }
    fermerEditeur()
    await Promise.all([
      chargerAdmin(),
      mythiquesObjets().then(d => { objets.value = d }),
      mythiquesStats().then(d => { stats.value = d }),
    ])
  } catch (e) {
    showToast(e.message || 'Erreur lors de la sauvegarde.', 'error')
  }
}

async function supprimerObjet(obj) {
  if (!confirm(`Supprimer "${obj.name}" ? Cette action est irréversible.`)) return
  try {
    await mythiquesAdminDeleteObjet(obj.id)
    showToast('Artefact supprimé.')
    await Promise.all([
      chargerAdmin(),
      mythiquesObjets().then(d => { objets.value = d }),
      mythiquesStats().then(d => { stats.value = d }),
    ])
  } catch (e) {
    showToast(e.message || 'Erreur lors de la suppression.', 'error')
  }
}

// ── Gestion membres ───────────────────────────────────────────────────────────

function fermerAddMembre() {
  showAddMembre.value = false
  addMembreSearch.value = ''
  addMembreSelected.value = null
  addMembreNiveau.value = 1
}

function selectUser(u) {
  addMembreSelected.value = addMembreSelected.value?.id === u.id ? null : u
}

async function ajouterMembre() {
  if (!addMembreSelected.value) return
  try {
    await mythiquesAdminAddMembre(addMembreSelected.value.id, addMembreNiveau.value)
    showToast(`${addMembreSelected.value.nom} ajouté au rang ${niveauLabels.value[addMembreNiveau.value]}.`)
    fermerAddMembre()
    await Promise.all([
      mythiquesAdminMembres().then(d => { adminMembres.value = d }),
      mythiquesAdminStats().then(d => { adminStats.value = d }),
      mythiquesStats().then(d => { stats.value = d }),
    ])
  } catch (e) {
    showToast(e.message || 'Erreur lors de l\'ajout.', 'error')
  }
}

async function changerNiveauMembre(userId, niveau) {
  try {
    await mythiquesAdminUpdateMembre(userId, parseInt(niveau))
    showToast('Niveau modifié.')
    const d = await mythiquesAdminMembres()
    adminMembres.value = d
    const s = await mythiquesAdminStats()
    adminStats.value = s
  } catch (e) {
    showToast(e.message || 'Erreur.', 'error')
  }
}

async function supprimerMembre(m) {
  if (!confirm(`Retirer ${m.nom} des membres Mythiques ?`)) return
  try {
    await mythiquesAdminDeleteMembre(m.user_id)
    showToast(`${m.nom} retiré.`)
    await Promise.all([
      mythiquesAdminMembres().then(d => { adminMembres.value = d }),
      mythiquesAdminStats().then(d => { adminStats.value = d }),
      mythiquesStats().then(d => { stats.value = d }),
    ])
  } catch (e) {
    showToast(e.message || 'Erreur.', 'error')
  }
}

// ── Édition profil membre ──────────────────────────────────────────────────────

function ouvrirEditMembre(m) {
  editMembreUserId.value = m.user_id
  editMembreForm.value = {
    photo_url: m.photo_url || '',
    grade: m.grade || '',
    description: m.description || '',
  }
  showEditMembre.value = true
}

function fermerEditMembre() {
  showEditMembre.value = false
  editMembreUserId.value = null
  editMembreForm.value = { photo_url: '', grade: '', description: '' }
}

async function handleMembreImageUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  uploadingMembreImage.value = true
  try {
    const url = await uploadImage(file)
    editMembreForm.value.photo_url = `${IMG_BASE}${url}`
  } catch (e) {
    showToast('Erreur upload image.', 'error')
  } finally {
    uploadingMembreImage.value = false
    event.target.value = ''
  }
}

async function sauvegarderProfilMembre() {
  if (!editMembreUserId.value) return
  try {
    await mythiquesAdminUpdateMembreProfile(editMembreUserId.value, editMembreForm.value)
    showToast('Profil mis à jour.')
    fermerEditMembre()
    const d = await mythiquesAdminMembres()
    adminMembres.value = d
    const m = await mythiquesMembres()
    membres.value = m
  } catch (e) {
    showToast(e.message || 'Erreur.', 'error')
  }
}
</script>

<style scoped>
/* ── Base ──────────────────────────────────────────────────────────────────── */
.page-mythiques {
  min-height: 100vh;
  background: #06050e;
  background-image:
    radial-gradient(ellipse 80% 50% at 50% -10%, rgba(80, 40, 140, 0.18) 0%, transparent 70%),
    radial-gradient(ellipse 60% 40% at 80% 100%, rgba(60, 20, 100, 0.12) 0%, transparent 60%);
  color: #e2dcd6;
  font-family: 'Crimson Text', Georgia, serif;
}

.page-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem 2rem 4rem;
}

/* ── Toast ─────────────────────────────────────────────────────────────────── */
.toast {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  padding: 0.75rem 1.25rem;
  font-family: 'Cinzel', serif;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  z-index: 9999;
  border: 1px solid;
}
.toast--success { background: rgba(13,25,13,0.95); border-color: rgba(34,197,94,0.5); color: #22c55e; backdrop-filter: blur(4px); }
.toast--error   { background: rgba(25,10,10,0.95); border-color: rgba(139,26,26,0.5); color: #ef4444; backdrop-filter: blur(4px); }
.toast-enter-active, .toast-leave-active { transition: opacity 0.3s, transform 0.3s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(10px); }

/* ── Header ────────────────────────────────────────────────────────────────── */
.header {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 2.5rem 0 2rem;
  border-bottom: 1px solid rgba(180, 140, 60, 0.18);
  margin-bottom: 2rem;
  flex-wrap: wrap;
  position: relative;
}
.header::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 120px;
  height: 1px;
  background: linear-gradient(to right, rgba(201,168,76,0.6), transparent);
}

.header-label {
  font-family: 'Cinzel Decorative', 'Cinzel', serif;
  font-size: 1.35rem;
  color: #e8e0cc;
  letter-spacing: 0.12em;
  margin: 0;
  text-shadow: 0 0 40px rgba(201,168,76,0.2);
}

.header-subtitle {
  font-family: 'Cinzel', serif;
  font-size: 0.6rem;
  color: rgba(201,168,76,0.5);
  letter-spacing: 0.28em;
  margin: 0.25rem 0 0;
  text-transform: uppercase;
}

.header-badge {
  font-family: 'Cinzel', serif;
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  padding: 0.35rem 1rem;
  border: 1px solid;
  flex-shrink: 0;
  background: rgba(255,255,255,0.02);
  text-shadow: 0 0 20px currentColor;
}

.header-stats {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  margin-left: auto;
}

.stat-box {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.stat-val {
  font-family: 'Cinzel', serif;
  font-size: 1.5rem;
  color: #e8e0cc;
  line-height: 1;
  text-shadow: 0 0 30px rgba(201,168,76,0.3);
}
.stat-lbl {
  font-size: 0.52rem;
  font-family: 'Cinzel', serif;
  letter-spacing: 0.18em;
  color: rgba(201,168,76,0.45);
  margin-top: 0.25rem;
}
.stat-sep {
  width: 1px;
  height: 32px;
  background: linear-gradient(to bottom, transparent, rgba(201,168,76,0.2), transparent);
}

/* ── Tabs ──────────────────────────────────────────────────────────────────── */
.tabs-bar {
  display: flex;
  gap: 0;
  border-bottom: 1px solid rgba(180,140,60,0.15);
  margin-bottom: 2rem;
}
.tabs-bar--sub  { margin-top: 1.2rem; border-color: rgba(255,255,255,0.06); }
.tabs-bar--modal { border-color: rgba(180,140,60,0.12); }

.tab-btn {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.18em;
  color: rgba(201,168,76,0.3);
  background: none;
  border: none;
  border-bottom: 1px solid transparent;
  padding: 0.7rem 1.4rem;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
  margin-bottom: -1px;
}
.tab-btn:hover { color: rgba(201,168,76,0.65); }
.tab-btn.active { color: #c9a84c; border-bottom-color: #c9a84c; }
.tab-btn--sub { font-size: 0.6rem; color: rgba(255,255,255,0.3); }
.tab-btn--sub.active { color: rgba(255,255,255,0.75); border-bottom-color: rgba(255,255,255,0.3); }
.tab-btn--modal { font-size: 0.6rem; padding: 0.5rem 0.9rem; }

/* ── Catalogue toolbar ─────────────────────────────────────────────────────── */
.catalogue-toolbar {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.75rem;
  flex-wrap: wrap;
}

.search-input, .status-select {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(180,140,60,0.15);
  color: #e2dcd6;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  padding: 0.55rem 1rem;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
}
.search-input { flex: 1; min-width: 200px; }
.search-input::placeholder { color: rgba(201,168,76,0.25); }
.search-input:focus, .status-select:focus {
  border-color: rgba(201,168,76,0.4);
  background: rgba(201,168,76,0.03);
}
.status-select { cursor: pointer; }
.status-select option { background: #0c0a14; }

/* ── Grille objets ─────────────────────────────────────────────────────────── */
.objets-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.2rem;
}
@media (max-width: 900px) { .objets-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) { .objets-grid { grid-template-columns: 1fr; } }

.loading-msg, .empty-msg {
  font-family: 'Cinzel', serif;
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  color: rgba(201,168,76,0.25);
  text-align: center;
  padding: 4rem 0;
}

/* ── Carte objet ───────────────────────────────────────────────────────────── */
.objet-card {
  background: linear-gradient(160deg, #0f0c1a 0%, #0a0814 100%);
  border: 1px solid rgba(180,140,60,0.12);
  position: relative;
  overflow: hidden;
  transition: border-color 0.3s, box-shadow 0.3s;
  cursor: pointer;
}
.objet-card:not(.locked):hover {
  border-color: color-mix(in srgb, var(--rarity-color) 55%, transparent);
  box-shadow: 0 0 24px color-mix(in srgb, var(--rarity-color) 12%, transparent),
              inset 0 0 40px rgba(201,168,76,0.02);
}
.objet-card.locked { cursor: default; }

.card-rarity-bar {
  height: 2px;
  width: 100%;
  opacity: 0.9;
}
.objet-card:not(.locked):hover .card-rarity-bar {
  box-shadow: 0 0 8px var(--rarity-color);
}

.card-content { position: relative; }
.card-content.blurred { filter: blur(5px) brightness(0.6); pointer-events: none; }

.card-image {
  height: 170px;
  overflow: hidden;
  position: relative;
}
.card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s ease;
}
.objet-card:not(.locked):hover .card-image img { transform: scale(1.04); }
.card-image-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, #0f0c1a 0%, rgba(10,8,20,0.3) 55%, transparent 100%);
}
.card-image--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at center, rgba(80,40,120,0.15) 0%, rgba(10,8,20,0.8) 100%);
}
.placeholder-icon {
  font-size: 2.5rem;
  opacity: 0.15;
  filter: grayscale(1);
}

.card-body {
  padding: 0.8rem 1rem 1rem;
}

.card-badges {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

.badge {
  font-family: 'Cinzel', serif;
  font-size: 0.52rem;
  letter-spacing: 0.1em;
  padding: 0.2rem 0.55rem;
  border: 1px solid;
  white-space: nowrap;
  background: rgba(255,255,255,0.02);
}
.badge--sm { font-size: 0.48rem; padding: 0.12rem 0.4rem; }
.badge--level { background: rgba(255,255,255,0.03) !important; color: rgba(201,168,76,0.35) !important; border-color: rgba(201,168,76,0.15) !important; }

.card-name {
  font-family: 'Cinzel', serif;
  font-size: 0.88rem;
  color: #e8e0cc;
  margin: 0 0 0.2rem;
  letter-spacing: 0.07em;
}
.card-type {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.9rem;
  font-style: italic;
  color: rgba(201,168,76,0.4);
  margin: 0 0 0.55rem;
}
.card-desc {
  font-size: 0.97rem;
  color: rgba(226,220,214,0.5);
  margin: 0 0 0.65rem;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.55;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.tag {
  font-family: 'Cinzel', serif;
  font-size: 0.48rem;
  letter-spacing: 0.1em;
  padding: 0.14rem 0.48rem;
  background: rgba(201,168,76,0.04);
  border: 1px solid rgba(201,168,76,0.12);
  color: rgba(201,168,76,0.45);
}

/* ── Overlay lock ──────────────────────────────────────────────────────────── */
.lock-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at center, rgba(30,15,60,0.7) 0%, rgba(6,5,14,0.82) 100%);
  gap: 0.6rem;
}
.lock-icon {
  font-size: 1.8rem;
  opacity: 0.5;
  filter: drop-shadow(0 0 8px rgba(201,168,76,0.3));
}
.lock-text {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.2em;
  color: rgba(201,168,76,0.5);
}

/* ── Modal détail ──────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(4, 3, 10, 0.9);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-panel {
  background: linear-gradient(160deg, #0f0b1e 0%, #0a0818 100%);
  border: 1px solid rgba(180,140,60,0.2);
  box-shadow: 0 0 60px rgba(80,40,140,0.2), inset 0 1px 0 rgba(201,168,76,0.08);
  width: 100%;
  max-width: 720px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}
.modal-panel--sm { max-width: 480px; }

.modal-rarity-bar { height: 2px; }

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.4rem 1.6rem 0.8rem;
  gap: 1rem;
}
.modal-header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.modal-title {
  font-family: 'Cinzel', serif;
  font-size: 1.1rem;
  color: #e8e0cc;
  margin: 0;
  letter-spacing: 0.08em;
}
.modal-type {
  font-style: italic;
  color: rgba(201,168,76,0.45);
  font-size: 0.95rem;
  margin: 0.2rem 0 0;
}

.modal-close {
  background: none;
  border: none;
  color: rgba(201,168,76,0.35);
  font-size: 1rem;
  cursor: pointer;
  padding: 0.2rem 0.5rem;
  transition: color 0.15s;
}
.modal-close:hover { color: rgba(201,168,76,0.8); }

.tabs-bar--modal { padding: 0 1.6rem; margin-bottom: 0; }

.modal-body { padding: 1.3rem 1.6rem; }

.modal-tab-content { animation: fadeIn 0.18s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

.modal-fiche-layout {
  display: flex;
  gap: 1.6rem;
  flex-wrap: wrap;
}

.modal-image-wrap {
  flex-shrink: 0;
}
.modal-image {
  width: 200px;
  max-width: 100%;
  border: 1px solid rgba(180,140,60,0.15);
  object-fit: cover;
}

.modal-fiche-infos { flex: 1; min-width: 200px; }

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.8rem 1.2rem;
  margin-bottom: 1.1rem;
}
.info-item { display: flex; flex-direction: column; gap: 0.18rem; }
.info-label {
  font-family: 'Cinzel', serif;
  font-size: 0.5rem;
  letter-spacing: 0.16em;
  color: rgba(201,168,76,0.35);
}
.info-val {
  font-size: 0.95rem;
  color: rgba(226,220,214,0.75);
}
.info-val--code {
  font-family: monospace;
  font-size: 0.82rem;
  color: rgba(201,168,76,0.65);
  background: rgba(201,168,76,0.05);
  padding: 0.12rem 0.5rem;
  letter-spacing: 0.08em;
  border: 1px solid rgba(201,168,76,0.1);
}

.modal-desc {
  font-size: 1rem;
  line-height: 1.65;
  color: rgba(226,220,214,0.65);
  margin-bottom: 0.8rem;
}

.discovery-grid { display: flex; flex-direction: column; gap: 1.1rem; }
.discovery-item { display: flex; flex-direction: column; gap: 0.22rem; }

/* ── Notes internes — bandeau clignotant ─────────────────────────────────── */
.notes-banner {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.2em;
  color: #ef4444;
  background: rgba(139, 26, 26, 0.06);
  border: 1px solid rgba(139, 26, 26, 0.3);
  padding: 0.6rem 1rem;
  margin-bottom: 1.2rem;
  animation: pulseBanner 2.5s ease-in-out infinite;
  text-align: center;
}
@keyframes pulseBanner {
  0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(139,26,26,0.2); }
  50% { opacity: 0.45; box-shadow: none; }
}

.notes-content {
  font-size: 1rem;
  line-height: 1.6;
  color: rgba(255,255,255,0.65);
  margin-bottom: 1rem;
}
.notes-danger-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 0.75rem;
}

.modal-footer-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1.2rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255,255,255,0.06);
}

/* ── Éditeur split-screen ──────────────────────────────────────────────────── */
.editeur-overlay {
  position: fixed;
  inset: 0;
  background: #06050e;
  z-index: 2000;
  display: flex;
  flex-direction: column;
}

.editeur-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.6rem;
  background: rgba(201,168,76,0.03);
  border-bottom: 1px solid rgba(180,140,60,0.15);
  flex-shrink: 0;
}

.editeur-title {
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  letter-spacing: 0.18em;
  color: rgba(201,168,76,0.6);
}

.editeur-actions {
  display: flex;
  gap: 0.75rem;
}

.editeur-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.editeur-form {
  width: 50%;
  overflow-y: auto;
  padding: 1.5rem;
  border-right: 1px solid rgba(180,140,60,0.1);
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.editeur-preview {
  width: 50%;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.preview-title {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.15em;
  color: rgba(255,255,255,0.3);
  margin: 0 0 0.6rem;
}

.preview-card-wrap { max-width: 320px; }
.preview-card { cursor: default !important; }
.preview-card:hover { border-color: rgba(255,255,255,0.06) !important; }

.preview-sep {
  height: 1px;
  background: rgba(255,255,255,0.06);
  margin: 0.5rem 0;
}

.preview-fiche {
  background: linear-gradient(160deg, #0f0b1e 0%, #0a0818 100%);
  border: 1px solid rgba(180,140,60,0.12);
}

.preview-modal-body { padding: 0.8rem 1rem; }

/* ── Formulaire ────────────────────────────────────────────────────────────── */
.form-group { display: flex; flex-direction: column; gap: 0.3rem; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

.form-label {
  font-family: 'Cinzel', serif;
  font-size: 0.5rem;
  letter-spacing: 0.16em;
  color: rgba(201,168,76,0.4);
}

.form-input {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(180,140,60,0.12);
  color: #e2dcd6;
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 1rem;
  padding: 0.5rem 0.85rem;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
  width: 100%;
  box-sizing: border-box;
}
.form-input:focus { border-color: rgba(201,168,76,0.35); background: rgba(201,168,76,0.02); }
.form-input option { background: #0a0816; }
.form-textarea { resize: vertical; min-height: 80px; }

.upload-row {
  display: flex;
  gap: 0.5rem;
}
.upload-row .form-input { flex: 1; }
.btn-upload {
  background: rgba(201,168,76,0.12);
  border: 1px solid rgba(201,168,76,0.35);
  color: #c9a84c;
  font-family: 'Cinzel', serif;
  font-size: 0.85rem;
  padding: 0 0.9rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.2s;
}
.btn-upload:hover { background: rgba(201,168,76,0.22); }
.btn-upload.loading { opacity: 0.5; cursor: not-allowed; }

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 1rem;
  margin-top: 0.5rem;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.editeur-close {
  margin-left: auto;
  font-size: 0.8rem;
}

/* ── Admin sections ────────────────────────────────────────────────────────── */
.admin-section { }

.admin-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.admin-list { display: flex; flex-direction: column; gap: 0.4rem; }

.admin-list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255,255,255,0.015);
  border: 1px solid rgba(180,140,60,0.08);
  padding: 0.65rem 1rem;
  gap: 1rem;
  flex-wrap: wrap;
  transition: border-color 0.2s;
}
.admin-list-row:hover { border-color: rgba(180,140,60,0.15); }

.admin-row-info {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
}

.admin-row-name {
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  color: #e2dcd6;
  letter-spacing: 0.05em;
}
.admin-row-type {
  font-style: italic;
  font-size: 0.85rem;
  color: rgba(201,168,76,0.35);
}
.admin-row-level {
  font-family: 'Cinzel', serif;
  font-size: 0.55rem;
  color: rgba(201,168,76,0.3);
  letter-spacing: 0.1em;
}
.admin-row-ident {
  font-size: 0.82rem;
  color: rgba(201,168,76,0.3);
  font-family: monospace;
}

.admin-row-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.avatar-initial {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Cinzel', serif;
  font-size: 0.7rem;
  border: 1px solid;
  flex-shrink: 0;
}

.inline-select {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(180,140,60,0.12);
  color: rgba(201,168,76,0.6);
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  outline: none;
}
.inline-select option { background: #0a0816; }

/* ── Statistiques ──────────────────────────────────────────────────────────── */
.stats-grid { display: flex; flex-direction: column; gap: 2rem; }

.stats-counter-row {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}
.stats-counter {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.stats-counter-val {
  font-family: 'Cinzel', serif;
  font-size: 2rem;
  color: #fff;
  line-height: 1;
}
.stats-counter-lbl {
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  color: rgba(255,255,255,0.3);
}

.stats-section { }
.stats-title {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.15em;
  color: rgba(255,255,255,0.3);
  margin: 0 0 0.75rem;
}

.stats-bar-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}
.stats-bar-label {
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  width: 100px;
  flex-shrink: 0;
}
.stats-bar-track {
  flex: 1;
  height: 3px;
  background: rgba(201,168,76,0.07);
  overflow: hidden;
}
.stats-bar-fill {
  height: 100%;
  transition: width 0.5s ease;
}
.stats-bar-count {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  color: rgba(255,255,255,0.4);
  width: 24px;
  text-align: right;
  flex-shrink: 0;
}

/* ── Config ────────────────────────────────────────────────────────────────── */
.config-view {
  padding: 1.5rem 0;
}
.config-section {
  background: rgba(15,10,30,0.7);
  border: 1px solid rgba(201,168,76,0.2);
  padding: 2rem;
  max-width: 600px;
}
.config-title {
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  color: #c9a84c;
  margin: 0 0 0.5rem;
}
.config-hint {
  font-size: 0.72rem;
  color: rgba(226,220,214,0.5);
  margin: 0 0 1.5rem;
}
.config-fields {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}
.config-field-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.config-level-badge {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  border: 1px solid;
  padding: 0.2rem 0.5rem;
  width: 48px;
  text-align: center;
  flex-shrink: 0;
}
.config-input {
  flex: 1;
}
.config-preview {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  width: 110px;
  text-align: right;
  flex-shrink: 0;
  opacity: 0.8;
}
.config-actions {
  display: flex;
  justify-content: flex-end;
}

/* ── Boutons ───────────────────────────────────────────────────────────────── */
.btn-primary {
  background: rgba(139,26,26,0.85);
  border: 1px solid rgba(160,32,32,0.7);
  color: #f0e8e0;
  font-family: 'Cinzel', serif;
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  padding: 0.55rem 1.2rem;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
}
.btn-primary:hover:not(:disabled) {
  background: rgba(160,32,32,0.9);
  border-color: rgba(180,40,40,0.8);
  box-shadow: 0 0 12px rgba(139,26,26,0.3);
}
.btn-primary:disabled { opacity: 0.35; cursor: not-allowed; }

.btn-ghost {
  background: transparent;
  border: 1px solid rgba(180,140,60,0.18);
  color: rgba(201,168,76,0.5);
  font-family: 'Cinzel', serif;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  padding: 0.4rem 0.9rem;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}
.btn-ghost:hover { background: rgba(201,168,76,0.05); color: rgba(201,168,76,0.85); border-color: rgba(201,168,76,0.35); }
.btn-ghost--danger { border-color: rgba(139,26,26,0.3); color: rgba(192,57,43,0.65); }
.btn-ghost--danger:hover { background: rgba(139,26,26,0.08); color: #c02020; border-color: rgba(139,26,26,0.5); }

/* ── Suggestions autocomplete ──────────────────────────────────────────────── */
.form-group { position: relative; }

/* ── Recherche membre ──────────────────────────────────────────────────────── */
.membre-search-list {
  border: 1px solid rgba(255,255,255,0.07);
  background: rgba(0,0,0,0.3);
  max-height: 200px;
  overflow-y: auto;
  margin-top: 0.5rem;
}
.membre-search-hint {
  padding: 0.9rem;
  font-size: 0.75rem;
  color: rgba(226,220,214,0.3);
  text-align: center;
  font-family: 'Cinzel', serif;
  letter-spacing: 0.1em;
}
.membre-search-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.85rem;
  cursor: pointer;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  transition: background 0.12s;
}
.membre-search-row:last-child { border-bottom: none; }
.membre-search-row:hover { background: rgba(255,255,255,0.04); }
.membre-search-row.selected { background: rgba(201,168,76,0.1); }
.membre-avatar-sm {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(201,168,76,0.15);
  border: 1px solid rgba(201,168,76,0.3);
  color: #c9a84c;
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.membre-search-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  flex: 1;
  min-width: 0;
}
.membre-search-nom {
  font-size: 0.82rem;
  color: #e2dcd6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.membre-search-ident {
  font-size: 0.7rem;
  color: rgba(226,220,214,0.4);
}
.membre-check {
  color: #c9a84c;
  font-size: 0.85rem;
  flex-shrink: 0;
}

/* ── Niveau picker ─────────────────────────────────────────────────────────── */
.niveau-picker {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.niveau-pick-btn {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.5rem 0.3rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(226,220,214,0.5);
  cursor: pointer;
  transition: all 0.15s;
  font-family: 'Cinzel', serif;
}
.niveau-pick-btn:hover { background: rgba(255,255,255,0.06); color: #e2dcd6; }
.niveau-pick-btn.active { color: inherit; }
.niveau-pick-num {
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  font-weight: 600;
}
.niveau-pick-label {
  font-size: 0.55rem;
  letter-spacing: 0.08em;
  opacity: 0.8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* ── Grille membres ────────────────────────────────────────────────────────── */
.membres-view {
  padding: 1rem 0;
}

.membres-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.2rem;
}

.membre-card {
  background: linear-gradient(160deg, #0f0c1a 0%, #0a0814 100%);
  border: 1px solid rgba(180,140,60,0.12);
  padding: 1.4rem 1.2rem 1.2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  text-align: center;
}
.membre-card:hover {
  border-color: rgba(201,168,76,0.25);
  box-shadow: 0 0 20px rgba(201,168,76,0.06);
}

.membre-card-photo {
  flex-shrink: 0;
}
.membre-card-img {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(201,168,76,0.3);
}
.membre-card-initiales {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 2px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Cinzel', serif;
  font-size: 1.6rem;
  font-weight: 600;
}

.membre-card-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
}

.membre-card-nom {
  font-family: 'Cinzel', serif;
  font-size: 0.88rem;
  color: #e8e0cc;
  margin: 0;
  letter-spacing: 0.07em;
}

.membre-card-grade {
  font-style: italic;
  color: #c9a84c;
  font-size: 0.88rem;
  margin: 0;
  opacity: 0.85;
}

.membre-card-badge {
  margin-top: 0.1rem;
}

.membre-card-desc {
  font-size: 0.9rem;
  color: rgba(226,220,214,0.5);
  margin: 0.3rem 0 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
  text-align: center;
}
</style>

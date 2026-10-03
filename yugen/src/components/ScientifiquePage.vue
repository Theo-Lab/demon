<template>
  <div class="sci-page">
    <AppNavbar />

    <div v-if="!access" class="sci-loading">
      <p>Chargement...</p>
    </div>

    <div v-else-if="accesDenie" class="jeu-indispo">
      <p class="jeu-indispo-title">Acces restreint</p>
      <p class="jeu-indispo-sub">Cette section est reservee aux membres de la Scientifique.</p>
      <RouterLink to="/parchemin" class="jeu-indispo-link">&#8592; Retour</RouterLink>
    </div>

    <div v-else class="sci-inner">

      <!-- En-tete -->
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
          @click="switchTab(t.key)"
        >{{ t.label }}</button>
      </div>

      <!-- ══ TABLEAU DE BORD ══════════════════════════════════════════ -->
      <div v-if="onglet === 'dashboard'" class="sci-section">
        <div class="enc-dashboard">
          <div class="enc-stat-card" @click="switchTab('potions')">
            <span class="enc-stat-num">{{ potions.length }}</span>
            <span class="enc-stat-label">Potions</span>
          </div>
          <div class="enc-stat-card" @click="switchTab('ingredients')">
            <span class="enc-stat-num">{{ allIngredients.length }}</span>
            <span class="enc-stat-label">Ingredients</span>
          </div>
          <div class="enc-stat-card" @click="switchTab('experiments')">
            <span class="enc-stat-num">{{ experiments.length }}</span>
            <span class="enc-stat-label">Experiences</span>
          </div>
          <div class="enc-stat-card" @click="switchTab('projects')">
            <span class="enc-stat-num">{{ projects.length }}</span>
            <span class="enc-stat-label">Projets</span>
          </div>
          <div class="enc-stat-card" @click="switchTab('scientists')">
            <span class="enc-stat-num">{{ scientists.length }}</span>
            <span class="enc-stat-label">Scientifiques</span>
          </div>
        </div>
      </div>

      <!-- ══ POTIONS ══════════════════════════════════════════════════ -->
      <div v-if="onglet === 'potions'" class="sci-section">

        <!-- Detail potion -->
        <div v-if="detail && detailType === 'potion'" class="sci-fiche">
          <button class="sci-back" @click="closeDetail">&#8592; Potions</button>
          <div class="sci-fiche-header">
            <h2 class="sci-fiche-title">{{ detail.nom }}</h2>
            <div class="enc-badges">
              <span class="enc-badge" :style="{ background: statutColor(detail.statut), color: '#fff' }">{{ statutLabel(detail.statut) }}</span>
              <span v-if="detail.niveau_danger" class="enc-badge enc-badge--danger">Danger {{ detail.niveau_danger }}/5</span>
            </div>
          </div>
          <div v-if="detail.image_url" class="sci-fiche-img">
            <img :src="SERVER_URL + detail.image_url" :alt="detail.nom" />
          </div>
          <div class="sci-fiche-body">
            <div v-if="detail.createur_nom" class="sci-fiche-champ">
              <p class="sci-champ-label">Createur</p>
              <p class="sci-champ-val">
                <a v-if="detail.createur_id" class="enc-link" @click.prevent="navigateTo('scientists', detail.createur_id)">{{ detail.createur_nom }}</a>
                <span v-else>{{ detail.createur_nom }}</span>
              </p>
            </div>
            <div v-if="detail.effet_principal" class="sci-fiche-champ">
              <p class="sci-champ-label">Effet principal</p>
              <p class="sci-champ-val">{{ detail.effet_principal }}</p>
            </div>
            <div v-if="detail.effets_secondaires" class="sci-fiche-champ">
              <p class="sci-champ-label">Effets secondaires</p>
              <p class="sci-champ-val">{{ detail.effets_secondaires }}</p>
            </div>
            <div v-if="detail.description" class="sci-fiche-champ">
              <p class="sci-champ-label">Description</p>
              <p class="sci-champ-val">{{ detail.description }}</p>
            </div>
            <div v-if="detail.jet_minimum" class="sci-fiche-champ">
              <p class="sci-champ-label">Jet minimum</p>
              <p class="sci-champ-val">{{ detail.jet_minimum }}</p>
            </div>
            <div v-if="detail.nb_fioles" class="sci-fiche-champ">
              <p class="sci-champ-label">Nombre de fioles</p>
              <p class="sci-champ-val">{{ detail.nb_fioles }}</p>
            </div>
            <div v-if="detail.materiel" class="sci-fiche-champ">
              <p class="sci-champ-label">Materiel</p>
              <p class="sci-champ-val">{{ detail.materiel }}</p>
            </div>
            <div v-if="detail.etapes_preparation" class="sci-fiche-champ">
              <p class="sci-champ-label">Etapes de preparation</p>
              <p class="sci-champ-val">{{ detail.etapes_preparation }}</p>
            </div>
            <div v-if="detail.notes" class="sci-fiche-champ">
              <p class="sci-champ-label">Notes</p>
              <p class="sci-champ-val">{{ detail.notes }}</p>
            </div>
            <div v-if="detail.ingredients && detail.ingredients.length" class="sci-fiche-champ">
              <p class="sci-champ-label">Ingredients</p>
              <div class="enc-ingredient-list">
                <span
                  v-for="ing in detail.ingredients" :key="ing.id"
                  class="enc-ingredient-badge"
                  :style="{ borderColor: catColor(ing.categorie) }"
                  @click="navigateTo('ingredients', ing.id)"
                >
                  {{ ing.nom }}<span v-if="ing.quantite" class="enc-qty"> ({{ ing.quantite }})</span>
                </span>
              </div>
            </div>
          </div>
          <div v-if="access.dirigeant || canEdit" class="sci-fiche-actions">
            <button class="sci-btn sci-btn--sm" @click="openEditPotion(detail)">Modifier</button>
            <button v-if="access.dirigeant || canDeletePerm" class="sci-btn sci-btn--danger sci-btn--sm" @click="deletePotion(detail.id)">Supprimer</button>
          </div>
        </div>

        <!-- Liste potions -->
        <div v-else>
          <div class="sci-cat-header">
            <h2 class="sci-cat-title">Potions</h2>
            <div class="enc-filters">
              <select v-model="potionFilter" class="sci-select sci-select--sm">
                <option value="">Tous les statuts</option>
                <option value="theorique">Theorique</option>
                <option value="experimentale">Experimentale</option>
                <option value="testee">Testee</option>
                <option value="validee">Validee</option>
                <option value="instable">Instable</option>
              </select>
            </div>
            <button v-if="access.dirigeant || canCreatePerm" class="sci-btn" @click="openCreatePotion">+ Nouvelle potion</button>
          </div>
          <p v-if="!filteredPotions.length" class="sci-hint">Aucune potion.</p>
          <div v-else class="sci-items-grid">
            <div
              v-for="p in pagedPotions" :key="p.id"
              class="sci-item-card"
              @click="openPotionDetail(p.id)"
            >
              <img v-if="p.image_url" :src="SERVER_URL + p.image_url" class="sci-card-img" :alt="p.nom" />
              <div class="sci-card-body">
                <p class="sci-item-name">{{ p.nom }}</p>
                <div class="enc-badges" style="margin-top:6px">
                  <span class="enc-badge enc-badge--sm" :style="{ background: statutColor(p.statut) }">{{ statutLabel(p.statut) }}</span>
                  <span v-if="p.niveau_danger" class="enc-badge enc-badge--sm enc-badge--danger">{{ p.niveau_danger }}/5</span>
                </div>
                <p v-if="p.effet_principal" class="sci-card-snippet">{{ truncate(p.effet_principal) }}</p>
                <p v-if="p.createur_nom" class="sci-item-meta">{{ p.createur_nom }}</p>
              </div>
            </div>
          </div>
          <div v-if="potionTotalPages > 1" class="sci-pagination">
            <button class="sci-page-btn" :disabled="potionPage === 1" @click="potionPage--">&#8592;</button>
            <button
              v-for="n in potionTotalPages" :key="n"
              class="sci-page-btn"
              :class="{ 'sci-page-btn--active': potionPage === n }"
              @click="potionPage = n"
            >{{ n }}</button>
            <button class="sci-page-btn" :disabled="potionPage === potionTotalPages" @click="potionPage++">&#8594;</button>
          </div>
        </div>
      </div>

      <!-- ══ INGREDIENTS ══════════════════════════════════════════════ -->
      <div v-if="onglet === 'ingredients'" class="sci-section">

        <!-- Detail ingredient -->
        <div v-if="detail && detailType === 'ingredient'" class="sci-fiche">
          <button class="sci-back" @click="closeDetail">&#8592; Ingredients</button>
          <div class="sci-fiche-header">
            <h2 class="sci-fiche-title">{{ detail.nom }}</h2>
            <div class="enc-badges">
              <span class="enc-badge" :style="{ background: catColor(detail.categorie) }">{{ catLabel(detail.categorie) }}</span>
              <span v-if="detail.danger" class="enc-badge enc-badge--danger">Danger {{ detail.danger }}/5</span>
            </div>
          </div>
          <div v-if="detail.image_url" class="sci-fiche-img">
            <img :src="SERVER_URL + detail.image_url" :alt="detail.nom" />
          </div>
          <div class="sci-fiche-body">
            <div v-if="detail.proprietes" class="sci-fiche-champ">
              <p class="sci-champ-label">Proprietes</p>
              <p class="sci-champ-val">{{ detail.proprietes }}</p>
            </div>
            <div v-if="detail.localisation" class="sci-fiche-champ">
              <p class="sci-champ-label">Localisation</p>
              <p class="sci-champ-val">{{ detail.localisation }}</p>
            </div>
            <div v-if="detail.obtention" class="sci-fiche-champ">
              <p class="sci-champ-label">Obtention</p>
              <p class="sci-champ-val">{{ detail.obtention }}</p>
            </div>
            <div v-if="detail.description" class="sci-fiche-champ">
              <p class="sci-champ-label">Description</p>
              <p class="sci-champ-val">{{ detail.description }}</p>
            </div>
            <div v-if="detail.utilite_rp" class="sci-fiche-champ">
              <p class="sci-champ-label">Utilite</p>
              <p class="sci-champ-val">{{ detail.utilite_rp }}</p>
            </div>
            <div v-if="detail.recette_rp" class="sci-fiche-champ">
              <p class="sci-champ-label">Recette</p>
              <p class="sci-champ-val">{{ detail.recette_rp }}</p>
            </div>
            <div v-if="detail.effets_rp" class="sci-fiche-champ">
              <p class="sci-champ-label">Effets</p>
              <p class="sci-champ-val">{{ detail.effets_rp }}</p>
            </div>
            <div v-if="detail.potions && detail.potions.length" class="sci-fiche-champ">
              <p class="sci-champ-label">Utilise dans</p>
              <div class="enc-ingredient-list">
                <span
                  v-for="pot in detail.potions" :key="pot.id"
                  class="enc-ingredient-badge"
                  :style="{ borderColor: statutColor(pot.statut) }"
                  @click="navigateTo('potions', pot.id)"
                >
                  {{ pot.nom }}<span v-if="pot.quantite" class="enc-qty"> ({{ pot.quantite }})</span>
                </span>
              </div>
            </div>
          </div>
          <div v-if="access.dirigeant" class="sci-fiche-actions">
            <button class="sci-btn sci-btn--sm" @click="openEditIngredient(detail)">Modifier</button>
            <button class="sci-btn sci-btn--danger sci-btn--sm" @click="deleteIngredient(detail.id)">Supprimer</button>
          </div>
        </div>

        <!-- Liste ingredients -->
        <div v-else>
          <div class="sci-cat-header">
            <h2 class="sci-cat-title">Ingredients</h2>
            <button v-if="access.dirigeant" class="sci-btn" @click="openCreateIngredient">+ Nouvel ingredient</button>
          </div>
          <div class="sci-subtabs">
            <button class="sci-subtab" :class="{ 'sci-subtab--active': ingredientFilter === '' }" @click="ingredientFilter = ''">Tous</button>
            <button class="sci-subtab" :class="{ 'sci-subtab--active': ingredientFilter === 'plante_toxique' }" @click="ingredientFilter = 'plante_toxique'">Plantes toxiques</button>
            <button class="sci-subtab" :class="{ 'sci-subtab--active': ingredientFilter === 'plante_medicinale' }" @click="ingredientFilter = 'plante_medicinale'">Plantes medicinales</button>
            <button class="sci-subtab" :class="{ 'sci-subtab--active': ingredientFilter === 'ressource' }" @click="ingredientFilter = 'ressource'">Ressources</button>
            <button class="sci-subtab" :class="{ 'sci-subtab--active': ingredientFilter === 'produit_chimique' }" @click="ingredientFilter = 'produit_chimique'">Produits chimiques</button>
          </div>
          <p v-if="!filteredIngredients.length" class="sci-hint">Aucun ingredient.</p>
          <div v-else class="sci-items-grid">
            <div
              v-for="i in pagedIngredients" :key="i.id"
              class="sci-item-card"
              @click="openIngredientDetail(i.id)"
            >
              <img v-if="i.image_url" :src="SERVER_URL + i.image_url" class="sci-card-img" :alt="i.nom" />
              <div class="sci-card-body">
                <p class="sci-item-name">{{ i.nom }}</p>
                <div class="enc-badges" style="margin-top:6px">
                  <span class="enc-badge enc-badge--sm" :style="{ background: catColor(i.categorie) }">{{ catLabel(i.categorie) }}</span>
                  <span v-if="i.danger" class="enc-badge enc-badge--sm enc-badge--danger">{{ i.danger }}/5</span>
                </div>
                <p v-if="i.proprietes" class="sci-card-snippet">{{ truncate(i.proprietes) }}</p>
                <p v-if="i.localisation" class="sci-item-meta">{{ i.localisation }}</p>
              </div>
            </div>
          </div>
          <div v-if="ingredientTotalPages > 1" class="sci-pagination">
            <button class="sci-page-btn" :disabled="ingredientPage === 1" @click="ingredientPage--">&#8592;</button>
            <button
              v-for="n in ingredientTotalPages" :key="n"
              class="sci-page-btn"
              :class="{ 'sci-page-btn--active': ingredientPage === n }"
              @click="ingredientPage = n"
            >{{ n }}</button>
            <button class="sci-page-btn" :disabled="ingredientPage === ingredientTotalPages" @click="ingredientPage++">&#8594;</button>
          </div>
        </div>
      </div>

      <!-- ══ EXPERIENCES ══════════════════════════════════════════════ -->
      <div v-if="onglet === 'experiments'" class="sci-section">

        <!-- Detail experience -->
        <div v-if="detail && detailType === 'experiment'" class="sci-fiche">
          <button class="sci-back" @click="closeDetail">&#8592; Experiences</button>
          <div class="sci-fiche-header">
            <h2 class="sci-fiche-title">{{ detail.nom }}</h2>
            <div class="enc-badges">
              <span class="enc-badge" :style="{ background: expStatutColor(detail.statut) }">{{ expStatutLabel(detail.statut) }}</span>
            </div>
          </div>
          <div v-if="detail.image_url" class="sci-fiche-img">
            <img :src="SERVER_URL + detail.image_url" :alt="detail.nom" />
          </div>
          <div class="sci-fiche-body">
            <div v-if="detail.responsable_nom" class="sci-fiche-champ">
              <p class="sci-champ-label">Responsable</p>
              <p class="sci-champ-val">
                <a v-if="detail.responsable_id" class="enc-link" @click.prevent="navigateTo('scientists', detail.responsable_id)">{{ detail.responsable_nom }}</a>
                <span v-else>{{ detail.responsable_nom }}</span>
              </p>
            </div>
            <div v-if="detail.objectif" class="sci-fiche-champ">
              <p class="sci-champ-label">Objectif</p>
              <p class="sci-champ-val">{{ detail.objectif }}</p>
            </div>
            <div v-if="detail.hypothese" class="sci-fiche-champ">
              <p class="sci-champ-label">Hypothese</p>
              <p class="sci-champ-val">{{ detail.hypothese }}</p>
            </div>
            <div v-if="detail.sujet_teste" class="sci-fiche-champ">
              <p class="sci-champ-label">Sujet teste</p>
              <p class="sci-champ-val">{{ detail.sujet_teste }}</p>
            </div>
            <div v-if="detail.protocole" class="sci-fiche-champ">
              <p class="sci-champ-label">Protocole</p>
              <p class="sci-champ-val">{{ detail.protocole }}</p>
            </div>
            <div v-if="detail.observations" class="sci-fiche-champ">
              <p class="sci-champ-label">Observations</p>
              <p class="sci-champ-val">{{ detail.observations }}</p>
            </div>
            <div v-if="detail.resultats" class="sci-fiche-champ">
              <p class="sci-champ-label">Resultats</p>
              <p class="sci-champ-val">{{ detail.resultats }}</p>
            </div>
            <div v-if="detail.conclusion" class="sci-fiche-champ">
              <p class="sci-champ-label">Conclusion</p>
              <p class="sci-champ-val">{{ detail.conclusion }}</p>
            </div>
            <div v-if="parsedPotionsUsed.length" class="sci-fiche-champ">
              <p class="sci-champ-label">Potions utilisees</p>
              <div class="enc-ingredient-list">
                <span
                  v-for="pid in parsedPotionsUsed" :key="pid"
                  class="enc-ingredient-badge"
                  @click="navigateTo('potions', pid)"
                >{{ potionNameById(pid) }}</span>
              </div>
            </div>
          </div>
          <div v-if="access.dirigeant || canEdit" class="sci-fiche-actions">
            <button class="sci-btn sci-btn--sm" @click="openEditExperiment(detail)">Modifier</button>
            <button v-if="access.dirigeant || canDeletePerm" class="sci-btn sci-btn--danger sci-btn--sm" @click="deleteExperiment(detail.id)">Supprimer</button>
          </div>
        </div>

        <!-- Liste experiences -->
        <div v-else>
          <div class="sci-cat-header">
            <h2 class="sci-cat-title">Experiences</h2>
            <button v-if="access.dirigeant || canCreatePerm" class="sci-btn" @click="openCreateExperiment">+ Nouvelle experience</button>
          </div>
          <p v-if="!experiments.length" class="sci-hint">Aucune experience.</p>
          <div v-else class="sci-items-grid">
            <div
              v-for="e in pagedExperiments" :key="e.id"
              class="sci-item-card"
              @click="openExperimentDetail(e.id)"
            >
              <img v-if="e.image_url" :src="SERVER_URL + e.image_url" class="sci-card-img" :alt="e.nom" />
              <div class="sci-card-body">
                <p class="sci-item-name">{{ e.nom }}</p>
                <div class="enc-badges" style="margin-top:6px">
                  <span class="enc-badge enc-badge--sm" :style="{ background: expStatutColor(e.statut) }">{{ expStatutLabel(e.statut) }}</span>
                </div>
                <p v-if="e.objectif" class="sci-card-snippet">{{ truncate(e.objectif) }}</p>
                <p v-if="e.responsable_nom" class="sci-item-meta">{{ e.responsable_nom }}</p>
              </div>
            </div>
          </div>
          <div v-if="experimentTotalPages > 1" class="sci-pagination">
            <button class="sci-page-btn" :disabled="experimentPage === 1" @click="experimentPage--">&#8592;</button>
            <button
              v-for="n in experimentTotalPages" :key="n"
              class="sci-page-btn"
              :class="{ 'sci-page-btn--active': experimentPage === n }"
              @click="experimentPage = n"
            >{{ n }}</button>
            <button class="sci-page-btn" :disabled="experimentPage === experimentTotalPages" @click="experimentPage++">&#8594;</button>
          </div>
        </div>
      </div>

      <!-- ══ PROJETS ══════════════════════════════════════════════════ -->
      <div v-if="onglet === 'projects'" class="sci-section">

        <!-- Detail projet -->
        <div v-if="detail && detailType === 'project'" class="sci-fiche">
          <button class="sci-back" @click="closeDetail">&#8592; Projets</button>
          <div class="sci-fiche-header">
            <h2 class="sci-fiche-title">{{ detail.nom }}</h2>
            <div class="enc-badges">
              <span class="enc-badge" :style="{ background: projStatutColor(detail.statut) }">{{ projStatutLabel(detail.statut) }}</span>
              <span v-if="detail.progression !== undefined" class="enc-badge" style="background:rgba(255,255,255,0.1)">{{ detail.progression }}%</span>
            </div>
          </div>
          <div v-if="detail.image_url" class="sci-fiche-img">
            <img :src="SERVER_URL + detail.image_url" :alt="detail.nom" />
          </div>
          <div class="sci-fiche-body">
            <div v-if="detail.responsable_nom" class="sci-fiche-champ">
              <p class="sci-champ-label">Responsable</p>
              <p class="sci-champ-val">
                <a v-if="detail.responsable_id" class="enc-link" @click.prevent="navigateTo('scientists', detail.responsable_id)">{{ detail.responsable_nom }}</a>
                <span v-else>{{ detail.responsable_nom }}</span>
              </p>
            </div>
            <div v-if="detail.description" class="sci-fiche-champ">
              <p class="sci-champ-label">Description</p>
              <p class="sci-champ-val">{{ detail.description }}</p>
            </div>
            <div v-if="detail.principe" class="sci-fiche-champ">
              <p class="sci-champ-label">Principe</p>
              <p class="sci-champ-val">{{ detail.principe }}</p>
            </div>
            <div v-if="detail.architecture" class="sci-fiche-champ">
              <p class="sci-champ-label">Architecture</p>
              <p class="sci-champ-val">{{ detail.architecture }}</p>
            </div>
            <div v-if="detail.notes" class="sci-fiche-champ">
              <p class="sci-champ-label">Notes</p>
              <p class="sci-champ-val">{{ detail.notes }}</p>
            </div>
            <div v-if="detail.experiments && detail.experiments.length" class="sci-fiche-champ">
              <p class="sci-champ-label">Experiences liees</p>
              <div class="enc-ingredient-list">
                <span
                  v-for="ex in detail.experiments" :key="ex.id"
                  class="enc-ingredient-badge"
                  @click="navigateTo('experiments', ex.id)"
                >{{ ex.nom }}</span>
              </div>
            </div>
            <div v-if="detail.potions && detail.potions.length" class="sci-fiche-champ">
              <p class="sci-champ-label">Potions liees</p>
              <div class="enc-ingredient-list">
                <span
                  v-for="pt in detail.potions" :key="pt.id"
                  class="enc-ingredient-badge"
                  @click="navigateTo('potions', pt.id)"
                >{{ pt.nom }}</span>
              </div>
            </div>
          </div>
          <div v-if="access.dirigeant" class="sci-fiche-actions">
            <button class="sci-btn sci-btn--sm" @click="openEditProject(detail)">Modifier</button>
            <button class="sci-btn sci-btn--danger sci-btn--sm" @click="deleteProject(detail.id)">Supprimer</button>
          </div>
        </div>

        <!-- Liste projets -->
        <div v-else>
          <div class="sci-cat-header">
            <h2 class="sci-cat-title">Projets</h2>
            <button v-if="access.dirigeant" class="sci-btn" @click="openCreateProject">+ Nouveau projet</button>
          </div>
          <p v-if="!projects.length" class="sci-hint">Aucun projet.</p>
          <div v-else class="sci-items-grid">
            <div
              v-for="p in pagedProjects" :key="p.id"
              class="sci-item-card"
              @click="openProjectDetail(p.id)"
            >
              <img v-if="p.image_url" :src="SERVER_URL + p.image_url" class="sci-card-img" :alt="p.nom" />
              <div class="sci-card-body">
                <p class="sci-item-name">{{ p.nom }}</p>
                <div class="enc-badges" style="margin-top:6px">
                  <span class="enc-badge enc-badge--sm" :style="{ background: projStatutColor(p.statut) }">{{ projStatutLabel(p.statut) }}</span>
                  <span class="enc-badge enc-badge--sm" style="background:rgba(255,255,255,0.08)">{{ p.progression }}%</span>
                </div>
                <p v-if="p.description" class="sci-card-snippet">{{ truncate(p.description) }}</p>
                <div v-if="p.progression" class="sci-card-progress">
                  <div class="sci-card-progress-bar" :style="{ width: p.progression + '%' }"></div>
                </div>
                <p v-if="p.responsable_nom" class="sci-item-meta">{{ p.responsable_nom }}</p>
              </div>
            </div>
          </div>
          <div v-if="projectTotalPages > 1" class="sci-pagination">
            <button class="sci-page-btn" :disabled="projectPage === 1" @click="projectPage--">&#8592;</button>
            <button
              v-for="n in projectTotalPages" :key="n"
              class="sci-page-btn"
              :class="{ 'sci-page-btn--active': projectPage === n }"
              @click="projectPage = n"
            >{{ n }}</button>
            <button class="sci-page-btn" :disabled="projectPage === projectTotalPages" @click="projectPage++">&#8594;</button>
          </div>
        </div>
      </div>

      <!-- ══ SCIENTIFIQUES ════════════════════════════════════════════ -->
      <div v-if="onglet === 'scientists'" class="sci-section">

        <!-- Detail scientifique -->
        <div v-if="detail && detailType === 'scientist'" class="sci-fiche">
          <button class="sci-back" @click="closeDetail">&#8592; Scientifiques</button>
          <div class="sci-fiche-header">
            <h2 class="sci-fiche-title">{{ detail.nom }}</h2>
            <span v-if="detail.affinite" class="enc-badge" style="background:rgba(201,168,76,0.2);color:#c9a84c">{{ detail.affinite }}</span>
          </div>
          <div v-if="detail.image_url" class="sci-fiche-img">
            <img :src="SERVER_URL + detail.image_url" :alt="detail.nom" />
          </div>
          <div class="sci-fiche-body">
            <div v-if="detail.description" class="sci-fiche-champ">
              <p class="sci-champ-label">Description</p>
              <p class="sci-champ-val">{{ detail.description }}</p>
            </div>
            <div v-if="detail.potions && detail.potions.length" class="sci-fiche-champ">
              <p class="sci-champ-label">Potions</p>
              <div class="enc-ingredient-list">
                <span
                  v-for="p in detail.potions" :key="p.id"
                  class="enc-ingredient-badge"
                  :style="{ borderColor: statutColor(p.statut) }"
                  @click="navigateTo('potions', p.id)"
                >{{ p.nom }}</span>
              </div>
            </div>
            <div v-if="detail.experiments && detail.experiments.length" class="sci-fiche-champ">
              <p class="sci-champ-label">Experiences</p>
              <div class="enc-ingredient-list">
                <span
                  v-for="e in detail.experiments" :key="e.id"
                  class="enc-ingredient-badge"
                  @click="navigateTo('experiments', e.id)"
                >{{ e.nom }}</span>
              </div>
            </div>
            <div v-if="detail.projects && detail.projects.length" class="sci-fiche-champ">
              <p class="sci-champ-label">Projets</p>
              <div class="enc-ingredient-list">
                <span
                  v-for="p in detail.projects" :key="p.id"
                  class="enc-ingredient-badge"
                  @click="navigateTo('projects', p.id)"
                >{{ p.nom }}</span>
              </div>
            </div>
          </div>
          <div v-if="access.dirigeant" class="sci-fiche-actions">
            <button class="sci-btn sci-btn--sm" @click="openEditScientist(detail)">Modifier</button>
            <button class="sci-btn sci-btn--danger sci-btn--sm" @click="deleteScientist(detail.id)">Supprimer</button>
          </div>
        </div>

        <!-- Liste scientifiques -->
        <div v-else>
          <div class="sci-cat-header">
            <h2 class="sci-cat-title">Scientifiques</h2>
            <button v-if="access.dirigeant" class="sci-btn" @click="openCreateScientist">+ Nouveau scientifique</button>
          </div>
          <p v-if="!scientists.length" class="sci-hint">Aucun scientifique.</p>
          <div v-else class="sci-items-grid">
            <div
              v-for="s in pagedScientists" :key="s.id"
              class="sci-item-card"
              @click="openScientistDetail(s.id)"
            >
              <img v-if="s.image_url" :src="SERVER_URL + s.image_url" class="sci-card-img" :alt="s.nom" />
              <div class="sci-card-body">
                <p class="sci-item-name">{{ s.nom }}</p>
                <p v-if="s.description" class="sci-card-snippet">{{ truncate(s.description) }}</p>
                <p v-if="s.affinite" class="sci-item-meta">{{ s.affinite }}</p>
              </div>
            </div>
          </div>
          <div v-if="scientistTotalPages > 1" class="sci-pagination">
            <button class="sci-page-btn" :disabled="scientistPage === 1" @click="scientistPage--">&#8592;</button>
            <button
              v-for="n in scientistTotalPages" :key="n"
              class="sci-page-btn"
              :class="{ 'sci-page-btn--active': scientistPage === n }"
              @click="scientistPage = n"
            >{{ n }}</button>
            <button class="sci-page-btn" :disabled="scientistPage === scientistTotalPages" @click="scientistPage++">&#8594;</button>
          </div>
        </div>
      </div>

      <!-- ══ RECHERCHE ════════════════════════════════════════════════ -->
      <div v-if="onglet === 'search'" class="sci-section">
        <div class="enc-search-box">
          <input
            v-model="searchQuery"
            class="sci-input"
            placeholder="Rechercher une potion, un ingredient, un scientifique..."
            @input="doSearch"
          />
        </div>
        <div v-if="searchResults" class="enc-search-results">
          <div v-if="searchResults.potions.length" class="enc-search-group">
            <p class="sci-champ-label">Potions</p>
            <div class="enc-ingredient-list">
              <span v-for="r in searchResults.potions" :key="r.id" class="enc-ingredient-badge" @click="navigateTo('potions', r.id)">{{ r.nom }}</span>
            </div>
          </div>
          <div v-if="searchResults.ingredients.length" class="enc-search-group">
            <p class="sci-champ-label">Ingredients</p>
            <div class="enc-ingredient-list">
              <span v-for="r in searchResults.ingredients" :key="r.id" class="enc-ingredient-badge" @click="navigateTo('ingredients', r.id)">{{ r.nom }}</span>
            </div>
          </div>
          <div v-if="searchResults.scientists.length" class="enc-search-group">
            <p class="sci-champ-label">Scientifiques</p>
            <div class="enc-ingredient-list">
              <span v-for="r in searchResults.scientists" :key="r.id" class="enc-ingredient-badge" @click="navigateTo('scientists', r.id)">{{ r.nom }}</span>
            </div>
          </div>
          <p v-if="!searchResults.potions.length && !searchResults.ingredients.length && !searchResults.scientists.length && searchQuery.length >= 2" class="sci-hint">Aucun resultat.</p>
        </div>
      </div>

      <!-- ══ EFFETS RESSENTIS ════════════════════════════════════════════════ -->
      <div v-if="onglet === 'effets'" class="sci-section">
        <div class="sci-cat-header">
          <h2 class="sci-cat-title">Effets Ressentis</h2>
          <button v-if="access.dirigeant || canCreatePerm" class="sci-btn" @click="openCreateEffet">+ Nouvel effet</button>
        </div>
        <p class="sci-hint" style="margin-bottom:20px">Créez des fiches d'effets avec un lien public à partager aux joueurs.</p>
        <p v-if="!effets.length" class="sci-hint">Aucun effet créé.</p>
        <div v-else class="sci-items-grid">
          <div v-for="e in effets" :key="e.id" class="sci-item-card sci-effet-card">
            <img v-if="e.image_url" :src="SERVER_URL + e.image_url" class="sci-card-img" :alt="e.titre" />
            <div class="sci-card-body">
              <div class="sci-effet-header-row">
                <p class="sci-item-name">{{ e.titre }}</p>
                <span v-if="!e.actif" class="enc-badge enc-badge--sm" style="background:rgba(100,100,100,0.4)">Expiré</span>
              </div>
              <p v-if="e.sous_titre" class="sci-item-meta" style="font-style:italic">{{ e.sous_titre }}</p>
              <p v-if="e.contenu" class="sci-card-snippet">{{ truncate(e.contenu, 100) }}</p>
              <div class="sci-effet-actions">
                <button class="sci-btn sci-btn--sm" @click.stop="copyEffetLink(e)">Copier lien</button>
                <a :href="'/effets/' + e.token" target="_blank" class="sci-btn sci-btn--sm sci-btn--outline">Ouvrir</a>
                <button v-if="access.dirigeant || canEdit" class="sci-btn sci-btn--sm sci-btn--ghost" @click.stop="openEditEffet(e)">Modifier</button>
                <button v-if="access.dirigeant || canDeletePerm" class="sci-btn sci-btn--sm sci-btn--danger" @click.stop="deleteEffet(e.id)">Sup.</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Modale effet -->
        <Transition name="sci-modal">
          <div v-if="showEffetForm" class="sci-modal-overlay" @click.self="showEffetForm = false">
            <div class="sci-modal">
              <h3 class="sci-modal-title">{{ editingEffet ? 'Modifier l\'effet' : 'Nouvel effet' }}</h3>
              <div class="sci-form-group">
                <label class="sci-label">Titre *</label>
                <input v-model="effetForm.titre" class="sci-input" placeholder="Ex : Potion d'Oubli — Stade 1" />
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Sous-titre</label>
                <input v-model="effetForm.sous_titre" class="sci-input" placeholder="Ex : Altération mémorielle temporaire" />
              </div>
              <div class="sci-form-row">
                <div class="sci-form-group">
                  <label class="sci-label">Type</label>
                  <select v-model="effetForm.type" class="sci-select">
                    <option value="general">Général</option>
                    <option value="potion">Potion</option>
                    <option value="experience">Expérience</option>
                    <option value="poison">Poison</option>
                  </select>
                </div>
                <div class="sci-form-group">
                  <label class="sci-label">Intensité (1-5)</label>
                  <input v-model.number="effetForm.intensite" type="number" min="1" max="5" class="sci-input" />
                </div>
                <div class="sci-form-group">
                  <label class="sci-label">Durée</label>
                  <input v-model="effetForm.duree" class="sci-input" placeholder="Ex : 3 tours, 1 heure…" />
                </div>
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Description / Ce que ressent le personnage</label>
                <textarea v-model="effetForm.contenu" class="sci-textarea" rows="5" placeholder="Décrivez ce que le personnage ressent, voit, pense…" />
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Symptômes (un par ligne)</label>
                <textarea v-model="effetForm.symptomes" class="sci-textarea" rows="3" placeholder="Nausées&#10;Vision trouble&#10;Perte de mémoire…" />
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Image</label>
                <div class="sci-img-zone" @paste="handleEffetImagePaste" tabindex="0">
                  <img v-if="effetForm.image_url" :src="SERVER_URL + effetForm.image_url" class="sci-img-zone-preview" />
                  <div v-else class="sci-img-zone-empty"><span class="sci-img-zone-hint">Ctrl+V pour coller</span></div>
                  <div class="sci-img-zone-actions">
                    <label class="sci-btn sci-btn--sm sci-btn--outline sci-upload-label">
                      {{ uploadingEffetImage ? 'Upload...' : (effetForm.image_url ? 'Changer' : '+ Fichier') }}
                      <input type="file" accept="image/*" style="display:none" :disabled="uploadingEffetImage" @change="handleEffetImageUpload" />
                    </label>
                    <button v-if="effetForm.image_url" class="sci-btn sci-btn--sm sci-btn--danger" @click.prevent="effetForm.image_url = ''">Retirer</button>
                  </div>
                </div>
              </div>
              <label v-if="editingEffet" class="sci-check" style="margin-bottom:4px">
                <input type="checkbox" v-model="effetForm.actif" /> Effet actif (le lien est accessible)
              </label>
              <p v-if="effetErr" class="sci-err">{{ effetErr }}</p>
              <div class="sci-modal-actions">
                <button class="sci-btn" :disabled="savingEffet" @click="saveEffet">{{ savingEffet ? '...' : (editingEffet ? 'Enregistrer' : 'Créer') }}</button>
                <button class="sci-btn sci-btn--ghost" @click="showEffetForm = false">Annuler</button>
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <!-- ══ MEMBRES ══════════════════════════════════════════════════ -->
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

      <!-- ══ GESTION (dirigeant) ══════════════════════════════════════ -->
      <div v-if="onglet === 'gestion' && access.dirigeant" class="sci-section">

        <div class="sci-subtabs">
          <button v-for="st in gestionSubtabs" :key="st.key" class="sci-subtab" :class="{ 'sci-subtab--active': gestionOnglet === st.key }" @click="gestionOnglet = st.key">{{ st.label }}</button>
        </div>

        <!-- Roles -->
        <div v-if="gestionOnglet === 'roles'" class="sci-gestion-block">
          <div class="sci-gestion-header">
            <h3 class="sci-gestion-title">Roles</h3>
            <button class="sci-btn" @click="openCreateRole">+ Nouveau role</button>
          </div>
          <p v-if="!roles.length" class="sci-hint">Aucun role cree.</p>
          <div v-else class="sci-roles-list">
            <div v-for="role in roles" :key="role.id" class="sci-role-row">
              <div class="sci-role-info">
                <span class="sci-role-nom">{{ role.nom }}</span>
                <span class="sci-role-ordre">Niveau {{ role.ordre }}</span>
                <div class="sci-role-perms">
                  <span v-if="role.can_create_items" class="sci-perm">Creer fiches</span>
                  <span v-if="role.can_edit_items" class="sci-perm">Modifier fiches</span>
                  <span v-if="role.can_delete_items" class="sci-perm">Supprimer fiches</span>
                  <span v-if="role.can_add_members" class="sci-perm">Gerer membres inferieurs</span>
                </div>
              </div>
              <div class="sci-row-actions">
                <button class="sci-btn sci-btn--sm" @click="openEditRole(role)">Modifier</button>
                <button class="sci-btn sci-btn--danger sci-btn--sm" @click="deleteRole(role.id)">Supprimer</button>
              </div>
            </div>
          </div>

          <Transition name="sci-modal">
            <div v-if="showRoleForm" class="sci-modal-overlay" @click.self="showRoleForm = false">
              <div class="sci-modal">
                <h3 class="sci-modal-title">{{ editingRole ? 'Modifier le role' : 'Nouveau role' }}</h3>
                <div class="sci-form-row">
                  <div class="sci-form-group">
                    <label class="sci-label">Nom *</label>
                    <input v-model="roleForm.nom" class="sci-input" />
                  </div>
                  <div class="sci-form-group">
                    <label class="sci-label">Niveau (hierarchie)</label>
                    <input v-model.number="roleForm.ordre" type="number" class="sci-input" placeholder="0" />
                  </div>
                </div>
                <p class="sci-label" style="margin-bottom:8px">Permissions</p>
                <div class="sci-perms-grid">
                  <label class="sci-check"><input type="checkbox" v-model="roleForm.can_create_items" /> Creer des fiches</label>
                  <label class="sci-check"><input type="checkbox" v-model="roleForm.can_edit_items" /> Modifier des fiches</label>
                  <label class="sci-check"><input type="checkbox" v-model="roleForm.can_delete_items" /> Supprimer des fiches</label>
                  <label class="sci-check"><input type="checkbox" v-model="roleForm.can_add_members" /> Gerer des membres inferieurs</label>
                </div>
                <p v-if="roleErr" class="sci-err">{{ roleErr }}</p>
                <div class="sci-modal-actions">
                  <button class="sci-btn" :disabled="savingRole" @click="saveRole">{{ savingRole ? '...' : (editingRole ? 'Enregistrer' : 'Creer') }}</button>
                  <button class="sci-btn sci-btn--ghost" @click="showRoleForm = false">Annuler</button>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Membres (gestion) -->
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
                <button class="sci-btn sci-btn--sm" @click="openChangeMembre(m)">Changer role</button>
                <button class="sci-btn sci-btn--danger sci-btn--sm" @click="removeMembre(m.id)">Retirer</button>
              </div>
            </div>
          </div>

          <Transition name="sci-modal">
            <div v-if="showMembreForm" class="sci-modal-overlay" @click.self="showMembreForm = false">
              <div class="sci-modal">
                <h3 class="sci-modal-title">{{ editingMembre ? 'Changer le role' : 'Ajouter un membre' }}</h3>
                <div v-if="!editingMembre" class="sci-form-group">
                  <label class="sci-label">Utilisateur</label>
                  <select v-model="membreForm.userId" class="sci-select">
                    <option value="">-- Choisir --</option>
                    <option v-for="u in allUsers" :key="u.id" :value="u.id">{{ u.nom }} ({{ u.identifiant }})</option>
                  </select>
                </div>
                <div v-else class="sci-form-group">
                  <p class="sci-label" style="color:#fff">{{ editingMembre.nom }}</p>
                </div>
                <div class="sci-form-group">
                  <label class="sci-label">Role</label>
                  <select v-model="membreForm.roleId" class="sci-select">
                    <option value="">-- Choisir --</option>
                    <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.nom }} (niv. {{ r.ordre }})</option>
                  </select>
                </div>
                <p v-if="membreErr" class="sci-err">{{ membreErr }}</p>
                <div class="sci-modal-actions">
                  <button class="sci-btn" :disabled="savingMembre" @click="saveMembre">{{ savingMembre ? '...' : (editingMembre ? 'Enregistrer' : 'Ajouter') }}</button>
                  <button class="sci-btn sci-btn--ghost" @click="showMembreForm = false">Annuler</button>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Categories & Champs -->
        <div v-if="gestionOnglet === 'categories'" class="sci-gestion-block">
          <div class="sci-gestion-header">
            <h3 class="sci-gestion-title">Categories</h3>
            <button class="sci-btn" @click="openCreateCat">+ Nouvelle categorie</button>
          </div>
          <p v-if="!categories.length" class="sci-hint">Aucune categorie.</p>
          <div v-else class="sci-cat-manage-list">
            <div v-for="cat in categories" :key="cat.id" class="sci-cat-manage-row">
              <div class="sci-cat-manage-top">
                <div class="sci-role-info">
                  <span class="sci-role-nom">{{ cat.icone }} {{ cat.nom }}</span>
                  <span class="sci-role-ordre">{{ cat.champs.length }} champ(s)</span>
                </div>
                <div class="sci-row-actions">
                  <button class="sci-btn sci-btn--sm" @click="openEditCat(cat)">Modifier</button>
                  <button class="sci-btn sci-btn--sm" @click="toggleCatChamps(cat.id)">Champs {{ openChamps === cat.id ? '&#9650;' : '&#9660;' }}</button>
                  <button class="sci-btn sci-btn--danger sci-btn--sm" @click="deleteCat(cat.id)">Supprimer</button>
                </div>
              </div>
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

          <Transition name="sci-modal">
            <div v-if="showCatForm" class="sci-modal-overlay" @click.self="showCatForm = false">
              <div class="sci-modal">
                <h3 class="sci-modal-title">{{ editingCat ? 'Modifier la categorie' : 'Nouvelle categorie' }}</h3>
                <div class="sci-form-row">
                  <div class="sci-form-group">
                    <label class="sci-label">Nom *</label>
                    <input v-model="catForm.nom" class="sci-input" />
                  </div>
                  <div class="sci-form-group">
                    <label class="sci-label">Icone (emoji)</label>
                    <input v-model="catForm.icone" class="sci-input" style="max-width:80px" />
                  </div>
                  <div class="sci-form-group">
                    <label class="sci-label">Ordre</label>
                    <input v-model.number="catForm.ordre" type="number" class="sci-input" style="max-width:80px" />
                  </div>
                </div>
                <p v-if="catErr" class="sci-err">{{ catErr }}</p>
                <div class="sci-modal-actions">
                  <button class="sci-btn" :disabled="savingCat" @click="saveCat">{{ savingCat ? '...' : (editingCat ? 'Enregistrer' : 'Creer') }}</button>
                  <button class="sci-btn sci-btn--ghost" @click="showCatForm = false">Annuler</button>
                </div>
              </div>
            </div>
          </Transition>

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
                  <button class="sci-btn" :disabled="savingChamp" @click="saveChamp">{{ savingChamp ? '...' : (editingChamp ? 'Enregistrer' : 'Ajouter') }}</button>
                  <button class="sci-btn sci-btn--ghost" @click="showChampForm = false">Annuler</button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <!-- ══ MODALE ENCYCLOPEDIE (Create/Edit) ════════════════════════ -->
      <Transition name="sci-modal">
        <div v-if="showEncForm" class="sci-modal-overlay" @click.self="showEncForm = false" @paste="handleImagePaste">
          <div class="sci-modal">
            <h3 class="sci-modal-title">{{ encFormTitle }}</h3>

            <!-- Potion form -->
            <template v-if="encFormType === 'potion'">
              <div class="sci-form-group">
                <label class="sci-label">Nom *</label>
                <input v-model="encForm.nom" class="sci-input" />
              </div>
              <div class="sci-form-row">
                <div class="sci-form-group">
                  <label class="sci-label">Createur</label>
                  <select v-model="encForm.createur_id" class="sci-select">
                    <option value="">-- Aucun --</option>
                    <option v-for="s in scientists" :key="s.id" :value="s.id">{{ s.nom }}</option>
                  </select>
                </div>
                <div class="sci-form-group">
                  <label class="sci-label">Statut</label>
                  <select v-model="encForm.statut" class="sci-select">
                    <option value="theorique">Theorique</option>
                    <option value="experimentale">Experimentale</option>
                    <option value="testee">Testee</option>
                    <option value="validee">Validee</option>
                    <option value="instable">Instable</option>
                  </select>
                </div>
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Effet principal</label>
                <textarea v-model="encForm.effet_principal" class="sci-textarea" rows="2" />
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Effets secondaires</label>
                <textarea v-model="encForm.effets_secondaires" class="sci-textarea" rows="2" />
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Description</label>
                <textarea v-model="encForm.description" class="sci-textarea" rows="2" />
              </div>
              <div class="sci-form-row">
                <div class="sci-form-group">
                  <label class="sci-label">Jet minimum</label>
                  <input v-model.number="encForm.jet_minimum" type="number" class="sci-input" />
                </div>
                <div class="sci-form-group">
                  <label class="sci-label">Nb fioles</label>
                  <input v-model.number="encForm.nb_fioles" type="number" class="sci-input" />
                </div>
                <div class="sci-form-group">
                  <label class="sci-label">Danger (0-5)</label>
                  <input v-model.number="encForm.niveau_danger" type="number" min="0" max="5" class="sci-input" />
                </div>
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Materiel</label>
                <textarea v-model="encForm.materiel" class="sci-textarea" rows="2" placeholder="Ex : Alambic, flacon en verre, mortier…" />
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Etapes de preparation</label>
                <textarea v-model="encForm.etapes_preparation" class="sci-textarea" rows="4" placeholder="1. Broyer les baies…&#10;2. Faire chauffer…" />
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Notes</label>
                <textarea v-model="encForm.notes" class="sci-textarea" rows="2" />
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Ingredients</label>
                <div class="enc-ing-editor">
                  <div v-for="(ing, idx) in encForm.ingredients" :key="idx" class="enc-ing-row">
                    <div class="enc-ing-search" style="flex:2">
                      <input
                        v-model="ing._search"
                        class="sci-input"
                        :placeholder="ing.id ? ingNomById(ing.id) : 'Rechercher…'"
                        autocomplete="off"
                        @input="ing.id = ''"
                        @focus="ing._open = true"
                        @blur="closeIngSearch(ing)"
                      />
                      <div v-if="ing._open && ing._search && ingSuggestions(ing._search).length" class="enc-ing-dropdown">
                        <div
                          v-for="s in ingSuggestions(ing._search)" :key="s.id"
                          class="enc-ing-option"
                          @mousedown.prevent="ing.id = s.id; ing._search = s.nom; ing._open = false"
                        >
                          <span class="enc-ing-option-nom">{{ s.nom }}</span>
                          <span class="enc-ing-option-cat" :style="{ color: catColor(s.categorie) }">{{ catLabel(s.categorie) }}</span>
                        </div>
                      </div>
                    </div>
                    <input v-model="ing.quantite" class="sci-input" placeholder="Quantite" style="flex:1" />
                    <button class="sci-btn sci-btn--danger sci-btn--sm" @click="encForm.ingredients.splice(idx, 1)">X</button>
                  </div>
                  <button class="sci-btn sci-btn--sm sci-btn--outline" @click="encForm.ingredients.push({ id: '', quantite: '', _search: '', _open: false })">+ Ingredient</button>
                </div>
              </div>
            </template>

            <!-- Ingredient form -->
            <template v-if="encFormType === 'ingredient'">
              <div class="sci-form-group">
                <label class="sci-label">Nom *</label>
                <input v-model="encForm.nom" class="sci-input" />
              </div>
              <div class="sci-form-row">
                <div class="sci-form-group">
                  <label class="sci-label">Categorie</label>
                  <select v-model="encForm.categorie" class="sci-select">
                    <option value="plante_toxique">Plante toxique</option>
                    <option value="plante_medicinale">Plante medicinale</option>
                    <option value="ressource">Ressource</option>
                    <option value="produit_chimique">Produit chimique</option>
                  </select>
                </div>
                <div class="sci-form-group">
                  <label class="sci-label">Danger (0-5)</label>
                  <input v-model.number="encForm.danger" type="number" min="0" max="5" class="sci-input" />
                </div>
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Proprietes</label>
                <textarea v-model="encForm.proprietes" class="sci-textarea" rows="2" />
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Localisation</label>
                <input v-model="encForm.localisation" class="sci-input" />
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Obtention</label>
                <input v-model="encForm.obtention" class="sci-input" />
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Description</label>
                <textarea v-model="encForm.description" class="sci-textarea" rows="2" />
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Utilite</label>
                <input v-model="encForm.utilite_rp" class="sci-input" />
              </div>
            </template>

            <!-- Scientist form -->
            <template v-if="encFormType === 'scientist'">
              <div class="sci-form-group">
                <label class="sci-label">Nom *</label>
                <input v-model="encForm.nom" class="sci-input" />
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Affinite</label>
                <input v-model="encForm.affinite" class="sci-input" />
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Description</label>
                <textarea v-model="encForm.description" class="sci-textarea" rows="3" />
              </div>
            </template>

            <!-- Experiment form -->
            <template v-if="encFormType === 'experiment'">
              <div class="sci-form-group">
                <label class="sci-label">Nom *</label>
                <input v-model="encForm.nom" class="sci-input" />
              </div>
              <div class="sci-form-row">
                <div class="sci-form-group">
                  <label class="sci-label">Responsable</label>
                  <select v-model="encForm.responsable_id" class="sci-select">
                    <option value="">-- Aucun --</option>
                    <option v-for="s in scientists" :key="s.id" :value="s.id">{{ s.nom }}</option>
                  </select>
                </div>
                <div class="sci-form-group">
                  <label class="sci-label">Statut</label>
                  <select v-model="encForm.statut" class="sci-select">
                    <option value="proposition">Proposition</option>
                    <option value="autorisee">Autorisee</option>
                    <option value="en_cours">En cours</option>
                    <option value="terminee">Terminee</option>
                    <option value="echec">Echec</option>
                    <option value="suspendue">Suspendue</option>
                    <option value="refusee">Refusee</option>
                  </select>
                </div>
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Objectif</label>
                <textarea v-model="encForm.objectif" class="sci-textarea" rows="2" />
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Hypothese</label>
                <textarea v-model="encForm.hypothese" class="sci-textarea" rows="2" />
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Protocole</label>
                <textarea v-model="encForm.protocole" class="sci-textarea" rows="2" />
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Observations</label>
                <textarea v-model="encForm.observations" class="sci-textarea" rows="2" />
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Resultats</label>
                <textarea v-model="encForm.resultats" class="sci-textarea" rows="2" />
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Conclusion</label>
                <textarea v-model="encForm.conclusion" class="sci-textarea" rows="2" />
              </div>
            </template>

            <!-- Project form -->
            <template v-if="encFormType === 'project'">
              <div class="sci-form-group">
                <label class="sci-label">Nom *</label>
                <input v-model="encForm.nom" class="sci-input" />
              </div>
              <div class="sci-form-row">
                <div class="sci-form-group">
                  <label class="sci-label">Responsable</label>
                  <select v-model="encForm.responsable_id" class="sci-select">
                    <option value="">-- Aucun --</option>
                    <option v-for="s in scientists" :key="s.id" :value="s.id">{{ s.nom }}</option>
                  </select>
                </div>
                <div class="sci-form-group">
                  <label class="sci-label">Statut</label>
                  <select v-model="encForm.statut" class="sci-select">
                    <option value="en_cours">En cours</option>
                    <option value="termine">Termine</option>
                    <option value="abandonne">Abandonne</option>
                  </select>
                </div>
                <div class="sci-form-group">
                  <label class="sci-label">Progression (%)</label>
                  <input v-model.number="encForm.progression" type="number" min="0" max="100" class="sci-input" />
                </div>
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Description</label>
                <textarea v-model="encForm.description" class="sci-textarea" rows="2" />
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Principe</label>
                <textarea v-model="encForm.principe" class="sci-textarea" rows="2" />
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Architecture</label>
                <textarea v-model="encForm.architecture" class="sci-textarea" rows="2" />
              </div>
              <div class="sci-form-group">
                <label class="sci-label">Notes</label>
                <textarea v-model="encForm.notes" class="sci-textarea" rows="2" />
              </div>
            </template>

            <!-- Champ image (commun à tous les types) -->
            <div class="sci-form-group">
              <label class="sci-label">Image</label>
              <div class="sci-img-zone" @paste="handleImagePaste" tabindex="0">
                <img v-if="encForm.image_url" :src="SERVER_URL + encForm.image_url" class="sci-img-zone-preview" :alt="encForm.nom" />
                <div v-else class="sci-img-zone-empty">
                  <span class="sci-img-zone-hint">Ctrl+V pour coller</span>
                </div>
                <div class="sci-img-zone-actions">
                  <label class="sci-btn sci-btn--sm sci-btn--outline sci-upload-label">
                    {{ uploadingImage ? 'Upload...' : (encForm.image_url ? 'Changer' : '+ Fichier') }}
                    <input type="file" accept="image/*" style="display:none" :disabled="uploadingImage" @change="handleImageUpload" />
                  </label>
                  <button v-if="encForm.image_url" class="sci-btn sci-btn--sm sci-btn--danger" @click.prevent="encForm.image_url = ''">Retirer</button>
                  <span v-if="uploadingImage" class="sci-img-uploading">Upload…</span>
                </div>
              </div>
            </div>

            <p v-if="encErr" class="sci-err">{{ encErr }}</p>
            <div class="sci-modal-actions">
              <button class="sci-btn" :disabled="savingEnc || uploadingImage" @click="saveEncForm">{{ savingEnc ? '...' : (encEditing ? 'Enregistrer' : 'Creer') }}</button>
              <button class="sci-btn sci-btn--ghost" @click="showEncForm = false">Annuler</button>
            </div>
          </div>
        </div>
      </Transition>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import AppNavbar from './AppNavbar.vue'
import {
  sciMe, sciGetRoles, sciCreateRole, sciUpdateRole, sciDeleteRole,
  sciGetMembres, sciAddMembre, sciUpdateMembre, sciRemoveMembre,
  sciGetCategories, sciCreateCategorie, sciUpdateCategorie, sciDeleteCategorie,
  sciAddChamp, sciUpdateChamp, sciDeleteChamp,
  sciGetUsers,
  encGetScientists, encGetScientist, encCreateScientist, encUpdateScientist, encDeleteScientist,
  encGetIngredients, encGetIngredient, encCreateIngredient, encUpdateIngredient, encDeleteIngredient,
  encGetPotions, encGetPotion, encCreatePotion, encUpdatePotion, encDeletePotion,
  encGetExperiments, encGetExperiment, encCreateExperiment, encUpdateExperiment, encDeleteExperiment,
  encGetProjects, encGetProject, encCreateProject, encUpdateProject, encDeleteProject,
  encSearch,
  sciGetEffets, sciCreateEffet, sciUpdateEffet, sciDeleteEffet,
  uploadImage, SERVER_URL,
} from '../api.js'

// ── State principal ───────────────────────────────────────────────────────────

const access      = ref(null)
const accesDenie  = ref(false)
const onglet      = ref('dashboard')
const gestionOnglet = ref('roles')

const categories  = ref([])
const roles       = ref([])
const membres     = ref([])
const allUsers    = ref([])

// Encyclopedie data
const potions       = ref([])
const allIngredients = ref([])
const experiments   = ref([])
const projects      = ref([])
const scientists    = ref([])

// Effets Ressentis
const effets        = ref([])

// Detail view
const detail       = ref(null)
const detailType   = ref('')

// Filters
const potionFilter     = ref('')
const ingredientFilter = ref('')

// Search
const searchQuery   = ref('')
const searchResults = ref(null)
let searchTimeout = null

const tabs = computed(() => {
  const t = [
    { key: 'dashboard',   label: 'Tableau de bord' },
    { key: 'potions',     label: 'Potions' },
    { key: 'ingredients', label: 'Ingredients' },
    { key: 'experiments', label: 'Experiences' },
    { key: 'projects',    label: 'Projets' },
    { key: 'scientists',  label: 'Scientifiques' },
    { key: 'search',      label: 'Recherche' },
    { key: 'effets',      label: 'Effets' },
    { key: 'membres',     label: 'Membres' },
  ]
  if (access.value?.dirigeant) t.push({ key: 'gestion', label: 'Gestion' })
  return t
})

const gestionSubtabs = [
  { key: 'roles',      label: 'Roles' },
  { key: 'membres',    label: 'Membres' },
  { key: 'categories', label: 'Categories' },
]

const canCreatePerm = computed(() => !!access.value?.role?.can_create_items)
const canEdit       = computed(() => !!access.value?.role?.can_edit_items)
const canDeletePerm = computed(() => !!access.value?.role?.can_delete_items)

// ── Helpers ───────────────────────────────────────────────────────────────────

// ── Pagination ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 12

const potionPage     = ref(1)
const ingredientPage = ref(1)
const experimentPage = ref(1)
const projectPage    = ref(1)
const scientistPage  = ref(1)

watch(potionFilter, () => { potionPage.value = 1 })
watch(ingredientFilter, () => { ingredientPage.value = 1 })

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(text, n = 90) {
  if (!text) return ''
  return text.length > n ? text.slice(0, n).trimEnd() + '…' : text
}

function parseOptions(raw) {
  try { return JSON.parse(raw) } catch { return [] }
}

function roleColor(ordre) {
  if (ordre >= 8) return '#c9a84c'
  if (ordre >= 5) return '#8b1a1a'
  return 'rgba(255,255,255,0.2)'
}

function statutColor(s) {
  const map = { theorique: 'rgba(255,255,255,0.3)', experimentale: '#c9a84c', testee: '#4a9eca', validee: '#4a8a4a', instable: '#8b1a1a' }
  return map[s] || 'rgba(255,255,255,0.2)'
}
function statutLabel(s) {
  const map = { theorique: 'Theorique', experimentale: 'Experimentale', testee: 'Testee', validee: 'Validee', instable: 'Instable' }
  return map[s] || s
}

function catColor(c) {
  const map = { plante_toxique: '#8b1a1a', plante_medicinale: '#4a8a4a', ressource: '#c9a84c', produit_chimique: '#4a6a8a' }
  return map[c] || 'rgba(255,255,255,0.2)'
}
function catLabel(c) {
  const map = { plante_toxique: 'Plante toxique', plante_medicinale: 'Plante medicinale', ressource: 'Ressource', produit_chimique: 'Produit chimique' }
  return map[c] || c
}

function expStatutColor(s) {
  const map = { proposition: 'rgba(255,255,255,0.3)', autorisee: '#c9a84c', en_cours: '#4a9eca', terminee: '#4a8a4a', echec: '#8b1a1a', suspendue: '#7a5a2a', refusee: '#6a2a2a' }
  return map[s] || 'rgba(255,255,255,0.2)'
}
function expStatutLabel(s) {
  const map = { proposition: 'Proposition', autorisee: 'Autorisee', en_cours: 'En cours', terminee: 'Terminee', echec: 'Echec', suspendue: 'Suspendue', refusee: 'Refusee' }
  return map[s] || s
}

function projStatutColor(s) {
  const map = { en_cours: '#4a9eca', termine: '#4a8a4a', abandonne: '#8b1a1a' }
  return map[s] || 'rgba(255,255,255,0.2)'
}
function projStatutLabel(s) {
  const map = { en_cours: 'En cours', termine: 'Termine', abandonne: 'Abandonne' }
  return map[s] || s
}

function potionNameById(id) {
  const p = potions.value.find(x => x.id === id)
  return p ? p.nom : id
}

function ingNomById(id) {
  const i = allIngredients.value.find(x => x.id === id)
  return i ? i.nom : id
}

function ingSuggestions(search) {
  const q = search.trim().toLowerCase()
  if (!q) return []
  return allIngredients.value.filter(i => i.nom.toLowerCase().includes(q)).slice(0, 8)
}

function closeIngSearch(ing) {
  setTimeout(() => { ing._open = false }, 150)
}

const parsedPotionsUsed = computed(() => {
  if (!detail.value?.potions_utilisees) return []
  try { return JSON.parse(detail.value.potions_utilisees) } catch { return [] }
})

const filteredPotions = computed(() => {
  if (!potionFilter.value) return potions.value
  return potions.value.filter(p => p.statut === potionFilter.value)
})

const filteredIngredients = computed(() => {
  if (!ingredientFilter.value) return allIngredients.value
  return allIngredients.value.filter(i => i.categorie === ingredientFilter.value)
})

const pagedPotions = computed(() => {
  const start = (potionPage.value - 1) * ITEMS_PER_PAGE
  return filteredPotions.value.slice(start, start + ITEMS_PER_PAGE)
})
const potionTotalPages = computed(() => Math.ceil(filteredPotions.value.length / ITEMS_PER_PAGE))

const pagedIngredients = computed(() => {
  const start = (ingredientPage.value - 1) * ITEMS_PER_PAGE
  return filteredIngredients.value.slice(start, start + ITEMS_PER_PAGE)
})
const ingredientTotalPages = computed(() => Math.ceil(filteredIngredients.value.length / ITEMS_PER_PAGE))

const pagedExperiments = computed(() => {
  const start = (experimentPage.value - 1) * ITEMS_PER_PAGE
  return experiments.value.slice(start, start + ITEMS_PER_PAGE)
})
const experimentTotalPages = computed(() => Math.ceil(experiments.value.length / ITEMS_PER_PAGE))

const pagedProjects = computed(() => {
  const start = (projectPage.value - 1) * ITEMS_PER_PAGE
  return projects.value.slice(start, start + ITEMS_PER_PAGE)
})
const projectTotalPages = computed(() => Math.ceil(projects.value.length / ITEMS_PER_PAGE))

const pagedScientists = computed(() => {
  const start = (scientistPage.value - 1) * ITEMS_PER_PAGE
  return scientists.value.slice(start, start + ITEMS_PER_PAGE)
})
const scientistTotalPages = computed(() => Math.ceil(scientists.value.length / ITEMS_PER_PAGE))

// ── Init ──────────────────────────────────────────────────────────────────────

async function loadAll() {
  try {
    const [a, rols, mems, cats] = await Promise.all([
      sciMe(), sciGetRoles(), sciGetMembres(), sciGetCategories(),
    ])
    access.value     = a
    roles.value      = rols
    membres.value    = mems
    categories.value = cats
    if (a?.dirigeant) {
      allUsers.value = await sciGetUsers()
    }
    // Load encyclopedie data
    await loadEncData()
  } catch (e) {
    accesDenie.value = true
    access.value     = {}
  }
}

async function loadEncData() {
  const [pots, ings, exps, projs, scis, effetsData] = await Promise.all([
    encGetPotions(), encGetIngredients(), encGetExperiments(), encGetProjects(), encGetScientists(), sciGetEffets(),
  ])
  potions.value       = pots
  allIngredients.value = ings
  experiments.value   = exps
  projects.value      = projs
  scientists.value    = scis
  effets.value        = effetsData
}

onMounted(loadAll)

// ── Navigation ───────────────────────────────────────────────────────────────

function switchTab(key) {
  onglet.value   = key
  detail.value   = null
  detailType.value = ''
}

function closeDetail() {
  detail.value   = null
  detailType.value = ''
}

async function navigateTo(section, id) {
  const tabMap = { potions: 'potions', ingredients: 'ingredients', experiments: 'experiments', projects: 'projects', scientists: 'scientists' }
  onglet.value = tabMap[section] || section
  detail.value = null
  detailType.value = ''
  try {
    if (section === 'potions') { detail.value = await encGetPotion(id); detailType.value = 'potion' }
    else if (section === 'ingredients') { detail.value = await encGetIngredient(id); detailType.value = 'ingredient' }
    else if (section === 'experiments') { detail.value = await encGetExperiment(id); detailType.value = 'experiment' }
    else if (section === 'projects') { detail.value = await encGetProject(id); detailType.value = 'project' }
    else if (section === 'scientists') { detail.value = await encGetScientist(id); detailType.value = 'scientist' }
  } catch (e) { alert(e.message) }
}

// ── Detail openers ───────────────────────────────────────────────────────────

async function openPotionDetail(id) {
  try { detail.value = await encGetPotion(id); detailType.value = 'potion' } catch (e) { alert(e.message) }
}
async function openIngredientDetail(id) {
  try { detail.value = await encGetIngredient(id); detailType.value = 'ingredient' } catch (e) { alert(e.message) }
}
async function openExperimentDetail(id) {
  try { detail.value = await encGetExperiment(id); detailType.value = 'experiment' } catch (e) { alert(e.message) }
}
async function openProjectDetail(id) {
  try { detail.value = await encGetProject(id); detailType.value = 'project' } catch (e) { alert(e.message) }
}
async function openScientistDetail(id) {
  try { detail.value = await encGetScientist(id); detailType.value = 'scientist' } catch (e) { alert(e.message) }
}

// ── Search ───────────────────────────────────────────────────────────────────

function doSearch() {
  clearTimeout(searchTimeout)
  if (searchQuery.value.length < 2) { searchResults.value = null; return }
  searchTimeout = setTimeout(async () => {
    try { searchResults.value = await encSearch(searchQuery.value) } catch { searchResults.value = { potions: [], ingredients: [], scientists: [] } }
  }, 300)
}

// ── Encyclopedie CRUD ────────────────────────────────────────────────────────

const showEncForm    = ref(false)
const encFormType    = ref('')
const encFormTitle   = ref('')
const encEditing     = ref(null)
const encForm        = ref({})
const encErr         = ref('')
const savingEnc      = ref(false)
const uploadingImage = ref(false)

async function uploadImageFile(file) {
  uploadingImage.value = true
  try {
    const url = await uploadImage(file)
    encForm.value.image_url = url
    encErr.value = ''
  } catch (err) { encErr.value = err.message }
  finally { uploadingImage.value = false }
}

async function handleImageUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  await uploadImageFile(file)
  e.target.value = ''
}

function handleImagePaste(e) {
  if (!showEncForm.value) return
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (file) uploadImageFile(file)
      break
    }
  }
}

function openCreatePotion() {
  encEditing.value = null; encFormType.value = 'potion'; encFormTitle.value = 'Nouvelle potion'
  encForm.value = { nom: '', createur_id: '', createur_nom: '', statut: 'theorique', effet_principal: '', effets_secondaires: '', description: '', jet_minimum: null, nb_fioles: null, niveau_danger: 0, materiel: '', etapes_preparation: '', notes: '', image_url: '', ingredients: [] }
  encErr.value = ''; showEncForm.value = true
}
function openEditPotion(p) {
  encEditing.value = p; encFormType.value = 'potion'; encFormTitle.value = 'Modifier la potion'
  encForm.value = { nom: p.nom, createur_id: p.createur_id || '', createur_nom: p.createur_nom || '', statut: p.statut, effet_principal: p.effet_principal || '', effets_secondaires: p.effets_secondaires || '', description: p.description || '', jet_minimum: p.jet_minimum, nb_fioles: p.nb_fioles, niveau_danger: p.niveau_danger || 0, materiel: p.materiel || '', etapes_preparation: p.etapes_preparation || '', notes: p.notes || '', image_url: p.image_url || '', ingredients: (p.ingredients || []).map(i => ({ id: i.id, quantite: i.quantite || '', _search: i.nom || '', _open: false })) }
  encErr.value = ''; showEncForm.value = true
}

function openCreateIngredient() {
  encEditing.value = null; encFormType.value = 'ingredient'; encFormTitle.value = 'Nouvel ingredient'
  encForm.value = { nom: '', categorie: 'plante_toxique', danger: 0, proprietes: '', localisation: '', obtention: '', description: '', utilite_rp: '', image_url: '' }
  encErr.value = ''; showEncForm.value = true
}
function openEditIngredient(i) {
  encEditing.value = i; encFormType.value = 'ingredient'; encFormTitle.value = "Modifier l'ingredient"
  encForm.value = { nom: i.nom, categorie: i.categorie, danger: i.danger || 0, proprietes: i.proprietes || '', localisation: i.localisation || '', obtention: i.obtention || '', description: i.description || '', utilite_rp: i.utilite_rp || '', image_url: i.image_url || '' }
  encErr.value = ''; showEncForm.value = true
}

function openCreateScientist() {
  encEditing.value = null; encFormType.value = 'scientist'; encFormTitle.value = 'Nouveau scientifique'
  encForm.value = { nom: '', affinite: '', description: '', image_url: '' }
  encErr.value = ''; showEncForm.value = true
}
function openEditScientist(s) {
  encEditing.value = s; encFormType.value = 'scientist'; encFormTitle.value = 'Modifier le scientifique'
  encForm.value = { nom: s.nom, affinite: s.affinite || '', description: s.description || '', image_url: s.image_url || '' }
  encErr.value = ''; showEncForm.value = true
}

function openCreateExperiment() {
  encEditing.value = null; encFormType.value = 'experiment'; encFormTitle.value = 'Nouvelle experience'
  encForm.value = { nom: '', responsable_id: '', statut: 'proposition', objectif: '', hypothese: '', protocole: '', observations: '', resultats: '', conclusion: '', image_url: '' }
  encErr.value = ''; showEncForm.value = true
}
function openEditExperiment(e) {
  encEditing.value = e; encFormType.value = 'experiment'; encFormTitle.value = "Modifier l'experience"
  encForm.value = { nom: e.nom, responsable_id: e.responsable_id || '', statut: e.statut, objectif: e.objectif || '', hypothese: e.hypothese || '', protocole: e.protocole || '', observations: e.observations || '', resultats: e.resultats || '', conclusion: e.conclusion || '', image_url: e.image_url || '' }
  encErr.value = ''; showEncForm.value = true
}

function openCreateProject() {
  encEditing.value = null; encFormType.value = 'project'; encFormTitle.value = 'Nouveau projet'
  encForm.value = { nom: '', responsable_id: '', statut: 'en_cours', progression: 0, description: '', principe: '', architecture: '', notes: '', image_url: '' }
  encErr.value = ''; showEncForm.value = true
}
function openEditProject(p) {
  encEditing.value = p; encFormType.value = 'project'; encFormTitle.value = 'Modifier le projet'
  encForm.value = { nom: p.nom, responsable_id: p.responsable_id || '', statut: p.statut, progression: p.progression || 0, description: p.description || '', principe: p.principe || '', architecture: p.architecture || '', notes: p.notes || '', image_url: p.image_url || '' }
  encErr.value = ''; showEncForm.value = true
}

async function saveEncForm() {
  encErr.value = ''
  if (!encForm.value.nom?.trim()) { encErr.value = 'Nom requis.'; return }
  savingEnc.value = true
  try {
    const data = { ...encForm.value }
    // Auto-fill createur_nom from scientists list
    if (data.createur_id && encFormType.value === 'potion') {
      const s = scientists.value.find(x => x.id === data.createur_id)
      if (s) data.createur_nom = s.nom
    }
    if (data.responsable_id && (encFormType.value === 'experiment' || encFormType.value === 'project')) {
      const s = scientists.value.find(x => x.id === data.responsable_id)
      if (s) data.responsable_nom = s.nom
    }

    if (encFormType.value === 'potion') {
      if (encEditing.value) {
        await encUpdatePotion(encEditing.value.id, data)
        potions.value = await encGetPotions()
        detail.value = await encGetPotion(encEditing.value.id)
      } else {
        await encCreatePotion(data)
        potions.value = await encGetPotions()
        closeDetail()
      }
    } else if (encFormType.value === 'ingredient') {
      if (encEditing.value) {
        await encUpdateIngredient(encEditing.value.id, data)
        allIngredients.value = await encGetIngredients()
        detail.value = await encGetIngredient(encEditing.value.id)
      } else {
        await encCreateIngredient(data)
        allIngredients.value = await encGetIngredients()
        closeDetail()
      }
    } else if (encFormType.value === 'scientist') {
      if (encEditing.value) {
        await encUpdateScientist(encEditing.value.id, data)
        scientists.value = await encGetScientists()
        detail.value = await encGetScientist(encEditing.value.id)
      } else {
        await encCreateScientist(data)
        scientists.value = await encGetScientists()
        closeDetail()
      }
    } else if (encFormType.value === 'experiment') {
      if (encEditing.value) {
        await encUpdateExperiment(encEditing.value.id, data)
        experiments.value = await encGetExperiments()
        detail.value = await encGetExperiment(encEditing.value.id)
      } else {
        await encCreateExperiment(data)
        experiments.value = await encGetExperiments()
        closeDetail()
      }
    } else if (encFormType.value === 'project') {
      if (encEditing.value) {
        await encUpdateProject(encEditing.value.id, data)
        projects.value = await encGetProjects()
        detail.value = await encGetProject(encEditing.value.id)
      } else {
        await encCreateProject(data)
        projects.value = await encGetProjects()
        closeDetail()
      }
    }
    showEncForm.value = false
  } catch (e) { encErr.value = e.message } finally { savingEnc.value = false }
}

async function deletePotion(id) {
  if (!confirm('Supprimer cette potion ?')) return
  try { await encDeletePotion(id); potions.value = potions.value.filter(p => p.id !== id); closeDetail() } catch (e) { alert(e.message) }
}
async function deleteIngredient(id) {
  if (!confirm('Supprimer cet ingredient ?')) return
  try { await encDeleteIngredient(id); allIngredients.value = allIngredients.value.filter(i => i.id !== id); closeDetail() } catch (e) { alert(e.message) }
}
async function deleteScientist(id) {
  if (!confirm('Supprimer ce scientifique ?')) return
  try { await encDeleteScientist(id); scientists.value = scientists.value.filter(s => s.id !== id); closeDetail() } catch (e) { alert(e.message) }
}
async function deleteExperiment(id) {
  if (!confirm('Supprimer cette experience ?')) return
  try { await encDeleteExperiment(id); experiments.value = experiments.value.filter(e => e.id !== id); closeDetail() } catch (e) { alert(e.message) }
}
async function deleteProject(id) {
  if (!confirm('Supprimer ce projet ?')) return
  try { await encDeleteProject(id); projects.value = projects.value.filter(p => p.id !== id); closeDetail() } catch (e) { alert(e.message) }
}

// ── Gestion : Roles ──────────────────────────────────────────────────────────

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
  roleForm.value    = { nom: role.nom, ordre: role.ordre, can_create_items: !!role.can_create_items, can_edit_items: !!role.can_edit_items, can_delete_items: !!role.can_delete_items, can_add_members: !!role.can_add_members }
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
  if (!confirm('Supprimer ce role ?')) return
  try { await sciDeleteRole(id); roles.value = roles.value.filter(r => r.id !== id) } catch (e) { alert(e.message) }
}

// ── Gestion : Membres ───────────────────────────────────────────────────────

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
  if (!membreForm.value.roleId) { membreErr.value = 'Role requis.'; return }
  savingMembre.value = true
  try {
    if (editingMembre.value) {
      await sciUpdateMembre(editingMembre.value.id, membreForm.value.roleId)
    } else {
      if (!membreForm.value.userId) { membreErr.value = 'Utilisateur requis.'; savingMembre.value = false; return }
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

// ── Gestion : Categories ─────────────────────────────────────────────────────

const showCatForm  = ref(false)
const editingCat   = ref(null)
const savingCat    = ref(false)
const catErr       = ref('')
const catForm      = ref({ nom: '', icone: '', ordre: 0 })

function openCreateCat() {
  editingCat.value  = null; catForm.value = { nom: '', icone: '', ordre: 0 }; catErr.value = ''; showCatForm.value = true
}
function openEditCat(cat) {
  editingCat.value = cat; catForm.value = { nom: cat.nom, icone: cat.icone, ordre: cat.ordre }; catErr.value = ''; showCatForm.value = true
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
  if (!confirm('Supprimer cette categorie ?')) return
  try { await sciDeleteCategorie(id); categories.value = categories.value.filter(c => c.id !== id) } catch (e) { alert(e.message) }
}

// ── Gestion : Champs ─────────────────────────────────────────────────────────

const showChampForm   = ref(false)
const editingChamp    = ref(null)
const champCatId      = ref(null)
const savingChamp     = ref(false)
const champErr        = ref('')
const champOptionsRaw = ref('')
const champForm       = ref({ nom: '', type: 'texte', requis: false, ordre: 0 })
const openChamps      = ref(null)

function toggleCatChamps(catId) { openChamps.value = openChamps.value === catId ? null : catId }

function openAddChamp(catId) {
  editingChamp.value = null; champCatId.value = catId; champForm.value = { nom: '', type: 'texte', requis: false, ordre: 0 }; champOptionsRaw.value = ''; champErr.value = ''; showChampForm.value = true
}
function openEditChamp(ch) {
  editingChamp.value = ch; champCatId.value = ch.categorie_id; champForm.value = { nom: ch.nom, type: ch.type, requis: !!ch.requis, ordre: ch.ordre }; champOptionsRaw.value = parseOptions(ch.options).join('\n'); champErr.value = ''; showChampForm.value = true
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
      if (cat) { const idx = cat.champs.findIndex(ch => ch.id === updated.id); if (idx !== -1) cat.champs[idx] = updated }
    } else {
      const created = await sciAddChamp(champCatId.value, payload)
      const cat = categories.value.find(c => c.id === champCatId.value)
      if (cat) cat.champs.push(created)
    }
    showChampForm.value = false
  } catch (e) { champErr.value = e.message } finally { savingChamp.value = false }
}
async function deleteChamp(id, catId) {
  if (!confirm('Supprimer ce champ ?')) return
  try { await sciDeleteChamp(id); const cat = categories.value.find(c => c.id === catId); if (cat) cat.champs = cat.champs.filter(ch => ch.id !== id) } catch (e) { alert(e.message) }
}

// ── Effets Ressentis ─────────────────────────────────────────────────────────
const showEffetForm      = ref(false)
const editingEffet       = ref(null)
const savingEffet        = ref(false)
const effetErr           = ref('')
const effetForm          = ref({ titre: '', sous_titre: '', contenu: '', symptomes: '', duree: '', intensite: 1, type: 'general', image_url: '', actif: true })
const uploadingEffetImage = ref(false)

function openCreateEffet() {
  editingEffet.value = null
  effetForm.value = { titre: '', sous_titre: '', contenu: '', symptomes: '', duree: '', intensite: 1, type: 'general', image_url: '', actif: true }
  effetErr.value = ''; showEffetForm.value = true
}
function openEditEffet(e) {
  editingEffet.value = e
  effetForm.value = { titre: e.titre, sous_titre: e.sous_titre || '', contenu: e.contenu || '', symptomes: e.symptomes || '', duree: e.duree || '', intensite: e.intensite || 1, type: e.type || 'general', image_url: e.image_url || '', actif: !!e.actif }
  effetErr.value = ''; showEffetForm.value = true
}
async function saveEffet() {
  effetErr.value = ''
  if (!effetForm.value.titre?.trim()) { effetErr.value = 'Titre requis.'; return }
  savingEffet.value = true
  try {
    const data = { ...effetForm.value, actif: effetForm.value.actif ? 1 : 0 }
    if (editingEffet.value) {
      const updated = await sciUpdateEffet(editingEffet.value.id, data)
      const idx = effets.value.findIndex(x => x.id === updated.id)
      if (idx !== -1) effets.value[idx] = updated
    } else {
      effets.value.unshift(await sciCreateEffet(data))
    }
    showEffetForm.value = false
  } catch (e) { effetErr.value = e.message } finally { savingEffet.value = false }
}
async function deleteEffet(id) {
  if (!confirm('Supprimer cet effet ?')) return
  try { await sciDeleteEffet(id); effets.value = effets.value.filter(e => e.id !== id) } catch (e) { alert(e.message) }
}
async function copyEffetLink(e) {
  const url = `${window.location.origin}/effets/${e.token}`
  await navigator.clipboard.writeText(url)
  alert(`Lien copié : ${url}`)
}

async function handleEffetImageUpload(ev) {
  const file = ev.target.files[0]; if (!file) return
  uploadingEffetImage.value = true
  try { effetForm.value.image_url = await uploadImage(file) } catch (err) { effetErr.value = err.message }
  finally { uploadingEffetImage.value = false; ev.target.value = '' }
}
function handleEffetImagePaste(e) {
  const items = e.clipboardData?.items; if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (file) {
        uploadingEffetImage.value = true
        uploadImage(file).then(url => { effetForm.value.image_url = url }).catch(err => { effetErr.value = err.message }).finally(() => { uploadingEffetImage.value = false })
      }
      break
    }
  }
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
.sci-tabs { display: flex; gap: 0; margin-bottom: 28px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-wrap: wrap; }
.sci-tab { background: none; border: none; border-bottom: 2px solid transparent; padding: 8px 14px; font-family: 'Cinzel', serif; font-size: 0.6rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.35); cursor: pointer; transition: color 0.15s, border-color 0.15s; margin-bottom: -1px; }
.sci-tab:hover { color: rgba(255,255,255,0.65); }
.sci-tab--active { color: #fff; border-bottom-color: #8b1a1a; }

.sci-subtabs { display: flex; gap: 4px; margin-bottom: 24px; flex-wrap: wrap; }
.sci-subtab { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); padding: 6px 14px; font-family: 'Cinzel', serif; font-size: 0.55rem; letter-spacing: 0.06em; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.15s; }
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

/* ── Dashboard ─────────────────────────────────────────────────── */
.enc-dashboard { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; }
.enc-stat-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); padding: 28px 20px; cursor: pointer; transition: border-color 0.15s, background 0.15s; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
.enc-stat-card:hover { border-color: rgba(139,26,26,0.4); background: rgba(139,26,26,0.05); }
.enc-stat-num { font-family: 'Cinzel', serif; font-size: 1.8rem; color: #c9a84c; line-height: 1; }
.enc-stat-label { font-family: 'Cinzel', serif; font-size: 0.62rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.45); }

/* ── Badges ────────────────────────────────────────────────────── */
.enc-badges { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.enc-badge { display: inline-block; font-family: 'Cinzel', serif; font-size: 0.55rem; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 10px; color: #fff; border-radius: 0; }
.enc-badge--sm { font-size: 0.5rem; padding: 2px 7px; }
.enc-badge--danger { background: rgba(139,26,26,0.6); }

/* ── Items grid ────────────────────────────────────────────────── */
.sci-cat-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
.sci-cat-title { font-family: 'Cinzel', serif; font-size: 1rem; letter-spacing: 0.06em; flex: 1; }
.sci-back { background: none; border: none; color: rgba(255,255,255,0.35); font-family: 'Cinzel', serif; font-size: 0.6rem; letter-spacing: 0.1em; cursor: pointer; padding: 0; transition: color 0.12s; }
.sci-back:hover { color: rgba(255,255,255,0.7); }

.sci-items-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.sci-item-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); cursor: pointer; transition: border-color 0.15s, background 0.15s; overflow: hidden; }
.sci-item-card:hover { border-color: rgba(201,168,76,0.3); background: rgba(201,168,76,0.04); }
.sci-card-img { width: 100%; height: 160px; object-fit: cover; display: block; }
.sci-card-body { padding: 14px 16px; }
.sci-item-name { font-family: 'Cinzel', serif; font-size: 0.78rem; letter-spacing: 0.04em; color: rgba(255,255,255,0.85); margin: 0 0 2px; }
.sci-item-meta { font-size: 0.8rem; color: rgba(255,255,255,0.3); font-style: italic; margin: 4px 0 0; }
.sci-card-snippet { font-size: 0.82rem; color: rgba(255,255,255,0.35); font-style: italic; margin: 6px 0 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.sci-card-progress { height: 2px; background: rgba(255,255,255,0.06); margin-top: 8px; }
.sci-card-progress-bar { height: 100%; background: #4a9eca; transition: width 0.3s; }
.sci-pagination { display: flex; align-items: center; gap: 4px; margin-top: 24px; flex-wrap: wrap; }
.sci-page-btn { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); font-family: 'Cinzel', serif; font-size: 0.6rem; letter-spacing: 0.06em; padding: 6px 12px; cursor: pointer; transition: all 0.15s; min-width: 32px; }
.sci-page-btn:hover:not(:disabled) { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.85); }
.sci-page-btn:disabled { opacity: 0.3; cursor: default; }
.sci-page-btn--active { background: rgba(139,26,26,0.2); border-color: rgba(139,26,26,0.5); color: #fff; }

.enc-filters { display: flex; gap: 8px; }
.sci-select--sm { padding: 4px 8px; font-size: 0.8rem; }

/* ── Fiche image ───────────────────────────────────────────────── */
.sci-fiche-img { margin-bottom: 24px; }
.sci-fiche-img img { max-width: 100%; max-height: 360px; width: 100%; object-fit: cover; border: 1px solid rgba(255,255,255,0.07); display: block; }

/* ── Image upload ──────────────────────────────────────────────── */
.sci-img-zone { border: 1px dashed rgba(255,255,255,0.15); background: rgba(255,255,255,0.02); transition: border-color 0.15s; outline: none; }
.sci-img-zone:focus { border-color: rgba(139,26,26,0.5); }
.sci-img-zone:focus-within { border-color: rgba(139,26,26,0.3); }
.sci-img-zone-empty { display: flex; align-items: center; justify-content: center; height: 80px; }
.sci-img-zone-hint { font-family: 'Cinzel', serif; font-size: 0.58rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.2); }
.sci-img-zone-preview { width: 100%; max-height: 180px; object-fit: cover; display: block; }
.sci-img-zone-actions { display: flex; align-items: center; gap: 8px; padding: 8px 10px; flex-wrap: wrap; }
.sci-img-uploading { font-family: 'Cinzel', serif; font-size: 0.58rem; letter-spacing: 0.08em; color: rgba(255,255,255,0.35); font-style: italic; }
.sci-upload-label { cursor: pointer !important; }

/* ── Fiche detail ──────────────────────────────────────────────── */
.sci-fiche { max-width: 700px; }
.sci-fiche-header { margin: 16px 0 24px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.sci-fiche-title { font-family: 'Cinzel', serif; font-size: 1.3rem; letter-spacing: 0.06em; margin: 0; }
.sci-fiche-body { display: flex; flex-direction: column; gap: 20px; margin-bottom: 24px; }
.sci-fiche-champ { }
.sci-champ-label { font-family: 'Cinzel', serif; font-size: 0.58rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin: 0 0 6px; }
.sci-champ-val { font-size: 1rem; color: rgba(255,255,255,0.8); margin: 0; white-space: pre-wrap; }
.sci-fiche-actions { display: flex; gap: 8px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.06); }

/* ── Ingredient badges (clickable) ─────────────────────────────── */
.enc-ingredient-list { display: flex; flex-wrap: wrap; gap: 6px; }
.enc-ingredient-badge { display: inline-block; font-family: 'Cinzel', serif; font-size: 0.6rem; letter-spacing: 0.04em; padding: 4px 12px; border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.75); cursor: pointer; transition: all 0.15s; background: rgba(255,255,255,0.03); }
.enc-ingredient-badge:hover { background: rgba(255,255,255,0.08); border-color: rgba(201,168,76,0.4); color: #fff; }
.enc-qty { color: rgba(255,255,255,0.4); font-style: italic; }

.enc-link { color: #c9a84c; cursor: pointer; text-decoration: none; border-bottom: 1px solid rgba(201,168,76,0.3); }
.enc-link:hover { border-bottom-color: #c9a84c; }

/* ── Search ────────────────────────────────────────────────────── */
.enc-search-box { margin-bottom: 24px; }
.enc-search-results { display: flex; flex-direction: column; gap: 20px; }
.enc-search-group { }

/* ── Ingredient editor (in potion form) ────────────────────────── */
.enc-ing-editor { display: flex; flex-direction: column; gap: 6px; }
.enc-ing-row { display: flex; gap: 6px; align-items: flex-start; }
.enc-ing-search { position: relative; }
.enc-ing-dropdown { position: absolute; top: 100%; left: 0; right: 0; z-index: 200; background: #0e1117; border: 1px solid rgba(255,255,255,0.12); border-top: none; max-height: 220px; overflow-y: auto; }
.enc-ing-option { display: flex; justify-content: space-between; align-items: center; padding: 7px 12px; cursor: pointer; gap: 8px; transition: background 0.1s; }
.enc-ing-option:hover { background: rgba(255,255,255,0.05); }
.enc-ing-option-nom { font-family: 'Cinzel', serif; font-size: 0.68rem; letter-spacing: 0.04em; color: rgba(255,255,255,0.85); }
.enc-ing-option-cat { font-family: 'Crimson Text', Georgia, serif; font-size: 0.78rem; font-style: italic; flex-shrink: 0; }

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

/* ── Gestion categories ────────────────────────────────────────── */
.sci-cat-manage-list { display: flex; flex-direction: column; gap: 4px; }
.sci-cat-manage-row { border: 1px solid rgba(255,255,255,0.06); }
.sci-cat-manage-top { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: rgba(255,255,255,0.02); gap: 12px; }
.sci-champs-panel { border-top: 1px solid rgba(255,255,255,0.05); padding: 12px 16px; background: rgba(0,0,0,0.2); display: flex; flex-direction: column; gap: 8px; }
.sci-champ-row { display: flex; align-items: center; gap: 10px; }
.sci-champ-nom { font-family: 'Cinzel', serif; font-size: 0.68rem; color: rgba(255,255,255,0.75); flex: 1; }
.sci-champ-type { font-size: 0.72rem; color: rgba(255,255,255,0.3); font-style: italic; }

/* ── Modale ────────────────────────────────────────────────────── */
.sci-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 300; display: flex; align-items: center; justify-content: center; padding: 24px; }
.sci-modal { background: #0e1117; border: 1px solid rgba(255,255,255,0.1); padding: 28px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
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

/* ── Effets Ressentis ──────────────────────────────────────────── */
.sci-effet-card { display: flex; flex-direction: column; }
.sci-effet-header-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 2px; }
.sci-effet-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); }
.sci-effet-actions .sci-btn { padding: 4px 10px; font-size: 0.55rem; }

/* ── Transitions ───────────────────────────────────────────────── */
.sci-modal-enter-active, .sci-modal-leave-active { transition: opacity 0.2s; }
.sci-modal-enter-from, .sci-modal-leave-to { opacity: 0; }
</style>

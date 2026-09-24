const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Wrapper central : ajoute credentials, Content-Type, et gère le refresh automatique.
// Sur un 401, on tente POST /auth/refresh une fois (nouveau access token via cookie),
// puis on rejoue la requête originale. Si le refresh échoue, on retourne le 401.
async function apiFetch(url, options = {}) {
  const headers = { ...options.headers }
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }

  const init = { ...options, credentials: 'include', headers }
  let res = await fetch(url, init)

  if (res.status === 401 && !url.includes('/auth/')) {
    const refreshRes = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    if (refreshRes.ok) {
      res = await fetch(url, init)
    }
  }

  return res
}

export async function register(identifiant, nom, mot_de_passe) {
  const res = await apiFetch(`${BASE}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ identifiant, nom, mot_de_passe }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.user
}

export async function login(identifiant, mot_de_passe) {
  const res = await apiFetch(`${BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ identifiant, mot_de_passe }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.user
}

export async function logout() {
  await apiFetch(`${BASE}/auth/logout`, { method: 'POST' })
}

export async function getMe() {
  const res = await apiFetch(`${BASE}/auth/me`)
  if (!res.ok) return null
  const data = await res.json()
  return data.user
}

export async function joinSphere(id) {
  const res = await apiFetch(`${BASE}/auth/spheres/${id}/join`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function leaveSphere(id) {
  const res = await apiFetch(`${BASE}/auth/spheres/${id}/leave`, { method: 'DELETE' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function updateProfile({ pouvoir_nom, grade, role, signature } = {}) {
  const res = await apiFetch(`${BASE}/auth/profile`, {
    method: 'PATCH',
    body: JSON.stringify({ pouvoir_nom, grade, role, signature }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.user
}

// ── Sphères ────────────────────────────────────────────────────────────────

export async function getSpheres() {
  const res = await apiFetch(`${BASE}/spheres`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.spheres
}

export async function getSphere(id) {
  const res = await apiFetch(`${BASE}/spheres/${id}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function createSphere(nom, description, chef_id) {
  const res = await apiFetch(`${BASE}/spheres`, {
    method: 'POST',
    body: JSON.stringify({ nom, description, chef_id }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.sphere
}

export async function deleteSphere(id) {
  const res = await apiFetch(`${BASE}/spheres/${id}`, { method: 'DELETE' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function addMembreSphere(sphereId, user_id, grade) {
  const res = await apiFetch(`${BASE}/spheres/${sphereId}/membres`, {
    method: 'POST',
    body: JSON.stringify({ user_id, grade }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function updateGradeMembre(sphereId, userId, grade) {
  const res = await apiFetch(`${BASE}/spheres/${sphereId}/membres/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ grade }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function getSphereGrades(sphereId) {
  const res = await apiFetch(`${BASE}/spheres/${sphereId}/grades`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.grades
}

export async function createSphereGrade(sphereId, nom, ordre) {
  const res = await apiFetch(`${BASE}/spheres/${sphereId}/grades`, {
    method: 'POST',
    body: JSON.stringify({ nom, ordre }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.grade
}

export async function deleteSphereGrade(sphereId, gradeId) {
  const res = await apiFetch(`${BASE}/spheres/${sphereId}/grades/${gradeId}`, { method: 'DELETE' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function removeMembreSphere(sphereId, userId) {
  const res = await apiFetch(`${BASE}/spheres/${sphereId}/membres/${userId}`, { method: 'DELETE' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function deleteUser(id) {
  const res = await apiFetch(`${BASE}/auth/users/${id}`, { method: 'DELETE' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function adminUpdateUser(id, fields) {
  const res = await apiFetch(`${BASE}/auth/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.user
}

export async function setUserRole(id, role) {
  const res = await apiFetch(`${BASE}/auth/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function getUsers() {
  const res = await apiFetch(`${BASE}/auth/users`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.users
}

// ── Projets ────────────────────────────────────────────────────────────────

export async function getMesProjets() {
  const res = await apiFetch(`${BASE}/projets`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.projets
}

export async function getProjet(token) {
  const res = await apiFetch(`${BASE}/projets/${token}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.projet
}

export async function createProjet(titre, doc_titre, contenu) {
  const res = await apiFetch(`${BASE}/projets`, {
    method: 'POST',
    body: JSON.stringify({ titre, doc_titre, contenu }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.projet
}

export async function updateProjet(token, titre, doc_titre, contenu) {
  const res = await apiFetch(`${BASE}/projets/${token}`, {
    method: 'PATCH',
    body: JSON.stringify({ titre, doc_titre, contenu }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function deleteProjet(token) {
  const res = await apiFetch(`${BASE}/projets/${token}`, { method: 'DELETE' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

// ── Upload ─────────────────────────────────────────────────────────────────

export async function uploadImage(file) {
  const fd = new FormData()
  fd.append('image', file)
  const res = await apiFetch(`${BASE}/upload`, {
    method: 'POST',
    body: fd,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.url
}

// ── Paris ──────────────────────────────────────────────────────────────────

export async function getParis() {
  const res = await apiFetch(`${BASE}/paris`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.paris
}

export async function createPari(titre, description, issues) {
  const res = await apiFetch(`${BASE}/paris`, {
    method: 'POST',
    body: JSON.stringify({ titre, description, issues }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.pari
}

export async function deletePari(id) {
  const res = await apiFetch(`${BASE}/paris/${id}`, { method: 'DELETE' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function addMise(pariId, joueur_nom, issue_id, montant) {
  const res = await apiFetch(`${BASE}/paris/${pariId}/mises`, {
    method: 'POST',
    body: JSON.stringify({ joueur_nom, issue_id, montant }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.pari
}

export async function deleteMise(pariId, miseId) {
  const res = await apiFetch(`${BASE}/paris/${pariId}/mises/${miseId}`, { method: 'DELETE' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.pari
}

export async function resoudrePari(pariId, issue_gagnante_id) {
  const res = await apiFetch(`${BASE}/paris/${pariId}/resoudre`, {
    method: 'POST',
    body: JSON.stringify({ issue_gagnante_id }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.pari
}

// ── Rapports ───────────────────────────────────────────────────────────────

export async function getRapports() {
  const res = await apiFetch(`${BASE}/rapports`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.rapports
}

export async function getRapport(slug) {
  const res = await apiFetch(`${BASE}/rapports/${slug}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.rapport
}

export async function createRapport(type, titre, contenu, brouillon = false) {
  const res = await apiFetch(`${BASE}/rapports`, {
    method: 'POST',
    body: JSON.stringify({ type, titre, contenu, brouillon }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.rapport
}

export async function updateRapport(slug, { type, titre, contenu, brouillon } = {}) {
  const res = await apiFetch(`${BASE}/rapports/${slug}`, {
    method: 'PATCH',
    body: JSON.stringify({ type, titre, contenu, brouillon }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.rapport
}

export async function updateStatutRapport(slug, statut) {
  const res = await apiFetch(`${BASE}/rapports/${slug}/statut`, {
    method: 'PATCH',
    body: JSON.stringify({ statut }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function deleteRapport(slug) {
  const res = await apiFetch(`${BASE}/rapports/${slug}`, { method: 'DELETE' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

// ── Parchemins ─────────────────────────────────────────────────────────────

export async function getMesParchemins() {
  const res = await apiFetch(`${BASE}/parchemins`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.parchemins
}

export async function getParchemin(token) {
  const res = await apiFetch(`${BASE}/parchemins/${token}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.parchemin
}

export async function createParchemin(titre, doc_titre, contenu) {
  const res = await apiFetch(`${BASE}/parchemins`, {
    method: 'POST',
    body: JSON.stringify({ titre, doc_titre, contenu }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.parchemin
}

export async function updateParchemin(token, titre, doc_titre, contenu) {
  const res = await apiFetch(`${BASE}/parchemins/${token}`, {
    method: 'PATCH',
    body: JSON.stringify({ titre, doc_titre, contenu }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function deleteParchemin(token) {
  const res = await apiFetch(`${BASE}/parchemins/${token}`, { method: 'DELETE' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

// ── Slots ───────────────────────────────────────────────────────────────────

// Origine du serveur pour construire les URLs d'images
export const IMG_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '')

export async function getSlotsConfig() {
  const res = await apiFetch(`${BASE}/slots/config`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function spinSlots(mise) {
  const res = await apiFetch(`${BASE}/slots/spin`, {
    method: 'POST',
    body: JSON.stringify({ mise }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function getSlotsAdminSymbols() {
  const res = await apiFetch(`${BASE}/slots/admin/symbols`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.symboles
}

export async function createSlotsSymbol(formData) {
  const res = await apiFetch(`${BASE}/slots/admin/symbols`, { method: 'POST', body: formData })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.symbol
}

export async function updateSlotsSymbol(id, formData) {
  const res = await apiFetch(`${BASE}/slots/admin/symbols/${id}`, { method: 'PATCH', body: formData })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.symbol
}

export async function deleteSlotsSymbol(id) {
  const res = await apiFetch(`${BASE}/slots/admin/symbols/${id}`, { method: 'DELETE' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function getSlotsAdminConfig() {
  const res = await apiFetch(`${BASE}/slots/admin/config`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.config
}

export async function updateSlotsConfig(mise_min, mise_max, nb_colonnes) {
  const res = await apiFetch(`${BASE}/slots/admin/config`, {
    method: 'PATCH',
    body: JSON.stringify({ mise_min, mise_max, nb_colonnes }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.config
}

export async function getSlotsWebhook() {
  const res = await apiFetch(`${BASE}/slots/admin/webhook`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.webhook
}

export async function updateSlotsWebhook(webhook) {
  const res = await apiFetch(`${BASE}/slots/admin/webhook`, {
    method: 'PATCH',
    body: JSON.stringify({ webhook }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function testSlotsWebhook() {
  const res = await apiFetch(`${BASE}/slots/admin/webhook/test`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function wipeStats() {
  const res = await apiFetch(`${BASE}/slots/admin/stats`, { method: 'DELETE' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function getSlotsAdminStats() {
  const res = await apiFetch(`${BASE}/slots/admin/stats`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function getSlotsAdminLogs({ limit = 100, offset = 0, joueur = '' } = {}) {
  const params = new URLSearchParams({ limit, offset })
  if (joueur) params.set('joueur', joueur)
  const res = await apiFetch(`${BASE}/slots/admin/logs?${params}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function getSlotsAdminJoueurs() {
  const res = await apiFetch(`${BASE}/slots/admin/joueurs`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.joueurs
}

export async function updateJoueurSolde(id, montant, operation) {
  const res = await apiFetch(`${BASE}/slots/admin/joueurs/${id}/solde`, {
    method: 'PATCH',
    body: JSON.stringify({ montant, operation }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.joueur
}

// ── Blackjack Lobby ────────────────────────────────────────────────────────

export async function getBlackjackTables() {
  const res = await apiFetch(`${BASE}/blackjack-lobby/tables`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.tables
}

// ── Roulette ───────────────────────────────────────────────────────────────

// ── Blackjack ──────────────────────────────────────────────────────────────────

export async function blackjackNew(mise) {
  const res = await apiFetch(`${BASE}/blackjack/new`, {
    method: 'POST',
    body: JSON.stringify({ mise }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function blackjackHit() {
  const res = await apiFetch(`${BASE}/blackjack/hit`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function blackjackStand() {
  const res = await apiFetch(`${BASE}/blackjack/stand`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function blackjackDouble() {
  const res = await apiFetch(`${BASE}/blackjack/double`, { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function spinRoulette(mises) {
  const res = await apiFetch(`${BASE}/roulette/spin`, {
    method: 'POST',
    body: JSON.stringify({ mises }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

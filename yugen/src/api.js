const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

function getToken() {
  return localStorage.getItem('token')
}

export async function register(identifiant, nom, mot_de_passe) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiant, nom, mot_de_passe }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  localStorage.setItem('token', data.token)
  return data.user
}

export async function login(identifiant, mot_de_passe) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiant, mot_de_passe }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  localStorage.setItem('token', data.token)
  return data.user
}

export async function getMe() {
  const res = await fetch(`${BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.user
}

export async function updateProfile(pouvoir_nom) {
  const res = await fetch(`${BASE}/auth/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ pouvoir_nom }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.user
}

// ── Sphères ────────────────────────────────────────────────────────────────

export async function getSpheres() {
  const res = await fetch(`${BASE}/spheres`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.spheres
}

export async function getSphere(id) {
  const res = await fetch(`${BASE}/spheres/${id}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function createSphere(nom, description, chef_id) {
  const res = await fetch(`${BASE}/spheres`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ nom, description, chef_id }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.sphere
}

export async function deleteSphere(id) {
  const res = await fetch(`${BASE}/spheres/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function addMembreSphere(sphereId, user_id, grade) {
  const res = await fetch(`${BASE}/spheres/${sphereId}/membres`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ user_id, grade }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function updateGradeMembre(sphereId, userId, grade) {
  const res = await fetch(`${BASE}/spheres/${sphereId}/membres/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ grade }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function getSphereGrades(sphereId) {
  const res = await fetch(`${BASE}/spheres/${sphereId}/grades`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.grades
}

export async function createSphereGrade(sphereId, nom, ordre) {
  const res = await fetch(`${BASE}/spheres/${sphereId}/grades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ nom, ordre }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.grade
}

export async function deleteSphereGrade(sphereId, gradeId) {
  const res = await fetch(`${BASE}/spheres/${sphereId}/grades/${gradeId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function removeMembreSphere(sphereId, userId) {
  const res = await fetch(`${BASE}/spheres/${sphereId}/membres/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function getUsers() {
  const res = await fetch(`${BASE}/auth/users`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.users
}

// ── Projets ────────────────────────────────────────────────────────────────

export async function getMesProjets() {
  const res = await fetch(`${BASE}/projets`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.projets
}

export async function getProjet(token) {
  const res = await fetch(`${BASE}/projets/${token}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.projet
}

export async function createProjet(titre, doc_titre, contenu) {
  const res = await fetch(`${BASE}/projets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ titre, doc_titre, contenu }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.projet
}

export async function updateProjet(token, titre, doc_titre, contenu) {
  const res = await fetch(`${BASE}/projets/${token}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ titre, doc_titre, contenu }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function deleteProjet(token) {
  const res = await fetch(`${BASE}/projets/${token}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export function logout() {
  localStorage.removeItem('token')
}

// ── Upload ─────────────────────────────────────────────────────────────────

export async function uploadImage(file) {
  const fd = new FormData()
  fd.append('image', file)
  const res = await fetch(`${BASE}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: fd,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.url
}

// ── Rapports ───────────────────────────────────────────────────────────────

export async function getRapports() {
  const res = await fetch(`${BASE}/rapports`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.rapports
}

export async function getRapport(slug) {
  const res = await fetch(`${BASE}/rapports/${slug}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.rapport
}

export async function createRapport(type, titre, contenu, brouillon = false) {
  const res = await fetch(`${BASE}/rapports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ type, titre, contenu, brouillon }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.rapport
}

export async function updateRapport(slug, { type, titre, contenu, brouillon } = {}) {
  const res = await fetch(`${BASE}/rapports/${slug}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ type, titre, contenu, brouillon }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data.rapport
}

export async function updateStatutRapport(slug, statut) {
  const res = await fetch(`${BASE}/rapports/${slug}/statut`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ statut }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

export async function deleteRapport(slug) {
  const res = await fetch(`${BASE}/rapports/${slug}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message)
  return data
}

import { ref } from 'vue'
import { getMe, logout as apiLogout } from './api.js'

export const isLoggedIn = ref(false)
export const currentUser = ref(null)
export const showLoginModal = ref(false)

// Restaurer la session au démarrage (via cookie httpOnly, pas de localStorage)
export async function initAuth() {
  try {
    const user = await getMe()
    if (user) {
      currentUser.value = user
      isLoggedIn.value = true
    }
  } catch {
    // serveur indisponible, on continue sans session
  }
}

export async function logout() {
  try {
    await apiLogout() // révoque le refresh token en DB + efface les cookies côté serveur
  } catch {
    // serveur indisponible, on efface l'état local quand même
  }
  isLoggedIn.value = false
  currentUser.value = null
}

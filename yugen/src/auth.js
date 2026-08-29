import { ref } from 'vue'
import { getMe, logout as apiLogout } from './api.js'

export const isLoggedIn = ref(false)
export const currentUser = ref(null)

// Restaurer la session au démarrage
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

export function logout() {
  apiLogout()
  isLoggedIn.value = false
  currentUser.value = null
}

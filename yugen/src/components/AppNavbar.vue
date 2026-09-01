<template>
  <nav class="navbar">

    <div class="navbar-links">
      <RouterLink to="/" class="nav-link" active-class="nav-link--active" exact>Accueil</RouterLink>
      <RouterLink v-if="isLoggedIn" to="/parchemin" class="nav-link" active-class="nav-link--active">Parchemin</RouterLink>
    </div>

    <!-- Non connecté -->
    <button v-if="!isLoggedIn" class="connect-btn" @click="emit('open-login')">
      Se connecter
    </button>

    <!-- Connecté -->
    <div v-else class="profile" @click="menuOpen = !menuOpen" ref="profileRef">
      <div class="profile-info">
        <span class="profile-name">{{ currentUser.nom }}</span>
        <span class="profile-grade">{{ currentUser.grade }}</span>
      </div>
      <div class="profile-avatar">{{ currentUser.nom[0] }}</div>

      <!-- Dropdown -->
      <div v-if="menuOpen" class="dropdown">
        <button class="dropdown-item" @click="$router.push('/profil'); menuOpen = false">Mon profil</button>
        <button class="dropdown-item" @click="$router.push('/projets'); menuOpen = false">Mes projets</button>
        <div class="dropdown-sep"></div>
        <button class="dropdown-item dropdown-item--danger" @click.stop="logout">Déconnexion</button>
      </div>
    </div>

  </nav>
</template>

<script setup>
import { ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { isLoggedIn, currentUser, logout as doLogout } from '../auth.js'

const emit = defineEmits(['open-login'])

const menuOpen = ref(false)
const profileRef = ref(null)

onClickOutside(profileRef, () => { menuOpen.value = false })

function logout() {
  doLogout()
  menuOpen.value = false
}
</script>

<style scoped>
.navbar {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2.5rem;
  height: 52px;
  background: #0c0c0d;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.navbar-links {
  display: flex;
  gap: 0.2rem;
}

.nav-link {
  font-family: 'Cinzel', serif;
  font-size: 0.7rem;
  letter-spacing: 0.07em;
  color: rgba(255,255,255,0.3);
  text-decoration: none;
  padding: 0.4rem 0.8rem;
  transition: color 0.15s;
}

.nav-link:hover { color: rgba(255,255,255,0.65); }
.nav-link--active { color: #fff; }

/* ── Bouton connexion ─────────────────────── */
.connect-btn {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.6);
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  padding: 0.55rem 1.2rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.connect-btn:hover {
  background: rgba(255,255,255,0.07);
  border-color: rgba(255,255,255,0.14);
  color: rgba(255,255,255,0.85);
}

/* ── Profil ───────────────────────────────── */
.profile {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  position: relative;
  padding: 0.4rem 0.6rem;
  border: 1px solid transparent;
  transition: border-color 0.15s;
}

.profile:hover { border-color: rgba(255,255,255,0.08); }

.profile-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.1rem;
}

.profile-name {
  font-family: 'Cinzel', serif;
  font-size: 0.72rem;
  color: #fff;
  letter-spacing: 0.06em;
}

.profile-grade {
  font-family: 'Crimson Text', Georgia, serif;
  font-size: 0.78rem;
  font-style: italic;
  color: #8b1a1a;
}

.profile-avatar {
  width: 32px;
  height: 32px;
  background: #8b1a1a;
  color: #fff;
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Dropdown ─────────────────────────────── */
.dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: #141416;
  border: 1px solid rgba(255,255,255,0.08);
  min-width: 160px;
  z-index: 200;
}

.dropdown-item {
  display: block;
  width: 100%;
  background: none;
  border: none;
  text-align: left;
  padding: 0.7rem 1rem;
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 0.07em;
  color: rgba(255,255,255,0.6);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.dropdown-item:hover {
  background: rgba(255,255,255,0.04);
  color: #fff;
}

.dropdown-item--danger { color: #8b1a1a; }
.dropdown-item--danger:hover { color: #c02020; background: rgba(139,26,26,0.08); }

.dropdown-sep {
  height: 1px;
  background: rgba(255,255,255,0.06);
}
</style>

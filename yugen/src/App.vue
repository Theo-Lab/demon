<script setup>
import LoginModal from './components/LoginModal.vue'
import { showLoginModal } from './auth.js'
</script>

<template>
  <RouterView />
  <LoginModal v-if="showLoginModal" @close="showLoginModal = false" />
</template>

<script setup>
import { ref } from 'vue'
import LoginModal from './components/LoginModal.vue'

const showModal = ref(false)
</script>

<template>
  <RouterView @open-login="showModal = true" />
  <LoginModal v-if="showModal" @close="showModal = false" />
</template>

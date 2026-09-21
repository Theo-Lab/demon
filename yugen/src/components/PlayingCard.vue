<template>
  <div class="card" :class="{ 'card--hidden': card.hidden, 'card--red': isRed, 'card--flip': flipIn }">
    <template v-if="!card.hidden">
      <span class="card-corner card-corner--tl">{{ card.v }}<br>{{ suitChar }}</span>
      <span class="card-center">{{ suitChar }}</span>
      <span class="card-corner card-corner--br">{{ card.v }}<br>{{ suitChar }}</span>
    </template>
    <template v-else>
      <span class="card-back-pattern"></span>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  card:   { type: Object,  required: true },
  flipIn: { type: Boolean, default: false },
})

const SUITS = { S: '♠', H: '♥', D: '♦', C: '♣' }

const suitChar = computed(() => SUITS[props.card.s] ?? '')
const isRed    = computed(() => props.card.s === 'H' || props.card.s === 'D')
</script>

<style scoped>
.card {
  position: relative;
  width: 64px;
  height: 90px;
  background: #f2ede6;
  border-radius: 5px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.55);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #1a1a1a;
  user-select: none;
  transform-origin: center center;
}

.card--red { color: #b91c1c; }

.card--hidden {
  background: #1a2a3a;
  border: 1px solid rgba(255,255,255,0.08);
}

/* 3D flip on reveal */
@keyframes card-flip {
  0%   { transform: rotateY(90deg) scale(0.88); opacity: 0.3; }
  55%  { transform: rotateY(-6deg) scale(1.04); opacity: 1; }
  100% { transform: rotateY(0deg)  scale(1);    opacity: 1; }
}
.card--flip {
  animation: card-flip 0.38s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}

.card-corner {
  position: absolute;
  font-family: 'Cinzel', serif;
  font-size: 0.7rem;
  line-height: 1.2;
  font-weight: 700;
  text-align: center;
}
.card-corner--tl { top: 5px;    left: 6px; }
.card-corner--br { bottom: 5px; right: 6px; transform: rotate(180deg); }

.card-center { font-size: 1.6rem; line-height: 1; }

.card-back-pattern {
  display: block;
  width: 48px;
  height: 74px;
  border: 2px solid rgba(255,255,255,0.12);
  background: repeating-linear-gradient(
    45deg,
    rgba(255,255,255,0.04) 0px,
    rgba(255,255,255,0.04) 3px,
    transparent 3px,
    transparent 9px
  );
}
</style>

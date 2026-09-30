<template>
  <div class="bg-orbs" aria-hidden="true">
    <div class="orb orb-blue"></div>
    <div class="orb orb-purple"></div>
    <div class="orb orb-teal"></div>
  </div>
  <router-view />
  <AppToast />
  <GestureController />
</template>

<script setup>
import AppToast from './components/AppToast.vue'
import GestureController from './components/gesture/GestureController.vue'
</script>

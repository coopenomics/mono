<template lang="pug">
q-btn.full-width(color='primary', unelevated, no-caps, @click='openSettings') Настройки
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

const openSettings = () => {
  router.push({ name: 'extension-settings' });
};
</script>

<template lang="pug">
q-btn.full-width(@click='cancel', flat, no-caps, color='grey-7') Отменить
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

const cancel = () => {
  router.push({ name: 'one-extension' });
};
</script>

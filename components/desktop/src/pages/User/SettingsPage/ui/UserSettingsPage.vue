<template lang="pug">
.settings-page
  //- Безопасность входа: активные сессии и устройства (Story 3.7).
  SessionsCard
</template>

<script lang="ts" setup>
import { SessionsCard } from 'src/features/Security/ManageSessions';
</script>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  max-width: 720px;
}
</style>

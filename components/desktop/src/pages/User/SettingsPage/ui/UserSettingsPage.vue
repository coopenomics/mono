<template lang="pug">
.settings-page
  //- Безопасность входа: активные сессии и устройства (Story 3.7).
  SessionsCard

  //- PIN-код устройства (уточнённая модель Эпика 7).
  PinCard
</template>

<script lang="ts" setup>
import { SessionsCard } from 'src/features/Security/ManageSessions';
import { PinCard } from 'src/features/Security/SetupPin';
</script>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  max-width: 720px;
}
</style>

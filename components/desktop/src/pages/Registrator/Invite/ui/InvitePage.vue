<template lang="pug">
.invite-page
  Invite
</template>

<script lang="ts" setup>
import { Invite } from 'src/widgets/Registrator/Invite';
</script>

<style scoped>
.invite-page {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--p-6, 24px);
  min-height: 100%;
}
</style>

<template lang="pug">
q-page.onboarding-page
  OnboardingStepsCard
</template>

<script setup lang="ts">
import { OnboardingStepsCard } from 'app/extensions/chairman/features/Onboarding/ui';
</script>

<style scoped lang="scss">
// Канон-отступы страницы (как у прочих столов): контент не липнет к краям.
.onboarding-page {
  padding: var(--p-6, 24px);
  @media (max-width: 768px) {
    padding: var(--p-4, 16px);
  }
}
</style>

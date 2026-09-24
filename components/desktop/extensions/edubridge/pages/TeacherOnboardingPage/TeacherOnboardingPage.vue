<template lang="pug">
EduOfferGate(
  :kind="Zeus.EduOfferKind.TEACHER"
  :hint="$t('edubridge.teacherOnboardingPage.hint')"
  :offer-description="$t('edubridge.teacherOnboardingPage.offerDescription')"
  :offer-title="$t('edubridge.teacherOnboardingPage.offerTitle')"
  :contract-description="$t('edubridge.teacherOnboardingPage.contractDescription')"
  target-route="edubridge-teacher-profile"
)
</template>

<script setup lang="ts">
import { Zeus } from '@coopenomics/sdk';
import { EduOfferGate } from '../../features/OfferGate';
</script>

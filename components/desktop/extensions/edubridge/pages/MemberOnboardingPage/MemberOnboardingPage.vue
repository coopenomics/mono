<template lang="pug">
EduOfferGate(
  :kind="Zeus.EduOfferKind.PARENT"
  :hint="$t('edubridge.memberOnboardingPage.hint')"
  :offer-description="$t('edubridge.memberOnboardingPage.offerDescription')"
  :offer-title="$t('edubridge.memberOnboardingPage.offerTitle')"
  target-route="edubridge-catalog"
)
</template>

<script setup lang="ts">
import { Zeus } from '@coopenomics/sdk';
import { EduOfferGate } from '../../features/OfferGate';
</script>

<template lang="pug">
EduOfferGate(
  :kind="Zeus.EduOfferKind.PARENT"
  :hint="$t('edubridge.memberOnboardingPage.hint')"
  :offer-title="$t('edubridge.memberOnboardingPage.offerTitle')"
  target-route="edubridge-catalog"
  :return-to="returnTo"
)
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, type RouteLocationRaw } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { EduOfferGate } from '../../features/OfferGate';
import { ACCESS_QUERY, accessModeOf } from '../../shared/lib/accessIntent';

/**
 * Подпись оферты ученика. Человека сюда приводит кнопка «Получить доступ» на
 * странице курса: после подписи он возвращается на тот же курс, и оформление
 * доступа продолжается с того же места.
 */
const route = useRoute();

const returnTo = computed<RouteLocationRaw | undefined>(() => {
  const courseId = typeof route.query.course === 'string' ? route.query.course : '';
  if (!courseId) return undefined;
  return {
    name: 'edubridge-catalog-course',
    params: { coopname: route.params.coopname, id: courseId },
    query: { [ACCESS_QUERY]: accessModeOf(route.query[ACCESS_QUERY]) ?? 'enroll' },
  };
});
</script>

<template lang="pug">
div
  .agreement-pending.t-body(v-if='isPending') {{ $t('agreementer.staticUserAgreement.pendingText') }}
  .agreement-pending.t-body(v-else-if='isLoading') {{ $t('agreementer.staticUserAgreement.loadingText') }}
  .agreement-pending.t-body(v-else-if='error') {{ error }}
  DocumentHtmlReader(v-else :html='html')
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader';
import { Cooperative } from 'cooptypes';
import { fetchPublicProvision } from 'src/features/Agreementer/StaticPrivacyPolicy/api';
import { t } from 'src/shared/i18n';

const { info } = useSystemStore();

const html = ref('');
const error = ref('');
const isLoading = ref(true);

const isPending = computed(() => {
  const protocol = info?.vars?.user_agreement;
  return !protocol?.protocol_number || !protocol?.protocol_day_month_year;
});

/**
 * Текст собирает бэкенд из шаблона в блокчейне — той самой редакции, которую
 * утвердил совет. Подставлять переменные здесь нельзя: это вторая копия логики
 * фабрики документов, и она неизбежно разъезжается с подписываемым документом.
 * Имя подписанта в публичном показе фабрика оставляет прочерком.
 */
onMounted(async () => {
  if (isPending.value) {
    isLoading.value = false;
    return;
  }

  try {
    const provision = await fetchPublicProvision({ registry_id: Cooperative.Registry.UserAgreement.registry_id });
    html.value = provision.html;
  } catch (e: any) {
    error.value = e?.message ?? t('agreementer.staticUserAgreement.loadError');
  } finally {
    isLoading.value = false;
  }
});
</script>

<style scoped>
.agreement-pending {
  padding: var(--p-4);
  color: var(--p-ink-2);
  text-align: center;
}
</style>

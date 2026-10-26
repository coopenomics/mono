<template lang="pug">
//- Встроенное приложение платформы: бесплатно, открывается своей страницей.
AppCard(
  :seed='extension.name || extension.title || ""',
  :title='extension.title || extension.name',
  :description='extension.description',
  :price="$t('extensionCard.extensionCard.free')",
  :state='state',
  :clickable='extension.is_available',
  :muted='!extension.is_available',
  @open='open'
)
</template>

<script lang="ts" setup>
import type { IExtension } from 'src/entities/Extension/model/types';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { t } from 'src/shared/i18n';
import AppCard, { type AppCardState } from './AppCard.vue';

const props = defineProps<{ extension: IExtension }>();

const router = useRouter();

// Одна пометка: установлено, выключено или ещё в разработке. Не установленное
// и готовое приложение пометки не носит — пустота читается яснее слова.
const state = computed<AppCardState | null>(() => {
  const ext = props.extension;
  if (!ext.is_available) return { label: t('extensionCard.extensionCard.inDevelopmentBadge'), variant: 'neutral' };
  if (ext.is_installed && ext.enabled) return { label: t('extensionCard.extensionCard.installedBadge'), variant: 'pos' };
  if (ext.is_installed) return { label: t('extensionCard.extensionCard.disabledBadge'), variant: 'warn' };
  return null;
});

const open = () => {
  if (props.extension.is_available)
    router.push({ name: 'one-extension', params: { name: props.extension.name } });
};
</script>

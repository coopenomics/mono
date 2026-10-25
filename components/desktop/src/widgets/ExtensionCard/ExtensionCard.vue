<template lang="pug">
//- Встроенное приложение платформы: бесплатно, открывается своей страницей.
AppCard(
  :seed='extension.name || extension.title || ""',
  :title='extension.title',
  :description='extension.description',
  origin='builtin',
  :price="$t('extensionCard.extensionCard.free')",
  :clickable='extension.is_available',
  @open='open'
)
  template(#badges)
    BaseBadge(v-if='isInstalled', variant='pos') {{ $t('extensionCard.extensionCard.installedBadge') }}
    BaseBadge(v-else-if='!extension.is_available', variant='warn') {{ $t('extensionCard.extensionCard.inDevelopmentBadge') }}
  template(#foot, v-if='extension.is_available')
    span.app-card-more
      | {{ $t('extensionCard.extensionCard.moreLink') }}
      q-icon(name='arrow_forward', size='14px')
</template>

<script lang="ts" setup>
import type { IExtension } from 'src/entities/Extension/model/types';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { BaseBadge } from 'src/shared/ui/base';
import AppCard from './AppCard.vue';

const props = defineProps<{ extension: IExtension }>();

const router = useRouter();

const isInstalled = computed(
  () => props.extension.is_installed && props.extension.is_available,
);

const open = () => {
  if (props.extension.is_available)
    router.push({ name: 'one-extension', params: { name: props.extension.name } });
};
</script>

<style scoped lang="scss">
.app-card-more {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1, 4px);
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  color: var(--p-primary);
}
</style>

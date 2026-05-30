<template lang="pug">
.banner.page-hint(v-if='!dismissed', :class='`banner--${variant}`')
  q-icon.banner__icon(:name='resolvedIcon', size='18px')
  .banner__body
    slot
  BaseButton.page-hint__close(
    variant='ghost',
    icon-only,
    size='sm',
    aria-label='Скрыть подсказку',
    @click='dismiss'
  )
    template(#icon-left)
      q-icon(name='close', size='16px')
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { BaseButton } from 'src/shared/ui/base';
import { useDismissibleBanner } from 'src/shared/hooks';
import type { PageHintProps, PageHintVariant } from './PageHint.types';

/**
 * Канон стола MONO Platform v2: на каждой странице сверху — закрывающаяся
 * подсказка `.banner.banner--info` с иконкой и крестиком. Логику скрытия
 * (LocalStorage, без мигания) инкапсулирует хук `useDismissibleBanner`,
 * разметку — этот компонент. Текст подсказки передаётся слотом.
 */

const props = withDefaults(defineProps<PageHintProps>(), {
  variant: 'info',
});

const { dismissed, dismiss } = useDismissibleBanner(props.storageKey);

const DEFAULT_ICON: Record<PageHintVariant, string> = {
  info: 'info',
  pos: 'check_circle',
  warn: 'warning',
  neg: 'error',
};

const resolvedIcon = computed(() => props.icon ?? DEFAULT_ICON[props.variant]);
</script>

<style scoped lang="scss">
.page-hint__close {
  flex-shrink: 0;
  align-self: flex-start;
  margin: -4px -4px 0 0;
}
</style>

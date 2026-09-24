<template lang="pug">
q-card.artifacts-access-placeholder(flat, bordered)
  q-card-section.text-center.q-py-xl
    q-icon.artifacts-access-placeholder__icon(name='lock_outline', size='56px', color='grey-6')
    .text-h6.q-mt-md {{ title }}
    .text-body2.text-grey-7.q-mt-sm.artifacts-access-placeholder__description
      | {{ description }}
    .row.justify-center.q-mt-lg(v-if='showAction')
      slot(name='action')
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { t } from '../../../../i18n';

const props = withDefaults(
  defineProps<{
    /** Скоуп страницы: для проекта или компонента — влияет на формулировку */
    scope?: 'project' | 'component';
    /** Принят ли запрос на допуск (в рассмотрении) — меняет текст */
    pending?: boolean;
  }>(),
  {
    scope: 'project',
    pending: false,
  },
);

const title = computed(() => {
  if (props.pending) {
    return t('capital.artifactsAccessPlaceholder.pendingTitle');
  }
  return props.scope === 'component'
    ? t('capital.artifactsAccessPlaceholder.componentDeniedTitle')
    : t('capital.artifactsAccessPlaceholder.projectDeniedTitle');
});

const description = computed(() => {
  if (props.pending) {
    return props.scope === 'component'
      ? t('capital.artifactsAccessPlaceholder.pendingComponentBody')
      : t('capital.artifactsAccessPlaceholder.pendingProjectBody');
  }
  return props.scope === 'component'
    ? t('capital.artifactsAccessPlaceholder.componentDeniedBody')
    : t('capital.artifactsAccessPlaceholder.projectDeniedBody');
});

const showAction = computed(() => true);
</script>

<style lang="scss" scoped>
.artifacts-access-placeholder {
  margin: 16px;
  background: var(--q-grey-1, #fafafa);

  &__icon {
    opacity: 0.65;
  }

  &__description {
    max-width: 480px;
    margin-left: auto;
    margin-right: auto;
    line-height: 1.5;
  }
}
</style>

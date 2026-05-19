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
    return 'Запрос на допуск рассматривается';
  }
  return props.scope === 'component'
    ? 'Артефакты компонента доступны участникам'
    : 'Артефакты проекта доступны участникам';
});

const description = computed(() => {
  if (props.pending) {
    return props.scope === 'component'
      ? 'Когда мастер компонента или председатель подтвердит ваш запрос на допуск, артефакты этого компонента станут видны.'
      : 'Когда мастер проекта или председатель подтвердит ваш запрос на допуск, артефакты проекта и его компонентов станут видны.';
  }
  return props.scope === 'component'
    ? 'Чтобы открыть артефакты этого компонента, получите допуск к нему или к родительскому проекту.'
    : 'Чтобы открыть артефакты проекта и его компонентов, получите допуск к проекту.';
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

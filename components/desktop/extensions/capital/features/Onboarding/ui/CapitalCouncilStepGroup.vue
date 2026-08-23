<template lang="pug">
.capital-council-group
  .capital-council-group__item(
    v-for='(step, index) in steps'
    :key='step.id'
  )
    .capital-council-group__head
      .capital-council-group__title
        span.capital-council-group__index {{ index + 1 }}.
        span {{ step.title }}
      .capital-council-group__status
        BaseChip(
          v-if='step.status === "completed"'
          variant='pos'
          size='sm'
        ) Утверждено советом
        BaseChip(
          v-else-if='step.status === "in_progress"'
          variant='warn'
          size='sm'
        ) Ожидаем решение совета

    p.capital-council-group__desc.t-body2 {{ step.description }}

    BaseButton.capital-council-group__action(
      v-if='canDeclare(step)'
      variant='primary'
      size='sm'
      :disable='busy'
      @click='emit("declare", step.id)'
    ) Объявить собрание совета

    q-separator.capital-council-group__sep(v-if='index < steps.length - 1')
</template>

<script setup lang="ts">
import { BaseButton, BaseChip } from 'src/shared/ui/base';
import type { ICouncilOnboardingStep } from 'src/shared/ui/CouncilOnboarding';

defineProps<{
  steps: ICouncilOnboardingStep[];
  busy?: boolean;
  canDeclare: (step: ICouncilOnboardingStep) => boolean;
}>();

const emit = defineEmits<{
  declare: [stepId: string];
}>();
</script>

<style scoped lang="scss">
.capital-council-group__item {
  padding: var(--p-2) 0;
}

.capital-council-group__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--p-3);
}

.capital-council-group__title {
  display: flex;
  gap: var(--p-2);
  font-weight: 600;
  color: var(--p-ink);
}

.capital-council-group__index {
  flex: 0 0 auto;
  color: var(--p-ink-2);
}

.capital-council-group__status {
  flex: 0 0 auto;
}

.capital-council-group__desc {
  margin: var(--p-2) 0 0;
  color: var(--p-ink-2);
}

.capital-council-group__action {
  margin-top: var(--p-3);
}

.capital-council-group__sep {
  margin-top: var(--p-4);
}
</style>

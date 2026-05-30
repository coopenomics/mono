<script lang="ts" setup>
import { onMounted, computed } from 'vue';
import { CouncilOnboardingCard } from 'src/shared/ui/CouncilOnboarding';
import { BaseBadge } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { useMarketplaceOnboarding } from '../model/composable';

/**
 * Эпик 1 / Эпик 12: L1 — подключение кооперативом ЦПП «Стол заказов».
 *
 * Председатель утверждает Советом два документа (Положение ЦПП и шаблон
 * публичной оферты) через стандартный платформенный механизм онбординга —
 * тот же, что в Капитале/Благоросте. Каждый документ уходит в Совет проектом
 * решения; статус шага меняется на «завершён» по РЕАЛЬНОМУ ончейн-решению
 * совета (без stub-кнопки). Когда оба документа утверждены — расширение
 * подключается автоматически и пайщики получают доступ к Столу заказов.
 */

const { config, loading, isCompleted, loadState, handleStepSubmit } =
  useMarketplaceOnboarding();

const chipVariant = computed<BaseBadgeVariant>(() =>
  isCompleted.value ? 'pos' : 'warn',
);
const chipLabel = computed(() =>
  isCompleted.value ? 'Подключено' : 'Не подключено',
);

onMounted(async () => {
  await loadState();
});
</script>

<template lang="pug">
q-page.onboarding-l1(role="region", aria-label="Подключение ЦПП Стол заказов")
  .onboarding-l1__card
    CouncilOnboardingCard(
      :config="config",
      :loading="loading",
      title="Подключение ЦПП «Стол заказов»",
      subtitle="Целевая Потребительская Программа должна быть принята Советом кооператива, прежде чем пайщики смогут пользоваться Столом заказов.",
      :completion-title="config.completionTitle",
      :completion-message="config.completionMessage",
      @step-submit="handleStepSubmit"
    )
      template(#status)
        BaseBadge(:variant="chipVariant", dot) {{ chipLabel }}
</template>

<style scoped lang="scss">
.onboarding-l1 {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__card {
    max-width: 860px;
  }
}
</style>

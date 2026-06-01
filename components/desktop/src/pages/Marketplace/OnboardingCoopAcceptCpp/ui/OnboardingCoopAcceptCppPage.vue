<script lang="ts" setup>
import { onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { CouncilOnboardingCard } from 'src/shared/ui/CouncilOnboarding';
import { BaseBadge, BaseButton } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { useSystemStore } from 'src/entities/System/model';
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

const { config, loading, submitting, isCompleted, loadState, handleStepSubmit } =
  useMarketplaceOnboarding();

const chipVariant = computed<BaseBadgeVariant>(() =>
  isCompleted.value ? 'pos' : 'warn',
);
const chipLabel = computed(() =>
  isCompleted.value ? 'Подключено' : 'Не подключено',
);

// Шаги 3–4 после утверждения двух документов Советом: они выполняются на других
// столах, поэтому здесь — только подсказка со ссылками (без дублирования
// функционала добавления участков/ПВЗ).
const router = useRouter();
const systemStore = useSystemStore();
const coopname = computed(() => systemStore.info?.coopname || '');

const NEXT_STEPS = [
  {
    n: 3,
    title: 'Добавьте кооперативные участки',
    description:
      'Кооперативные участки создаются юридически вне системы, а здесь добавляются уже оформленные участки с их председателями. Без хотя бы одного участка пунктам выдачи не на чем работать.',
    cta: 'Перейти к участкам',
    route: 'branches',
  },
  {
    n: 4,
    title: 'Назначьте пункты выдачи (ПВЗ)',
    description:
      'Отметьте нужные кооперативные участки как пункты выдачи заказов и задайте режим их работы — тогда пайщики смогут выбирать ПВЗ при заказе.',
    cta: 'Перейти к ПВЗ',
    route: 'marketplace-issuance-points',
  },
] as const;

function goTo(name: string): void {
  if (!coopname.value) return;
  void router.push({ name, params: { coopname: coopname.value } });
}

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
      :submitting="submitting",
      title="Подключение ЦПП «Стол заказов»",
      subtitle="Целевая Потребительская Программа должна быть принята Советом кооператива, прежде чем пайщики смогут пользоваться Столом заказов.",
      :completion-title="config.completionTitle",
      :completion-message="config.completionMessage",
      @step-submit="handleStepSubmit"
    )
      template(#status)
        BaseBadge(:variant="chipVariant", dot) {{ chipLabel }}

  .onboarding-l1__next
    .onboarding-l1__next-head Дальнейшая настройка
    .onboarding-l1__next-sub Эти шаги выполняются на других столах — после них Стол заказов готов к работе.
    .onboarding-l1__step(v-for="step in NEXT_STEPS", :key="step.n")
      .onboarding-l1__step-num {{ step.n }}
      .onboarding-l1__step-body
        .onboarding-l1__step-title {{ step.title }}
        .onboarding-l1__step-desc {{ step.description }}
        BaseButton.onboarding-l1__step-cta(
          variant="ghost",
          size="sm",
          :disabled="!coopname",
          @click="goTo(step.route)"
        )
          | {{ step.cta }}
          template(#icon-right)
            q-icon(name="arrow_forward", size="16px")
</template>

<style scoped lang="scss">
.onboarding-l1 {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__card {
    width: 100%;
  }

  &__next {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
    padding: var(--p-5, 20px);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-lg, 12px);
  }

  &__next-head {
    font-size: var(--p-fs-h3);
    font-weight: 600;
    color: var(--p-ink-1);
  }

  &__next-sub {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
  }

  &__step {
    display: flex;
    gap: var(--p-3, 12px);
    align-items: flex-start;
    padding-top: var(--p-3, 12px);
    border-top: 1px solid var(--p-line);
  }

  &__step-num {
    flex: 0 0 28px;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--p-surface-2);
    color: var(--p-ink-2);
    font-weight: 600;
  }

  &__step-body {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__step-title {
    font-weight: 600;
    color: var(--p-ink-1);
  }

  &__step-desc {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
  }

  &__step-cta {
    align-self: flex-start;
  }
}
</style>

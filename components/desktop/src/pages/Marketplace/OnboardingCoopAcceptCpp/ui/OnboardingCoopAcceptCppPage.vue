<script lang="ts" setup>
import { onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  CouncilOnboardingCard,
  type ICouncilOnboardingExtraStep,
} from 'src/shared/ui/CouncilOnboarding';
import { BaseBadge } from 'src/shared/ui/base';
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
 *
 * Шаги 3–4 (добавить кооперативные участки, назначить ПВЗ) выполняются на
 * других столах — здесь они идут тем же сквозным списком (extraSteps) со
 * ссылками, без дублирования функционала.
 */

const { config, loading, submitting, isCompleted, loadState, handleStepSubmit } =
  useMarketplaceOnboarding();

const chipVariant = computed<BaseBadgeVariant>(() =>
  isCompleted.value ? 'pos' : 'warn',
);
const chipLabel = computed(() =>
  isCompleted.value ? 'Подключено' : 'Не подключено',
);

const router = useRouter();
const systemStore = useSystemStore();
const coopname = computed(() => systemStore.info?.coopname || '');

// Кнопки шагов 3–4 активны только после принятия Советом обоих положений
// (1–2 completed). Сами пункты списка видны всегда — disabled лишь действие.
const extraStepsLocked = computed(
  () => !coopname.value || !isCompleted.value,
);

// id доп.шага = имя маршрута стола, куда ведём.
const EXTRA_STEPS = computed<ICouncilOnboardingExtraStep[]>(() => [
  {
    id: 'branches',
    title: 'Добавьте кооперативные участки',
    description:
      'Кооперативные участки создаются юридически вне системы, а здесь добавляются уже оформленные участки с их председателями. Без хотя бы одного участка пунктам выдачи не на чем работать.',
    actionLabel: 'Перейти к участкам',
    disabled: extraStepsLocked.value,
  },
  {
    id: 'marketplace-issuance-points',
    title: 'Назначьте пункты выдачи (ПВЗ)',
    description:
      'Отметьте нужные кооперативные участки как пункты выдачи заказов и задайте режим их работы — тогда пайщики смогут выбирать ПВЗ при заказе.',
    actionLabel: 'Перейти к ПВЗ',
    disabled: extraStepsLocked.value,
  },
]);

function onExtraAction(step: ICouncilOnboardingExtraStep): void {
  if (extraStepsLocked.value) return;
  void router.push({ name: step.id, params: { coopname: coopname.value } });
}

onMounted(async () => {
  await loadState();
});
</script>

<template lang="pug">
q-page.onboarding-l1(role="region", aria-label="Подключение ЦПП Стол заказов")
  CouncilOnboardingCard(
    :config="config",
    :loading="loading",
    :submitting="submitting",
    :extra-steps="EXTRA_STEPS",
    title="Подключение ЦПП «Стол заказов»",
    subtitle="Целевая Потребительская Программа должна быть принята Советом кооператива, прежде чем пайщики смогут пользоваться Столом заказов.",
    :completion-title="config.completionTitle",
    :completion-message="config.completionMessage",
    @step-submit="handleStepSubmit",
    @extra-action="onExtraAction"
  )
    template(#status)
      BaseBadge(:variant="chipVariant", dot) {{ chipLabel }}
</template>

<style scoped lang="scss">
.onboarding-l1 {
  padding: var(--p-6, 24px);
}

@media (max-width: 768px) {
  .onboarding-l1 {
    padding: var(--p-4, 16px);
  }
}
</style>

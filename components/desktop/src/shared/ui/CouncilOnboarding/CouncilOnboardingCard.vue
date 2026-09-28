<template lang="pug">
//- Подключение программы советом: шапка с прогрессом, шаги — плашками, внизу
//- одна отправка. Плашка раскрывается на месте до вопроса повестки и проекта
//- решения: прочитать можно всё, не открывая окон, а объявить — разом.
q-card.council-onboarding(flat, :class="{ 'council-onboarding--loading': loading }")
  q-inner-loading(:showing="loading")
    q-spinner(color="primary", size="2.5em")
    div.t-meta.q-mt-sm(v-if="loadingText") {{ loadingText }}

  template(v-if="!loading")
    //- Поздравление, если шаги совета завершены — канон-состояние EmptyState.
    slot(name="completion", v-if="isCompleted")
      EmptyState.council-onboarding__done(
        :title="completionTitle",
        :body="completionMessage"
      )
        template(#icon)
          q-icon(name="celebration", size="26px")

    template(v-if="!isCompleted")
      .council-onboarding__head
        h2.council-onboarding__title {{ title }}
        p.council-onboarding__sub(v-if="subtitle") {{ subtitle }}
        .council-onboarding__progress
          .council-onboarding__bar
            i(:style="{ width: `${progressPercent}%` }")
          span.t-meta {{ $t('ui.councilOnboardingCard.progressText', { done: doneCount, total: steps.length }) }}
        .council-onboarding__status-row(v-if="countdownLabel || hasStatusSlot")
          BaseBadge(v-if="countdownLabel", variant="info") {{ countdownLabel }}
          slot(name="status")

      .council-onboarding__list
        q-expansion-item.council-onboarding__plate(
          v-for="(step, index) in steps",
          :key="step.id",
          v-model="expanded[step.id]",
          :class="`council-onboarding__plate--${stateOf(step)}`"
        )
          template(#header)
            .council-onboarding__plate-head
              .council-onboarding__num
                q-spinner(v-if="stateOf(step) === 'sending'", size="16px")
                q-icon(v-else-if="stateOf(step) === 'done'", name="check", size="16px")
                q-icon(v-else-if="stateOf(step) === 'council'", name="hourglass_top", size="16px")
                q-icon(v-else-if="stateOf(step) === 'failed'", name="priority_high", size="16px")
                span(v-else) {{ index + 1 }}
              .council-onboarding__plate-text
                .council-onboarding__plate-title {{ step.title }}
                .council-onboarding__plate-desc {{ step.description }}
              BaseBadge.council-onboarding__badge(:variant="BADGE[stateOf(step)].variant")
                | {{ $t(BADGE[stateOf(step)].label) }}
          .council-onboarding__plate-body
            .t-eyebrow {{ $t('ui.councilOnboardingCard.agendaQuestionLabel') }}
            p.council-onboarding__question {{ step.question }}
            .t-eyebrow {{ $t('ui.councilOnboardingCard.draftDecisionLabel') }}
            p.council-onboarding__prefix(v-if="step.decisionPrefix") {{ step.decisionPrefix }}
            DocumentHtmlReader(v-if="step.decision" :html="step.decision" profile="document")
            BaseBanner(v-else-if="step.decisionError" variant="neg") {{ step.decisionError }}
            //- Документ ещё формируется: текст подставится сам, как только придёт.
            .council-onboarding__ghost(v-else aria-busy="true")
              .t-meta {{ $t('ui.councilOnboardingCard.generatingDocumentText') }}
              q-skeleton(v-for="(w, i) in ghostLines" :key="i" type="text" :width="w")

      .council-onboarding__foot(v-if="pendingSteps.length")
        span.t-meta {{ $t('ui.councilOnboardingCard.footHint') }}
        BaseButton(
          variant="primary",
          :loading="busy",
          :disabled="!ready",
          @click="announceAll"
        ) {{ announceLabel }}

    //- Доп.шаги (навигация на другие столы) — такими же плашками после шагов
    //- совета, со сквозной нумерацией; видны и после подключения.
    .council-onboarding__list.council-onboarding__list--extra(v-if="extraStepsList.length")
      .council-onboarding__plate.council-onboarding__plate--extra(v-for="(step, i) in extraStepsList", :key="step.id")
        .council-onboarding__plate-head
          .council-onboarding__num
            span {{ steps.length + i + 1 }}
          .council-onboarding__plate-text
            .council-onboarding__plate-title {{ step.title }}
            .council-onboarding__plate-desc {{ step.description }}
          BaseButton(
            variant="secondary",
            size="sm",
            :disabled="step.disabled",
            @click="() => emit('extra-action', step)"
          )
            span {{ step.actionLabel }}
            template(#icon-right)
              q-icon.q-ml-xs(name="arrow_forward", size="16px")
</template>

<script setup lang="ts">
import { ref, computed, useSlots } from 'vue';
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseBanner } from 'src/shared/ui/base/BaseBanner';
import { BaseBadge, type BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge';
import { useConfirm } from 'src/shared/lib/composables';
import type {
  ICouncilOnboardingStep,
  ICouncilOnboardingConfig,
  ICouncilOnboardingExtraStep,
} from './types';
import { t } from 'src/shared/i18n';
import { FailAlert, SuccessAlert } from 'src/shared/api';

interface Props {
  config: ICouncilOnboardingConfig;
  loading?: boolean;
  /**
   * Отправить проект решения шага в Совет. Отвечает, когда вопрос объявлен, и
   * бросает ошибку, если нет, — по ней очередь останавливается. Загрузку и
   * сообщения показывает карточка.
   */
  submitStep: (step: ICouncilOnboardingStep) => Promise<unknown>;
  loadingText?: string;
  title?: string;
  subtitle?: string;
  completionTitle?: string;
  completionMessage?: string;
  // Доп.шаги (навигация на другие столы) — рисуются после шагов совета и видны
  // всегда. По умолчанию пусто.
  extraSteps?: ICouncilOnboardingExtraStep[];
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  loadingText: t('ui.councilOnboardingCard.loadingText'),
  title: t('ui.councilOnboardingCard.subtitleText'),
  completionTitle: t('ui.councilOnboardingCard.completedTitle'),
  completionMessage: t('ui.councilOnboardingCard.completedText'),
  extraSteps: () => [],
});

const emit = defineEmits<{
  (e: 'extra-action', step: ICouncilOnboardingExtraStep): void;
}>();

const slots = useSlots();
// Статус-ряд рисуется, только если расширение передало чип подключения.
const hasStatusSlot = computed(() => Boolean(slots.status));
const { confirm } = useConfirm();

const steps = computed(() => props.config.steps);
const extraStepsList = computed(() => props.extraSteps ?? []);
const ghostLines = ['100%', '94%', '98%', '62%', '100%', '88%'];

const isCompleted = computed(() => steps.value.length > 0 && steps.value.every((s) => s.status === 'completed'));
const doneCount = computed(() => steps.value.filter((s) => s.status === 'completed').length);
const progressPercent = computed(() => (steps.value.length ? Math.round((doneCount.value / steps.value.length) * 100) : 0));

const countdownLabel = computed(() => {
  if (!props.config.expireAt) return null;
  const diff = props.config.expireAt.getTime() - Date.now();
  if (diff <= 0) return t('ui.councilOnboardingCard.expiredText');
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return days > 0
    ? t('ui.councilOnboardingCard.remainingDaysHours', { days, hours })
    : t('ui.councilOnboardingCard.remainingHours', { hours });
});

const expanded = ref<Record<string, boolean>>({});

/**
 * Что показывает плашка. Отметка отправки живёт до следующего чтения шагов:
 * вопрос, объявленный в этой очереди, сразу выглядит «у совета», а ошибка
 * остаётся видна у своего вопроса.
 */
type SendState = 'sending' | 'sent' | 'failed';
type PlateState = 'pending' | 'sending' | 'council' | 'done' | 'failed';
const sendState = ref<Record<string, SendState>>({});

function stateOf(step: ICouncilOnboardingStep): PlateState {
  if (step.status === 'completed') return 'done';
  if (step.status === 'in_progress') return 'council';
  const sent = sendState.value[step.id];
  if (sent === 'sending') return 'sending';
  if (sent === 'sent') return 'council';
  if (sent === 'failed') return 'failed';
  return 'pending';
}

const BADGE: Record<PlateState, { variant: BaseBadgeVariant; label: string }> = {
  pending: { variant: 'neutral', label: 'ui.councilOnboardingCard.badgePending' },
  sending: { variant: 'accent', label: 'ui.councilOnboardingCard.badgeSending' },
  council: { variant: 'warn', label: 'ui.councilOnboardingCard.badgeCouncil' },
  done: { variant: 'pos', label: 'ui.councilOnboardingCard.badgeApproved' },
  failed: { variant: 'neg', label: 'ui.councilOnboardingCard.badgeFailed' },
};

// Вопросы, ждущие объявления, по порядку шагов.
const pendingSteps = computed(() => steps.value.filter((s) => s.status === 'pending' && sendState.value[s.id] !== 'sent'));
const busy = ref(false);
// Объявлять можно, когда сформированы все документы: без документа в совет
// ушло бы решение из одной вводной фразы.
const ready = computed(() => !busy.value && pendingSteps.value.length > 0 && pendingSteps.value.every((s) => Boolean(s.decision)));
const announceLabel = computed(() =>
  pendingSteps.value.length === 1
    ? t('ui.councilOnboardingCard.announceOneButton')
    : t('ui.councilOnboardingCard.announceAllButton', { count: pendingSteps.value.length }),
);

/**
 * Вопросы уходят в совет строго по очереди: следующий объявляется, когда
 * предыдущий уже объявлен, — порядок шагов сохраняется. Ошибка останавливает
 * очередь и раскрывает свой вопрос; повторное нажатие продолжит с неотправленных.
 */
async function announceAll(): Promise<void> {
  if (!ready.value) return;
  const queue = [...pendingSteps.value];
  const agreed = await confirm({
    title: t('ui.councilOnboardingCard.announceConfirmTitle'),
    message: t('ui.councilOnboardingCard.announceConfirmMessage', { count: queue.length }),
    confirmLabel: t('ui.councilOnboardingCard.announceConfirmLabel'),
  });
  if (!agreed) return;

  busy.value = true;
  let sent = 0;
  try {
    for (const step of queue) {
      sendState.value = { ...sendState.value, [step.id]: 'sending' };
      try {
        await props.submitStep(step);
        sendState.value = { ...sendState.value, [step.id]: 'sent' };
        sent += 1;
      } catch (e) {
        sendState.value = { ...sendState.value, [step.id]: 'failed' };
        expanded.value = { ...expanded.value, [step.id]: true };
        FailAlert(e);
        return;
      }
    }
    SuccessAlert(t('ui.councilOnboardingCard.draftsSentText', { count: sent }));
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped lang="scss">
.council-onboarding--loading {
  min-height: 240px;
}

.council-onboarding__head {
  padding: var(--p-7) var(--p-7) var(--p-6);
}

.council-onboarding__title {
  margin: 0;
  color: var(--p-ink);
  font-size: var(--p-fs-h1);
  font-weight: 600;
  line-height: var(--p-lh-h1);
  letter-spacing: var(--p-ls-h1);
}

.council-onboarding__sub {
  max-width: 68ch;
  margin: var(--p-2) 0 0;
  color: var(--p-ink-2);
}

.council-onboarding__progress {
  display: flex;
  align-items: center;
  gap: var(--p-3);
  margin-top: var(--p-5);
}

.council-onboarding__bar {
  flex: 1;
  max-width: 280px;
  height: 6px;
  overflow: hidden;
  border-radius: var(--p-r-pill);
  background: var(--p-surface-3);

  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--p-pos);
    transition: width var(--p-dur-base) var(--p-ease-standard);
  }
}

.council-onboarding__status-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--p-2);
  margin-top: var(--p-3);
}

.council-onboarding__list {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  padding: 0 var(--p-7) var(--p-7);
}

// Плашка шага: на сером — то, что уже у совета или утверждено; белая с
// обводкой — то, что ждёт объявления. Цвет смысла несёт кружок номера и
// бейдж, а не полоса.
.council-onboarding__plate {
  overflow: hidden;
  border: 1px solid var(--p-line-1);
  border-radius: var(--p-r-md);
  background: var(--p-surface);
}

.council-onboarding__plate--council,
.council-onboarding__plate--done {
  background: var(--p-surface-2);
  border-color: var(--p-line);
}

.council-onboarding__plate--failed {
  border-color: var(--p-neg);
}

.council-onboarding__list--extra {
  padding-top: var(--p-5);
}

.council-onboarding__plate--extra {
  padding: var(--p-3) var(--p-4);
}

.council-onboarding__plate-head {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--p-4);
  min-width: 0;
  padding: var(--p-1) 0;
}

.council-onboarding__plate-text {
  flex: 1;
  min-width: 0;
}

.council-onboarding__plate-title {
  color: var(--p-ink);
  font-size: var(--p-fs-h3);
  font-weight: 600;
  line-height: var(--p-lh-h3);
}

.council-onboarding__plate-desc {
  margin-top: 2px;
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
}

.council-onboarding__badge {
  flex: 0 0 auto;
}

// Номер шага в мягком кружке: цвет — состояние шага.
.council-onboarding__num {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--p-r-pill);
  background: var(--p-primary-soft);
  color: var(--p-primary);
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
}

.council-onboarding__plate--council .council-onboarding__num {
  background: var(--p-warn-soft);
  color: var(--p-warn);
}

.council-onboarding__plate--done .council-onboarding__num {
  background: var(--p-pos-soft);
  color: var(--p-pos);
}

.council-onboarding__plate--failed .council-onboarding__num {
  background: var(--p-neg-soft);
  color: var(--p-neg);
}

.council-onboarding__plate--extra .council-onboarding__num {
  background: var(--p-surface-3);
  color: var(--p-ink-2);
}

// Раскрытый вопрос — белым листом под шапкой плашки.
.council-onboarding__plate-body {
  padding: var(--p-4) var(--p-5) var(--p-5);
  border-top: 1px solid var(--p-line);
  background: var(--p-surface);
}

.council-onboarding__question {
  margin: var(--p-1) 0 var(--p-4);
  color: var(--p-ink-1);
}

.council-onboarding__prefix {
  margin: var(--p-1) 0 var(--p-2);
  color: var(--p-ink-1);
}

.council-onboarding__ghost {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  padding-top: var(--p-2);
}

.council-onboarding__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-4);
  padding: var(--p-4) var(--p-7);
  border-top: 1px solid var(--p-line);
  background: var(--p-surface-2);
}

.council-onboarding__done :deep(.empty__icon) {
  width: 56px;
  height: 56px;
  background: var(--p-pos-soft);
  color: var(--p-pos);
}

@media (max-width: 700px) {
  .council-onboarding__head {
    padding: var(--p-5) var(--p-4) var(--p-4);
  }

  .council-onboarding__list {
    padding: 0 var(--p-4) var(--p-5);
  }

  .council-onboarding__foot {
    flex-direction: column;
    align-items: stretch;
    padding: var(--p-4);
  }

  .council-onboarding__plate-head {
    flex-wrap: wrap;
  }
}
</style>

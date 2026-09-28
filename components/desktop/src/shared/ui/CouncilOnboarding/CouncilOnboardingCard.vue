<template lang="pug">
//- Единая карточка онбординга. Лоадер — внутри карточки (q-inner-loading),
//- а не оверлеем на всё окно: иначе он «болтается» поверх уже отрисованной
//- страницы. Шаги совета и доп.шаги (навигация на другие столы) идут одним
//- сквозным списком 1-2-3-4 — без второй карточки и заголовков-разделов.
q-card.council-onboarding(flat, :class="{ 'council-onboarding--loading': loading }")
  q-inner-loading(:showing="loading")
    q-spinner(color="primary", size="2.5em")
    div.text-caption.text-grey-7.q-mt-sm(v-if="loadingText") {{ loadingText }}

  template(v-if="!loading")
    //- Поздравление, если шаги совета завершены — канон-состояние EmptyState.
    slot(name="completion", v-if="isCompleted")
      EmptyState.council-onboarding__done(
        :title="completionTitle",
        :body="completionMessage"
      )
        template(#icon)
          q-icon(name="celebration", size="26px")

    //- Шапка (только пока шаги совета не завершены).
    template(v-if="!isCompleted")
      q-card-section
        div.text-h5 {{ title }}
        div.text-caption.text-grey-7.q-mt-xs(v-if="subtitle") {{ subtitle }}
        //- Несколько вопросов ждут объявления — одно окно со всеми документами
        //- и одна отправка по очереди вместо кнопки на каждом шаге.
        div.council-onboarding__bulk(v-if="pendingSteps.length > 1")
          BaseButton(variant="primary", size="sm", :disabled="busy", @click="openBulk")
            template(#icon-left)
              q-icon.q-mr-xs(name="playlist_add_check", size="18px")
            span {{ $t('ui.councilOnboardingCard.announceAllLabel') }}
        div.council-onboarding__status-row(v-if="countdownLabel || hasStatusSlot")
          q-chip(
            v-if="countdownLabel",
            color="primary",
            text-color="white",
            icon="schedule"
          ) {{ countdownLabel }}
          slot(name="status")
      q-separator

    //- Единый список: шаги совета (пока не завершено) + доп.шаги (всегда).
    //- Одна структура и один вертикальный ритм у всех строк — без q-item и
    //- q-gutter (их разная высота и отрицательные margin'ы давали «гармошку»),
    //- хайрлайны-разделители между всеми шагами одинаковые.
    q-card-section.council-onboarding__steps(v-if="!isCompleted || extraStepsList.length")
      template(v-if="!isCompleted")
        div.council-onboarding__step(v-for="(step, index) in steps", :key="step.id")
          div.council-onboarding__step-head
            q-icon(:name="getIcon(step)", :color="getIconColor(step)", size="22px")
            div.text-subtitle1.council-onboarding__step-title {{ index + 1 }}. {{ step.title }}
          div.text-caption.text-grey-7.council-onboarding__step-desc {{ step.description }}
          div.council-onboarding__step-action(v-if="step.status === 'in_progress'")
            q-chip.q-ma-none(
              dense,
              color="amber",
              text-color="black",
              icon="hourglass_top"
            ) {{ $t('ui.councilOnboardingCard.waitingDecisionText') }}
          div.council-onboarding__step-action(v-else-if="showAction(index)")
            BaseButton(
              variant="primary",
              size="sm",
              :loading="busy && currentStepId === step.id",
              :disabled="busy",
              @click="() => handleStepClick(step)"
            ) {{ $t('ui.councilOnboardingCard.announceMeetLabel') }}

      div.council-onboarding__step(v-for="(step, i) in extraStepsList", :key="step.id")
        div.council-onboarding__step-head
          q-icon(name="radio_button_unchecked", color="grey-6", size="22px")
          div.text-subtitle1.council-onboarding__step-title {{ steps.length + i + 1 }}. {{ step.title }}
        div.text-caption.text-grey-7.council-onboarding__step-desc {{ step.description }}
        div.council-onboarding__step-action
          BaseButton(
            variant="primary",
            size="sm",
            :disabled="step.disabled",
            @click="() => emit('extra-action', step)"
          )
            span {{ step.actionLabel }}
            template(#icon-right)
              q-icon.q-ml-xs(name="arrow_forward", size="16px")

  BaseDialog(
    v-model='dialogOpen',
    :title='dialogTitle',
    size='lg',
    :close-on-backdrop='false',
    :close-on-escape='false',
    @update:model-value='(v) => !v && closeDialog()'
  )
    div.row.items-center.q-gutter-xs.text-subtitle1.text-weight-medium
      q-icon(name="help_outline" size="18px" class="text-primary")
      span {{ $t('ui.councilOnboardingCard.agendaQuestionLabel') }}
    div.q-mt-sm.q-pa-sm.text-body1.rounded-borders {{ dialogQuestion }}

    q-separator.q-my-md

    div.row.items-center.q-gutter-xs.text-subtitle1.text-weight-medium
      q-icon(name="gavel" size="18px" class="text-primary")
      span {{ $t('ui.councilOnboardingCard.draftDecisionLabel') }}
    div.q-mt-sm.q-pa-sm.rounded-borders
      div(v-if="dialogDecisionPrefix") {{ dialogDecisionPrefix }}
      DocumentHtmlReader(v-if="dialogDecision" :html="dialogDecision" profile="document")
      BaseBanner.q-mt-sm(v-else-if="dialogDecisionError" variant="neg") {{ dialogDecisionError }}
      //- Документ ещё формируется: текст подставится сам, как только придёт.
      div.council-onboarding__decision-ghost(v-else aria-busy="true")
        div.text-caption.text-grey-7 {{ $t('ui.councilOnboardingCard.generatingDocumentText') }}
        q-skeleton(v-for="(w, i) in ghostLines" :key="i" type="text" :width="w")

    template(#footer)
      BaseButton(variant='ghost' :disabled='busy' @click='closeDialog') {{ $t('common.action.cancel') }}
      BaseButton(variant='primary' :disabled='!dialogDecision' :loading='busy' @click='submitCurrent') {{ $t('ui.councilOnboardingCard.announceButton') }}

  //- Все вопросы, ждущие объявления, одним окном: каждый раскрывается до
  //- проекта решения, отправка — одна, вопросы уходят в совет по порядку.
  BaseDialog(
    v-model='bulkOpen',
    :title="$t('ui.councilOnboardingCard.announceAllTitle')",
    size='xl',
    :close-on-backdrop='false',
    :close-on-escape='false'
  )
    div.council-onboarding__bulk-head
      div.text-caption.text-grey-7 {{ $t('ui.councilOnboardingCard.announceAllHint') }}
      BaseButton(variant='ghost', size='sm', @click='toggleAllExpanded')
        | {{ allExpanded ? $t('ui.councilOnboardingCard.collapseAllLabel') : $t('ui.councilOnboardingCard.expandAllLabel') }}
    div.council-onboarding__bulk-list
      q-expansion-item.council-onboarding__bulk-item(
        v-for="step in bulkSteps",
        :key="step.id",
        v-model="expanded[step.id]",
        switch-toggle-side
      )
        template(#header)
          div.council-onboarding__bulk-item-head
            q-spinner(v-if="bulkState[step.id] === 'sending'", color="primary", size="20px")
            q-icon(v-else, :name="bulkIcon(step)", :color="bulkIconColor(step)", size="20px")
            div
              div.text-subtitle2 {{ stepNumber(step) }}. {{ step.title }}
              div.text-caption.text-grey-7 {{ step.description }}
        div.council-onboarding__bulk-body
          div.text-subtitle2 {{ $t('ui.councilOnboardingCard.agendaQuestionLabel') }}
          div.q-mt-xs.text-body2 {{ step.question }}
          div.text-subtitle2.q-mt-md {{ $t('ui.councilOnboardingCard.draftDecisionLabel') }}
          div.q-mt-xs(v-if="step.decisionPrefix") {{ step.decisionPrefix }}
          DocumentHtmlReader(v-if="step.decision" :html="step.decision" profile="document")
          BaseBanner.q-mt-sm(v-else-if="step.decisionError" variant="neg") {{ step.decisionError }}
          div.council-onboarding__decision-ghost(v-else aria-busy="true")
            div.text-caption.text-grey-7 {{ $t('ui.councilOnboardingCard.generatingDocumentText') }}
            q-skeleton(v-for="(w, i) in ghostLines" :key="i" type="text" :width="w")

    template(#footer)
      BaseButton(variant='ghost' :disabled='busy' @click='bulkOpen = false') {{ $t('common.action.cancel') }}
      BaseButton(
        variant='primary',
        :disabled='!bulkReady',
        :loading='busy',
        @click='submitAll'
      ) {{ $t('ui.councilOnboardingCard.announceAllButton', { count: bulkSteps.length }) }}
</template>

<script setup lang="ts">
import { ref, computed, useSlots } from 'vue';
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseBanner } from 'src/shared/ui/base/BaseBanner';
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
   * бросает ошибку, если нет, — по ней очередь «Объявить все» останавливается.
   * Загрузку и сообщения показывает карточка.
   */
  submitStep: (step: ICouncilOnboardingStep) => Promise<unknown>;
  loadingText?: string;
  title?: string;
  subtitle?: string;
  completionTitle?: string;
  completionMessage?: string;
  // Доп.шаги (навигация на другие столы) — рисуются в общем списке после
  // шагов совета и видны всегда. По умолчанию пусто (другие онбординги не
  // передают — поведение не меняется).
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
// Есть ли переданный контент в слоте статуса — чтобы не рисовать пустой
// статус-ряд, если расширение не передаёт чип подключения.
const hasStatusSlot = computed(() => Boolean(slots.status));

const dialogOpen = ref(false);
const currentStepId = ref<string | null>(null);

const steps = computed(() => props.config.steps);

// Окно читает шаг из актуального конфига, а не из снимка на момент нажатия:
// документ для проекта решения часто приходит позже, чем председатель
// открывает окно, и должен появиться в нём сам.
const currentStep = computed(() => steps.value.find((s) => s.id === currentStepId.value) ?? null);
const dialogTitle = computed(() => currentStep.value?.title ?? '');
const dialogQuestion = computed(() => currentStep.value?.question ?? '');
const dialogDecision = computed(() => currentStep.value?.decision ?? '');
const dialogDecisionPrefix = computed(() => currentStep.value?.decisionPrefix ?? '');
const dialogDecisionError = computed(() => currentStep.value?.decisionError ?? '');
const ghostLines = ['100%', '94%', '98%', '62%', '100%', '88%'];
// Null-safe доступ к доп.шагам: prop опционален, дефолт — пустой список.
const extraStepsList = computed(() => props.extraSteps ?? []);

const countdownLabel = computed(() => {
  if (!props.config.expireAt) return null;
  const now = new Date();
  const diff = props.config.expireAt.getTime() - now.getTime();
  if (diff <= 0) return t('ui.councilOnboardingCard.expiredText');

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return t('ui.councilOnboardingCard.remainingDaysHours', { days, hours });
  }
  return t('ui.councilOnboardingCard.remainingHours', { hours });
});

const isCompleted = computed(() => {
  if (props.config.steps.length === 0) return false;
  return props.config.steps.every(step => step.status === 'completed');
});

const getIcon = (step: ICouncilOnboardingStep) => {
  if (step.status === 'completed') return 'task_alt';
  if (step.status === 'in_progress') return 'hourglass_top';
  return 'radio_button_unchecked';
};

const getIconColor = (step: ICouncilOnboardingStep) => {
  if (step.status === 'completed') return 'green-6';
  if (step.status === 'in_progress') return 'orange-6';
  return 'grey-6';
};

const isPrevCompleted = (index: number) => {
  if (index === 0) return true;
  const prev = steps.value[index - 1];
  if (!prev) return true;
  return prev.status === 'completed' || prev.status === 'in_progress';
};

const showAction = (index: number) => {
  const step = steps.value[index];
  if (!step) return false;
  if (step.status === 'completed' || step.status === 'in_progress') return false;
  return isPrevCompleted(index);
};

const handleStepClick = (step: ICouncilOnboardingStep) => {
  currentStepId.value = step.id;
  dialogOpen.value = true;
};

const closeDialog = () => {
  dialogOpen.value = false;
  currentStepId.value = null;
};

// Одна отправка за раз: и одиночная кнопка, и очередь «Объявить все».
const busy = ref(false);

const submitCurrent = async () => {
  // Без документа в совет ушло бы решение из одной вводной фразы.
  const step = currentStep.value;
  if (!step || !dialogDecision.value) return;
  busy.value = true;
  try {
    await props.submitStep(step);
    SuccessAlert(t('ui.councilOnboardingCard.draftSentText'));
    closeDialog();
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
};

// Вопросы, ждущие объявления, по порядку шагов.
const pendingSteps = computed(() => steps.value.filter((s) => s.status === 'pending'));

type BulkState = 'waiting' | 'sending' | 'done' | 'failed';
const bulkOpen = ref(false);
// Состав окна снимается при открытии: шаги, объявленные по ходу очереди,
// меняют статус и ушли бы из списка, а их отметку «отправлен» надо видеть.
const bulkIds = ref<string[]>([]);
const bulkState = ref<Record<string, BulkState>>({});
const expanded = ref<Record<string, boolean>>({});

const bulkSteps = computed(() =>
  bulkIds.value.map((id) => steps.value.find((s) => s.id === id)).filter((s): s is ICouncilOnboardingStep => Boolean(s)),
);
const bulkReady = computed(
  () => !busy.value && bulkSteps.value.length > 0 && bulkSteps.value.every((s) => Boolean(s.decision)) && bulkSteps.value.some((s) => bulkState.value[s.id] !== 'done'),
);
const allExpanded = computed(() => bulkSteps.value.length > 0 && bulkSteps.value.every((s) => expanded.value[s.id]));
const stepNumber = (step: ICouncilOnboardingStep) => steps.value.findIndex((s) => s.id === step.id) + 1;

const openBulk = () => {
  bulkIds.value = pendingSteps.value.map((s) => s.id);
  bulkState.value = Object.fromEntries(bulkIds.value.map((id) => [id, 'waiting' as BulkState]));
  expanded.value = Object.fromEntries(bulkIds.value.map((id, i) => [id, i === 0]));
  bulkOpen.value = true;
};

const toggleAllExpanded = () => {
  const open = !allExpanded.value;
  expanded.value = Object.fromEntries(bulkIds.value.map((id) => [id, open]));
};

const bulkIcon = (step: ICouncilOnboardingStep) => {
  const state = bulkState.value[step.id];
  if (state === 'done') return 'task_alt';
  if (state === 'failed') return 'error_outline';
  return 'radio_button_unchecked';
};

const bulkIconColor = (step: ICouncilOnboardingStep) => {
  const state = bulkState.value[step.id];
  if (state === 'done') return 'positive';
  if (state === 'failed') return 'negative';
  return 'grey-6';
};

// Вопросы уходят в совет строго по очереди: следующий шаг объявляется, когда
// предыдущий уже объявлен, — тот же порядок, что у кнопок шагов. Ошибка
// останавливает очередь, окно остаётся открытым с отметкой, где она случилась;
// повторное нажатие продолжит с неотправленных.
const submitAll = async () => {
  if (!bulkReady.value) return;
  busy.value = true;
  let sent = 0;
  try {
    for (const step of bulkSteps.value) {
      if (bulkState.value[step.id] === 'done') continue;
      bulkState.value = { ...bulkState.value, [step.id]: 'sending' };
      try {
        await props.submitStep(step);
        bulkState.value = { ...bulkState.value, [step.id]: 'done' };
        sent += 1;
      } catch (e) {
        bulkState.value = { ...bulkState.value, [step.id]: 'failed' };
        expanded.value = { ...expanded.value, [step.id]: true };
        FailAlert(e);
        return;
      }
    }
    SuccessAlert(t('ui.councilOnboardingCard.draftsSentText', { count: sent }));
    bulkOpen.value = false;
  } finally {
    busy.value = false;
  }
};
</script>

<style scoped lang="scss">
// Пока идёт загрузка — резервируем высоту, чтобы q-inner-loading центрировал
// спиннер в осмысленной области, а не в схлопнутой пустой карточке.
.council-onboarding--loading {
  min-height: 240px;
}

// Таймер + статус подключения в один ряд с предсказуемым зазором. Не Quasar
// .row + .q-gutter: у чипов свои дефолтные margin'ы, из-за которых зазор
// «прыгает»; здесь gap + сброс margin дают ровную линию и аккуратный перенос.
.council-onboarding__status-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;

  :deep(.q-chip) {
    margin: 0;
  }
}

// Единый ритм шагов: одинаковый вертикальный отступ и хайрлайн-разделитель
// у КАЖДОЙ строки (и шаги совета, и доп.шаги — в одном контейнере), чтобы не
// было «гармошки» из-за разной высоты строк/разных секций.
.council-onboarding__decision-ghost {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  padding-top: var(--p-2);
}

.council-onboarding__bulk {
  margin-top: var(--p-3);
}

.council-onboarding__bulk-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
}

.council-onboarding__bulk-list {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  margin-top: var(--p-3);
}

.council-onboarding__bulk-item {
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
}

.council-onboarding__bulk-item-head {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--p-3);
}

.council-onboarding__bulk-body {
  padding: 0 var(--p-4) var(--p-4);
}

.council-onboarding__steps {
  display: flex;
  flex-direction: column;
}

.council-onboarding__step {
  padding: 16px 0;

  &:not(:first-child) {
    border-top: 1px solid var(--p-line);
  }
}

// Шапка шага: иконка + заголовок в одну линию с ровным зазором (без
// q-gutter — его отрицательные margin'ы ломали вертикальный ритм).
.council-onboarding__step-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.council-onboarding__step-desc {
  margin-top: 4px;
}

// Действие шага (кнопка/чип) — отдельным ярусом снизу, слева, с предсказуемым
// отступом. Кнопки навигации — солидные primary, не блёклый outline.
.council-onboarding__step-action {
  margin-top: 12px;
}

// Success-акцент для завершённого онбординга: иконка-плитка EmptyState по
// умолчанию приглушённая (surface-2 / ink-3) — для «подключено» красим её
// в позитивный токен и чуть увеличиваем.
.council-onboarding__done :deep(.empty__icon) {
  width: 56px;
  height: 56px;
  background: var(--p-pos-soft);
  color: var(--p-pos);
}
</style>

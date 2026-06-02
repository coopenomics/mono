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

    //- Иначе — шапка и шаги совета.
    template(v-else)
      q-card-section
        div.text-h5 {{ title }}
        div.text-caption.text-grey-7.q-mt-xs(v-if="subtitle") {{ subtitle }}
        div.council-onboarding__status-row(v-if="countdownLabel || hasStatusSlot")
          q-chip(
            v-if="countdownLabel",
            color="primary",
            text-color="white",
            icon="schedule"
          ) {{ countdownLabel }}
          slot(name="status")
      q-separator
      q-card-section
        q-list(separator)
          q-item.council-onboarding__step(v-for="(step, index) in steps", :key="step.id")
            q-item-section
              div.row.items-center.q-gutter-sm
                q-icon(:name="getIcon(step)", :color="getIconColor(step)", size="22px")
                div.text-subtitle1 {{ index + 1 }}. {{ step.title }}
              div.text-caption.text-grey-7.q-mt-xs {{ step.description }}
              div.q-mt-sm(v-if="step.status === 'in_progress'")
                q-chip.q-ma-none(
                  dense,
                  color="amber",
                  text-color="black",
                  icon="hourglass_top"
                ) Ожидаем решение совета
            q-item-section(side, top)
              q-btn(
                v-if="showAction(index)",
                :disable="submitting",
                color="primary",
                label="Объявить собрание совета",
                @click="() => handleStepClick(step)"
              )

    //- Доп.шаги — показываем ВСЕГДА (в т.ч. после завершения шагов совета),
    //- нумерация продолжает шаги совета. Единый список, без отдельной карточки.
    template(v-if="extraStepsList.length")
      q-separator
      q-card-section
        q-list(separator)
          q-item.council-onboarding__step(v-for="(step, i) in extraStepsList", :key="step.id")
            q-item-section
              div.row.items-center.q-gutter-sm
                q-icon(name="radio_button_unchecked", color="grey-6", size="22px")
                div.text-subtitle1 {{ steps.length + i + 1 }}. {{ step.title }}
              div.text-caption.text-grey-7.q-mt-xs {{ step.description }}
            q-item-section(side, top)
              q-btn(
                outline,
                color="primary",
                :label="step.actionLabel",
                :disable="step.disabled",
                @click="() => emit('extra-action', step)"
              )

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
      span Вопрос на повестке
    div.q-mt-sm.q-pa-sm.text-body1.rounded-borders {{ dialogQuestion }}

    q-separator.q-my-md

    div.row.items-center.q-gutter-xs.text-subtitle1.text-weight-medium
      q-icon(name="gavel" size="18px" class="text-primary")
      span Проект решения
    div.q-mt-sm.q-pa-sm.rounded-borders
      div(v-if="dialogDecisionPrefix") {{ dialogDecisionPrefix }}
      DocumentHtmlReader(v-if="dialogDecision" :html="dialogDecision" :sanitize="false")

    template(#footer)
      BaseButton(variant='ghost' :disabled='submitting' @click='closeDialog') Отмена
      BaseButton(variant='primary' :loading='submitting' @click='submitStep') Объявить
</template>

<script setup lang="ts">
import { ref, computed, useSlots, watch } from 'vue';
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import type {
  ICouncilOnboardingStep,
  ICouncilOnboardingConfig,
  ICouncilOnboardingExtraStep,
} from './types';

interface Props {
  config: ICouncilOnboardingConfig;
  loading?: boolean;
  // Идёт отправка проекта решения в Совет (async в родителе). Пока true —
  // кнопка «Объявить» крутит лоадер, диалог не закрывается.
  submitting?: boolean;
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
  submitting: false,
  loadingText: 'Загрузка данных онбординга...',
  title: 'Адаптация к работе на платформе',
  completionTitle: 'Онбординг завершен!',
  completionMessage: 'Все необходимые документы утверждены.',
  extraSteps: () => [],
});

const emit = defineEmits<{
  (e: 'step-submit', step: ICouncilOnboardingStep): void;
  (e: 'extra-action', step: ICouncilOnboardingExtraStep): void;
}>();

const slots = useSlots();
// Есть ли переданный контент в слоте статуса — чтобы не рисовать пустой
// статус-ряд, если расширение не передаёт чип подключения.
const hasStatusSlot = computed(() => Boolean(slots.status));

const dialogOpen = ref(false);
const currentStep = ref<ICouncilOnboardingStep | null>(null);
const dialogTitle = ref('');
const dialogQuestion = ref('');
const dialogDecision = ref('');
const dialogDecisionPrefix = ref('');

const steps = computed(() => props.config.steps);
// Null-safe доступ к доп.шагам: prop опционален, дефолт — пустой список.
const extraStepsList = computed(() => props.extraSteps ?? []);

const countdownLabel = computed(() => {
  if (!props.config.expireAt) return null;
  const now = new Date();
  const diff = props.config.expireAt.getTime() - now.getTime();
  if (diff <= 0) return 'Время истекло';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `Осталось ${days} дн. ${hours} ч.`;
  }
  return `Осталось ${hours} ч.`;
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
  currentStep.value = step;
  dialogTitle.value = step.title;
  dialogQuestion.value = step.question;
  dialogDecision.value = step.decision;
  dialogDecisionPrefix.value = step.decisionPrefix || '';
  dialogOpen.value = true;
};

const closeDialog = () => {
  dialogOpen.value = false;
  currentStep.value = null;
  dialogTitle.value = '';
  dialogQuestion.value = '';
  dialogDecision.value = '';
  dialogDecisionPrefix.value = '';
};

const submitStep = () => {
  if (!currentStep.value) return;
  // Диалог здесь НЕ закрываем: реальная отправка проекта решения в Совет —
  // async-операция в родителе (handleStepSubmit). Пока она идёт, prop
  // `submitting` = true → кнопка «Объявить» крутит лоадер, диалог открыт и
  // некликабелен. Закрытие — по watcher'у ниже, когда submitting вернётся
  // в false (успех или ошибка). Иначе диалог схлопывался мгновенно и юзер
  // не видел, что транзакция ещё идёт.
  emit('step-submit', currentStep.value);
};

// Закрываем диалог по завершении async-отправки (submitting: true → false).
watch(
  () => props.submitting,
  (now, prev) => {
    if (prev && !now && dialogOpen.value) closeDialog();
  },
);
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

// Воздух между шагами: q-list(separator) по умолчанию жмёт строки, а у нас
// в шаге три яруса (заголовок / описание / чип) — без этого всё слипается.
.council-onboarding__step {
  padding-top: 16px;
  padding-bottom: 16px;
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

<template lang="pug">
// Показываем лоадер пока данные загружаются
WindowLoader(
  v-if="loadingState"
  text="Загрузка данных онбординга..."
)

// Показываем поздравление если онбординг завершен
OnboardingCompletionCelebration(
  v-else-if="isOnboardingCompleted"
)

// Показываем шаги если онбординг не завершен и данные загружены
.onboarding(v-else)
  .onboarding__head
    h2.onboarding__title Адаптируйте кооператив к работе на платформе
    p.onboarding__lead
      | Чтобы кооператив начал работать в цифровом контуре платформы, совет
      | принимает несколько решений в электронной форме — по одному на каждый
      | шаг ниже. Сначала утверждаются положения о цифровых сервисах и формы
      | документов кооператива, затем оформляется вступление в Потребительский
      | кооператив «Восход». После этого вы импортируете пайщиков и объявляете
      | общее собрание. Для каждого шага платформа сформирует проект повестки и
      | зафиксирует принятое решение — пройдите все шаги до окончания срока
      | адаптации.
    .onboarding__deadline
      q-icon(name="fa-regular fa-clock" size="15px")
      span {{ countdownLabel ? `Срок адаптации: ${countdownLabel}` : 'Отсчёт появится после получения данных' }}

  q-separator.onboarding__sep

  .stepper.stepper--v
      .step(
        v-for="(step, index) in steps"
        :key="step.key"
        :class="stepClass(index)"
      )
        .step__rail
          .step__num
            q-icon(v-if="step.done" name="fa-solid fa-check")
            template(v-else) {{ index + 1 }}
          .step__line
        .step__body
          .step__label {{ step.title }}
          .step__sublabel {{ step.description }}
          .step__meta(v-if="!step.done && step.pending")
            q-icon(name="fa-solid fa-hourglass-half" size="12px")
            span {{ getPendingText(step) }}

          .step__action(v-if="showAction(index)")
            BaseButton(
              v-if="step.type === 'agenda'"
              variant="primary"
              size="sm"
              :loading="loadingAction"
              @click="openAgendaDialog(step)"
            )
              template(#icon-left)
                q-icon(name="fa-solid fa-bullhorn" size="14px")
              | Объявить собрание совета

            BaseButton(
              v-else-if="step.type === 'import'"
              variant="primary"
              size="sm"
              :disabled="loadingAction || isActionDisabled(index)"
              @click="importDialog = true"
            )
              template(#icon-left)
                q-icon(name="fa-solid fa-file-arrow-up" size="14px")
              | Импорт пайщиков
              q-tooltip(
                v-if="isActionDisabled(index)"
                anchor="top middle"
                self="bottom middle"
              ) Для продолжения примите решения советом

            BaseButton(
              v-else-if="step.type === 'meet'"
              variant="primary"
              size="sm"
              :disabled="loadingAction || isActionDisabled(index)"
              @click="openMeetDialog"
            )
              template(#icon-left)
                q-icon(name="fa-solid fa-users" size="14px")
              | Объявить общее собрание
              q-tooltip(
                v-if="isActionDisabled(index)"
                anchor="top middle"
                self="bottom middle"
              ) Для продолжения примите решения советом

  BaseDialog(
    :model-value="agendaDialog.open"
    size="lg"
    :title="agendaDialog.title || 'Предложение повестки'"
    :close-on-backdrop="!loadingAction"
    :close-on-escape="!loadingAction"
    @update:model-value="onAgendaDialogToggle"
  )
    .agenda-dialog
      .agenda-dialog__section
        .agenda-dialog__label
          q-icon(name="fa-regular fa-circle-question" size="16px")
          span Вопрос на повестке
        .agenda-dialog__question {{ agendaDialog.question }}

      .agenda-dialog__section
        .agenda-dialog__label
          q-icon(name="fa-solid fa-gavel" size="16px")
          span Проект решения
        .agenda-dialog__decision
          DocumentHtmlReader(:html="agendaDialog.decision" :sanitize="false")

    template(#footer)
      BaseButton(
        variant="ghost"
        :disabled="loadingAction"
        @click="closeAgendaDialog"
      ) Отмена
      BaseButton(
        variant="primary"
        :loading="loadingAction"
        @click="submitAgenda"
      )
        template(#icon-left)
          q-icon(name="fa-solid fa-bullhorn" size="15px")
        | Объявить

  CreateMeetForm(
    v-model="meetDialog"
    :loading="loadingAction"
    :is-chairman="true"
    :preset="meetPreset"
    @create="handleCreateMeet"
  )

  ParticipantsImportDialog(v-model="importDialog")
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { CreateMeetForm } from 'src/features/Meet/CreateMeet/ui';
import { ParticipantsImportDialog } from 'src/features/User/ImportParticipants/ui';
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader';
import { WindowLoader } from 'src/shared/ui/Loader';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import OnboardingCompletionCelebration from './OnboardingCompletionCelebration.vue';
import { useOnboardingFlow } from '../model';

const {
  steps,
  countdownLabel,
  isOnboardingCompleted,
  loadingAction,
  loadingState,
  meetDialog,
  meetPreset,
  agendaDialog,
  init,
  openAgendaDialog,
  closeAgendaDialog,
  submitAgenda,
  openMeetDialog,
  handleCreateMeet,
} = useOnboardingFlow();

const importDialog = ref(false);

// Закрытие диалога повестки (крестик / клик по фону / Escape) сбрасывает
// его состояние через closeAgendaDialog. Открытие идёт только через
// кнопку шага (openAgendaDialog), поэтому здесь обрабатываем лишь закрытие.
const onAgendaDialogToggle = (open: boolean) => {
  if (!open) closeAgendaDialog();
};

const getPendingText = (step: { type: string }) => {
  if (step.type === 'meet') return 'Ожидаем решение общего собрания пайщиков';
  return 'Ожидаем решение совета';
};

const isPrevStarted = (index: number) => {
  if (index === 0) return true;
  const prev = steps.value[index - 1];
  if (!prev) return true;

  // Для шагов импорта и общего собрания проверяем завершение 6-го шага (voskhod_membership)
  if (steps.value[index]?.type === 'import' || steps.value[index]?.type === 'meet') {
    const voskhodStep = steps.value[5]; // 6-й шаг (индекс 5)
    return voskhodStep?.done || voskhodStep?.pending;
  }

  return prev.done || prev.pending;
};

const showAction = (index: number) => {
  const step = steps.value[index];
  if (!step) return false;
  if (step.done || step.pending) return false;
  return isPrevStarted(index);
};

const isActionDisabled = (index: number) => {
  const step = steps.value[index];
  if (!step || step.done || step.pending) return false;

  // Для шагов импорта и общего собрания проверяем, что все agenda шаги выполнены
  if (step.type === 'import' || step.type === 'meet') {
    const agendaSteps = steps.value.slice(0, 6); // Первые 6 шагов - agenda шаги
    return !agendaSteps.every(step => step.done);
  }

  return false;
};

// Канон-степпер: пройденный шаг — is-done (галочка, заливка primary),
// текущий доступный к действию — is-active (подсветка номера). Ожидающие
// решения и ещё недоступные шаги — нейтральные.
const stepClass = (index: number) => {
  const step = steps.value[index];
  if (!step) return '';
  if (step.done) return 'is-done';
  if (showAction(index)) return 'is-active';
  return '';
};

onMounted(init);
</script>

<style scoped lang="scss">
.onboarding {
  display: flex;
  flex-direction: column;
}
.onboarding__head {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}
.onboarding__title {
  margin: 0;
  font-size: var(--p-fs-h2);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--p-ink);
}
.onboarding__lead {
  margin: 0;
  font-size: var(--p-fs-body);
  line-height: 1.55;
  color: var(--p-ink-2);
}
// Разделитель между шапкой и степпером — канон-воздух сверху/снизу.
.onboarding__sep {
  margin: var(--p-5, 20px) 0;
}
// Действие шага — без обрамляющей рамки, просто отступ сверху.
.step__action {
  margin-top: var(--p-3, 12px);
}
// Срок адаптации — спокойная плашка-предупреждение, отсчёт виден сразу.
.onboarding__deadline {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: var(--p-r-pill, 999px);
  background: var(--p-warn-soft);
  color: var(--p-warn);
  font-size: var(--p-fs-body-sm);
  font-weight: 500;
}

// Диалог повестки.
.agenda-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--p-5, 20px);
}
.agenda-dialog__section {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
}
// Подписи секций — надстрочные метки (eyebrow): отдельный типографический
// ярус ниже заголовка окна и заметно отличный от него, чтобы не казаться
// конкурирующим заголовком на фоне крупного заголовка самого документа.
.agenda-dialog__label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-ink-3);

  .q-icon {
    color: var(--p-primary);
  }
}
.agenda-dialog__question {
  font-size: var(--p-fs-body);
  line-height: 1.5;
  color: var(--p-ink);
}
.agenda-dialog__decision {
  padding: var(--p-4, 16px);
  background: var(--p-surface-2);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-sm, 8px);
  max-height: 50vh;
  overflow-y: auto;
}
</style>

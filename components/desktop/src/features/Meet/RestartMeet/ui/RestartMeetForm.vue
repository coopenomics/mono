<template lang="pug">
q-dialog(
  :model-value='modelValue',
  @update:model-value='$emit("update:modelValue", $event)',
  persistent,
  :maximized='true'
)
  q-card
    div
      q-bar.bg-gradient-dark.text-white
        span Перезапустить собрание
        q-space
        q-btn(
          v-close-popup,
          dense,
          flat,
          icon='close',
          @click='$emit("update:modelValue", false)'
        )
          q-tooltip Закрыть

      .q-pa-sm.row.justify-center
        .q-pa-md(style='max-width: 800px; width: 100%')
          .text-caption.text-grey.q-mt-md При перезапуске собрания будут использованы существующие пункты повестки.
            |
            | Собрание будет назначено на новые даты с новыми ответственными лицами.

          q-form.q-mt-md(@submit='handleSubmit')
            .text-subtitle1.q-mb-sm Выберите новые даты и ответственных для собрания

            UserSearchSelector.q-mb-md(
              v-model='formData.new_presider',
              label='Председатель собрания',
              :rules='[(val) => !!val || "Обязательное поле"]',
              dense,
              standout='bg-teal text-white'
            )

            UserSearchSelector.q-mb-md(
              v-model='formData.new_secretary',
              label='Секретарь собрания',
              :rules='[(val) => !!val || "Обязательное поле"]',
              dense,
              standout='bg-teal text-white'
            )

            q-input.q-mb-md(
              v-model='formData.new_open_at',
              :label='`Новая дата и время открытия (мин. через 15 дней, ${timezoneLabel})`',
              type='datetime-local',
              :rules='[(val) => !!val || "Обязательное поле"]',
              dense,
              standout='bg-teal text-white'
            )

            q-input.q-mb-md(
              v-model='formData.new_close_at',
              :label='`Новая дата и время закрытия (${timezoneLabel})`',
              type='datetime-local',
              :rules='[(val) => !!val || "Обязательное поле"]',
              dense,
              standout='bg-teal text-white'
            )

            q-input.q-mb-md(
              v-model='formData.details',
              label='Дополнительная информация для пайщиков (для нового слота; необязательно)',
              type='textarea',
              autogrow,
              :maxlength='maxMeetDetailsLength',
              counter,
              dense,
              standout='bg-teal text-white',
              :rules='[validateMeetDetailsLength]'
            )

            .text-subtitle1.q-mb-sm Пункты повестки для перезапуска:

            template(v-if='meetStore.currentMeet?.processing?.questions?.length')
              .meet-form-agenda-item.q-mb-sm(
                v-for='(question, index) in meetStore.currentMeet.processing.questions',
                :key='index'
              )
                .row.items-start.no-wrap
                  .col-auto.q-mr-md
                    AgendaNumberAvatar(:number='index + 1')
                  .col.min-w-0
                    .text-body1.text-weight-medium.q-mb-sm {{ question.title }}
                    .meet-form-field-row.q-mb-xs
                      span.meet-form-field-label Проект решения
                      span.meet-form-field-text {{ question.decision }}
                    .meet-form-field-row
                      span.meet-form-field-label Приложения
                      span.meet-form-field-text(
                        v-if='question.context',
                        v-html='parseLinks(question.context)'
                      )
                      span.meet-form-field-text(v-else) —

            .q-pa-sm.q-my-sm.bg-red-1.text-red-8.rounded-borders(v-else)
              .text-center Вопросы повестки не найдены

          .q-mt-lg
            q-btn(
              flat,
              label='Отмена',
              @click='$emit("update:modelValue", false)',
              :disable='loading'
            )
            q-btn.q-ml-sm(
              color='primary',
              label='Перезапустить',
              @click='handleSubmit',
              :loading='loading',
              :disable='!meetStore.currentMeet?.processing?.questions?.length'
            )
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useMeetStore } from 'src/entities/Meet';
import {
  getCurrentLocalDateForForm,
  convertLocalDateToUTC,
  getTimezoneLabel,
  getFutureDateForForm,
} from 'src/shared/lib/utils/dates/timezone';
import { env } from 'src/shared/config/Environment';
import { AgendaNumberAvatar } from 'src/shared/ui/AgendaNumberAvatar';
import { UserSearchSelector } from 'src/shared/ui';
import { parseLinks } from 'src/shared/lib/utils';

const maxMeetDetailsLength = 10000;
const validateMeetDetailsLength = (val: string | null | undefined): true | string =>
  !val || val.length <= maxMeetDetailsLength || `Не более ${maxMeetDetailsLength} символов`;

const props = defineProps<{
  modelValue: boolean;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'restart', data: any): void;
}>();

const meetStore = useMeetStore();

// Название часового пояса для отображения в лейблах
const timezoneLabel = getTimezoneLabel();

// Форма для перезапуска собрания
const formData = reactive(
  env.NODE_ENV === 'development'
    ? {
        new_presider: '',
        new_secretary: '',
        new_open_at: getCurrentLocalDateForForm(0.17),
        new_close_at: getCurrentLocalDateForForm(1),
        details: '',
      }
    : {
        new_presider: '',
        new_secretary: '',
        new_open_at: getFutureDateForForm(15, 6, 0),
        new_close_at: getFutureDateForForm(18, 12, 0),
        details: '',
      },
);

// Сброс формы при открытии диалога
watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      // Предзаполняем текущими данными собрания
      const currentMeet = meetStore.currentMeet;
      if (currentMeet?.processing?.meet) {
        formData.new_presider = currentMeet.processing.meet.presider;
        formData.new_secretary = currentMeet.processing.meet.secretary;
      }

      formData.details = currentMeet?.pre?.details?.trim() ? currentMeet.pre.details : '';

      if (env.NODE_ENV === 'development') {
        formData.new_open_at = getCurrentLocalDateForForm(0.17);
        formData.new_close_at = getCurrentLocalDateForForm(1);
      } else {
        formData.new_open_at = getFutureDateForForm(15, 6, 0);
        formData.new_close_at = getFutureDateForForm(18, 12, 0);
      }
    }
  },
);

const handleSubmit = () => {
  const meet = meetStore.currentMeet;
  if (!meet) return;

  // Проверяем наличие вопросов повестки
  if (!meet.processing?.questions || meet.processing.questions.length === 0) {
    return;
  }

  // Конвертируем локальные даты в UTC для отправки в блокчейн
  const dataToSend = {
    new_presider: formData.new_presider,
    new_secretary: formData.new_secretary,
    new_open_at: convertLocalDateToUTC(formData.new_open_at),
    new_close_at: convertLocalDateToUTC(formData.new_close_at),
    details: formData.details.trim(),
    agenda_points: meet.processing.questions.map((q) => ({
      title: q.title,
      context: q.context,
      decision: q.decision,
    })),
  };

  emit('restart', dataToSend);
};
</script>

<style lang="scss" scoped>
.meet-form-agenda-item {
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}
.meet-form-agenda-item:last-child {
  margin-bottom: 0;
}
.body--dark .meet-form-agenda-item,
.q-dark .meet-form-agenda-item {
  background-color: color-mix(in srgb, var(--q-dark-page, #1f1c1c) 90%, var(--q-primary) 10%);
  border: 1px solid rgba(255, 255, 255, 0.26);
}

.meet-form-field-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  opacity: 0.65;
  margin-bottom: 2px;
}

.meet-form-field-row .meet-form-field-label {
  margin-bottom: 4px;
}

.meet-form-field-text {
  font-size: 14px;
  line-height: 1.45;
  font-weight: 500;
  word-break: break-word;
}

.meet-form-field-text :deep(a) {
  word-break: break-word;
}
</style>

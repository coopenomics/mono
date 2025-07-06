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
              :label='env.NODE_ENV === "development" ? `Новая дата и время открытия (мин. через 1 минуту, ${timezoneLabel})` : `Новая дата и время открытия (мин. через 15 дней, ${timezoneLabel})`',
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

            .text-subtitle1.q-mb-sm Пункты повестки для перезапуска:

            q-card.q-pa-xs.q-my-sm.rounded-borders(
              flat,
              v-if='meetStore.currentMeet?.processing?.questions?.length'
            )
              .q-mb-xs.flex.items-start.q-mb-lg.q-pa-xs(
                v-for='(question, index) in meetStore.currentMeet.processing.questions',
                :key='index'
              )
                AgendaNumberAvatar.q-mr-sm(:number='index + 1', size='22px')
                .col
                  .text-body2.text-weight-medium.q-mb-2 {{ question.title }}
                  .text-caption.q-mb-1.q-mt-md
                    span.text-weight-bold.text-black Проект решения:
                    span.text-black.q-ml-xs {{ question.decision }}
                  .text-caption.q-mt-md
                    span.text-weight-bold.text-black Приложения:
                    span.text-black.q-ml-xs(
                      v-if='question.context',
                      v-html='parseLinks(question.context)'
                    )
                    span.text-black(v-else) —

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
      }
    : {
        new_presider: '',
        new_secretary: '',
        new_open_at: getFutureDateForForm(15, 6, 0),
        new_close_at: getFutureDateForForm(18, 12, 0),
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
    agenda_points: meet.processing.questions.map((q) => ({
      title: q.title,
      context: q.context,
      decision: q.decision,
    })),
  };

  emit('restart', dataToSend);
};
</script>

<template lang="pug">
q-dialog(
  :model-value='modelValue',
  @update:model-value='$emit("update:modelValue", $event)',
  persistent,
  :maximized='true'
)
  q-card.meet-wizard
    //- ===== Шапка =====
    header.meet-wizard__bar
      .meet-wizard__bar-title Созыв общего собрания
      q-btn(
        flat,
        round,
        dense,
        icon='close',
        aria-label='Закрыть',
        :disable='loading',
        @click='$emit("update:modelValue", false)'
      )

    //- ===== Тело: степпер + контент шага =====
    .meet-wizard__body
      .meet-wizard__col
        p.meet-wizard__intro
          | При созыве собрания формируется документ повестки и направляется
          | в совет на решение. После принятия решения собрание планируется,
          | а пайщики получают уведомление с предложением ознакомиться с повесткой
          | и подписать его.

        VerticalStepper(
          :steps='steps',
          :active-key='activeKey',
          :completed='completedKeys',
          @change='goToStep'
        )
          template(#active='{ step }')
            //- ---------- Шаг 1: Параметры ----------
            q-form.meet-wizard__step(v-if='step.key === "basics"', ref='basicsForm', greedy)
              q-select(
                v-model='formData.type',
                :options='meetTypeOptions',
                label='Тип собрания',
                outlined,
                emit-value,
                map-options,
                :rules='[(v) => !!v || "Выберите тип собрания"]'
              )
              UserSearchSelector(
                v-model='formData.presider',
                label='Председатель собрания',
                outlined,
                :rules='[(v) => !!v || "Укажите председателя"]'
              )
              UserSearchSelector(
                v-model='formData.secretary',
                label='Секретарь собрания',
                outlined,
                :rules='[(v) => !!v || "Укажите секретаря"]'
              )
              .meet-wizard__dates
                q-input(
                  v-model='formData.open_at',
                  :label='`Открытие (мин. через 15 дней, ${timezoneLabel})`',
                  type='datetime-local',
                  outlined,
                  stack-label,
                  :rules='[(v) => !!v || "Укажите дату открытия"]'
                )
                q-input(
                  v-model='formData.close_at',
                  :label='`Закрытие (${timezoneLabel})`',
                  type='datetime-local',
                  outlined,
                  stack-label,
                  :rules='[(v) => !!v || "Укажите дату закрытия"]'
                )
              q-input(
                v-model='formData.details',
                label='Доп. информация для пайщиков (необязательно)',
                hint='Например: ссылка на трансляцию, как участвовать',
                type='textarea',
                outlined,
                autogrow,
                :maxlength='maxMeetDetailsLength',
                counter,
                :rules='[validateMeetDetailsLength]'
              )

            //- ---------- Шаг 2: Повестка ----------
            q-form.meet-wizard__step(v-else-if='step.key === "agenda"', ref='agendaForm', greedy)
              .meet-wizard__agenda-empty(v-if='!agendaPoints.length')
                | Добавьте хотя бы один вопрос повестки.
              .meet-agenda-card(v-for='(point, index) in agendaPoints', :key='index')
                .meet-agenda-card__head
                  span.meet-agenda-card__num Вопрос {{ index + 1 }}
                  q-btn(
                    v-if='agendaPoints.length > 1',
                    flat,
                    dense,
                    round,
                    size='sm',
                    icon='delete_outline',
                    aria-label='Удалить вопрос',
                    @click='removeAgendaPoint(index)'
                  )
                q-input(
                  v-model='point.title',
                  label='Вопрос',
                  outlined,
                  type='textarea',
                  autogrow,
                  :rules='[(v) => !!v || "Сформулируйте вопрос"]'
                )
                q-input(
                  v-model='point.decision',
                  label='Проект решения',
                  outlined,
                  type='textarea',
                  autogrow,
                  :rules='[(v) => !!v || "Укажите проект решения"]'
                )
                q-input(
                  v-model='point.context',
                  label='Приложения (необязательно)',
                  outlined,
                  type='textarea',
                  autogrow
                )
              .meet-wizard__add
                BaseButton(variant='ghost', size='sm', @click='addAgendaPoint')
                  q-icon(name='add', size='16px')
                  span.q-ml-sm Добавить вопрос

            //- ---------- Шаг 3: Проверка ----------
            .meet-wizard__step(v-else-if='step.key === "review"')
              .meet-review
                .meet-review__row
                  span.meet-review__label Тип собрания
                  span.meet-review__value {{ selectedTypeLabel }}
                .meet-review__row
                  span.meet-review__label Председатель
                  span.meet-review__value {{ formData.presider || '—' }}
                .meet-review__row
                  span.meet-review__label Секретарь
                  span.meet-review__value {{ formData.secretary || '—' }}
                .meet-review__row
                  span.meet-review__label Открытие
                  span.meet-review__value {{ formatLocal(formData.open_at) }}
                .meet-review__row
                  span.meet-review__label Закрытие
                  span.meet-review__value {{ formatLocal(formData.close_at) }}
                .meet-review__row(v-if='formData.details')
                  span.meet-review__label Доп. информация
                  span.meet-review__value {{ formData.details }}
              .meet-review__agenda-title Повестка ({{ agendaPoints.length }})
              .meet-review__agenda
                .meet-agenda-card(v-for='(p, i) in agendaPoints', :key='i')
                  .meet-agenda-card__head
                    span.meet-agenda-card__num Вопрос {{ i + 1 }}
                  .meet-review__field
                    span.meet-review__field-label Вопрос
                    span.meet-review__field-value {{ p.title || '—' }}
                  .meet-review__field
                    span.meet-review__field-label Проект решения
                    span.meet-review__field-value {{ p.decision || '—' }}
                  .meet-review__field(v-if='p.context')
                    span.meet-review__field-label Приложения
                    span.meet-review__field-value {{ p.context }}

    //- ===== Подвал: навигация =====
    footer.meet-wizard__foot
      BaseButton(
        v-if='activeKey === "basics"',
        variant='ghost',
        :disabled='loading',
        @click='$emit("update:modelValue", false)'
      ) Отмена
      BaseButton(
        v-else,
        variant='ghost',
        :disabled='loading',
        @click='goBack'
      )
        q-icon(name='arrow_back', size='16px')
        span.q-ml-sm Назад
      q-space
      BaseButton(
        v-if='activeKey !== "review"',
        variant='primary',
        @click='goNext'
      )
        span.q-mr-sm Далее
        q-icon(name='arrow_forward', size='16px')
      BaseButton(
        v-else,
        variant='primary',
        :loading='loading',
        @click='handleSubmit'
      )
        q-icon(name='campaign', size='16px')
        span.q-ml-sm Объявить собрание
</template>

<script setup lang="ts">
import { reactive, computed, watch, ref } from 'vue';
import type { QForm } from 'quasar';
import { useAgendaPoints } from 'src/shared/hooks/useAgendaPoints';
import {
  convertLocalDateToUTC,
  getTimezoneLabel,
  getFutureDateForForm,
} from 'src/shared/lib/utils/dates/timezone';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { UserSearchSelector } from 'src/shared/ui';
import { VerticalStepper } from 'src/shared/ui/domain/VerticalStepper';
import type { StepperStep } from 'src/shared/ui/domain/VerticalStepper';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { FailAlert } from 'src/shared/api';
import type { CreateMeetPreset } from './types';
import type { AgendaPoint } from 'src/shared/hooks/useAgendaPoints';

const maxMeetDetailsLength = 10000;
const validateMeetDetailsLength = (val: string | null | undefined): true | string =>
  !val || val.length <= maxMeetDetailsLength || `Не более ${maxMeetDetailsLength} символов`;

const props = defineProps<{
  modelValue: boolean;
  loading?: boolean;
  isChairman: boolean;
  preset?: CreateMeetPreset;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'create', data: any): void;
}>();

const timezoneLabel = getTimezoneLabel();
const session = useSessionStore();
const system = useSystemStore();

// ===== Шаги =====
const steps: StepperStep[] = [
  { key: 'basics', label: 'Параметры собрания', description: 'Тип, председатель, секретарь и сроки' },
  { key: 'agenda', label: 'Повестка', description: 'Вопросы и проекты решений' },
  { key: 'review', label: 'Проверка и созыв', description: 'Сверьте данные перед отправкой в совет' },
];
const activeKey = ref<string>('basics');
const completedKeys = ref<string[]>([]);

const basicsForm = ref<QForm | null>(null);
const agendaForm = ref<QForm | null>(null);

function markCompleted(key: string): void {
  if (!completedKeys.value.includes(key)) completedKeys.value.push(key);
}

async function goNext(): Promise<void> {
  if (activeKey.value === 'basics') {
    const ok = await basicsForm.value?.validate();
    if (!ok) return;
    markCompleted('basics');
    activeKey.value = 'agenda';
    return;
  }
  if (activeKey.value === 'agenda') {
    if (!agendaPoints.value.length) {
      FailAlert('Добавьте хотя бы один вопрос повестки');
      return;
    }
    const ok = await agendaForm.value?.validate();
    if (!ok) return;
    markCompleted('agenda');
    activeKey.value = 'review';
  }
}

function goBack(): void {
  if (activeKey.value === 'review') activeKey.value = 'agenda';
  else if (activeKey.value === 'agenda') activeKey.value = 'basics';
}

// Возврат на завершённый шаг по клику в степпере.
function goToStep(key: string): void {
  if (completedKeys.value.includes(key) || key === activeKey.value) {
    activeKey.value = key;
  }
}

// ===== Опции типа собрания =====
const meetTypeOptions = computed(() => {
  // Председатель может выбирать любой тип, член совета — только внеочередное.
  if (props.isChairman) {
    return [
      { label: 'Очередное собрание', value: 'regular' },
      { label: 'Внеочередное собрание', value: 'extra' },
    ];
  }
  return [{ label: 'Внеочередное собрание', value: 'extra' }];
});
const selectedTypeLabel = computed(
  () => meetTypeOptions.value.find((o) => o.value === formData.type)?.label || '—',
);

// ===== Данные формы =====
const buildDefaults = () => ({
  coopname: system.info.coopname,
  initiator: session.username,
  presider: '',
  secretary: '',
  open_at: getFutureDateForForm(15, 6, 0), // через 15 дней, 6:00
  close_at: getFutureDateForForm(18, 12, 0), // через 18 дней, 12:00
  username: session.username,
  type: props.isChairman ? 'regular' : 'extra',
  details: '',
});

const agendaPoints = ref<AgendaPoint[]>([]);

watch(
  () => props.preset,
  (newPreset) => {
    if (newPreset && newPreset.agenda_points) {
      if (agendaPoints.value.length === 0) {
        agendaPoints.value = newPreset.agenda_points.map((point) => ({
          title: point.title,
          decision: point.decision,
          context: point.context || '',
        }));
      }
    }
  },
  { immediate: true },
);

const formData = reactive<Record<string, any>>({
  ...buildDefaults(),
  ...(props.preset || {}),
});

watch(
  agendaPoints,
  (newPoints) => {
    formData.agenda_points = newPoints;
  },
  { immediate: true },
);

watch(
  () => props.preset,
  (newPreset) => {
    if (newPreset) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { agenda_points, ...presetWithoutAgenda } = newPreset;
      Object.assign(formData, {
        ...buildDefaults(),
        ...presetWithoutAgenda,
        agenda_points: agendaPoints.value,
      });
    }
  },
  { immediate: true },
);

// Минимум один вопрос повестки при первом открытии формы.
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      if (!agendaPoints.value.length) addAgendaPoint();
      activeKey.value = 'basics';
      completedKeys.value = [];
    }
  },
  { immediate: true },
);

const { addAgendaPoint, removeAgendaPoint } = useAgendaPoints(agendaPoints);

// Человекочитаемое представление локальной даты для шага проверки.
function formatLocal(local: string | undefined): string {
  if (!local) return '—';
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return local;
  return `${d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })} (${timezoneLabel})`;
}

const handleSubmit = () => {
  const dataToSend = {
    ...formData,
    open_at: convertLocalDateToUTC(formData.open_at),
    close_at: convertLocalDateToUTC(formData.close_at),
  };
  emit('create', dataToSend);
};
</script>

<style lang="scss" scoped>
.meet-wizard {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--p-canvas);
}

/* ===== Шапка ===== */
.meet-wizard__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3, 12px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
  background: var(--p-surface);
  border-bottom: 1px solid var(--p-line);
  flex-shrink: 0;
}
.meet-wizard__bar-title {
  font-size: var(--p-fs-h6, 16px);
  font-weight: 600;
  color: var(--p-ink);
}

/* ===== Тело ===== */
.meet-wizard__body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: var(--p-6, 24px) var(--p-4, 16px);
}
.meet-wizard__col {
  max-width: 680px;
  margin: 0 auto;
}
.meet-wizard__intro {
  margin: 0 0 var(--p-5, 20px);
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body, 1.55);
  color: var(--p-ink-2);
}

.meet-wizard__step {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
  padding-bottom: var(--p-2, 8px);
}
.meet-wizard__dates {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--p-3, 12px);
}
@media (max-width: 600px) {
  .meet-wizard__dates {
    grid-template-columns: 1fr;
  }
}

/* ===== Карточка вопроса повестки ===== */
.meet-agenda-card {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
  padding: var(--p-4, 16px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
}
.meet-agenda-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.meet-agenda-card__num {
  font-size: var(--p-fs-body-sm, 13px);
  font-weight: 600;
  color: var(--p-ink-2);
}
.meet-wizard__agenda-empty {
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-ink-3);
}
.meet-wizard__add {
  display: flex;
  justify-content: center;
}

/* ===== Шаг проверки ===== */
.meet-review {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
  overflow: hidden;
  margin-bottom: var(--p-5, 20px);
}
.meet-review__row {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: var(--p-3, 12px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
  background: var(--p-surface);
}
.meet-review__row + .meet-review__row {
  border-top: 1px solid var(--p-line);
}
.meet-review__label {
  font-size: var(--p-fs-meta, 12px);
  color: var(--p-ink-2);
}
.meet-review__value {
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-ink-1);
  overflow-wrap: anywhere;
}
.meet-review__agenda-title {
  font-size: var(--p-fs-body-sm, 13px);
  font-weight: 600;
  color: var(--p-ink-2);
  margin-bottom: var(--p-2, 8px);
}
.meet-review__agenda {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}
.meet-review__field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.meet-review__field-label {
  font-size: var(--p-fs-meta, 12px);
  color: var(--p-ink-2);
}
.meet-review__field-value {
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-ink-1);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

/* ===== Подвал ===== */
.meet-wizard__foot {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
  background: var(--p-surface);
  border-top: 1px solid var(--p-line);
  flex-shrink: 0;
}
</style>

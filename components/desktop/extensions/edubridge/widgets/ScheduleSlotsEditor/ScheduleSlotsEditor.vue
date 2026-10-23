<template lang="pug">
//- Окна расписания: каждая строка — день недели, время начала, длительность,
//- стоимость часа преподавателя и преподаватель. Из окон и даты начала группы строится календарь занятий.
//- Поля окна стоят сеткой: в широком блоке — одной строкой, в узкой панели — двумя
//- (день, начало, минуты; стоимость часа и преподаватель). Удаление окна — справа, на уровне первой строки.
.edu-slots(:class="{ 'edu-slots--with-teacher': teacherOptions.length }")
  .edu-slots__row(v-for="(slot, i) in modelValue" :key="i")
    .edu-slots__fields
      BaseSelect(:model-value="slot.weekday" :label="$t('edubridge.scheduleSlots.weekdayLabel')" :options="dayChoices" :disabled="disabled" @update:model-value="patch(i, { weekday: Number($event) })")
      //- Резервное окно дня и времени не имеет: его минуты администратор ставит в календарь внеочередным занятием.
      BaseInput(v-if="slot.weekday !== RESERVE_WEEKDAY" :model-value="slot.time" :label="$t('edubridge.scheduleSlots.timeLabel')" type="time" stack-label :disabled="disabled" @update:model-value="patch(i, { time: String($event ?? '') })")
      .t-sm.t-muted.edu-slots__reserve-note(v-else) {{ $t('edubridge.scheduleSlots.reserveNote') }}
      BaseInput(:model-value="slot.minutes" :label="$t('edubridge.scheduleSlots.minutesLabel')" type="number" min="5" step="5" :disabled="disabled" @update:model-value="patch(i, { minutes: Number($event || 0) })")
      //- Стоимость часа преподавателя в окне: из неё и минут окна складывается стоимость занятия для участника; членский взнос кооператива сверх неё.
      BaseInput(:model-value="slot.hourly_rate" :label="$t('edubridge.scheduleSlots.rateLabel')" type="number" min="0" :suffix="symbol" :disabled="disabled" @update:model-value="patch(i, { hourly_rate: String($event ?? '') })")
        template(#append)
          FieldHelp(:text="$t('edubridge.scheduleSlots.rateHelp')")
      //- Преподаватель окна — из допусков курса. Пустое окно сервер заполняет сам при сохранении.
      BaseSelect.edu-slots__teacher(v-if="teacherOptions.length" :model-value="slot.assignment_id" :label="$t('edubridge.scheduleSlots.teacherLabel')" :options="teacherOptions" :disabled="disabled" @update:model-value="patch(i, { assignment_id: $event ? String($event) : null })")
    BaseButton.edu-slots__remove(variant="ghost" icon-only :aria-label="$t('edubridge.scheduleSlots.remove')" :disabled="disabled" @click="remove(i)")
      template(#icon-left)
        q-icon(name="close" size="18px")
  .t-sm.t-muted(v-if="!modelValue.length") {{ $t('edubridge.scheduleSlots.empty') }}
  BaseButton(variant="secondary" size="sm" :disabled="disabled" @click="add")
    template(#icon-left)
      q-icon(name="add" size="18px")
    | {{ $t('edubridge.scheduleSlots.add') }}
</template>

<script setup lang="ts">
import { BaseButton, BaseInput, BaseSelect, FieldHelp } from 'src/shared/ui/base';
import { RESERVE_WEEKDAY, WEEKDAY_OPTIONS, type IScheduleSlot } from '../../entities/Lesson';
import { t } from '../../i18n';

/**
 * Редактор окон расписания. Значение — список окон; родитель сохраняет его
 * вместе с курсом либо группой. Преподаватель в окне выбирается из допусков к
 * курсу; у нового курса допусков ещё нет, и колонка не показывается.
 */
const props = withDefaults(
  defineProps<{
    modelValue: IScheduleSlot[];
    /** Допуски преподавателей к курсу: значение — допуск, подпись — имя. */
    teacherOptions?: { value: string; label: string }[];
    /** Длительность занятия курса — подставляется в новое окно. */
    defaultMinutes?: number;
    /** Символ валюты кооператива — в подписи поля стоимости часа. */
    symbol?: string;
    disabled?: boolean;
  }>(),
  { teacherOptions: () => [], defaultMinutes: 60, symbol: '', disabled: false },
);
const emit = defineEmits<{ 'update:modelValue': [IScheduleSlot[]] }>();

/** Дни недели и резерв: минуты резерва входят в программу, в календарь их ставит администратор сам. */
const dayChoices = [...WEEKDAY_OPTIONS, { value: RESERVE_WEEKDAY, label: t('edubridge.scheduleSlots.reserve') }];

function patch(i: number, change: Partial<IScheduleSlot>): void {
  emit('update:modelValue', props.modelValue.map((s, k) => (k === i ? { ...s, ...change } : s)));
}

function remove(i: number): void {
  emit('update:modelValue', props.modelValue.filter((_, k) => k !== i));
}

function add(): void {
  const last = props.modelValue[props.modelValue.length - 1];
  emit('update:modelValue', [
    ...props.modelValue,
    { weekday: last ? Math.min(7, last.weekday + 2) : 2, time: last?.time ?? '17:00', minutes: last?.minutes ?? props.defaultMinutes, assignment_id: last?.assignment_id ?? null, hourly_rate: last?.hourly_rate ?? '' },
  ]);
}
</script>

<style scoped>
.edu-slots {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  /* Вёрстка окна зависит от ширины самого блока, а не экрана: один редактор стоит и в форме, и в панели. */
  container: edu-slots / inline-size;
}
/* Окно: поля сеткой слева, удаление справа. */
.edu-slots__row {
  display: flex;
  align-items: flex-start;
  gap: var(--p-2);
}
/* Узкий блок (боковая панель): три колонки — день, начало, минуты; ниже стоимость часа и преподаватель на две колонки. */
.edu-slots__fields {
  flex: 1 1 auto;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 var(--p-2);
}
.edu-slots__teacher {
  grid-column: span 2;
}
/* Блок без колонки преподавателя (форма курса): четыре поля помещаются в одну строку уже с 560px. */
@container edu-slots (min-width: 560px) {
  .edu-slots:not(.edu-slots--with-teacher) .edu-slots__fields {
    grid-template-columns: 1.1fr 1fr 0.8fr 1.4fr;
  }
}
/* Широкий блок с преподавателем (страница группы): все поля окна одной строкой; имени преподавателя — двойная ширина. */
@container edu-slots (min-width: 680px) {
  .edu-slots--with-teacher .edu-slots__fields {
    grid-template-columns: 1fr 0.9fr 0.7fr 1.5fr 1.9fr;
  }
  .edu-slots__teacher {
    grid-column: auto;
  }
}
/* Поле ввода — 40px, под ним место под подсказку; кнопка 36px центрируется по полю первой строки. */
.edu-slots__remove {
  flex: 0 0 auto;
  margin-top: 2px;
}
/* Подпись резерва занимает ячейку времени на высоте поля. */
.edu-slots__reserve-note {
  display: flex;
  align-items: center;
  height: 40px;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

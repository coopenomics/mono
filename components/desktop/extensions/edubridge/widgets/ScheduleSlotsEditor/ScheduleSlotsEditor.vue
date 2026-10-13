<template lang="pug">
//- Окна расписания: каждая строка — день недели, время начала, длительность и
//- преподаватель. Из окон и даты начала группы строится календарь занятий.
.edu-slots
  .edu-slots__row(v-for="(slot, i) in modelValue" :key="i")
    BaseSelect.edu-slots__day(:model-value="slot.weekday" :label="$t('edubridge.scheduleSlots.weekdayLabel')" :options="dayChoices" :disabled="disabled" @update:model-value="patch(i, { weekday: Number($event) })")
    //- Резервное окно дня и времени не имеет: его минуты администратор ставит в календарь внеочередным занятием.
    BaseInput.edu-slots__time(v-if="slot.weekday !== RESERVE_WEEKDAY" :model-value="slot.time" :label="$t('edubridge.scheduleSlots.timeLabel')" type="time" stack-label :disabled="disabled" @update:model-value="patch(i, { time: String($event ?? '') })")
    .edu-slots__time.t-sm.t-muted.edu-slots__reserve-note(v-else) {{ $t('edubridge.scheduleSlots.reserveNote') }}
    BaseInput.edu-slots__minutes(:model-value="slot.minutes" :label="$t('edubridge.scheduleSlots.minutesLabel')" type="number" min="5" step="5" :disabled="disabled" @update:model-value="patch(i, { minutes: Number($event || 0) })")
    //- Плановая стоимость занятия окна для одного участника: из неё складывается взнос, она же потолок взноса преподавателя.
    BaseInput.edu-slots__cost(:model-value="slot.cost" :label="$t('edubridge.scheduleSlots.costLabel')" type="number" min="0" :suffix="symbol" :disabled="disabled" @update:model-value="patch(i, { cost: String($event ?? '') })")
    BaseSelect.edu-slots__teacher(v-if="teacherOptions.length" :model-value="slot.assignment_id" :label="$t('edubridge.scheduleSlots.teacherLabel')" :options="teacherChoices" clearable :disabled="disabled" @update:model-value="patch(i, { assignment_id: $event ? String($event) : null })")
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
import { computed } from 'vue';
import { BaseButton, BaseInput, BaseSelect } from 'src/shared/ui/base';
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
    /** Символ валюты кооператива — подпись у поля стоимости. */
    symbol?: string;
    disabled?: boolean;
  }>(),
  { teacherOptions: () => [], defaultMinutes: 60, symbol: '', disabled: false },
);
const emit = defineEmits<{ 'update:modelValue': [IScheduleSlot[]] }>();

const teacherChoices = computed(() => [{ value: '', label: t('edubridge.scheduleSlots.teacherNone') }, ...props.teacherOptions]);
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
    { weekday: last ? Math.min(7, last.weekday + 2) : 2, time: last?.time ?? '17:00', minutes: last?.minutes ?? props.defaultMinutes, assignment_id: last?.assignment_id ?? null, cost: last?.cost ?? '' },
  ]);
}
</script>

<style scoped>
.edu-slots {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
/* Окно — одной строкой: день, время, минуты, преподаватель, удаление. На узком экране поля переносятся. */
.edu-slots__row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--p-2);
}
.edu-slots__day {
  flex: 1 1 120px;
}
.edu-slots__time {
  flex: 0 1 130px;
}
.edu-slots__minutes {
  flex: 0 1 120px;
}
.edu-slots__cost {
  flex: 0 1 160px;
}
.edu-slots__teacher {
  flex: 2 1 200px;
}
.edu-slots__remove {
  margin-top: var(--p-5);
}
.edu-slots__reserve-note {
  align-self: center;
  padding-top: var(--p-4);
}
</style>

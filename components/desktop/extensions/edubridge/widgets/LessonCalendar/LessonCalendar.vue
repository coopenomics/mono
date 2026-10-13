<template lang="pug">
//- Календарь занятий — сетка месяца: по дням плитки занятий с временем и
//- подписью, цвет плитки — состояние занятия. Нажатие открывает занятие.
.edu-cal
  .edu-cal__head
    .edu-cal__nav
      BaseButton(variant="ghost" icon-only :aria-label="$t('edubridge.lessonCalendar.prev')" @click="shift(-1)")
        template(#icon-left)
          q-icon(name="chevron_left" size="20px")
      .edu-cal__month {{ monthTitle }}
      BaseButton(variant="ghost" icon-only :aria-label="$t('edubridge.lessonCalendar.next')" @click="shift(1)")
        template(#icon-left)
          q-icon(name="chevron_right" size="20px")
      BaseButton(variant="ghost" size="sm" @click="today") {{ $t('edubridge.lessonCalendar.today') }}
    .edu-cal__legend
      span.edu-cal__legend-item(v-for="s in legend" :key="s.key")
        span.edu-cal__dot(:class="`edu-cal__dot--${s.key}`")
        | {{ s.label }}
  .edu-cal__grid
    .edu-cal__weekday(v-for="d in WEEKDAY_OPTIONS" :key="d.value") {{ d.label }}
    .edu-cal__day(v-for="cell in cells" :key="cell.key" :class="{ 'edu-cal__day--out': cell.out, 'edu-cal__day--today': cell.today }")
      .edu-cal__date {{ cell.day }}
      button.edu-cal__chip(v-for="l in cell.lessons" :key="asText(l.id)" type="button" :class="`edu-cal__chip--${stateKey(l)}`" :title="titleOf(l)" @click="emit('select', l)")
        span.edu-cal__chip-time {{ timeOf(l) }}
        span.edu-cal__chip-label {{ labelOf(l) }}
  .t-sm.t-muted.q-mt-sm(v-if="!monthLessons.length") {{ $t('edubridge.lessonCalendar.emptyMonth') }}
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { asText } from 'src/shared/lib/utils';
import { BaseButton } from 'src/shared/ui/base';
import { WEEKDAY_OPTIONS, type ICalendarLesson } from '../../entities/Lesson';
import { t } from '../../i18n';

/**
 * Сетка месяца с занятиями. Подпись плитки даёт родитель: администратору —
 * группа и преподаватель, преподавателю — курс и группа, участнику — тема.
 */
const props = withDefaults(
  defineProps<{
    lessons: ICalendarLesson[];
    /** Подпись плитки занятия. */
    labelOf?: (l: ICalendarLesson) => string;
    /** Месяц, который открыт при первом показе. */
    initialMonth?: Date;
  }>(),
  { labelOf: (l: ICalendarLesson) => l.group_title || l.course_title, initialMonth: () => new Date() },
);
const emit = defineEmits<{ select: [ICalendarLesson]; 'month-change': [Date] }>();

const month = ref(new Date(props.initialMonth.getFullYear(), props.initialMonth.getMonth(), 1));
watch(month, (m) => emit('month-change', m));

const monthTitle = computed(() => month.value.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }));
function shift(delta: number): void {
  month.value = new Date(month.value.getFullYear(), month.value.getMonth() + delta, 1);
}
function today(): void {
  const now = new Date();
  month.value = new Date(now.getFullYear(), now.getMonth(), 1);
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const byDay = computed(() => {
  const map = new Map<string, ICalendarLesson[]>();
  for (const l of props.lessons) {
    const key = dayKey(new Date(String(l.held_at)));
    map.set(key, [...(map.get(key) ?? []), l]);
  }
  for (const list of map.values()) list.sort((a, b) => String(a.held_at).localeCompare(String(b.held_at)));
  return map;
});
const monthLessons = computed(() =>
  props.lessons.filter((l) => {
    const d = new Date(String(l.held_at));
    return d.getFullYear() === month.value.getFullYear() && d.getMonth() === month.value.getMonth();
  }),
);

/** Ячейки сетки: с понедельника недели, в которую попадает первое число, по воскресенье недели последнего. */
const cells = computed(() => {
  const first = month.value;
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const todayKey = dayKey(new Date());
  const out: { key: string; day: number; out: boolean; today: boolean; lessons: ICalendarLesson[] }[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (i >= 35 && d.getMonth() !== first.getMonth()) break;
    const key = dayKey(d);
    out.push({ key, day: d.getDate(), out: d.getMonth() !== first.getMonth(), today: key === todayKey, lessons: byDay.value.get(key) ?? [] });
  }
  return out;
});

const stateKey = (l: ICalendarLesson): string => (l.overdue ? 'overdue' : String(l.status).toLowerCase());
const timeOf = (l: ICalendarLesson): string => new Date(String(l.held_at)).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const titleOf = (l: ICalendarLesson): string => `${t('edubridge.lesson.numberShort', { number: l.lesson_number })} · ${props.labelOf(l)}`;
const legend = [
  { key: 'planned', label: t('edubridge.lesson.state.planned') },
  { key: 'held', label: t('edubridge.lesson.state.held') },
  { key: 'overdue', label: t('edubridge.lesson.state.overdue') },
  { key: 'cancelled', label: t('edubridge.lesson.state.cancelled') },
];

defineExpose({ month });
</script>

<style scoped>
.edu-cal__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-2);
  margin-bottom: var(--p-3);
}
.edu-cal__nav {
  display: flex;
  align-items: center;
  gap: var(--p-1);
}
.edu-cal__month {
  min-width: 160px;
  text-align: center;
  font-weight: 600;
  color: var(--p-ink);
  text-transform: capitalize;
}
.edu-cal__legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-3);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}
.edu-cal__legend-item {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
}
.edu-cal__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--p-info);
}
.edu-cal__dot--held,
.edu-cal__chip--held {
  background: var(--p-pos-soft);
  color: var(--p-pos);
}
.edu-cal__dot--held {
  background: var(--p-pos);
}
.edu-cal__dot--overdue {
  background: var(--p-warn);
}
.edu-cal__dot--cancelled {
  background: var(--p-ink-3);
}
/* Сетка семь колонок; высота ячейки растёт по числу занятий. */
.edu-cal__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  border-left: 1px solid var(--p-line);
  border-top: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  overflow: hidden;
}
.edu-cal__weekday {
  padding: var(--p-1) var(--p-2);
  font-size: var(--p-fs-meta);
  color: var(--p-ink-3);
  background: var(--p-surface-2);
  border-right: 1px solid var(--p-line);
  border-bottom: 1px solid var(--p-line);
}
.edu-cal__day {
  min-height: 84px;
  padding: var(--p-1);
  border-right: 1px solid var(--p-line);
  border-bottom: 1px solid var(--p-line);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.edu-cal__day--out {
  background: var(--p-surface-2);
}
.edu-cal__day--out .edu-cal__date {
  color: var(--p-ink-3);
}
.edu-cal__date {
  font-size: var(--p-fs-meta);
  color: var(--p-ink);
  padding: 0 var(--p-1);
}
.edu-cal__day--today .edu-cal__date {
  font-weight: 700;
  color: var(--p-primary);
}
.edu-cal__chip {
  display: flex;
  align-items: baseline;
  gap: var(--p-1);
  width: 100%;
  padding: 2px var(--p-1);
  border: 0;
  border-radius: var(--p-r-sm);
  background: var(--p-info-soft);
  color: var(--p-info);
  font: inherit;
  font-size: var(--p-fs-meta);
  line-height: 1.3;
  text-align: left;
  cursor: pointer;
}
.edu-cal__chip:hover {
  filter: brightness(0.96);
}
.edu-cal__chip--overdue {
  background: var(--p-warn-soft);
  color: var(--p-warn);
}
.edu-cal__chip--cancelled {
  background: var(--p-surface-2);
  color: var(--p-ink-3);
  text-decoration: line-through;
}
.edu-cal__chip-time {
  flex: 0 0 auto;
  font-weight: 600;
}
.edu-cal__chip-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

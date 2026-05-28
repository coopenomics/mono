<template lang="pug">
.activity-timeline
  template(v-if='groupByDate')
    .activity-timeline__group(v-for='group in grouped' :key='group.dateKey')
      .activity-timeline__group-head {{ group.label }}
      ol.activity-timeline__list
        li.activity-timeline__item(v-for='e in group.events' :key='e.id')
          .activity-timeline__icon(:class='`activity-timeline__icon--${e.type}`')
            q-icon(:name='e.icon || iconFor(e.type)' size='14px')
          .activity-timeline__body
            .activity-timeline__title-row
              span.activity-timeline__title {{ e.title }}
              span.activity-timeline__time {{ timeOf(e.date) }}
            p.activity-timeline__desc(v-if='e.description') {{ e.description }}
            span.activity-timeline__actor(v-if='e.actor') {{ e.actor }}
  template(v-else)
    ol.activity-timeline__list
      li.activity-timeline__item(v-for='e in events' :key='e.id')
        .activity-timeline__icon(:class='`activity-timeline__icon--${e.type}`')
          q-icon(:name='e.icon || iconFor(e.type)' size='14px')
        .activity-timeline__body
          .activity-timeline__title-row
            span.activity-timeline__title {{ e.title }}
            span.activity-timeline__time {{ e.date }}
          p.activity-timeline__desc(v-if='e.description') {{ e.description }}
          span.activity-timeline__actor(v-if='e.actor') {{ e.actor }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ActivityEvent, ActivityEventType, ActivityTimelineProps } from './ActivityTimeline.types';

const props = withDefaults(defineProps<ActivityTimelineProps>(), {
  groupByDate: false,
});

function iconFor(t: ActivityEventType): string {
  switch (t) {
    case 'create': return 'add_circle';
    case 'update': return 'edit';
    case 'sign': return 'check_circle';
    case 'reject': return 'cancel';
    case 'comment': return 'chat_bubble';
    case 'system': return 'settings';
    case 'transfer': return 'swap_horiz';
  }
}

function dateKeyOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function humanDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const yKey = yesterday.toISOString().slice(0, 10);
  const eKey = d.toISOString().slice(0, 10);
  if (eKey === todayKey) return 'Сегодня';
  if (eKey === yKey) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

const grouped = computed(() => {
  const groups = new Map<string, ActivityEvent[]>();
  for (const e of props.events) {
    const k = dateKeyOf(e.date);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(e);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([k, evs]) => ({ dateKey: k, label: humanDate(evs[0]!.date), events: evs }));
});
</script>

<style scoped>
.activity-timeline {
  display: flex;
  flex-direction: column;
  gap: var(--p-5, 20px);
  color: var(--p-ink);
}

.activity-timeline__group-head {
  font-size: var(--p-fs-meta, 12px);
  line-height: var(--p-lh-meta, 1.4);
  letter-spacing: var(--p-ls-eyebrow, 0.08em);
  text-transform: uppercase;
  color: var(--p-ink-2);
  margin-bottom: var(--p-2, 8px);
}

.activity-timeline__list {
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0 0 0 var(--p-5, 20px);
}
.activity-timeline__list::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 6px;
  bottom: 6px;
  width: 1px;
  background: var(--p-line);
}

.activity-timeline__item {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: start;
  gap: var(--p-3, 12px);
  padding: var(--p-1, 4px) 0 var(--p-3, 12px);
}
.activity-timeline__item:last-child {
  padding-bottom: 0;
}

.activity-timeline__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  margin-left: calc(var(--p-5, 20px) * -1);
  border-radius: 50%;
  background: var(--p-surface-3);
  color: var(--p-ink-1);
  border: 2px solid var(--p-surface);
}
.activity-timeline__icon--sign { background: var(--p-pos-soft); color: var(--p-pos); }
.activity-timeline__icon--reject { background: var(--p-neg-soft); color: var(--p-neg); }
.activity-timeline__icon--create { background: var(--p-primary-soft); color: var(--p-primary); }
.activity-timeline__icon--update { background: var(--p-info-soft); color: var(--p-info); }
.activity-timeline__icon--comment { background: var(--p-accent-soft); color: var(--p-accent); }
.activity-timeline__icon--transfer { background: var(--p-warn-soft); color: var(--p-warn); }

.activity-timeline__body {
  min-width: 0;
}

.activity-timeline__title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--p-2, 8px);
}

.activity-timeline__title {
  font-weight: 500;
  color: var(--p-ink);
  overflow-wrap: anywhere;
}

.activity-timeline__time {
  flex-shrink: 0;
  font-family: var(--p-mono);
  font-size: var(--p-fs-mono-sm, 12px);
  color: var(--p-ink-2);
}

.activity-timeline__desc {
  margin: var(--p-1, 4px) 0 0;
  color: var(--p-ink-1);
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body-sm, 1.5);
}

.activity-timeline__actor {
  display: inline-block;
  margin-top: var(--p-1, 4px);
  color: var(--p-ink-2);
  font-size: var(--p-fs-meta, 12px);
  line-height: var(--p-lh-meta, 1.4);
}
</style>

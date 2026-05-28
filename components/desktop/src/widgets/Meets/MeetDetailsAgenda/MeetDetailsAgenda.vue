<template lang="pug">
.meet-agenda
  .meet-agenda__head
    q-icon(name='list_alt', size='18px')
    span.meet-agenda__title Повестка

  .meet-agenda__intro(v-if='meetDetailsHtml')
    .meet-agenda__intro-text(v-html='meetDetailsHtml')

  .meet-agenda__items
    .meet-agenda-card(v-for='(item, index) in meetAgendaItems', :key='index')
      .meet-agenda-card__head
        AgendaNumberAvatar(:number='index + 1')
        span.meet-agenda-card__title {{ item.title }}
      .meet-agenda-card__field
        span.meet-agenda-card__label Проект решения
        span.meet-agenda-card__value {{ item.decision }}
      .meet-agenda-card__field
        span.meet-agenda-card__label Приложения
        span.meet-agenda-card__value(
          v-if='item.context',
          v-html='parseLinks(item.context)'
        )
        span.meet-agenda-card__value(v-else) —

  .meet-agenda__foot
    SignNotificationButton(
      v-if='coopname && meetHash',
      :coopname='coopname',
      :meetHash='meetHash'
    )
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { IMeet } from 'src/entities/Meet';
import { AgendaNumberAvatar } from 'src/shared/ui/AgendaNumberAvatar';
import { SignNotificationButton } from 'src/features/Meet/SignNotification/ui';
import { parseLinks } from 'src/shared/lib/utils';

const props = defineProps<{
  meet: IMeet;
  coopname?: string;
  meetHash?: string;
}>();

const coopname = computed(() => props.coopname || '');
const meetHash = computed(() => props.meetHash || '');

const meetDetailsHtml = computed(() => {
  const raw = props.meet?.pre?.details?.trim();
  return raw ? parseLinks(raw) : '';
});

const meetAgendaItems = computed(() => {
  if (!props.meet) return [];
  return props.meet.processing?.questions || [];
});
</script>

<style lang="scss" scoped>
.meet-agenda {
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 16px);
  padding: var(--p-5, 20px);
}

.meet-agenda__head {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
  color: var(--p-ink-2);
  margin-bottom: var(--p-4, 16px);
}
.meet-agenda__title {
  font-size: var(--p-fs-h2, 18px);
  font-weight: 600;
  color: var(--p-ink);
}

.meet-agenda__intro {
  background: var(--p-surface-2);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
  padding: var(--p-4, 16px);
  margin-bottom: var(--p-4, 16px);
}
.meet-agenda__intro-text {
  font-size: var(--p-fs-body, 14px);
  line-height: 1.5;
  color: var(--p-ink-1);
  overflow-wrap: anywhere;

  :deep(a) {
    color: var(--p-primary);
    word-break: break-word;
  }
}

.meet-agenda__items {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}

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
  align-items: flex-start;
  gap: var(--p-3, 12px);
}
.meet-agenda-card__title {
  font-size: var(--p-fs-body, 14px);
  font-weight: 600;
  line-height: 1.4;
  color: var(--p-ink-1);
  padding-top: 6px;
  overflow-wrap: anywhere;
}
.meet-agenda-card__field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.meet-agenda-card__label {
  font-size: var(--p-fs-meta, 12px);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--p-ink-3);
}
.meet-agenda-card__value {
  font-size: var(--p-fs-body-sm, 13px);
  line-height: 1.45;
  color: var(--p-ink-1);
  overflow-wrap: anywhere;

  :deep(a) {
    color: var(--p-primary);
    word-break: break-word;
  }
}

.meet-agenda__foot {
  display: flex;
  justify-content: center;
  margin-top: var(--p-5, 20px);
}
</style>

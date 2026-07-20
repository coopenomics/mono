<template lang="pug">
.notification-center(role='dialog', aria-label='Уведомления')
  header.notification-center__header
    h3.notification-center__title Уведомления
      span.notification-center__count(v-if='unreadCount') {{ unreadCount }}
    button.notification-center__mark-all(
      v-if='unreadCount',
      type='button',
      @click="emit('markAllRead')"
    ) Прочитать все

  .notification-center__body
    template(v-if='loading')
      ul.notification-center__skel
        li.notification-center__skel-item(v-for='i in 4', :key='i')
          span.skel.skel--circle.notification-center__skel-bullet
          .notification-center__skel-lines
            span.skel.skel--text
            span.skel.skel--text
            span.skel.skel--text

    template(v-else-if='!notifications.length')
      .notification-center__empty
        EmptyState(title='Нет уведомлений', body='Здесь появятся системные и финансовые события')

    template(v-else)
      ul.notification-center__list
        li.notification-center__group(v-for='group in groupedNotifications', :key='group.category')
          .notification-center__group-title {{ categoryLabels[group.category] }}
          ul.notification-center__items
            li.notification-center__item(
              v-for='n in group.items',
              :key='n.id',
              :class='{ "is-unread": !n.read }',
              tabindex='0',
              role='button',
              @click="emit('open', n.id)",
              @keydown.enter.prevent="emit('open', n.id)",
              @keydown.space.prevent="emit('open', n.id)"
            )
              BaseBadge.notification-center__item-bullet(
                v-if='!n.read',
                variant='accent',
                :dot='true'
              )
              span.notification-center__item-bullet-spacer(v-else)
              .notification-center__item-body
                .notification-center__item-title {{ n.title }}
                .notification-center__item-desc(v-if='n.description') {{ n.description }}
                time.notification-center__item-date(:datetime='toIso(n.date)') {{ formatRelative(n.date) }}

  footer.notification-center__footer(v-if='!loading && notifications.length && showViewAll')
    a.notification-center__view-all(
      :href='viewAllHref ?? "/notifications"',
      @click.prevent="emit('viewAll')"
    ) {{ viewAllLabel ?? 'Показать все' }}
      q-icon.notification-center__view-all-icon(name='arrow_forward', size='16px')
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { BaseBadge } from 'src/shared/ui/base/BaseBadge';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import type {
  NotificationCategory,
  NotificationCenterProps,
  NotificationItem,
} from './NotificationCenter.types';

const props = withDefaults(defineProps<NotificationCenterProps>(), {
  loading: false,
  showViewAll: true,
});

const emit = defineEmits<{
  markAllRead: [];
  open: [id: string];
  viewAll: [];
}>();

const CATEGORY_ORDER: NotificationCategory[] = ['system', 'financial', 'voting', 'message'];

const categoryLabels: Record<NotificationCategory, string> = {
  system: 'Системные',
  financial: 'Финансовые',
  voting: 'Голосования',
  message: 'Сообщения',
};

const unreadCount = computed(() => props.notifications.filter((n) => !n.read).length);

const groupedNotifications = computed<Array<{ category: NotificationCategory; items: NotificationItem[] }>>(() => {
  const map = new Map<NotificationCategory, NotificationItem[]>();
  for (const n of props.notifications) {
    const list = map.get(n.category) ?? [];
    list.push(n);
    map.set(n.category, list);
  }
  return CATEGORY_ORDER
    .filter((c) => map.has(c))
    .map((c) => ({
      category: c,
      items: (map.get(c) ?? []).slice().sort((a, b) => toDate(b.date).getTime() - toDate(a.date).getTime()),
    }));
});

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function toIso(value: string | Date): string {
  const d = toDate(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : '';
}

function formatRelative(value: string | Date): string {
  const d = toDate(value);
  if (!Number.isFinite(d.getTime())) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'только что';
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return `${m} ${plural(m, 'мин', 'мин', 'мин')} назад`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `${h} ${plural(h, 'час', 'часа', 'часов')} назад`;
  }
  if (diff < 7 * 86400) {
    const days = Math.floor(diff / 86400);
    return `${days} ${plural(days, 'день', 'дня', 'дней')} назад`;
  }
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
</script>

<style scoped>
.notification-center {
  display: flex;
  flex-direction: column;
  width: 360px;
  max-width: 100%;
  background: var(--p-surface);
  color: var(--p-ink);
  border: 1px solid var(--p-line-1);
  border-radius: var(--p-r-md, 12px);
  box-shadow: var(--p-shadow-pop);
  overflow: hidden;
}

/* На мобиле панель занимает всю ширину раскрытого меню (см. .notification-center-menu
   в виджете) — не узкий обрубок 360px. */
@media (max-width: 600px) {
  .notification-center {
    width: 100%;
  }
}

.notification-center__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-2, 8px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
  border-bottom: 1px solid var(--p-line);
}

.notification-center__title {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2, 8px);
  margin: 0;
  font-size: var(--p-fs-body, 14px);
  line-height: var(--p-lh-body, 1.5);
  font-weight: 600;
  color: var(--p-ink);
}

.notification-center__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--p-accent-soft, var(--p-primary-soft));
  color: var(--p-accent, var(--p-primary));
  font-size: var(--p-fs-caption, 12px);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.notification-center__mark-all {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--p-primary);
  font-size: var(--p-fs-body-sm, 13px);
  font-weight: 500;
  cursor: pointer;
}
.notification-center__mark-all:hover {
  text-decoration: underline;
}

/* Фиксированная высота тела (~4 уведомления) — панель не «прыгает» при
   смене скелетон → меньше элементов → пусто. Скролл внутри, не наружу. */
.notification-center__body {
  height: 340px;
  max-height: 60vh;
  overflow-y: auto;
}

.notification-center__empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--p-6, 24px) var(--p-4, 16px);
}

/* ---- Skeleton (канон .skel, как в таблицах/карточках) ---- */
.notification-center__skel {
  list-style: none;
  margin: 0;
  padding: 0;
}
.notification-center__skel-item {
  display: flex;
  align-items: flex-start;
  gap: var(--p-2, 8px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
}
.notification-center__skel-bullet {
  width: 8px;
  height: 8px;
  margin-top: 6px;
  flex: 0 0 auto;
}
.notification-center__skel-lines {
  display: flex;
  flex-direction: column;
  gap: var(--p-1, 4px);
  flex: 1 1 auto;
}
.notification-center__skel-lines .skel--text:nth-child(1) { width: 55%; }
.notification-center__skel-lines .skel--text:nth-child(2) { width: 90%; }
.notification-center__skel-lines .skel--text:nth-child(3) { width: 30%; }

.notification-center__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.notification-center__group + .notification-center__group {
  border-top: 1px solid var(--p-line);
}

.notification-center__group-title {
  padding: var(--p-2, 8px) var(--p-4, 16px) var(--p-1, 4px);
  font-size: var(--p-fs-caption, 12px);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--p-ink-3);
}

.notification-center__items {
  list-style: none;
  margin: 0;
  padding: 0;
}

.notification-center__item {
  display: flex;
  align-items: flex-start;
  gap: var(--p-2, 8px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
  cursor: pointer;
  outline: none;
  transition: background var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.notification-center__item:hover,
.notification-center__item:focus-visible {
  background: var(--p-surface-2);
}
.notification-center__item:focus-visible {
  box-shadow: inset 0 0 0 2px var(--p-primary);
}

/* Разделитель между уведомлениями — видимая линия в обеих темах (--p-line
   0.06 на тёмной почти невидим, оттого «всё сливалось»; --p-line-1 заметнее). */
.notification-center__items .notification-center__item + .notification-center__item {
  border-top: 1px solid var(--p-line-1);
}

/* Непрочитанные выделяем подложкой + левым акцент-баром: на тёмной теме одна
   разница в цвете текста + точка тонули в фоне панели. primary-soft/-line дают
   видимый тон в обеих темах, не ухудшая светлую. */
.notification-center__item.is-unread {
  background: var(--p-primary-soft);
  box-shadow: inset 3px 0 0 var(--p-primary);
}
.notification-center__item.is-unread:hover,
.notification-center__item.is-unread:focus-visible {
  background: var(--p-primary-line);
}

.notification-center__item-bullet {
  margin-top: 6px;
  flex: 0 0 auto;
}
.notification-center__item-bullet-spacer {
  display: inline-block;
  width: 8px;
  flex: 0 0 auto;
}

.notification-center__item-body {
  display: flex;
  flex-direction: column;
  gap: var(--p-1, 4px);
  min-width: 0;
  flex: 1 1 auto;
}

.notification-center__item-title {
  font-size: var(--p-fs-body-sm, 13px);
  font-weight: 600;
  line-height: var(--p-lh-body-sm, 1.4);
  color: var(--p-ink);
}
.notification-center__item.is-unread .notification-center__item-title {
  color: var(--p-ink);
  font-weight: 600;
}
.notification-center__item:not(.is-unread) .notification-center__item-title {
  color: var(--p-ink-2);
  font-weight: 500;
}

.notification-center__item-desc {
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body-sm, 1.5);
  color: var(--p-ink-2);
  /* In-app тела несут перенос строки как \n (не HTML <br> — тело рендерится
     как текст, без v-html: payload содержит ФИО/заголовки = XSS-вектор). */
  white-space: pre-line;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.notification-center__item-date {
  font-size: var(--p-fs-caption, 12px);
  line-height: var(--p-lh-body-sm, 1.4);
  color: var(--p-ink-3);
}

.notification-center__footer {
  border-top: 1px solid var(--p-line);
  padding: var(--p-2, 8px) var(--p-4, 16px);
  text-align: center;
}

.notification-center__view-all {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1, 4px);
  font-size: var(--p-fs-body-sm, 13px);
  font-weight: 500;
  color: var(--p-primary);
  text-decoration: none;
  cursor: pointer;
}
.notification-center__view-all:hover {
  text-decoration: underline;
}
.notification-center__view-all-icon {
  margin-left: 2px;
}
</style>

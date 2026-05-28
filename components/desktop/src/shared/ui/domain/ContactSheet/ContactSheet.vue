<template lang="pug">
ul.contact-sheet(:class='`contact-sheet--${density}`')
  li.contact-sheet__item(v-for='c in contacts' :key='c.type + ":" + c.value')
    q-icon.contact-sheet__icon(:name='iconFor(c.type)' size='16px')
    .contact-sheet__body
      .contact-sheet__head
        span.contact-sheet__label {{ c.label ?? labelFor(c.type) }}
        q-icon.contact-sheet__verified(
          v-if='c.verified',
          name='verified',
          size='14px',
          aria-label='Подтверждённый контакт'
        )
      .contact-sheet__value-row
        component.contact-sheet__value(
          :is='hrefFor(c) ? "a" : "span"',
          :href='hrefFor(c) || undefined',
          :target='c.type === "web" || c.type === "tg" ? "_blank" : undefined',
          :rel='c.type === "web" || c.type === "tg" ? "noopener noreferrer" : undefined'
        ) {{ c.value }}
        button.contact-sheet__copy(
          type='button',
          aria-label='Скопировать значение',
          @click.stop.prevent='() => onCopy(c)'
        )
          q-icon(name='content_copy' size='14px')
        slot(name='actions' :contact='c')
</template>

<script setup lang="ts">
import { copyToClipboard, Notify } from 'quasar';
import type { ContactItem, ContactSheetProps, ContactType } from './ContactSheet.types';

withDefaults(defineProps<ContactSheetProps>(), {
  density: 'comfortable',
});

const emit = defineEmits<{
  copy: [contact: ContactItem];
}>();

function iconFor(t: ContactType): string {
  switch (t) {
    case 'email': return 'mail_outline';
    case 'phone': return 'phone';
    case 'address': return 'place';
    case 'tg': return 'send';
    case 'web': return 'link';
  }
}

function labelFor(t: ContactType): string {
  switch (t) {
    case 'email': return 'Email';
    case 'phone': return 'Телефон';
    case 'address': return 'Адрес';
    case 'tg': return 'Telegram';
    case 'web': return 'Сайт';
  }
}

function hrefFor(c: ContactItem): string | undefined {
  if (!c.value) return undefined;
  switch (c.type) {
    case 'email': return `mailto:${c.value}`;
    case 'phone': return `tel:${c.value.replace(/\s+/g, '')}`;
    case 'tg':
      return c.value.startsWith('http') ? c.value : `https://t.me/${c.value.replace(/^@/, '')}`;
    case 'web':
      return c.value.startsWith('http') ? c.value : `https://${c.value}`;
    default: return undefined;
  }
}

async function onCopy(c: ContactItem): Promise<void> {
  if (!c.value) return;
  try {
    await copyToClipboard(c.value);
    emit('copy', c);
    Notify.create({ type: 'positive', message: 'Скопировано', timeout: 1200, position: 'top' });
  } catch {
    Notify.create({ type: 'negative', message: 'Не удалось скопировать', timeout: 2000, position: 'top' });
  }
}
</script>

<style scoped>
.contact-sheet {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--p-ink);
}

.contact-sheet__item {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: start;
  gap: var(--p-3, 12px);
  padding: var(--p-3, 12px) 0;
  border-bottom: 1px solid var(--p-line);
}
.contact-sheet--compact .contact-sheet__item {
  padding: var(--p-2, 8px) 0;
}
.contact-sheet__item:last-child {
  border-bottom: none;
}

.contact-sheet__icon {
  margin-top: 2px;
  color: var(--p-ink-2);
  flex-shrink: 0;
}

.contact-sheet__body {
  display: flex;
  flex-direction: column;
  gap: var(--p-1, 4px);
  min-width: 0;
}
.contact-sheet--comfortable .contact-sheet__body {
  gap: var(--p-2, 8px);
}

.contact-sheet__head {
  display: flex;
  align-items: center;
  gap: var(--p-1, 4px);
  color: var(--p-ink-2);
  font-size: var(--p-fs-meta, 12px);
  line-height: var(--p-lh-meta, 1.4);
}

.contact-sheet__verified {
  color: var(--p-pos);
}

.contact-sheet__value-row {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
  max-width: 100%;
}

.contact-sheet__value {
  color: var(--p-ink);
  font-size: var(--p-fs-body, 14px);
  line-height: var(--p-lh-body, 1.55);
  text-decoration: none;
  overflow-wrap: anywhere;
  min-width: 0;
}
a.contact-sheet__value {
  color: var(--p-primary);
  transition: color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
a.contact-sheet__value:hover {
  color: var(--p-primary-hover);
  text-decoration: underline;
}

.contact-sheet__copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--p-ink-3);
  border-radius: var(--p-r-xs, 6px);
  cursor: pointer;
  transition: background var(--p-dur-fast, 120ms) var(--p-ease-standard), color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.contact-sheet__copy:hover {
  background: var(--p-line-1);
  color: var(--p-ink-1);
}
.contact-sheet__copy:focus-visible {
  outline: none;
  box-shadow: var(--p-focus-ring);
}
</style>

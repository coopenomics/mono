<template lang="pug">
component(
  :is='linkable && resolvedHref ? "a" : "span"',
  :href='linkable && resolvedHref ? resolvedHref : undefined',
  :target='linkable && resolvedHref ? "_blank" : undefined',
  :rel='linkable && resolvedHref ? "noopener noreferrer" : undefined',
  :class='["account-badge", `account-badge--${size}`, { "account-badge--linkable": linkable }]'
)
  span.account-badge__name {{ accountName }}
  button.account-badge__copy(
    v-if='copyable',
    type='button',
    aria-label='Скопировать имя аккаунта',
    @click.stop.prevent='onCopy'
  )
    q-icon(name='content_copy' size='14px')
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { copyToClipboard, Notify } from 'quasar';
import type { AccountBadgeProps } from './AccountBadge.types';

const props = withDefaults(defineProps<AccountBadgeProps>(), {
  size: 'sm',
  copyable: true,
  linkable: false,
});

const emit = defineEmits<{
  copy: [value: string];
}>();

const resolvedHref = computed((): string | undefined => {
  if (!props.linkable) return undefined;
  if (props.explorerUrl) return props.explorerUrl;
  return undefined;
});

async function onCopy(): Promise<void> {
  if (!props.accountName) return;
  try {
    await copyToClipboard(props.accountName);
    emit('copy', props.accountName);
    Notify.create({ type: 'positive', message: 'Скопировано', timeout: 1200, position: 'top' });
  } catch {
    Notify.create({ type: 'negative', message: 'Не удалось скопировать', timeout: 2000, position: 'top' });
  }
}
</script>

<style scoped>
.account-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1, 4px);
  font-family: var(--p-mono);
  font-weight: 500;
  font-feature-settings: 'tnum' 1;
  background: var(--p-surface-3);
  color: var(--p-ink-1);
  border-radius: var(--p-r-xs, 6px);
  line-height: 1.2;
  vertical-align: middle;
  transition: background var(--p-dur-fast, 120ms) var(--p-ease-standard), color var(--p-dur-fast, 120ms) var(--p-ease-standard);
  white-space: nowrap;
  max-width: 100%;
}

.account-badge--sm {
  padding: 2px var(--p-2, 8px);
  font-size: var(--p-fs-mono-sm, 12px);
}

.account-badge--md {
  padding: 4px var(--p-2, 8px);
  font-size: var(--p-fs-mono, 13px);
}

.account-badge--linkable {
  text-decoration: none;
  cursor: pointer;
}
.account-badge--linkable:hover {
  background: var(--p-primary-soft);
  color: var(--p-primary);
}

.account-badge__name {
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.account-badge__copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  margin-left: var(--p-1, 4px);
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--p-ink-2);
  cursor: pointer;
  border-radius: var(--p-r-xs, 6px);
  transition: background var(--p-dur-fast, 120ms) var(--p-ease-standard), color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.account-badge__copy:hover {
  background: var(--p-line-1);
  color: var(--p-ink);
}
.account-badge__copy:focus-visible {
  outline: none;
  box-shadow: var(--p-focus-ring);
}
</style>

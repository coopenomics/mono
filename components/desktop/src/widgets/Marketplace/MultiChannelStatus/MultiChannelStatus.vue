<template>
  <div class="mp-mcs">
    <div class="mp-mcs__label">{{ label }}</div>
    <div class="mp-mcs__list">
      <div
        v-for="ch in channels"
        :key="ch.kind"
        class="mp-mcs__chip"
        :class="`mp-mcs__chip--${statusKind(ch.status)}`"
      >
        <q-icon :name="iconOf(ch.kind)" class="mp-mcs__chip-icon" />
        <span class="mp-mcs__chip-label">{{ kindLabel[ch.kind] }}</span>
        <span class="mp-mcs__chip-status">{{ statusLabel[ch.status] }}</span>
        <q-tooltip>
          <div><strong>{{ kindLabel[ch.kind] }}</strong></div>
          <div>Статус: {{ statusLabel[ch.status] }}</div>
          <div v-if="ch.at">Время: {{ formatTime(ch.at) }}</div>
          <div v-if="ch.error">Ошибка: {{ ch.error }}</div>
        </q-tooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type PropType } from 'vue'

export type ChannelKind = 'push' | 'email' | 'sms'
export type ChannelStatus = 'sent' | 'delivered' | 'read' | 'failed' | 'pending' | 'disabled'

export interface ChannelStatusEntry {
  kind: ChannelKind
  status: ChannelStatus
  at?: string | Date
  error?: string
}

defineProps({
  label: { type: String, default: 'Доставка уведомления' },
  channels: { type: Array as PropType<ChannelStatusEntry[]>, required: true },
})

const kindLabel: Record<ChannelKind, string> = {
  push:  'Push',
  email: 'E-mail',
  sms:   'SMS',
}

const statusLabel: Record<ChannelStatus, string> = {
  sent:      'Отправлено',
  delivered: 'Доставлено',
  read:      'Прочитано',
  failed:    'Ошибка',
  pending:   'В очереди',
  disabled:  'Отключено',
}

type ChipKind = 'ok' | 'warn' | 'fail' | 'idle'

function statusKind(s: ChannelStatus): ChipKind {
  if (s === 'delivered' || s === 'read') return 'ok'
  if (s === 'sent' || s === 'pending') return 'warn'
  if (s === 'failed') return 'fail'
  return 'idle'
}

function iconOf(k: ChannelKind): string {
  return ({
    push:  'fa-solid fa-bell',
    email: 'fa-solid fa-envelope',
    sms:   'fa-solid fa-message',
  } as const)[k]
}

function formatTime(v: string | Date) {
  const d = typeof v === 'string' ? new Date(v) : v
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped lang="scss">
.mp-mcs {
  &__label {
    font-size: 12px;
    color: var(--mp-on-surface-muted);
    margin-bottom: var(--mp-space-sm);
  }

  &__list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--mp-space-md);
  }

  &__chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 999px;
    background: var(--mp-surface-1);
    border: 1px solid var(--mp-border-subtle);
    font-size: 13px;
    color: var(--mp-on-surface);
    cursor: default;
    position: relative;

    // Цветовая точка-индикатор статуса (как у mp-status-chip)
    &::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--mp-on-surface-muted);
      flex-shrink: 0;
    }

    &--ok::before   { background: var(--q-positive); }
    &--warn::before { background: var(--q-warning); }
    &--fail::before { background: var(--q-negative); }
    &--idle::before { background: var(--mp-on-surface-muted); }
  }

  &__chip-icon {
    color: var(--mp-on-surface-muted);
    font-size: 14px;
  }

  &__chip-label {
    font-weight: 500;
  }

  &__chip-status {
    color: var(--mp-on-surface-muted);
    font-size: 12px;
  }
}
</style>

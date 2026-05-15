<template>
  <div class="mp-multi-channel-status">
    <div class="text-caption text-grey-7 q-mb-xs">{{ label }}</div>
    <div class="row q-gutter-sm items-center">
      <q-chip
        v-for="ch in channels"
        :key="ch.kind"
        dense
        :color="chipColor(ch.status)"
        text-color="white"
        :icon="iconOf(ch.kind)"
      >
        <span class="q-ml-xs">
          {{ kindLabel[ch.kind] }}
          <q-tooltip>
            <div><strong>{{ kindLabel[ch.kind] }}</strong></div>
            <div>Статус: {{ statusLabel[ch.status] }}</div>
            <div v-if="ch.at">Время: {{ formatTime(ch.at) }}</div>
            <div v-if="ch.error">Ошибка: {{ ch.error }}</div>
          </q-tooltip>
        </span>
      </q-chip>
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

function iconOf(k: ChannelKind): string {
  return ({
    push:  'fa-solid fa-bell',
    email: 'fa-solid fa-envelope',
    sms:   'fa-solid fa-message',
  } as const)[k]
}

function chipColor(s: ChannelStatus): string {
  return ({
    sent:      'info',
    delivered: 'positive',
    read:      'primary',
    failed:    'negative',
    pending:   'grey-7',
    disabled:  'grey-5',
  } as const)[s]
}

function formatTime(v: string | Date) {
  const d = typeof v === 'string' ? new Date(v) : v
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

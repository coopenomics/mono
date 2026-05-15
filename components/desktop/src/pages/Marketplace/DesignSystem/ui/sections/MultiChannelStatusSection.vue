<template>
  <div>
    <div class="text-h5 q-mb-md">MultiChannelStatus · Story 10.2.12 · UX-DR18</div>
    <div class="text-body2 text-grey-7 q-mb-lg">
      Статус доставки нотификации пайщику по каналам push / email / SMS с tooltip по
      каждому каналу. 6 status (sent / delivered / read / failed / pending / disabled).
    </div>

    <div class="column q-gutter-md">
      <MultiChannelStatus
        label="Заказ MP-1234 — все каналы доставлены"
        :channels="case1"
      />
      <MultiChannelStatus
        label="Заказ MP-1235 — SMS не отправлен"
        :channels="case2"
      />
      <MultiChannelStatus
        label="Заказ MP-1236 — все в очереди"
        :channels="case3"
      />
      <MultiChannelStatus
        label="Пользователь отключил email"
        :channels="case4"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { MultiChannelStatus, type ChannelStatusEntry } from 'src/widgets/Marketplace/MultiChannelStatus'

const now = new Date()

const case1: ChannelStatusEntry[] = [
  { kind: 'push',  status: 'read',      at: now },
  { kind: 'email', status: 'delivered', at: now },
  { kind: 'sms',   status: 'delivered', at: now },
]

const case2: ChannelStatusEntry[] = [
  { kind: 'push',  status: 'delivered', at: now },
  { kind: 'email', status: 'sent',      at: now },
  { kind: 'sms',   status: 'failed',    error: 'Номер не подтверждён' },
]

const case3: ChannelStatusEntry[] = [
  { kind: 'push',  status: 'pending' },
  { kind: 'email', status: 'pending' },
  { kind: 'sms',   status: 'pending' },
]

const case4: ChannelStatusEntry[] = [
  { kind: 'push',  status: 'delivered', at: now },
  { kind: 'email', status: 'disabled' },
  { kind: 'sms',   status: 'delivered', at: now },
]
</script>

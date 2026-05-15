<template>
  <div class="mp-takeover-dialog-section">
    <div class="text-h5 q-mb-md">TakeoverDialog · Story 10.2.1 · UX-DR7</div>
    <div class="text-body2 text-grey-7 q-mb-lg">
      Full-screen takeover для критических действий: выдача с двойной подписью (Эпик 6),
      отмена заказа (Эпик 4), открытие спора (Эпик 7), списание скоропорта (Эпик 8).
      4 kind: info / success / warning / danger.
    </div>

    <div class="row q-gutter-md">
      <q-btn unelevated color="primary"  label="info"    @click="openKind('info')" />
      <q-btn unelevated color="positive" label="success" @click="openKind('success')" />
      <q-btn unelevated color="warning"  label="warning" @click="openKind('warning')" />
      <q-btn unelevated color="negative" label="danger"  @click="openKind('danger')" />
    </div>

    <TakeoverDialog
      v-model="open"
      :title="content.title"
      :lead-text="content.lead"
      :kind="content.kind"
      :confirm-label="content.confirmLabel"
      @confirm="onConfirm"
    >
      <div class="text-body2 q-mb-md">{{ content.body }}</div>

      <q-banner v-if="content.kind === 'danger'" class="bg-red-1 text-red-9" rounded>
        Операция необратима. Двойная подпись потребует подтверждения второй стороной.
      </q-banner>

      <q-input
        v-if="content.input"
        v-model="reason"
        outlined
        type="textarea"
        autogrow
        label="Комментарий"
        class="q-mt-md"
      />
    </TakeoverDialog>

    <q-banner v-if="lastEvent" class="mp-event-banner q-mt-lg" rounded>
      Последнее событие: <strong>{{ lastEvent }}</strong>
    </q-banner>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { TakeoverDialog, type TakeoverKind } from 'src/widgets/Marketplace/TakeoverDialog'

const open = ref(false)
const reason = ref('')
const lastEvent = ref('')

const PRESETS: Record<TakeoverKind, {
  title: string; lead: string; body: string; confirmLabel: string; kind: TakeoverKind; input?: boolean
}> = {
  info: {
    title: 'Подробности заказа MP-1234',
    lead: 'Подтвердите получение информации о заказе.',
    body: 'Покажите эту страницу как «открытие подробностей» — ничего необратимого здесь не происходит, кнопка confirm просто закрывает диалог.',
    confirmLabel: 'Понятно',
    kind: 'info',
  },
  success: {
    title: 'Выдача заказа подтверждена',
    lead: 'Двойная подпись зафиксирована, имущество передано пайщику.',
    body: 'Заказ переведён в статус «Выдан». Кошелёк поставщика пополнен суммой 3 500 ₽.',
    confirmLabel: 'Закрыть',
    kind: 'success',
  },
  warning: {
    title: 'Списание скоропорта по решению совета',
    lead: 'Просрочен срок годности — требуется акт списания.',
    body: 'Списание выполняется на основании п. 6 Положения о ЦПП и решения совета №18 от 14.05.2026.',
    confirmLabel: 'Перейти к акту',
    kind: 'warning',
    input: true,
  },
  danger: {
    title: 'Отмена заказа MP-1234',
    lead: 'Это действие нельзя отменить.',
    body: 'Кошелёк заказчика будет разблокирован, поставщик получит уведомление. Если заказ уже в доставке — операция запустит цепочку гарантийного возврата.',
    confirmLabel: 'Подтвердить отмену',
    kind: 'danger',
    input: true,
  },
}

const content = ref(PRESETS.info)

function openKind(k: TakeoverKind) {
  content.value = PRESETS[k]
  reason.value = ''
  open.value = true
}

function onConfirm() {
  lastEvent.value = `confirm: ${content.value.kind} — ${reason.value || '(без комментария)'}`
  open.value = false
}
</script>

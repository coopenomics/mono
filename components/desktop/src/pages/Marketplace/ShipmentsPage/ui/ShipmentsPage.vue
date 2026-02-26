<template lang="pug">
div.page-shell
  q-card.hero-card(flat)
    .hero-title Перевозки
    .hero-subtitle Управление транспортировкой имущества между кооперативными участками

  //- Создание перевозки
  q-card.q-mt-md(flat)
    q-card-section
      .row.items-center
        .text-h6.col Активные перевозки
        q-btn(color="primary" icon="add" label="Создать перевозку" no-caps @click="showCreate = true")

    q-separator

    q-card-section
      q-table(
        :rows="shipments"
        :columns="columns"
        row-key="id"
        flat
        :loading="loading"
      )
        template(#body-cell-status="props")
          q-td(:props="props")
            q-chip(:color="shipmentStatusColor(props.row.status)" text-color="white" dense)
              q-icon(:name="shipmentStatusIcon(props.row.status)" size="xs").q-mr-xs
              | {{ shipmentStatusLabel(props.row.status) }}

        template(#body-cell-requests="props")
          q-td(:props="props")
            q-badge(color="blue") {{ props.row.request_count || 0 }} заявок

        template(#body-cell-route="props")
          q-td(:props="props")
            .row.items-center.q-gutter-xs
              q-chip(dense color="grey-3" text-color="grey-8") {{ props.row.source_braname }}
              q-icon(name="fa-solid fa-arrow-right" size="xs" color="grey")
              q-chip(dense color="grey-3" text-color="grey-8") {{ props.row.destination_braname }}

        template(#body-cell-actions="props")
          q-td(:props="props")
            q-btn(
              v-if="props.row.status === 'loading'"
              flat dense icon="fa-solid fa-signature" color="primary"
              @click="onSignByDriver(props.row)"
            )
              q-tooltip Подпись водителя
            q-btn(
              v-if="props.row.status === 'transit'"
              flat dense icon="fa-solid fa-flag-checkered" color="green"
              @click="onArrived(props.row)"
            )
              q-tooltip Прибыл
            q-btn(
              v-if="props.row.status === 'arrived'"
              flat dense icon="fa-solid fa-box-open" color="teal"
              @click="onReceiveShipment(props.row)"
            )
              q-tooltip Принять на склад

      .text-center.text-grey-5.q-pa-lg(v-if="shipments.length === 0 && !loading")
        q-icon(name="fa-solid fa-truck" size="48px")
        .q-mt-sm Нет активных перевозок

  //- Диалог создания перевозки
  q-dialog(v-model="showCreate")
    q-card(style="min-width: 500px")
      q-card-section
        .text-h6 Новая перевозка
      q-card-section
        q-input(v-model="newShipment.driver" label="Водитель (username)" dense outlined)
        q-input.q-mt-sm(v-model="newShipment.source" label="КУ отправления" dense outlined)
        q-input.q-mt-sm(v-model="newShipment.destination" label="КУ назначения" dense outlined)
        .text-caption.text-grey.q-mt-md Заявки для перевозки будут выбраны из склада КУ отправления
      q-card-actions(align="right")
        q-btn(flat label="Отмена" @click="showCreate = false")
        q-btn(flat label="Создать" color="primary" @click="createShipment" :loading="creating")

  //- Timeline перевозки
  q-dialog(v-model="showTimeline" maximized)
    q-card
      q-card-section
        .row.items-center
          .text-h6.col Перевозка {{ selectedShipment?.id }}
          q-btn(flat icon="close" @click="showTimeline = false")
      q-separator
      q-card-section
        q-timeline(color="primary")
          q-timeline-entry(title="Создание" subtitle="Загрузка" icon="fa-solid fa-box" color="blue")
            div КУ отправления: {{ selectedShipment?.source_braname }}
            div Создано: {{ formatDate(selectedShipment?.created_at) }}

          q-timeline-entry(
            title="В пути"
            subtitle="Транспортировка"
            icon="fa-solid fa-truck"
            :color="selectedShipment?.status !== 'loading' ? 'green' : 'grey'"
          )
            div(v-if="selectedShipment?.loaded_at") Загружено: {{ formatDate(selectedShipment?.loaded_at) }}
            div(v-else) Ожидает подписи водителя

          q-timeline-entry(
            title="Прибытие"
            subtitle="Доставка"
            icon="fa-solid fa-flag-checkered"
            :color="['arrived','completed'].includes(selectedShipment?.status) ? 'green' : 'grey'"
          )
            div(v-if="selectedShipment?.delivered_at") Доставлено: {{ formatDate(selectedShipment?.delivered_at) }}
            div(v-else) В пути

          q-timeline-entry(
            title="Приём"
            subtitle="Приёмка на складе"
            icon="fa-solid fa-warehouse"
            :color="selectedShipment?.status === 'completed' ? 'green' : 'grey'"
          )
            div КУ назначения: {{ selectedShipment?.destination_braname }}
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

const loading = ref(false)
const creating = ref(false)
const showCreate = ref(false)
const showTimeline = ref(false)
const shipments = ref<any[]>([])
const selectedShipment = ref<any>(null)

const newShipment = reactive({
  driver: '',
  source: '',
  destination: '',
})

const columns = [
  { name: 'id', label: 'ID', field: 'id', align: 'left' as const, sortable: true },
  { name: 'route', label: 'Маршрут', field: 'id', align: 'left' as const },
  { name: 'requests', label: 'Заявки', field: 'id', align: 'center' as const },
  { name: 'status', label: 'Статус', field: 'status', align: 'center' as const },
  { name: 'actions', label: '', field: 'id', align: 'right' as const },
]

function shipmentStatusColor(status: string) {
  const map: Record<string, string> = { loading: 'blue', transit: 'orange', arrived: 'green', completed: 'grey' }
  return map[status] || 'grey'
}

function shipmentStatusIcon(status: string) {
  const map: Record<string, string> = {
    loading: 'fa-solid fa-boxes-packing',
    transit: 'fa-solid fa-truck-fast',
    arrived: 'fa-solid fa-location-dot',
    completed: 'fa-solid fa-check',
  }
  return map[status] || 'fa-solid fa-question'
}

function shipmentStatusLabel(status: string) {
  const map: Record<string, string> = { loading: 'Загрузка', transit: 'В пути', arrived: 'Прибыл', completed: 'Завершена' }
  return map[status] || status
}

function formatDate(d: string) {
  return d ? new Date(d).toLocaleString('ru-RU') : '-'
}

function onSignByDriver(s: any) { selectedShipment.value = s; showTimeline.value = true }
function onArrived(s: any) { selectedShipment.value = s; showTimeline.value = true }
function onReceiveShipment(s: any) { selectedShipment.value = s; showTimeline.value = true }
function createShipment() { creating.value = false; showCreate.value = false }
</script>

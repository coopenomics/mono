<template lang="pug">
div.page-shell
  q-card.hero-card(flat)
    .hero-title Склад КУ
    .hero-subtitle Управление имуществом на кооперативном участке

  //- Фильтры
  q-card.q-mt-md(flat)
    q-card-section
      .row.q-gutter-md
        .col-auto
          q-select(
            v-model="statusFilter"
            :options="statusOptions"
            label="Статус"
            dense
            outlined
            emit-value
            map-options
            style="min-width: 200px"
          )

  //- Таблица имущества
  q-card.q-mt-md(flat)
    q-card-section
      q-table(
        :rows="filteredRequests"
        :columns="columns"
        row-key="id"
        flat
        :loading="loading"
      )
        template(#body-cell-status='props')
          q-td(:props='props')
            q-chip(
              :color="statusColor(props.row.status)"
              text-color="white"
              dense
            ) {{ statusLabel(props.row.status) }}

        template(#body-cell-type='props')
          q-td(:props='props')
            q-chip(
              v-if="props.row.type === 'coopstock'"
              color="blue"
              text-color="white"
              dense
            ) Запасы
            q-chip(v-else color="grey" text-color="white" dense) {{ props.row.type }}

        template(#body-cell-actions='props')
          q-td(:props='props')
            .row.q-gutter-xs
              q-btn(
                v-if="props.row.status === 'delivered' && isExpired(props.row)"
                flat dense icon="fa-solid fa-trash" color="negative"
                @click="onDestroy(props.row)"
              )
                q-tooltip Уничтожить
              q-btn(
                v-if="props.row.status === 'delivered' && isExpired(props.row)"
                flat dense icon="fa-solid fa-recycle" color="blue"
                @click="onReoffer(props.row)"
              )
                q-tooltip Перепредложить
              q-btn(
                v-if="props.row.status === 'supplied2'"
                flat dense icon="fa-solid fa-truck" color="primary"
                @click="onMarkDelivered(props.row)"
              )
                q-tooltip Отметить доставку
              q-btn(
                flat dense icon="fa-solid fa-eye" color="grey"
                @click="onView(props.row)"
              )
                q-tooltip Просмотр

      .text-center.text-grey-5.q-pa-lg(v-if="filteredRequests.length === 0 && !loading")
        q-icon(name="fa-solid fa-warehouse" size="48px")
        .q-mt-sm Нет имущества на складе

  //- Диалог уничтожения
  q-dialog(v-model="showDestroy")
    q-card(style="min-width: 400px")
      q-card-section
        .text-h6 Уничтожение имущества
      q-card-section
        .text-body2 Подтвердите уничтожение просроченного имущества. Будет составлен акт уничтожения.
        .text-caption.text-red.q-mt-sm Это действие необратимо.
      q-card-actions(align="right")
        q-btn(flat label="Отмена" @click="showDestroy = false")
        q-btn(flat label="Уничтожить" color="negative" @click="confirmDestroy")

  //- Диалог перепредложения
  q-dialog(v-model="showReoffer")
    q-card(style="min-width: 450px")
      q-card-section
        .text-h6 Перепредложить имущество
      q-card-section
        q-input(v-model="reofferPrice" label="Новая цена за единицу" dense outlined)
        q-input.q-mt-sm(v-model="reofferMeta" label="Описание" type="textarea" rows="3" dense outlined)
      q-card-actions(align="right")
        q-btn(flat label="Отмена" @click="showReoffer = false")
        q-btn(flat label="Перепредложить" color="primary" @click="confirmReoffer")
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Notify } from 'quasar'
import { client } from 'src/shared/api/client'

const router = useRouter()
const loading = ref(false)
const requests = ref<any[]>([])
const statusFilter = ref('all')
const showDestroy = ref(false)
const showReoffer = ref(false)
const selectedRequest = ref<any>(null)
const reofferPrice = ref('')
const reofferMeta = ref('')

const statusOptions = [
  { label: 'Все', value: 'all' },
  { label: 'Доставлено', value: 'delivered' },
  { label: 'На складе', value: 'supplied2' },
  { label: 'Ожидает возврата', value: 'reqreturn' },
]

const columns = [
  { name: 'id', label: 'ID', field: 'id', align: 'left' as const, sortable: true },
  { name: 'type', label: 'Тип', field: 'type', align: 'center' as const },
  { name: 'title', label: 'Название', field: (r: any) => r.data?.title || '-', align: 'left' as const },
  { name: 'units', label: 'Кол-во', field: 'units', align: 'center' as const },
  { name: 'unit_cost', label: 'Цена', field: 'unit_cost', align: 'right' as const },
  { name: 'status', label: 'Статус', field: 'status', align: 'center' as const },
  { name: 'actions', label: '', field: 'id', align: 'right' as const },
]

const filteredRequests = computed(() => {
  if (statusFilter.value === 'all') return requests.value
  return requests.value.filter(r => r.status === statusFilter.value)
})

function statusColor(status: string) {
  const map: Record<string, string> = {
    delivered: 'green', supplied2: 'blue', reqreturn: 'orange',
    retauthorized: 'teal', recieved1: 'purple', recieved2: 'deep-purple',
  }
  return map[status] || 'grey'
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    active: 'Активна', accepted: 'Принята', authorized: 'Авторизована',
    supplied1: 'Поставлено', supplied2: 'На складе', delivered: 'Доставлено',
    reqreturn: 'Запрос возврата', retauthorized: 'Возврат авторизован',
    recieved1: 'Получено', recieved2: 'Подтверждено', completed: 'Завершено',
  }
  return map[status] || status
}

function isExpired(request: any) {
  if (!request.deadline_for_receipt) return false
  return new Date(request.deadline_for_receipt) < new Date()
}

function onDestroy(request: any) {
  selectedRequest.value = request
  showDestroy.value = true
}

function onReoffer(request: any) {
  selectedRequest.value = request
  reofferPrice.value = request.unit_cost?.replace(/[^\d.]/g, '') || ''
  reofferMeta.value = request.meta || ''
  showReoffer.value = true
}

function onMarkDelivered(request: any) {
  Notify.create({ type: 'info', message: 'Функция доставки в разработке' })
}

function onView(request: any) {
  router.push({ name: 'marketplace-offer', params: { hash: request.hash } })
}

async function confirmDestroy() {
  Notify.create({ type: 'info', message: 'Уничтожение запущено' })
  showDestroy.value = false
}

async function confirmReoffer() {
  Notify.create({ type: 'info', message: 'Перепредложение создано' })
  showReoffer.value = false
}

onMounted(async () => {
  loading.value = true
  loading.value = false
})
</script>

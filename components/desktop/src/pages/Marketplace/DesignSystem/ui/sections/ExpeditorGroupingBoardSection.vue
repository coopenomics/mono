<template>
  <div>
    <div class="text-h5 q-mb-md">ExpeditorGroupingBoard · Story 10.2.8 · UX-DR14</div>
    <div class="text-body2 text-grey-7 q-mb-lg">
      Доска группировки заявок экспедитором: горизонтальные колонки по маршрутам/ПВЗ
      с drag-n-drop карточек заявок между ними. Используется в Эпике 5 (Доставка).
    </div>

    <ExpeditorGroupingBoard :columns="columns" @move="onMove" @move-all="onMoveAll" />

    <q-banner v-if="lastEvent" class="mp-event-banner q-mt-lg" rounded>
      {{ lastEvent }}
    </q-banner>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ExpeditorGroupingBoard, type GroupingColumn } from 'src/widgets/Marketplace/ExpeditorGroupingBoard'

const columns = ref<GroupingColumn[]>([
  {
    id: 'unassigned',
    title: 'Не распределено',
    meta: '3 заявки ожидают группировки',
    items: [
      { id: 1, shortId: '1234', title: 'Картофель 10 кг',  units: 10, unitLabel: 'кг', pvz: 'ПВЗ Молодёжная' },
      { id: 2, shortId: '1235', title: 'Молоко 5 л',        units: 5,  unitLabel: 'л',  pvz: 'ПВЗ Молодёжная' },
      { id: 3, shortId: '1236', title: 'Морковь 5 кг',      units: 5,  unitLabel: 'кг', pvz: 'ПВЗ Гагарина'    },
    ],
  },
  {
    id: 'route-1',
    title: 'Маршрут 1 (Молодёжная)',
    meta: 'Выезд 16.05 09:00',
    items: [],
  },
  {
    id: 'route-2',
    title: 'Маршрут 2 (Гагарина)',
    meta: 'Выезд 16.05 11:00',
    items: [],
  },
])

const lastEvent = ref<string | null>(null)

function onMove(payload: { itemId: string | number; fromColumnId: string; toColumnId: string }) {
  const { itemId, fromColumnId, toColumnId } = payload
  const from = columns.value.find((c) => c.id === fromColumnId)
  const to = columns.value.find((c) => c.id === toColumnId)
  if (!from || !to) return
  const idx = from.items.findIndex((i) => i.id === itemId)
  if (idx < 0) return
  const [item] = from.items.splice(idx, 1)
  if (item) to.items.push(item)
  lastEvent.value = `Переместили MP-${itemId}: «${fromColumnId}» → «${toColumnId}»`
}

function onMoveAll(payload: { fromColumnId: string; toColumnId: string }) {
  const { fromColumnId, toColumnId } = payload
  const from = columns.value.find((c) => c.id === fromColumnId)
  const to = columns.value.find((c) => c.id === toColumnId)
  if (!from || !to) return
  const moved = from.items.length
  to.items.push(...from.items)
  from.items = []
  lastEvent.value = `Bulk move: перенесли все ${moved} заявок из «${fromColumnId}» в «${toColumnId}»`
}
</script>

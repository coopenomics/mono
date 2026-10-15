<template lang="pug">
div.scroll-area(style="height: calc(100% - $toolbar-min-height); overflow-y: auto;")
  q-table(
    ref="tableRef"
    flat
    :grid="isMobile"
    :rows="meets"
    :columns="columns"
    :pagination="pagination"
    virtual-scroll
    @virtual-scroll="onScroll"
    :virtual-scroll-target="'.scroll-area'"
    :virtual-scroll-item-size="48"
    :virtual-scroll-sticky-size-start="48"
    :rows-per-page-options="[0]"
    :loading='loading'
    :no-data-label="$t('meet.meetsTable.noDataLabel')"
  )
    template(#header="props")
      q-tr(:props="props")
        q-th(
          v-for="col in props.cols"
          :key="col.name"
          :props="props"
        ) {{ col.label }}

    template(#body="props")
      q-tr(:key="`m_${props.row?.hash}`" :props="props")
        q-td {{ props.row.hash.substring(0, 10) }}
        q-td {{ props.row.processing?.meet?.type }}
        q-td {{ props.row.processing?.meet?.status }}
        q-td {{ formatDate(props.row.processing?.meet?.open_at) }}
        q-td {{ formatDate(props.row.processing?.meet?.close_at) }}
        q-td
          q-btn(
            size="sm"
            color="accent"
            icon="fa-solid fa-arrow-right"
            flat
            @click="navigateToMeetDetails(props.row)"
          ) {{ $t('meet.meetsTable.details') }}
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { date } from 'quasar'
import type { IMeet } from 'src/entities/Meet'
import type { QTableColumn } from 'quasar'
import { useRouter } from 'vue-router'
import { useWindowSize } from 'src/shared/hooks'
import { useDesktopStore } from 'src/entities/Desktop/model'
import { t } from 'src/shared/i18n';

const props = defineProps<{
  meets: IMeet[],
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'load'): void
}>()

const router = useRouter()
const { isMobile } = useWindowSize()
const desktop = useDesktopStore()

// Колонки для таблицы
const columns: QTableColumn<IMeet>[] = [
  { name: 'hash', align: 'left', label: 'ID', field: (row: IMeet) => row.hash, sortable: true },
  { name: 'type', align: 'left', label: t('meet.meetsTable.typeColumn'), field: (row: IMeet) => row.processing?.meet?.type, sortable: true },
  { name: 'status', align: 'left', label: t('meet.meetsTable.statusColumn'), field: (row: IMeet) => row.processing?.meet?.status, sortable: true },
  { name: 'open_at', align: 'left', label: t('meet.meetsTable.openAtColumn'), field: (row: IMeet) => row.processing?.meet?.open_at, sortable: true },
  { name: 'close_at', align: 'left', label: t('meet.meetsTable.closeAtColumn'), field: (row: IMeet) => row.processing?.meet?.close_at, sortable: true },
  { name: 'actions', align: 'left', label: t('meet.meetsTable.actionsColumn'), field: () => '', sortable: false },
]

const tableRef = ref(null)
const pagination = ref({ rowsPerPage: 0 })

// Форматирование даты
const formatDate = (dateString: string) => {
  if (!dateString) return '';
  return date.formatDate(dateString, 'DD.MM.YYYY HH:mm')
}

// Функция обработки виртуального скролла
const onScroll = ({ to }) => {
  const lastIndex = props.meets.length - 1
  // Если достигли последнего элемента в списке, эмитим событие load
  if (props.meets.length > 0 && to === lastIndex) {
    emit('load')
  }
}

// Определение текущего воркспейса и подходящего маршрута для деталей собрания
const navigateToMeetDetails = (meet: IMeet) => {
  const currentWorkspace = desktop.activeWorkspaceName
  const isSoviet = currentWorkspace === 'soviet'

  const routeName = isSoviet ? 'meet-details' : 'user-meet-details'

  router.push({
    name: routeName,
    params: {
      hash: meet.hash,
      coopname: router.currentRoute.value.params.coopname
    }
  })
}
</script>

<template lang="pug">
.text-caption.text-grey-7.q-mb-xs
  | {{ $t('chatcoop.calendarEventsTable.timezoneHint') }}
q-table(
  flat,

  v-model:pagination="pagination",
  :rows="calendarStore.events",
  :columns="columns",
  row-key="id",
  :loading="calendarStore.isLoading",
  :rows-per-page-options="[25]",
  :no-data-label="$t('chatcoop.calendarEventsTable.emptyLabel')"
)
  template(#body-cell-title="props")
    q-td.title-cell(:props="props")
      .title-cell__text {{ props.row.title }}
  template(#body-cell-room="props")
    q-td(:props="props") {{ roomLabel(props.row.matrixRoomId) }}
  template(#body-cell-starts="props")
    q-td(:props="props") {{ formatCalendarDateTime(props.row.startsAt) }}
  template(#body-cell-ends="props")
    q-td(:props="props") {{ props.row.endsAt ? formatCalendarDateTime(props.row.endsAt) : '—' }}
  template(#body-cell-actions="props")
    q-td(:props="props")
      q-btn(
        flat,
        dense,
        round,
        icon="fa-solid fa-door-open",
        @click="goChat(props.row.matrixRoomId)"
      )
        q-tooltip {{ $t('chatcoop.calendarEventsTable.joinRoomLabel') }}
      q-btn(
        v-if="canManageCalendarEvents",
        flat,
        dense,
        round,
        icon="fa-solid fa-pen",
        @click="onEdit(props.row)"
      )
      q-btn(
        v-if="canManageCalendarEvents",
        flat,
        dense,
        round,
        color="negative",
        icon="fa-solid fa-trash",
        @click="onDelete(props.row)"
      )
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useChatCoopCalendarStore } from '../../../entities/ChatCoopCalendar/model/store'
import type { IChatCoopCalendarEvent } from '../../../entities/ChatCoopCalendar/model/types'
import { formatCalendarDateTime } from '../../../shared/lib/calendarDateFormat'
import { useCalendarBoardPermissions } from '../../../shared/lib/useCalendarBoardPermissions'
import { t } from '../../../i18n';

defineProps<{
  onEdit: (row: IChatCoopCalendarEvent) => void
  onDelete: (row: IChatCoopCalendarEvent) => void
}>()

const calendarStore = useChatCoopCalendarStore()
const router = useRouter()
const { canManageCalendarEvents } = useCalendarBoardPermissions()

const pagination = ref({
  page: 1,
  rowsPerPage: 25,
})

const columns = [
  {
    name: 'title',
    label: t('chatcoop.calendarEventsTable.column.event'),
    field: 'title',
    align: 'left' as const,
    style: 'max-width: 400px; width: 400px;',
  },
  { name: 'room', label: t('chatcoop.calendarEventsTable.column.room'), field: 'matrixRoomId', align: 'left' as const },
  { name: 'starts', label: t('chatcoop.calendarEventsTable.column.start'), field: 'startsAt', align: 'left' as const },
  { name: 'ends', label: t('chatcoop.calendarEventsTable.column.end'), field: 'endsAt', align: 'left' as const },
  { name: 'actions', label: '', field: 'id', align: 'right' as const },
]

function roomLabel(matrixRoomId: string): string {
  return calendarStore.rooms.find((r) => r.matrixRoomId === matrixRoomId)?.displayLabel ?? matrixRoomId
}

function goChat(matrixRoomId: string): void {
  void router.push({ name: 'chatcoop-chat', query: { matrix_room: matrixRoomId } })
}
</script>

<style scoped lang="scss">
.title-cell {
  max-width: 400px;
  width: 400px;
  white-space: normal;
  word-break: break-word;
}

.title-cell__text {
  max-width: 100%;
  white-space: normal;
  word-break: break-word;
}
</style>

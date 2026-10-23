<template lang="pug">
q-page(padding)
  CalendarErrorBanner
  CalendarPageToolbar(:on-refresh="refresh", :on-request-create="onRequestCreate")
  SaveCalendarEventDialog(v-if="canManageCalendarEvents", ref="saveDialogRef")
  DeleteCalendarEventDialog(
    v-if="canManageCalendarEvents",
    v-model="deleteDialogOpen",
    :target="deleteTarget"
  )
  CalendarEventsTable(:on-edit="onEdit", :on-delete="onDelete")
</template>

<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue'
import { useLiveReload } from 'src/shared/lib/realtime'
import { CHAT_CALENDAR_LIVE_TABLES } from 'app/extensions/chatcoop/shared/lib/live'
import { DeleteCalendarEventDialog } from '../../../features/Calendar/DeleteEvent'
import { SaveCalendarEventDialog } from '../../../features/Calendar/SaveEvent'
import { useChatCoopCalendarStore } from '../../../entities/ChatCoopCalendar/model/store'
import type { IChatCoopCalendarEvent } from '../../../entities/ChatCoopCalendar/model/types'
import { CalendarErrorBanner } from '../../../widgets/CalendarErrorBanner'
import { CalendarEventsTable } from '../../../widgets/CalendarEventsTable'
import { CalendarPageToolbar } from '../../../widgets/CalendarPageToolbar'
import { useCalendarBoardPermissions } from '../../../shared/lib/useCalendarBoardPermissions'

const calendarStore = useChatCoopCalendarStore()
const { canManageCalendarEvents } = useCalendarBoardPermissions()
const saveDialogRef = ref<InstanceType<typeof SaveCalendarEventDialog> | null>(null)
const deleteDialogOpen = ref(false)
const deleteTarget = ref<IChatCoopCalendarEvent | null>(null)

watch(deleteDialogOpen, (open) => {
  if (!open) deleteTarget.value = null
})

function refresh(): void {
  void calendarStore.loadAll()
}

function onRequestCreate(): void {
  saveDialogRef.value?.openCreate()
}

function onEdit(row: IChatCoopCalendarEvent): void {
  saveDialogRef.value?.openEdit(row)
}

function onDelete(row: IChatCoopCalendarEvent): void {
  deleteTarget.value = row
  deleteDialogOpen.value = true
}

onMounted(() => {
  void calendarStore.loadAll()
})

// Календарь живёт по ленте: событие, созданное или перенесённое советом,
// появляется у всех пайщиков сразу.
useLiveReload(CHAT_CALENDAR_LIVE_TABLES, () => calendarStore.loadAll())
</script>

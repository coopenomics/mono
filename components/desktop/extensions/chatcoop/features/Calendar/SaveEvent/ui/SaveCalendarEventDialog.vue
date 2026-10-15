<template lang="pug">
q-dialog(v-model="dialogOpen", persistent)
  q-card(style="min-width: 360px; max-width: 520px")
    q-card-section.row.items-center
      .text-h6 {{ editingId ? $t('chatcoop.saveCalendarEventDialog.editTitle') : $t('chatcoop.saveCalendarEventDialog.createTitle') }}
      q-space
      q-btn(icon="close", flat, round, dense, v-close-popup)
    q-separator
    q-card-section
      q-select(
        v-model="form.matrixRoomId",
        :options="roomOptions",
        option-value="value",
        option-label="label",
        emit-value,
        map-options,
        :label="$t('chatcoop.saveCalendarEventDialog.roomLabel')",
        outlined,
        dense
      )
      q-input.q-mt-sm(v-model="form.title", :label="$t('chatcoop.saveCalendarEventDialog.titleLabel')", outlined, dense)
      q-input.q-mt-sm(v-model="form.description", :label="$t('chatcoop.saveCalendarEventDialog.descriptionLabel')", type="textarea", outlined, dense, autogrow)
      q-input.q-mt-sm(
        v-model="form.startsAtLocal",
        :label="$t('chatcoop.saveCalendarEventDialog.startLabel')",
        type="datetime-local",
        outlined,
        dense
      )
      q-input.q-mt-sm(v-model="form.endsAtLocal", :label="$t('chatcoop.saveCalendarEventDialog.endLabel')", type="datetime-local", outlined, dense)
      .text-caption.text-grey-7.q-mt-xs
        | {{ $t('chatcoop.saveCalendarEventDialog.timezoneHint') }}
    q-card-actions(align="right")
      q-btn(flat, :label="$t('common.action.cancel')", v-close-popup)
      q-btn(color="primary", :label="editingId ? $t('common.action.save') : $t('common.action.create')", :loading="saving", @click="submitForm")
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { api } from '../../../../entities/ChatCoopCalendar/api'
import { useChatCoopCalendarStore } from '../../../../entities/ChatCoopCalendar/model/store'
import type { IChatCoopCalendarEvent } from '../../../../entities/ChatCoopCalendar/model/types'
import { parseDatetimeLocalValue, toDatetimeLocalValue } from '../../../../shared/lib/calendarDateFormat'

const calendarStore = useChatCoopCalendarStore()

const dialogOpen = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)

const form = ref({
  matrixRoomId: '' as string,
  title: '',
  description: '',
  startsAtLocal: '',
  endsAtLocal: '',
})

const roomOptions = computed(() =>
  calendarStore.rooms.map((r) => ({ label: r.displayLabel, value: r.matrixRoomId })),
)

function resetForm(): void {
  editingId.value = null
  form.value = {
    matrixRoomId: '',
    title: '',
    description: '',
    startsAtLocal: '',
    endsAtLocal: '',
  }
}

function openCreate(): void {
  resetForm()
  dialogOpen.value = true
}

function openEdit(row: IChatCoopCalendarEvent): void {
  editingId.value = row.id
  form.value = {
    matrixRoomId: row.matrixRoomId,
    title: row.title,
    description: row.description ?? '',
    startsAtLocal: toDatetimeLocalValue(row.startsAt),
    endsAtLocal: row.endsAt ? toDatetimeLocalValue(row.endsAt) : '',
  }
  dialogOpen.value = true
}

async function submitForm(): Promise<void> {
  const starts = parseDatetimeLocalValue(form.value.startsAtLocal)
  if (!starts || !form.value.matrixRoomId || !form.value.title.trim()) return

  const ends = parseDatetimeLocalValue(form.value.endsAtLocal)
  saving.value = true
  try {
    if (editingId.value) {
      await api.updateEvent({
        id: editingId.value,
        matrixRoomId: form.value.matrixRoomId,
        title: form.value.title.trim(),
        description: form.value.description.trim() || null,
        startsAt: starts,
        endsAt: ends,
      })
    } else {
      await api.createEvent({
        matrixRoomId: form.value.matrixRoomId,
        title: form.value.title.trim(),
        description: form.value.description.trim() || null,
        startsAt: starts,
        endsAt: ends,
      })
    }
    dialogOpen.value = false
    await calendarStore.loadAll()
  } catch (e: unknown) {
    console.error(e)
  } finally {
    saving.value = false
  }
}

defineExpose({ openCreate, openEdit })
</script>

<template lang="pug">
.documents-calendar
  ReportsCalendar(ref='calendarRef' @select='onCalendarSelect')

  ReportEditorDialog(
    v-if='showEditor'
    v-model='showEditor'
    :report-type='editorReportType'
    :year='editorYear'
    :period='editorPeriod'
    @generated='onGenerated'
    @marked='onMarked'
  )
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { IReportType } from 'src/entities/Report'
import ReportsCalendar from 'extensions/reports/widgets/reports-calendar/ReportsCalendar.vue'
import ReportEditorDialog from './ReportEditorDialog.vue'

const showEditor = ref(false)
const editorReportType = ref<IReportType | null>(null)
const editorYear = ref(new Date().getFullYear() - 1)
const editorPeriod = ref<number | null>(null)

// Прямой ref на виджет календаря — нужен для вызова reload() после закрытия
// диалога. reportStore.loadCalendar() возвращает результат, но не пушит его
// в widget-ный ref автоматически: чтобы статус ячейки обновился сразу,
// дёргаем widget.reload() явно.
const calendarRef = ref<InstanceType<typeof ReportsCalendar> | null>(null)

function onCalendarSelect(payload: { reportType: IReportType; year: number; period: number | null }) {
  editorReportType.value = payload.reportType
  editorYear.value = payload.year
  editorPeriod.value = payload.period
  showEditor.value = true
}

async function onGenerated() {
  // Статус ячейки мог смениться (empty/draft → submitted). Перезагружаем виджет.
  await calendarRef.value?.reload()
}

async function onMarked() {
  // Mark-отметка изменила статус ячейки — обновляем виджет и закрываем диалог.
  await calendarRef.value?.reload()
  showEditor.value = false
}
</script>

<template lang="pug">
q-dialog(
  :model-value='modelValue'
  @update:model-value='$emit("update:modelValue", $event)'
  persistent
  maximized
  transition-show='slide-up'
  transition-hide='slide-down'
)
  q-card.column.no-wrap
    q-bar.bg-primary.text-white
      .text-subtitle1.ellipsis
        | {{ reportTitle }} за {{ year }}{{ period ? ` · период ${period}` : '' }}
      q-space
      q-chip(
        :color='saveStatusColor'
        text-color='white'
        dense
      ) {{ saveStatusLabel }}
      //- Mobile-only: открыть панель действий (на десктопе она всегда видна справа).
      q-btn.q-ml-xs(
        v-if='$q.screen.lt.md'
        flat dense
        icon='fa-solid fa-sliders'
        @click='showActionsPanel = true'
      )
        q-tooltip Действия
      q-btn(flat dense icon='fa-solid fa-xmark' @click='close')
        q-tooltip Закрыть

    //- Баннер ошибок генерации
    q-card-section.q-pa-sm(v-if='generationErrors.length')
      q-banner.bg-negative.text-white(dense)
        .text-caption(v-for='err in generationErrors' :key='err') {{ err }}

    //- Тело
    .row.no-wrap.col.overflow-hidden
      //- Центр — редактируемая форма
      .col.editor-container
        q-inner-loading(:showing='isLoading || readinessLoading')
          q-spinner(size='40px' color='primary')

        //- Заглушка «заполните реквизиты» — показывается раньше формы, если бэк
        //- вернул checkReadiness(ready=false). Пока пусто — скачивать XML
        //- нельзя, форма отчёта вообще не рендерится, чтобы не вводить в
        //- заблуждение (пустые значения в подписанте/классификаторах).
        .stub-requisites(v-if='!readinessLoading && notReady')
          q-icon(name='fa-solid fa-circle-info' size='56px' color='orange')
          .text-h6.q-mt-md.q-mb-sm Сначала заполните реквизиты
          .text-body2.t-muted.q-mb-md
            | Для отчёта «{{ reportTitle }}» не хватает обязательных полей. Заполните их в разделе «Реквизиты», после чего вернитесь сюда.
          .missing-chips.q-mb-lg
            q-chip(
              v-for='m in readiness?.missingFields'
              :key='m.key'
              square
              dense
              color='orange-1'
              text-color='orange-10'
              icon='fa-solid fa-triangle-exclamation'
            ) {{ m.label }}
          q-btn(
            color='primary'
            icon='fa-solid fa-pen-to-square'
            label='Перейти к реквизитам'
            @click='goToRequisites'
            no-caps
          )

        BuhotchEditor(
          v-else-if='reportType === "BUHOTCH" && edits'
          v-model:edits='buhotchEdits'
          :field-errors='fieldErrors'
          @dirty='onDirty'
        )

        ZeroReportEditor(
          v-else-if='reportType && reportType !== "BUHOTCH" && edits'
          :report-type='reportType'
          v-model:edits='zeroEdits'
          :field-errors='fieldErrors'
          @dirty='onDirty'
        )

        .stub-other(v-else-if='!isLoading && !reportType')
          q-icon(name='fa-solid fa-triangle-exclamation' size='48px' color='warning')
          .text-subtitle1.q-mt-md Тип отчёта не задан

      //- Backdrop за панелью действий (только на mobile, закрывает панель по тапу).
      .action-backdrop(
        v-if='$q.screen.lt.md && showActionsPanel'
        @click='showActionsPanel = false'
      )

      //- Правая панель действий. На ≥md — inline-колонка справа (всегда видна).
      //- На <md — slide-in overlay справа, открывается кнопкой-слайдером в шапке.
      .action-panel.column.q-pa-md.no-wrap(
        :class='{ "action-panel--mobile": $q.screen.lt.md, "action-panel--open": showActionsPanel }'
      )
        q-btn.mobile-close.q-mb-sm(
          v-if='$q.screen.lt.md'
          flat dense
          icon='fa-solid fa-chevron-right'
          label='Скрыть'
          align='between'
          @click='showActionsPanel = false'
          no-caps
        )

        //- Валидация + кнопки генерации — только когда форма загружена
        //- (реквизиты заполнены, edits подтянулись). Для notReady показываем
        //- только блок отметок «не надо сдавать / сдан вне платформы» ниже.
        template(v-if='!notReady')
          .validation-badge.q-mb-sm(:class='{ ok: isValid, bad: !isValid }')
            q-icon(:name='isValid ? "fa-solid fa-check" : "fa-solid fa-triangle-exclamation"')
            span(v-if='isValid') Форма валидна
            span(v-else) Ошибок: {{ errorsCount }}

          .text-subtitle2.q-mb-sm Действия

          q-btn.q-mb-sm(
            color='primary'
            icon='fa-solid fa-paper-plane'
            label='Скачать для отправки'
            :disable='!canGenerate'
            :loading='isGenerating'
            @click='downloadXml'
            no-caps
            stack
          )
            q-tooltip Сохраняет черновик, генерирует XML, валидирует XSD и скачивает файл
          q-btn.q-mb-sm(
            color='grey-7'
            icon='fa-solid fa-file-pdf'
            label='Скачать для просмотра'
            :disable='!canGenerate || !hasPdfPaperView'
            :loading='pdfLoading'
            @click='downloadPdf'
            no-caps
            stack
          )
            q-tooltip(v-if='!hasPdfPaperView') PDF-экспорт для {{ reportTitle }} пока не поддерживается
            q-tooltip(v-else) Заполненный отчёт в PDF (из бумажного вида)

          q-separator.q-my-md

          q-btn.q-mb-sm(
            outline
            color='grey-8'
            icon='fa-solid fa-rotate'
            label='Перегенерировать'
            :disable='isLoading'
            @click='regenerate'
            no-caps
            stack
          )
            q-tooltip Подтянуть актуальные данные из реестра; ваши правки сохраняются

          q-btn(
            v-if='hasDraft'
            flat
            color='negative'
            icon='fa-solid fa-trash'
            label='Удалить черновик'
            @click='clearDraft'
            no-caps
            stack
          )
            q-tooltip Вернуть форму к дефолтам

          q-separator.q-my-md

        //- Отметки на ячейке календаря (ReportSubmissionMark, coop-wide).
        //- Состояния:
        //-   SUBMITTED (реальный XML) → mark-кнопок нет, баннер «уже сдан»
        //-   NOT_REQUIRED             → «Снять отметку»
        //-   SUBMITTED_EXTERNALLY     → «Снять отметку»
        //-   null                     → две кнопки: «Не надо сдавать» + «Отметить сданным»

        .mark-hint.q-mb-sm(v-if='isRealSubmitted')
          q-icon(name='fa-solid fa-circle-check' color='positive' size='14px')
          |  Отчёт за этот период уже сдан (XML в архиве)

        template(v-else-if='currentMark === "NOT_REQUIRED"')
          .mark-hint.q-mb-sm
            q-icon(name='fa-solid fa-circle-xmark' color='grey-7' size='14px')
            |  Период отмечен как «не надо сдавать»
          q-btn(
            color='grey-7'
            icon='fa-solid fa-rotate-left'
            label='Снять отметку'
            :loading='markLoading'
            @click='clearMark'
            no-caps
            stack
          )
            q-tooltip Вернуть обычный статус периода

        template(v-else-if='currentMark === "SUBMITTED_EXTERNALLY"')
          .mark-hint.q-mb-sm
            q-icon(name='fa-solid fa-circle-check' color='positive' size='14px')
            |  Период отмечен как «сдан вне платформы»
          q-btn(
            color='grey-7'
            icon='fa-solid fa-rotate-left'
            label='Снять отметку'
            :loading='markLoading'
            @click='clearMark'
            no-caps
            stack
          )
            q-tooltip Вернуть обычный статус периода

        template(v-else)
          q-btn.q-mb-sm(
            outline
            color='positive'
            icon='fa-solid fa-circle-check'
            label='Отметить сданным'
            :loading='markLoading'
            @click='markSubmittedExternally'
            no-caps
            stack
          )
            q-tooltip Если отчёт уже сдан в бумаге / через стороннюю систему. В архив XML не попадает, но ячейка станет зелёной.
          q-btn(
            outline
            color='grey-8'
            icon='fa-solid fa-ban'
            label='Не надо сдавать'
            :loading='markLoading'
            @click='markNotRequired'
            no-caps
            stack
          )
            q-tooltip Отметить, что этот период сдавать не нужно — ячейка станет серой

        q-space

        q-btn(
          flat
          color='grey-8'
          icon='fa-solid fa-xmark'
          label='Закрыть'
          @click='close'
          no-caps
        )

    //- Скрытый paper-render для PDF-экспорта (рендерится по требованию).
    //- Все paper-views имеют общий контракт (xml, requisites?, year?)
    //- и root .printable-form — для экспорта берём querySelector('.printable-form').
    .hidden-pdf-source(v-show='false' ref='pdfSource')
      BuhotchForm(
        v-if='lastGeneratedXml && reportType === "BUHOTCH"'
        :xml='lastGeneratedXml'
        :requisites='requisites'
        :year='year'
      )
      Ndfl6Form(
        v-else-if='lastGeneratedXml && reportType === "NDFL6"'
        :xml='lastGeneratedXml'
        :requisites='requisites'
        :year='year'
      )
      RsvForm(
        v-else-if='lastGeneratedXml && reportType === "RSV"'
        :xml='lastGeneratedXml'
        :requisites='requisites'
        :year='year'
      )
      PsvForm(
        v-else-if='lastGeneratedXml && reportType === "PSV"'
        :xml='lastGeneratedXml'
        :requisites='requisites'
        :year='year'
      )
      Efs1Form(
        v-else-if='lastGeneratedXml && reportType === "FSS4"'
        :xml='lastGeneratedXml'
        :requisites='requisites'
        :year='year'
      )
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { Zeus } from '@coopenomics/sdk'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import {
  useReportDraft,
  useReportStore,
  type IReportReadinessView,
  type IReportRequisitesView,
  type IReportType,
} from 'src/entities/Report'
import BuhotchEditor from 'extensions/reports/widgets/report-forms/BuhotchEditor.vue'
import ZeroReportEditor from 'extensions/reports/widgets/report-forms/ZeroReportEditor.vue'
import BuhotchForm from 'extensions/reports/widgets/report-forms/BuhotchForm.vue'
import Ndfl6Form from 'extensions/reports/widgets/report-forms/Ndfl6Form.vue'
import RsvForm from 'extensions/reports/widgets/report-forms/RsvForm.vue'
import PsvForm from 'extensions/reports/widgets/report-forms/PsvForm.vue'
import Efs1Form from 'extensions/reports/widgets/report-forms/Efs1Form.vue'
import { exportFormToPdf, makePdfFileName } from 'extensions/reports/widgets/report-forms/pdf-export'

// Набор типов отчётов, для которых у нас есть paper-view для PDF-экспорта.
// 5 MVP-форм; ДУСН/УУСН/УВ_Взносы скрыты в HIDDEN_IN_MVP и сюда не попадают.
// Сравниваем через строковое представление IReportType (Zeus-enum тип
// нестыкуется с литералами напрямую).
const PDF_SUPPORTED_TYPES: ReadonlySet<string> = new Set<string>([
  'BUHOTCH', 'NDFL6', 'RSV', 'PSV', 'FSS4',
])

interface BalanceRow {
  otch: number
  prev: number
  prePrev: number
}

interface BuhotchEdits {
  header: {
    idFile: string
    programVersion: string
    docDate: string
    reportYear: number
    correctionNumber: number
    audit: boolean
    approved: boolean
  }
  organization: {
    orgName: string
    inn: string
    kpp: string
    address: string | null
    okpo: string | null
    okfs: string
    okopf: string
  }
  signer: {
    type: 'chairman' | 'representative'
    lastName: string
    firstName: string
    middleName: string | null
    repDoc: string | null
  }
  balance: {
    assetsTotal: BalanceRow
    nonMaterialAndLongFin: BalanceRow | null
    cash: BalanceRow | null
    shortTermFin: BalanceRow | null
    passivesTotal: BalanceRow
    targetFunds: BalanceRow | null
  }
  notes: {
    explanationFileName: string
  }
}

const REPORT_TITLES: Record<string, string> = {
  BUHOTCH: 'Бухотчётность (КНД 0710096)',
  NDFL6: '6-НДФЛ',
  RSV: 'РСВ',
  DUSN: 'Декларация УСН',
  FSS4: 'ЕФС-1',
  PSV: 'Персонифицированные сведения',
  UUSN: 'Уведомление УСН',
  UV_VZNOSY: 'Уведомление о взносах',
}

const props = defineProps<{
  modelValue: boolean
  reportType: IReportType | null
  year: number
  period?: number | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'generated'): void
  (e: 'marked'): void
}>()

const reportStore = useReportStore()
const $q = useQuasar()
const route = useRoute()
const router = useRouter()

// Видимость action-panel. На desktop (≥md) — всегда true; на mobile
// по-умолчанию false, открывается кнопкой-слайдером в q-bar. При ресайзе
// возврат на desktop автоматически «разоткроет» панель (она там не overlay).
const showActionsPanel = ref(!$q.screen.lt.md)
watch(
  () => $q.screen.lt.md,
  (isMobile) => {
    // Desktop → всегда видна; mobile → прячем (если только пользователь
    // не открыл вручную непосредственно перед этим).
    if (!isMobile) showActionsPanel.value = true
    else showActionsPanel.value = false
  },
)

const requisites = ref<IReportRequisitesView | null>(null)
const readiness = ref<IReportReadinessView | null>(null)
const readinessLoading = ref(false)
const lastGeneratedXml = ref<string | null>(null)
const lastGeneratedFileName = ref<string | null>(null)
const generationErrors = ref<string[]>([])
const isGenerating = ref(false)
const pdfLoading = ref(false)
const pdfSource = ref<HTMLElement | null>(null)
// Текущая отметка на ячейке. Три состояния:
//   null                   — отметки нет, показываем две кнопки «Не надо сдавать» / «Отметить сданным»
//   'NOT_REQUIRED'         — ячейка серая, показываем «Снять отметку»
//   'SUBMITTED_EXTERNALLY' — ячейка зелёная (как сдано), «Снять отметку»
// Когда status=SUBMITTED (реальный XML) — не показываем mark-кнопок вообще.
type CurrentMark = 'NOT_REQUIRED' | 'SUBMITTED_EXTERNALLY' | null
const currentMark = ref<CurrentMark>(null)
const isRealSubmitted = ref(false)
const markLoading = ref(false)

// useReportDraft требует фиксированного reportType — вводить per-open
// вместо per-dialog-lifetime. Для пересоздания пересоздаём сам composable
// через key в v-if.
// Вариант проще: открываем диалог только для BUHOTCH. Для остальных
// показываем заглушку (reportType !== BUHOTCH → composable не запускается).
const draft = useReportDraft<BuhotchEdits>(
  // fallback "BUHOTCH" — безопасен, т.к. при не-BUHOTCH верхний if-guard не даёт edits загружаться
  (props.reportType ?? 'BUHOTCH') as IReportType,
  props.year,
  props.period ?? null,
  { autoLoad: false },
)

const {
  edits,
  fieldErrors,
  isValid,
  isLoading,
  isSaving,
  lastSavedAt,
  hasDraft,
  load,
  markDirty,
  saveNow,
  validateNow,
  regenerate: regenerateDraft,
  clear,
} = draft

// Writable computed для v-model:edits. Сеттер пишет обратно в общий
// useReportDraft.edits — один источник правды на весь диалог.
const buhotchEdits = computed<BuhotchEdits | null>({
  get: () => edits.value as BuhotchEdits | null,
  set: (v) => { edits.value = v as unknown as BuhotchEdits | null },
})

interface ZeroReportEdits {
  header: {
    idFile: string
    versProgram: string
    docDate: string
    reportYear: number
    period: number | null
    correctionNumber: number
  }
  organization: {
    orgName: string
    inn: string
    kpp: string
    oktmo: string | null
    okved: string | null
    okfs: string | null
    okopf: string | null
    okpo: string | null
    ogrn: string | null
    address: string | null
  }
  signer: {
    type: 'chairman' | 'representative'
    lastName: string
    firstName: string
    middleName: string | null
    repDoc: string | null
    snils: string | null
    sfrRegNumber: string | null
    chairmanPosition: string | null
  }
}

const zeroEdits = computed<ZeroReportEdits | null>({
  get: () => edits.value as ZeroReportEdits | null,
  set: (v) => { edits.value = v as unknown as BuhotchEdits | null },
})

const reportTitle = computed(() =>
  props.reportType ? (REPORT_TITLES[props.reportType] ?? props.reportType) : '',
)

const notReady = computed(() => readiness.value !== null && readiness.value.ready === false)

const canGenerate = computed(() =>
  props.reportType !== null && edits.value !== null && !isLoading.value && !notReady.value,
)

const hasPdfPaperView = computed(() =>
  props.reportType !== null && PDF_SUPPORTED_TYPES.has(String(props.reportType)),
)

const errorsCount = computed(() => {
  let count = 0
  for (const msgs of Object.values(fieldErrors.value)) count += msgs.length
  return count
})

const saveStatusColor = computed(() => {
  if (isSaving.value) return 'orange'
  if (hasDraft.value) return 'positive'
  return 'grey'
})

const saveStatusLabel = computed(() => {
  if (isSaving.value) return 'Сохраняем…'
  if (hasDraft.value && lastSavedAt.value) {
    return `Черновик сохранён ${formatTime(lastSavedAt.value)}`
  }
  if (hasDraft.value) return 'Черновик'
  return 'Новый'
})

function formatTime(d: Date): string {
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// Загрузка при открытии + реквизиты для paper-view.
// immediate: true — DocumentsPage монтирует этот диалог через v-if, поэтому
// на момент create() props.modelValue уже true и классический watcher
// false→true никогда не сработает (компонент просто стоит пустой).
watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    generationErrors.value = []
    lastGeneratedXml.value = null
    lastGeneratedFileName.value = null
    currentMark.value = null
    isRealSubmitted.value = false
    readiness.value = null
    if (!props.reportType) return
    try {
      // Сначала — readiness-gate: если обязательные реквизиты не заполнены,
      // не грузим черновик и показываем stub с кнопкой «Перейти к реквизитам».
      // Не грузим форму, чтобы не вводить в заблуждение пустыми значениями
      // подписанта/классификаторов.
      readinessLoading.value = true
      try {
        readiness.value = (await reportStore.checkReadiness(props.reportType)) ?? null
      } finally {
        readinessLoading.value = false
      }
      if (readiness.value && readiness.value.ready === false) return
      await load()
      if (!requisites.value) {
        requisites.value = (await reportStore.loadRequisites()) ?? null
      }
      // Подтягиваем текущий статус ячейки из календаря (один запрос,
      // он и так нужен странице).
      const cal = await reportStore.loadCalendar(props.year)
      const row = cal.find((r) => r.reportType === props.reportType)
      const entry = row?.periods.find((p) => (p.periodCode ?? null) === (props.period ?? null))
      if (entry?.status === Zeus.CalendarEntryStatus.SUBMITTED) {
        isRealSubmitted.value = true
        currentMark.value = null
      } else if (entry?.status === Zeus.CalendarEntryStatus.SUBMITTED_EXTERNALLY) {
        currentMark.value = 'SUBMITTED_EXTERNALLY'
      } else if (entry?.status === Zeus.CalendarEntryStatus.NOT_REQUIRED) {
        currentMark.value = 'NOT_REQUIRED'
      }
    } catch (e) {
      FailAlert(e, 'Ошибка загрузки формы')
    }
  },
  { immediate: true },
)

function onDirty(path: string): void {
  markDirty(path)
}

async function ensureGenerated(): Promise<{ xml: string; fileName: string } | null> {
  if (!edits.value || !props.reportType) return null
  generationErrors.value = []
  // SaveNow чтобы сервер знал финальное состояние — иначе regenerate
  // после ухода из диалога мог показать старое. Validate, чтобы зафиксировать
  // текущие ошибки полей перед попыткой генерации.
  await Promise.all([saveNow(), validateNow()])
  if (!isValid.value) {
    generationErrors.value = [
      `Есть ${errorsCount.value} ошибок в полях формы — исправьте перед скачиванием.`,
    ]
    return null
  }
  const out = await reportStore.generateFromEdits(
    props.reportType,
    props.year,
    props.period ?? null,
    JSON.stringify(edits.value),
  )
  if (!out) {
    generationErrors.value = ['Пустой ответ от сервера']
    return null
  }
  generationErrors.value = out.errors ?? []
  if (!out.xml) return null
  lastGeneratedXml.value = out.xml
  lastGeneratedFileName.value = out.fileName
  if (out.isValid) SuccessAlert('XML сгенерирован и прошёл XSD-валидацию')
  emit('generated')
  return { xml: out.xml, fileName: out.fileName }
}

async function downloadXml(): Promise<void> {
  if (isGenerating.value) return
  isGenerating.value = true
  try {
    const r = await ensureGenerated()
    if (!r) return
    reportStore.triggerDownload(r.xml, r.fileName)
  } catch (e) {
    FailAlert(e, 'Ошибка генерации XML')
  } finally {
    isGenerating.value = false
  }
}

async function downloadPdf(): Promise<void> {
  if (pdfLoading.value) return
  pdfLoading.value = true
  try {
    // Генерируем XML чтобы paper-view в BuhotchForm имел из чего рендерить.
    const r = await ensureGenerated()
    if (!r || !props.reportType) return
    // Ждём перерендера скрытого BuhotchForm (watch реактивно подхватил XML).
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const root = pdfSource.value?.querySelector<HTMLElement>('.printable-form')
    if (!root) throw new Error('PDF: бумажный вид не отрендерился')
    const name = makePdfFileName(props.reportType, props.year, props.period ?? null)
    await exportFormToPdf(root, name)
  } catch (e) {
    FailAlert(e, 'Ошибка генерации PDF')
  } finally {
    pdfLoading.value = false
  }
}

async function regenerate(): Promise<void> {
  try {
    await regenerateDraft()
    SuccessAlert('Свежие данные подтянуты, ваши правки сохранены')
  } catch (e) {
    FailAlert(e, 'Ошибка перегенерации')
  }
}

async function clearDraft(): Promise<void> {
  try {
    await clear()
    await load()
    SuccessAlert('Черновик удалён, форма перезаполнена дефолтами')
  } catch (e) {
    FailAlert(e, 'Ошибка удаления черновика')
  }
}

async function applyMark(nextMark: CurrentMark, confirmMsg: string): Promise<void> {
  if (!props.reportType || markLoading.value) return
  if (!window.confirm(confirmMsg)) return
  markLoading.value = true
  try {
    const sdkMark =
      nextMark === 'NOT_REQUIRED' ? Zeus.ReportSubmissionMark.NOT_REQUIRED :
      nextMark === 'SUBMITTED_EXTERNALLY' ? Zeus.ReportSubmissionMark.SUBMITTED_EXTERNALLY :
      null
    await reportStore.markPeriod({
      reportType: props.reportType,
      year: props.year,
      period: props.period ?? null,
      mark: sdkMark,
    })
    currentMark.value = nextMark
    SuccessAlert(nextMark ? 'Отметка поставлена' : 'Отметка снята')
    emit('marked')
  } catch (e) {
    FailAlert(e, 'Ошибка установки отметки')
  } finally {
    markLoading.value = false
  }
}

function markNotRequired(): void {
  void applyMark(
    'NOT_REQUIRED',
    'Отметить период как «не надо сдавать»? В календаре ячейка станет серой.',
  )
}

function markSubmittedExternally(): void {
  void applyMark(
    'SUBMITTED_EXTERNALLY',
    'Отметить период как сданный вне платформы? В календаре ячейка станет зелёной ' +
      '(с обводкой — отличие от фактически сгенерированного XML).',
  )
}

function clearMark(): void {
  void applyMark(null, 'Снять отметку? Статус периода вернётся к обычному.')
}

function close(): void {
  emit('update:modelValue', false)
}

function goToRequisites(): void {
  const coopname = String(route.params.coopname ?? '')
  const firstMissing = readiness.value?.missingFields?.[0]?.key
  void router.push({
    name: 'reports-settings',
    params: { coopname },
    ...(firstMissing ? { query: { focus: firstMissing } } : {}),
  })
  close()
}
</script>

<style scoped lang="scss">
.editor-container {
  overflow: auto;
  background: var(--p-canvas);
  position: relative;
}

.action-panel {
  width: 260px;
  flex: 0 0 260px;
  border-left: 1px solid var(--p-line);
  background: var(--p-surface-2);
}

// Mobile: панель становится slide-in overlay справа. Без action-panel--open
// полностью ушла за край экрана — editor-container занимает все 100% ширины.
.action-panel--mobile {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(85vw, 320px);
  flex: none;
  z-index: 6001; // выше q-dialog (которое ~6000); иначе поверх не ложится
  box-shadow: var(--p-shadow-modal, -4px 0 16px rgba(0, 0, 0, 0.18));
  transform: translateX(100%);
  transition: transform 0.22s ease-out;
  overflow-y: auto;
}

.action-panel--mobile.action-panel--open {
  transform: translateX(0);
}

.action-backdrop {
  position: fixed;
  inset: 0;
  background: var(--p-overlay, rgba(0, 0, 0, 0.4));
  z-index: 6000;
  animation: fade-in 0.2s ease-out;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.mobile-close {
  align-self: flex-end;
  width: 100%;
}

.stub-other {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--p-ink-2);
  text-align: center;
  padding: 40px;
}

.stub-requisites {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  max-width: 560px;
  margin: 48px auto;
  padding: 32px;
  text-align: center;
  color: var(--p-ink-1);

  .missing-chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
  }
}

.hidden-pdf-source {
  position: absolute;
  left: -9999px;
  top: 0;
  width: 210mm;
}

.validation-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--p-r-xs, 4px);
  font-size: var(--p-fs-body-sm, 13px);
  font-weight: 500;
  &.ok {
    background: var(--p-pos-soft);
    color: var(--p-pos);
  }
  &.bad {
    background: var(--p-neg-soft);
    color: var(--p-neg);
  }
}

.mark-hint {
  font-size: var(--p-fs-meta, 12px);
  color: var(--p-ink-2);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: var(--p-surface-2);
  border-radius: var(--p-r-xs, 4px);
}
</style>

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
        | {{ $t('reports.reportEditorDialog.title', { reportTitle, year, periodSuffix }) }}
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
        q-tooltip {{ $t('reports.reportEditorDialog.actionsLabel') }}
      q-btn(flat dense icon='fa-solid fa-xmark' @click='close')
        q-tooltip {{ $t('common.action.close') }}

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
          .text-h6.q-mt-md.q-mb-sm {{ $t('reports.reportEditorDialog.requisitesRequiredTitle') }}
          .text-body2.t-muted.q-mb-md
            | {{ $t('reports.reportEditorDialog.requisitesRequiredText', { reportTitle }) }}
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
            :label='$t("reports.reportEditorDialog.goToRequisitesLabel")'
            @click='goToRequisites'
            no-caps
          )

        BuhotchEditor(
          v-else-if='reportType === "BUHOTCH" && edits'
          v-model:edits='buhotchEdits'
          :field-errors='fieldErrors'
          @dirty='onDirty'
        )

        //- Обычный контейнер, а не <template>: фрагмент с несколькими корнями,
        //- часть которых условная, при закрытии диалога роняет Vue на
        //- размонтировании пустого узла («Cannot destructure property type of
        //- vnode as it is null»), и окно перестаёт закрываться.
        .editor-stack(v-else-if='reportType && reportType !== "BUHOTCH" && edits')
          ZeroReportEditor(
            :report-type='reportType'
            v-model:edits='zeroEdits'
            :field-errors='fieldErrors'
            @dirty='onDirty'
          )
          //- Разделы с суммами и справки о доходах есть только у 6-НДФЛ:
          //- это единственный отчёт, где кооператив выступает налоговым агентом.
          Ndfl6TaxSection(
            v-if='reportType === "NDFL6" && ndfl6Edits?.tax'
            v-model:edits='ndfl6Edits'
            :field-errors='fieldErrors'
            :is-annual='ndfl6Edits.header.period === 4'
            @dirty='onDirty'
          )

          //- Уведомление по НДФЛ — та же шапка плюс одна сумма к перечислению.
          UvNdflAmountSection(
            v-if='reportType === "UV_NDFL" && uvNdflEdits?.payment'
            v-model:edits='uvNdflEdits'
            :field-errors='fieldErrors'
            @dirty='onDirty'
          )

        .stub-other(v-else-if='!isLoading && !reportType')
          q-icon(name='fa-solid fa-triangle-exclamation' size='48px' color='warning')
          .text-subtitle1.q-mt-md {{ $t('reports.reportEditorDialog.reportTypeMissingTitle') }}

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
          :label='$t("reports.reportEditorDialog.hideLabel")'
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
            span(v-if='isValid') {{ $t('reports.reportEditorDialog.formValidLabel') }}
            span(v-else) {{ $t('reports.reportEditorDialog.errorsCountLabel', { count: errorsCount }) }}

          //- Явный список ошибок полей — страховка на случай, если конкретное
          //- поле формы не подсвечивается инлайн (не все секции формы ещё
          //- подключены к fieldErrors). Без этого списка счётчик показывал
          //- «Ошибок: N» без единой подсказки, где именно искать.
          q-list.error-list.q-mb-sm(
            v-if='!isValid && fieldErrorEntries.length'
            dense bordered separator
          )
            q-item(v-for='err in fieldErrorEntries' :key='err.key' dense)
              q-item-section(avatar top)
                q-icon(name='fa-solid fa-circle-exclamation' color='negative' size='14px')
              q-item-section
                q-item-label.text-caption.text-weight-medium {{ err.label }}
                q-item-label(caption) {{ err.message }}

          .text-subtitle2.q-mb-sm {{ $t('reports.reportEditorDialog.actionsLabel') }}

          q-btn.q-mb-sm(
            color='primary'
            icon='fa-solid fa-paper-plane'
            :label='$t("reports.reportEditorDialog.downloadForSubmitLabel")'
            :disable='!canGenerate'
            :loading='isGenerating'
            @click='downloadXml'
            no-caps
          )
            q-tooltip {{ $t('reports.reportEditorDialog.downloadForSubmitHint') }}
          q-btn.q-mb-sm(
            color='grey-7'
            icon='fa-solid fa-file-pdf'
            :label='$t("reports.reportEditorDialog.downloadForViewLabel")'
            :disable='!canGenerate || !hasPdfPaperView'
            :loading='pdfLoading'
            @click='downloadPdf'
            no-caps
          )
            q-tooltip(v-if='!hasPdfPaperView') {{ $t('reports.reportEditorDialog.pdfExportUnsupported', { reportTitle }) }}
            q-tooltip(v-else) {{ $t('reports.reportEditorDialog.downloadForViewHint') }}

          q-separator.q-my-md

          q-btn.q-mb-sm(
            outline
            color='grey-8'
            icon='fa-solid fa-rotate'
            :label='$t("reports.reportEditorDialog.regenerateLabel")'
            :disable='isLoading'
            @click='regenerate'
            no-caps
          )
            q-tooltip {{ $t('reports.reportEditorDialog.regenerateHint') }}

          q-btn(
            v-if='hasDraft'
            flat
            color='negative'
            icon='fa-solid fa-trash'
            :label='$t("reports.reportEditorDialog.deleteDraftLabel")'
            @click='clearDraft'
            no-caps
          )
            q-tooltip {{ $t('reports.reportEditorDialog.deleteDraftHint') }}

          q-separator.q-my-md

        //- Отметки на ячейке календаря (ReportSubmissionMark, coop-wide).
        //- Состояния:
        //-   SUBMITTED (реальный XML) → mark-кнопок нет, баннер «уже сдан»
        //-   NOT_REQUIRED             → «Снять отметку»
        //-   SUBMITTED_EXTERNALLY     → «Снять отметку»
        //-   null                     → две кнопки: «Не надо сдавать» + «Отметить сданным»

        .mark-hint.q-mb-sm(v-if='isRealSubmitted')
          q-icon(name='fa-solid fa-circle-check' color='positive' size='14px')
          |  {{ $t('reports.reportEditorDialog.alreadySubmittedText') }}

        template(v-else-if='currentMark === "NOT_REQUIRED"')
          .mark-hint.q-mb-sm
            q-icon(name='fa-solid fa-circle-xmark' color='grey-7' size='14px')
            |  {{ $t('reports.reportEditorDialog.markedNotRequiredText') }}
          q-btn(
            color='grey-7'
            icon='fa-solid fa-rotate-left'
            :label='$t("reports.reportEditorDialog.unmarkLabel")'
            :loading='markLoading'
            @click='clearMark'
            no-caps
          )
            q-tooltip {{ $t('reports.reportEditorDialog.restoreStatusHint') }}

        template(v-else-if='currentMark === "SUBMITTED_EXTERNALLY"')
          .mark-hint.q-mb-sm
            q-icon(name='fa-solid fa-circle-check' color='positive' size='14px')
            |  {{ $t('reports.reportEditorDialog.markedSubmittedOffPlatformText') }}
          q-btn(
            color='grey-7'
            icon='fa-solid fa-rotate-left'
            :label='$t("reports.reportEditorDialog.unmarkLabel")'
            :loading='markLoading'
            @click='clearMark'
            no-caps
          )
            q-tooltip {{ $t('reports.reportEditorDialog.restoreStatusHint') }}

        template(v-else)
          q-btn.q-mb-sm(
            outline
            color='positive'
            icon='fa-solid fa-circle-check'
            :label='$t("reports.reportEditorDialog.markSubmittedLabel")'
            :loading='markLoading'
            @click='markSubmittedExternally'
            no-caps
          )
            q-tooltip {{ $t('reports.reportEditorDialog.markSubmittedHint') }}
          q-btn(
            outline
            color='grey-8'
            icon='fa-solid fa-ban'
            :label='$t("reports.reportEditorDialog.markNotRequiredLabel")'
            :loading='markLoading'
            @click='markNotRequired'
            no-caps
          )
            q-tooltip {{ $t('reports.reportEditorDialog.markNotRequiredHint') }}

        q-space

        q-btn(
          flat
          color='grey-8'
          icon='fa-solid fa-xmark'
          :label='$t("common.action.close")'
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
      //- Уведомление об исчисленных суммах — одна форма КНД 1110355 на все
      //- налоги: КБК, период и сумма читаются из XML, в бланке ничего от
      //- конкретного налога нет. Поэтому НДФЛ печатается тем же бланком, что
      //- УСН и взносы, а не своей копией.
      UusnForm(
        v-else-if='lastGeneratedXml && reportType === "UV_NDFL"'
        :xml='lastGeneratedXml'
        :requisites='requisites'
        :year='year'
      )
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { uiLocale } from 'src/shared/i18n';
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
import Ndfl6TaxSection from 'extensions/reports/widgets/report-forms/Ndfl6TaxSection.vue'
import type { Ndfl6Edits } from 'extensions/reports/widgets/report-forms/ndfl6-edits'
import UvNdflAmountSection from 'extensions/reports/widgets/report-forms/UvNdflAmountSection.vue'
import { uvNdflPeriodTitle } from 'extensions/reports/widgets/report-forms/uv-ndfl-edits'
import type { UvNdflEdits } from 'extensions/reports/widgets/report-forms/uv-ndfl-edits'
import BuhotchForm from 'extensions/reports/widgets/report-forms/BuhotchForm.vue'
import Ndfl6Form from 'extensions/reports/widgets/report-forms/Ndfl6Form.vue'
import RsvForm from 'extensions/reports/widgets/report-forms/RsvForm.vue'
import PsvForm from 'extensions/reports/widgets/report-forms/PsvForm.vue'
import Efs1Form from 'extensions/reports/widgets/report-forms/Efs1Form.vue'
import UusnForm from 'extensions/reports/widgets/report-forms/UusnForm.vue'
import { exportFormToPdf, makePdfFileName } from 'extensions/reports/widgets/report-forms/pdf-export'
import { t } from '../../../i18n';

// Набор типов отчётов, для которых у нас есть paper-view для PDF-экспорта.
// 5 MVP-форм; ДУСН/УУСН/УВ_Взносы скрыты в HIDDEN_IN_MVP и сюда не попадают.
// Сравниваем через строковое представление IReportType (Zeus-enum тип
// нестыкуется с литералами напрямую).
const PDF_SUPPORTED_TYPES: ReadonlySet<string> = new Set<string>([
  'BUHOTCH', 'NDFL6', 'RSV', 'PSV', 'FSS4', 'UV_NDFL',
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
  BUHOTCH: t('reports.reportEditorDialog.reportType.buhotch'),
  NDFL6: t('reports.reportEditorDialog.reportType.ndfl6'),
  RSV: t('reports.reportEditorDialog.reportType.rsv'),
  DUSN: t('reports.reportEditorDialog.reportType.usn'),
  FSS4: t('reports.reportEditorDialog.reportType.efs1'),
  PSV: t('reports.reportEditorDialog.reportType.psv'),
  UUSN: t('reports.reportEditorDialog.reportType.usnNotice'),
  UV_VZNOSY: t('reports.reportEditorDialog.reportType.contributionsNotice'),
  UV_NDFL: t('reports.reportEditorDialog.reportType.ndflNotice'),
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
    phone: string | null
  }
  signer: {
    type: 'chairman' | 'representative'
    lastName: string
    firstName: string
    middleName: string | null
    repDoc: string | null
    snils: string | null
    inn: string | null
    sfrRegNumber: string | null
    pfrRegNumber: string | null
    chairmanPosition: string | null
  }
}

const zeroEdits = computed<ZeroReportEdits | null>({
  get: () => edits.value as ZeroReportEdits | null,
  set: (v) => { edits.value = v as unknown as BuhotchEdits | null },
})

// 6-НДФЛ — та же шапка плюс собственные разделы с суммами: редактируется
// двумя компонентами поверх одного состояния.
const ndfl6Edits = computed<Ndfl6Edits | null>({
  get: () => edits.value as unknown as Ndfl6Edits | null,
  set: (v) => { edits.value = v as unknown as BuhotchEdits | null },
})

const uvNdflEdits = computed<UvNdflEdits | null>({
  get: () => edits.value as unknown as UvNdflEdits | null,
  set: (v) => { edits.value = v as unknown as BuhotchEdits | null },
})

const reportTitle = computed(() =>
  props.reportType ? (REPORT_TITLES[props.reportType] ?? props.reportType) : '',
)

// У уведомления по НДФЛ период — сквозной номер 1..24, который человеку ничего
// не говорит; в шапке показываем месяц и половину месяца. Остальным формам
// хватает номера квартала или месяца.
const periodSuffix = computed(() => {
  if (!props.period) return ''
  if (props.reportType === 'UV_NDFL') return ` · ${uvNdflPeriodTitle(props.period)}`
  return t('reports.reportEditorDialog.periodSuffixLabel', { period: props.period })
})

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

// Человекочитаемые названия секций формы — для расшифровки JSONPath из
// серверной ошибки валидации (см. error-list ниже).
const FIELD_SECTION_LABELS: Record<string, string> = {
  header: t('reports.reportEditorDialog.tab.header'),
  organization: t('reports.reportEditorDialog.tab.organization'),
  signer: t('reports.reportEditorDialog.tab.signer'),
  balance: t('reports.reportEditorDialog.tab.balance'),
  notes: t('reports.reportEditorDialog.tab.notes'),
}

function humanizeFieldPath(path: string): string {
  const [section, ...rest] = path.split('.')
  const sectionLabel = FIELD_SECTION_LABELS[section] ?? section
  return rest.length ? `${sectionLabel} → ${rest.join(' → ')}` : sectionLabel
}

interface FieldErrorEntry { key: string; label: string; message: string }

const fieldErrorEntries = computed<FieldErrorEntry[]>(() => {
  const out: FieldErrorEntry[] = []
  for (const [path, messages] of Object.entries(fieldErrors.value)) {
    messages.forEach((message, i) => {
      out.push({ key: `${path}#${i}`, label: humanizeFieldPath(path), message })
    })
  }
  return out
})

const saveStatusColor = computed(() => {
  if (isSaving.value) return 'orange'
  if (hasDraft.value) return 'positive'
  return 'grey'
})

const saveStatusLabel = computed(() => {
  if (isSaving.value) return t('reports.reportEditorDialog.savingLabel')
  if (hasDraft.value && lastSavedAt.value) {
    return t('reports.reportEditorDialog.draftSavedLabel', { time: formatTime(lastSavedAt.value) })
  }
  if (hasDraft.value) return t('reports.reportEditorDialog.draftLabel')
  return t('reports.reportEditorDialog.newLabel')
})

function formatTime(d: Date): string {
  return d.toLocaleTimeString(uiLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// realtime: нет источника — редактор черновика отчёта: живое перечитывание затёрло бы правку; список отчётов и календарь живут по ленте.
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
      FailAlert(e, t('reports.reportEditorDialog.formLoadError'))
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
      t('reports.reportEditorDialog.formErrorsText', { count: errorsCount.value }),
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
    generationErrors.value = [t('reports.reportEditorDialog.emptyResponseError')]
    return null
  }
  generationErrors.value = out.errors ?? []
  if (!out.xml) return null
  lastGeneratedXml.value = out.xml
  lastGeneratedFileName.value = out.fileName
  if (out.isValid) SuccessAlert(t('reports.reportEditorDialog.xmlGeneratedSuccess'))
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
    FailAlert(e, t('reports.reportEditorDialog.xmlGenerateError'))
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
    if (!root) throw new Error(t('reports.error.pdfRenderFailed'))
    const name = makePdfFileName(props.reportType, props.year, props.period ?? null)
    await exportFormToPdf(root, name)
  } catch (e) {
    FailAlert(e, t('reports.reportEditorDialog.pdfGenerateError'))
  } finally {
    pdfLoading.value = false
  }
}

async function regenerate(): Promise<void> {
  try {
    await regenerateDraft()
    SuccessAlert(t('reports.reportEditorDialog.regenerateSuccess'))
  } catch (e) {
    FailAlert(e, t('reports.reportEditorDialog.regenerateError'))
  }
}

async function clearDraft(): Promise<void> {
  try {
    await clear()
    await load()
    SuccessAlert(t('reports.reportEditorDialog.deleteDraftSuccess'))
  } catch (e) {
    FailAlert(e, t('reports.reportEditorDialog.deleteDraftError'))
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
    SuccessAlert(nextMark ? t('reports.reportEditorDialog.markSetSuccess') : t('reports.reportEditorDialog.markUnsetSuccess'))
    emit('marked')
  } catch (e) {
    FailAlert(e, t('reports.reportEditorDialog.markSetError'))
  } finally {
    markLoading.value = false
  }
}

function markNotRequired(): void {
  void applyMark(
    'NOT_REQUIRED',
    t('reports.reportEditorDialog.markNotRequiredConfirm'),
  )
}

function markSubmittedExternally(): void {
  void applyMark(
    'SUBMITTED_EXTERNALLY',
    t('reports.reportEditorDialog.markSubmittedOffPlatformConfirm') +
      t('reports.reportEditorDialog.markSubmittedOffPlatformConfirmSuffix'),
  )
}

function clearMark(): void {
  void applyMark(null, t('reports.reportEditorDialog.unmarkConfirm'))
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

// Отступы и зазор между карточками живут здесь, а не внутри форм: разделы
// 6-НДФЛ и уведомления — соседи ZeroReportEditor, и без общего контейнера они
// прижимались к краям диалога и слипались с формой над ними.
.editor-stack {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
  padding: var(--p-3, 12px);
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

.error-list {
  background: var(--p-surface-1, #fff);
  border-color: var(--p-neg-soft);
  max-height: 220px;
  overflow-y: auto;

  :deep(.q-item) {
    min-height: unset;
    padding: 6px 8px;
  }

  :deep(.q-item__label--caption) {
    color: var(--p-ink-2);
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

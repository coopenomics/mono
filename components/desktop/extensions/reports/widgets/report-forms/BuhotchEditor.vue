<template lang="pug">
.buhotch-editor(v-if='editsValue')
  //- === Титул ===
  .editor-section
    h3.section-title Титульный лист (КНД 0710096)

    .fields-grid
      q-input(
        label='Номер корректировки'
        type='number'
        :model-value='editsValue.header.correctionNumber'
        @update:model-value='v => updateField("header.correctionNumber", clampInt(v, 0, 999))'
        :rules='[v => (v >= 0 && v <= 999) || "0..999"]'
        dense filled
      )
      q-input(
        label='Отчётный год'
        type='number'
        :model-value='editsValue.header.reportYear'
        @update:model-value='v => updateField("header.reportYear", clampInt(v, 2000, 2100))'
        dense filled
      )
      q-input(
        label='Дата документа'
        :model-value='editsValue.header.docDate'
        @update:model-value='v => updateField("header.docDate", v)'
        mask='##.##.####'
        :rules='[reportRules.dateDdMmYyyy()]'
        dense filled
      )

    //- ПрАудит + ПрУтвер из XSD NO_BOUPR (обязательные атрибуты Документ/0/1).
    //- - «Подлежит обязательному аудиту»: для большинства кооперативов нет (не попадают
    //-   под пороги ФЗ-307). Если =1, требуется блок СвАудит (сейчас не поддерживаем).
    //- - «Подлежит утверждению общим собранием»: для потребкооперативов и с/х = да
    //-   (ст. 38 ФЗ-193 и аналоги). Тогда в документ добавляется НаимОргнУтв.
    .fields-grid
      q-checkbox(
        label='Подлежит обязательному аудиту'
        :model-value='editsValue.header.audit'
        @update:model-value='v => updateField("header.audit", !!v)'
      )
        q-tooltip XSD ПрАудит. Обычно для кооперативов «нет».
      q-checkbox(
        label='Подлежит утверждению общим собранием'
        :model-value='editsValue.header.approved'
        @update:model-value='v => updateField("header.approved", !!v)'
      )
        q-tooltip XSD ПрУтвер. Для кооперативов — «да» (утверждает общее собрание).

  //- === Организация ===
  .editor-section
    h3.section-title Организация

    q-input(
      label='Наименование организации'
      :model-value='editsValue.organization.orgName'
      @update:model-value='v => updateField("organization.orgName", v)'
      :rules='[reportRules.length(1, 1000)]'
      :error='errFor("organization.orgName")'
      :error-message='msgFor("organization.orgName")'
      dense filled
    )

    .fields-grid
      q-input(
        label='ИНН'
        :model-value='editsValue.organization.inn'
        @update:model-value='v => updateField("organization.inn", v)'
        :rules='[reportRules.innUl()]'
        :error='errFor("organization.inn")'
        :error-message='msgFor("organization.inn")'
        mask='##########'
        dense filled
      )
      q-input(
        label='КПП'
        :model-value='editsValue.organization.kpp'
        @update:model-value='v => updateField("organization.kpp", String(v || "").toUpperCase())'
        :rules='[reportRules.kpp()]'
        :error='errFor("organization.kpp")'
        :error-message='msgFor("organization.kpp")'
        dense filled
        maxlength='9'
      )
      q-input(
        label='ОКПО'
        :model-value='editsValue.organization.okpo || ""'
        @update:model-value='v => updateField("organization.okpo", v || null)'
        :rules='[reportRules.optionalRegex(/^\\d{8}(\\d{2})?$/, "ОКПО — 8 или 10 цифр")]'
        :error='errFor("organization.okpo")'
        :error-message='msgFor("organization.okpo")'
        dense filled
      )

    .fields-grid
      q-input(
        label='ОКФС'
        :model-value='editsValue.organization.okfs'
        @update:model-value='v => updateField("organization.okfs", v)'
        :rules='[reportRules.okfs()]'
        :error='errFor("organization.okfs")'
        :error-message='msgFor("organization.okfs")'
        dense filled
      )
      q-input(
        label='ОКОПФ'
        :model-value='editsValue.organization.okopf'
        @update:model-value='v => updateField("organization.okopf", v)'
        :rules='[reportRules.okopf()]'
        :error='errFor("organization.okopf")'
        :error-message='msgFor("organization.okopf")'
        dense filled
      )

    q-input(
      label='Адрес места нахождения'
      :model-value='editsValue.organization.address || ""'
      @update:model-value='v => updateField("organization.address", v || null)'
      type='textarea'
      autogrow
      dense filled
      :rules='[reportRules.optionalRegex(/^.{1,255}$/, "до 255 символов")]'
      :error='errFor("organization.address")'
      :error-message='msgFor("organization.address")'
    )

  //- === Подписант ===
  .editor-section
    h3.section-title Подписант

    q-option-group(
      :model-value='editsValue.signer.type'
      @update:model-value='v => updateField("signer.type", v)'
      :options='signerTypeOptions'
      inline
    )

    .fields-grid
      q-input(
        label='Фамилия'
        :model-value='editsValue.signer.lastName'
        @update:model-value='v => updateField("signer.lastName", v)'
        dense filled
        :rules='[v => !!v || "обязательно"]'
        :error='errFor("signer.lastName")'
        :error-message='msgFor("signer.lastName")'
      )
      q-input(
        label='Имя'
        :model-value='editsValue.signer.firstName'
        @update:model-value='v => updateField("signer.firstName", v)'
        dense filled
        :rules='[v => !!v || "обязательно"]'
        :error='errFor("signer.firstName")'
        :error-message='msgFor("signer.firstName")'
      )
      q-input(
        label='Отчество'
        :model-value='editsValue.signer.middleName || ""'
        @update:model-value='v => updateField("signer.middleName", v || null)'
        dense filled
      )

    q-input(
      v-if='editsValue.signer.type === "representative"'
      label='Документ, подтверждающий полномочия'
      :model-value='editsValue.signer.repDoc || ""'
      @update:model-value='v => updateField("signer.repDoc", v || null)'
      :rules='[reportRules.length(1, 120)]'
      :error='errFor("signer.repDoc")'
      :error-message='msgFor("signer.repDoc")'
      dense filled
    )

  //- === Баланс ===
  .editor-section
    h3.section-title Бухгалтерский баланс (форма 0710001), тыс. ₽

    .balance-table
      .balance-header
        .bh-label Показатель
        .bh-code Код
        .bh-col На 31.12.{{ editsValue.header.reportYear }}
        .bh-col На 31.12.{{ editsValue.header.reportYear - 1 }}
        .bh-col На 31.12.{{ editsValue.header.reportYear - 2 }}

      .balance-section-title АКТИВ

      BalanceRowEditor(
        label='Нематериальные, финансовые и др. внеоборотные активы'
        code='1170'
        :row='editsValue.balance.nonMaterialAndLongFin'
        @update='row => updateRow("balance.nonMaterialAndLongFin", row)'
      )
      BalanceRowEditor(
        label='Денежные средства и денежные эквиваленты'
        code='1250'
        :row='editsValue.balance.cash'
        @update='row => updateRow("balance.cash", row)'
      )
      BalanceRowEditor(
        label='Финансовые и другие оборотные активы'
        code='1260'
        :row='editsValue.balance.shortTermFin'
        @update='row => updateRow("balance.shortTermFin", row)'
      )
      BalanceRowEditor.total(
        label='БАЛАНС (актив)'
        code='1600'
        :row='editsValue.balance.assetsTotal'
        @update='row => updateRow("balance.assetsTotal", row)'
      )

      .balance-section-title ПАССИВ

      BalanceRowEditor(
        label='Целевые средства (паевой фонд + целевые поступления)'
        code='1350'
        :row='editsValue.balance.targetFunds'
        @update='row => updateRow("balance.targetFunds", row)'
      )
      BalanceRowEditor.total(
        label='БАЛАНС (пассив)'
        code='1700'
        :row='editsValue.balance.passivesTotal'
        @update='row => updateRow("balance.passivesTotal", row)'
      )

    .balance-note(v-if='balanceDelta !== null')
      span(v-if='Math.abs(balanceDelta) <= 1')
        | Актив = Пассив (расхождение {{ balanceDelta }} тыс. ₽ в пределах регламента 0710001).
      span.warn(v-else)
        | ⚠️ Актив не равен пассиву: Δ = {{ balanceDelta }} тыс. ₽. Проверьте корректировки.

  //- === Пояснения ===
  .editor-section
    h3.section-title Пояснения

    q-input(
      label='Имя файла пояснительной записки'
      :model-value='editsValue.notes.explanationFileName'
      @update:model-value='v => updateField("notes.explanationFileName", v)'
      hint='XSD требует непустое значение. Если записки нет — оставьте "-".'
      :rules='[reportRules.length(1, 255)]'
      dense filled
    )
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Selectors } from '@coopenomics/sdk'
import BalanceRowEditor from './BalanceRowEditor.vue'

const { reportRules } = Selectors

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

/**
 * Двусторонний биндинг через defineModel (Vue 3.4+). Родитель подключает
 * `v-model:edits='...'`; мы тут пишем `editsModel.value = next` — это
 * автоматически эмитит `update:edits`. Без ручного @emit возникали
 * странные проблемы с реактивностью управляемых контролов
 * (q-checkbox/q-option-group «не переключались»), особенно на
 * structuredClone(reactive-proxy). JSON-клон + defineModel — надёжнее.
 */
const editsModel = defineModel<BuhotchEdits | null>('edits', { required: true })

const props = defineProps<{
  /** Серверные ошибки валидации: ключ = JSONPath поля. */
  fieldErrors?: Record<string, string[]>
}>()

const emit = defineEmits<{
  (e: 'dirty', path: string): void
}>()

const editsValue = computed(() => editsModel.value)

/** Есть ли серверная ошибка по path. */
function errFor(path: string): boolean {
  return (props.fieldErrors?.[path]?.length ?? 0) > 0
}

/** Первая серверная ошибка по path (показываем под полем). */
function msgFor(path: string): string {
  return props.fieldErrors?.[path]?.[0] ?? ''
}

const signerTypeOptions = [
  { label: '1 — руководитель', value: 'chairman' },
  { label: '2 — уполномоченный представитель', value: 'representative' },
]

function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.')
  let current: Record<string, unknown> = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    const next = current[part]
    if (next === null || next === undefined || typeof next !== 'object') {
      current[part] = {}
    }
    current = current[part] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value
}

function updateField(path: string, value: unknown): void {
  const current = editsModel.value
  if (!current) return
  // JSON-clone (не structuredClone): гарантированно выкидывает любые
  // Vue-proxy-обёртки/символы, оставляет только валидный JSON — такой же
  // POJO, каким он был при исходной сборке edits (buildInitialReportEdits).
  const next = JSON.parse(JSON.stringify(current)) as Record<string, unknown>
  setByPath(next, path, value)
  editsModel.value = next as unknown as BuhotchEdits
  emit('dirty', path)
}

function updateRow(path: string, row: BalanceRow | null): void {
  updateField(path, row)
}

function clampInt(v: unknown, min: number, max: number): number {
  const n = Number(v ?? 0)
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, Math.round(n)))
}

const balanceDelta = computed(() => {
  const b = editsModel.value?.balance
  if (!b) return null
  return b.assetsTotal.otch - b.passivesTotal.otch
})
</script>

<style scoped lang="scss">
.buhotch-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px;
  font-family: 'Segoe UI', system-ui, sans-serif;
}

.editor-section {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 16px;
}

.section-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #222;
}

.fields-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
  &:last-child { margin-bottom: 0; }
}

.balance-table {
  display: flex;
  flex-direction: column;
  font-size: 13px;
}

.balance-header {
  display: grid;
  grid-template-columns: 1fr 60px repeat(3, 140px);
  gap: 8px;
  padding: 8px;
  background: #f5f5f5;
  font-weight: 600;
  border-bottom: 1px solid #ccc;
  .bh-col { text-align: right; }
}

.balance-section-title {
  padding: 10px 8px 6px;
  font-weight: 700;
  background: #fafafa;
  border-bottom: 1px solid #eee;
}

.balance-note {
  margin-top: 10px;
  padding: 8px 10px;
  background: #f9f9f9;
  border-left: 3px solid #888;
  font-size: 12px;
  color: #555;
  .warn { color: #c00; font-weight: 600; }
}
</style>

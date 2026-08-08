<template lang="pug">
BaseDialog(
  :model-value="modelValue"
  :title="dialogTitle"
  size="lg"
  @update:model-value="emit('update:modelValue', $event)"
)
  .detail-ku
    .banner.banner--info
      q-icon.banner__icon(name="info", size="18px")
      .banner__body
        | Наименование, адрес и контакты участка задаются на столе председателя
        | в разделе «Кооперативные участки» и едины для всего кооператива. Здесь
        | вы отмечаете участок как пункт выдачи и настраиваете режим его работы.

    .detail-ku__readonly
      .detail-ku__ro-row
        .detail-ku__ro-label Участок
        .detail-ku__ro-value {{ branchName || coreBraname }}
      .detail-ku__ro-row
        .detail-ku__ro-label Адрес
        .detail-ku__ro-value {{ branchAddress || '—' }}
      .detail-ku__ro-row
        .detail-ku__ro-label Контакты
        .detail-ku__ro-value {{ branchContacts || '—' }}

    q-form.detail-ku__form(ref="formRef", greedy)
      q-input(
        v-model="form.description"
        outlined
        dense
        label="Описание (опционально)"
        type="textarea"
        autogrow
        aria-label="Описание пункта выдачи"
      )

      .detail-ku__section-title Режим работы
      .detail-ku__days
        .detail-ku__day(v-for="day in days", :key="day.key")
          q-toggle(
            v-model="form.workingHours[day.key].enabled"
            :label="day.label"
            dense
          )
          //- Поля времени рендерим ВСЕГДА; при выключенном дне они disabled
          //- (серые). Так высота строки постоянна и список не «скачет» при
          //- переключении — место зарезервировано, а не появляется/исчезает.
          .detail-ku__day-times
            q-input(
              v-model="form.workingHours[day.key].open"
              outlined
              dense
              hide-bottom-space
              label="Открытие"
              mask="time"
              placeholder="09:00"
              :disable="!form.workingHours[day.key].enabled"
              lazy-rules
              :rules="[timeRule]"
            )
            q-input(
              v-model="form.workingHours[day.key].close"
              outlined
              dense
              hide-bottom-space
              label="Закрытие"
              mask="time"
              placeholder="18:00"
              :disable="!form.workingHours[day.key].enabled"
              lazy-rules
              :rules="[timeRule]"
            )

  template(#footer)
    BaseButton(variant="ghost", :disabled="isSaving", @click="cancel") Отмена
    BaseButton(variant="primary", :loading="isSaving", @click="submit")
      template(#icon-left)
        q-icon(name="save", size="16px")
      | Сохранить
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { QForm } from 'quasar'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { BaseButton, BaseDialog } from 'src/shared/ui/base'
import { useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails'
import type {
  IMarketplaceKUDetails,
  IWorkingHours,
} from 'src/entities/MarketplaceKUDetails'
import type { IBranch } from 'src/entities/Branch/model'

/**
 * Детализация существующего в core кооперативного участка как ПВЗ Стола
 * заказов (`marketplaceDetailKU`). Наименование/адрес/контакты участка —
 * единый источник правды на столе председателя («Кооперативные участки»),
 * здесь показаны read-only; редактируются только режим работы и описание.
 *
 * Поля с масками/валидацией остаются на сыром `q-form`/`q-input` — это
 * одобренный канон форм проекта (см. CreateMarketplaceOfferPage); base-обёртки
 * (BaseDialog/BaseButton) применяются к оболочке и действиям.
 */

const props = defineProps<{
  modelValue: boolean
  coopname: string
  coreBraname: string
  existing?: IMarketplaceKUDetails | null
  branch?: IBranch | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved', value: IMarketplaceKUDetails): void
}>()

const days = [
  { key: 'mon' as const, label: 'Пн' },
  { key: 'tue' as const, label: 'Вт' },
  { key: 'wed' as const, label: 'Ср' },
  { key: 'thu' as const, label: 'Чт' },
  { key: 'fri' as const, label: 'Пт' },
  { key: 'sat' as const, label: 'Сб' },
  { key: 'sun' as const, label: 'Вс' },
]

type DayKey = (typeof days)[number]['key']

const isSaving = ref(false)
const formRef = ref<QForm | null>(null)
const store = useMarketplaceKUDetailsStore()

// Реквизиты участка показываем read-only: из уже сохранённой детализации
// (бэкенд резолвит их живьём из организации) либо из карточки КУ стола совета.
const branchName = computed(
  () => props.existing?.name || props.branch?.short_name || props.branch?.full_name || ''
)
const branchAddress = computed(
  () => props.existing?.addressFull || props.branch?.fact_address || props.branch?.full_address || ''
)
const branchContacts = computed(() => {
  const phone = props.existing?.contactPhone || props.branch?.phone || ''
  const email = props.existing?.contactEmail || props.branch?.email || ''
  return [phone, email].filter(Boolean).join(' · ')
})

// В заголовке — человекочитаемое имя участка, не служебный braname.
const dialogTitle = computed(
  () => `Детализация ПВЗ — ${branchName.value || props.coreBraname}`
)

// Правила с регулярками держим в script, а не inline в pug-атрибуте:
// pug съедает обратные слэши в строковом значении :rules, и `\d`/`\.`
// деградируют в литералы `d`/`.`, из-за чего валидные значения ложно
// краснеют (канон форм — выносить такие правила в функции, ср. priceRule).
function timeRule(v: string): true | string {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) || 'Время в формате ЧЧ:ММ'
}

const form = reactive({
  description: '',
  workingHours: Object.fromEntries(
    days.map((d) => [d.key, { enabled: false, open: '09:00', close: '18:00' }])
  ) as Record<DayKey, { enabled: boolean; open: string; close: string }>,
})

function resetWorkingHours() {
  for (const d of days) {
    form.workingHours[d.key] = { enabled: false, open: '09:00', close: '18:00' }
  }
}

// Перезаполнение при открытии: редактирование берёт режим работы/описание из
// `existing`, добавление нового — пустую форму (реквизиты участка read-only).
function resetForm() {
  const next = props.existing
  if (next) {
    form.description = next.description ?? ''
    for (const d of days) {
      const wh = next.workingHours[d.key]
      form.workingHours[d.key] = wh
        ? { enabled: true, open: wh.open, close: wh.close }
        : { enabled: false, open: '09:00', close: '18:00' }
    }
  } else {
    form.description = ''
    resetWorkingHours()
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) resetForm()
  },
  { immediate: true }
)

function buildWorkingHours(): IWorkingHours {
  const wh: IWorkingHours = {}
  for (const d of days) {
    const slot = form.workingHours[d.key]
    if (slot.enabled) wh[d.key] = { open: slot.open, close: slot.close, breaks: [] }
  }
  return wh
}

function cancel() {
  emit('update:modelValue', false)
}

async function submit() {
  const valid = await formRef.value?.validate()
  if (!valid) return

  isSaving.value = true
  try {
    const saved = await store.detailKU({
      coopname: props.coopname,
      coreBraname: props.coreBraname,
      description: form.description || undefined,
      workingHours: buildWorkingHours(),
    })
    SuccessAlert('Пункт выдачи сохранён. Адрес геокодируется автоматически.')
    emit('saved', saved)
    emit('update:modelValue', false)
  } catch (e) {
    FailAlert(e, 'Не удалось сохранить пункт выдачи')
  } finally {
    isSaving.value = false
  }
}
</script>

<style scoped lang="scss">
.detail-ku {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__form {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__readonly {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    padding: var(--p-3, 12px);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 8px);
  }

  &__ro-row {
    display: grid;
    grid-template-columns: 96px 1fr;
    gap: var(--p-3, 12px);
    align-items: baseline;
  }

  &__ro-label {
    color: var(--p-ink-3);
    font-size: var(--p-fs-body-sm, 13px);
  }

  &__ro-value {
    color: var(--p-ink-1);
  }

  &__section-title {
    margin-top: var(--p-2, 8px);
    font-weight: 600;
    color: var(--p-ink-2);
  }

  &__days {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  // День — одна строка: переключатель слева, поля времени справа на той же
  // линии. Без column-раскладки, чтобы включение дня не добавляло вторую
  // строку и список не «удлинялся».
  &__day {
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 8px);
    padding: var(--p-2, 8px) var(--p-3, 12px);
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--p-3, 12px);
    min-height: 56px;
  }

  // Фиксированная колонка переключателя — поля времени выравниваются по всем
  // строкам независимо от длины метки дня.
  &__day > :deep(.q-toggle) {
    flex: 0 0 auto;
    min-width: 88px;
  }

  &__day-times {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--p-2, 8px);
    max-width: 360px;
  }
}

@media (max-width: 600px) {
  .detail-ku__day-times {
    max-width: none;
  }
}
</style>

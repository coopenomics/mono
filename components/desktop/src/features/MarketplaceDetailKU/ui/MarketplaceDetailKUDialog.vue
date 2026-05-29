<template lang="pug">
BaseDialog(
  :model-value="modelValue"
  :title="`Детализация ПВЗ — ${coreBraname}`"
  size="lg"
  @update:model-value="emit('update:modelValue', $event)"
)
  .detail-ku
    .banner.banner--info
      q-icon.banner__icon(name="info", size="18px")
      .banner__body
        | Укажите фактический адрес, контакты и режим работы пункта выдачи —
        | он может отличаться от юридического адреса участка. После сохранения
        | адрес автоматически геокодируется для отображения на карте.

    q-form.detail-ku__form(ref="formRef", greedy)
      q-input(
        v-model="form.addressFull"
        outlined
        dense
        label="Фактический адрес ПВЗ"
        autogrow
        :rules="[v => !!(v && v.trim()) || 'Адрес обязателен']"
        aria-label="Фактический адрес пункта выдачи"
      )
      .detail-ku__row
        q-input(
          v-model="form.contactPhone"
          outlined
          dense
          label="Контактный телефон"
          mask="+# (###) ###-##-##"
          :rules="[v => !!v || 'Телефон обязателен']"
          aria-label="Контактный телефон пункта выдачи"
        )
        q-input(
          v-model="form.contactEmail"
          outlined
          dense
          label="Контактный email"
          type="email"
          lazy-rules
          :rules="[emailRule]"
          aria-label="Контактный email пункта выдачи"
        )
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
          .detail-ku__day-times(v-if="form.workingHours[day.key].enabled")
            q-input(
              v-model="form.workingHours[day.key].open"
              outlined
              dense
              label="Открытие"
              mask="time"
              placeholder="09:00"
              lazy-rules
              :rules="[timeRule]"
            )
            q-input(
              v-model="form.workingHours[day.key].close"
              outlined
              dense
              label="Закрытие"
              mask="time"
              placeholder="18:00"
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
import { reactive, ref, watch } from 'vue'
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
 * заказов (`marketplaceDetailKU`). Используется и для добавления нового ПВЗ
 * (передаётся `branch` — поля адреса/контактов предзаполняются из карточки
 * КУ стола совета), и для редактирования уже подключённого (`existing`).
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

// Правила с регулярками держим в script, а не inline в pug-атрибуте:
// pug съедает обратные слэши в строковом значении :rules, и `\d`/`\.`
// деградируют в литералы `d`/`.`, из-за чего валидные значения ложно
// краснеют (канон форм — выносить такие правила в функции, ср. priceRule).
function emailRule(v: string): true | string {
  return /.+@.+\..+/.test(v) || 'Введите валидный email'
}

function timeRule(v: string): true | string {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) || 'Время в формате ЧЧ:ММ'
}

const form = reactive({
  addressFull: '',
  contactPhone: '',
  contactEmail: '',
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

// Перезаполнение при открытии: редактирование берёт значения из `existing`,
// добавление нового — из карточки КУ (фактический адрес → контакты).
function resetForm() {
  const next = props.existing
  if (next) {
    form.addressFull = next.addressFull
    form.contactPhone = next.contactPhone
    form.contactEmail = next.contactEmail
    form.description = next.description ?? ''
    for (const d of days) {
      const wh = next.workingHours[d.key]
      form.workingHours[d.key] = wh
        ? { enabled: true, open: wh.open, close: wh.close }
        : { enabled: false, open: '09:00', close: '18:00' }
    }
  } else {
    form.addressFull = props.branch?.fact_address || props.branch?.full_address || ''
    form.contactPhone = props.branch?.phone || ''
    form.contactEmail = props.branch?.email || ''
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
      addressFull: form.addressFull,
      contactPhone: form.contactPhone,
      contactEmail: form.contactEmail,
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

  &__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--p-3, 12px);
  }

  &__section-title {
    margin-top: var(--p-2, 8px);
    font-weight: 600;
    color: var(--p-ink-2);
  }

  &__days {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--p-3, 12px);
  }

  &__day {
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 8px);
    padding: var(--p-3, 12px);
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__day-times {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--p-2, 8px);
  }
}

@media (max-width: 600px) {
  .detail-ku__row,
  .detail-ku__days {
    grid-template-columns: 1fr;
  }
}
</style>

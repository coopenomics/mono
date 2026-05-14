<template lang="pug">
q-dialog(:model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" persistent)
  q-card(style="min-width: 480px; max-width: 720px;")
    q-card-section.row.items-center
      .text-h6 Детализация ПВЗ — {{ coreBraname }}
      q-space
      q-btn(flat round icon="close" @click="cancel")
    q-card-section
      q-form(@submit.prevent="submit" greedy)
        q-input(
          v-model="form.addressFull"
          label="Полный адрес ПВЗ"
          required
          autogrow
          :rules="[v => !!v || 'Адрес обязателен']"
          aria-label="Полный адрес пункта выдачи"
        )
        q-input(
          v-model="form.contactPhone"
          label="Контактный телефон"
          mask="+# (###) ###-##-##"
          required
          :rules="[v => !!v || 'Телефон обязателен']"
          aria-label="Контактный телефон пункта выдачи"
        )
        q-input(
          v-model="form.contactEmail"
          label="Контактный email"
          type="email"
          required
          :rules="[v => /.+@.+\..+/.test(v) || 'Введите валидный email']"
          aria-label="Контактный email пункта выдачи"
        )
        q-input(
          v-model="form.description"
          label="Описание (опционально)"
          type="textarea"
          autogrow
          aria-label="Описание пункта выдачи"
        )
        .text-subtitle2.q-mt-md Режим работы
        .row.q-col-gutter-sm
          .col-12.col-sm-6(v-for="day in days" :key="day.key")
            q-card.q-pa-sm(flat bordered)
              .row.items-center.q-mb-xs
                q-toggle(
                  v-model="form.workingHours[day.key].enabled"
                  :label="day.label"
                  dense
                )
              .row.q-col-gutter-xs(v-if="form.workingHours[day.key].enabled")
                .col
                  q-input(
                    v-model="form.workingHours[day.key].open"
                    label="Открытие"
                    mask="##:##"
                    placeholder="09:00"
                    dense
                    :rules="[v => /^\d{2}:\d{2}$/.test(v) || 'HH:mm']"
                  )
                .col
                  q-input(
                    v-model="form.workingHours[day.key].close"
                    label="Закрытие"
                    mask="##:##"
                    placeholder="18:00"
                    dense
                    :rules="[v => /^\d{2}:\d{2}$/.test(v) || 'HH:mm']"
                  )
    q-card-actions(align="right")
      q-btn(flat label="Отмена" @click="cancel")
      q-btn(color="primary" label="Сохранить" :loading="isSaving" @click="submit")
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails'
import type {
  IMarketplaceKUDetails,
  IWorkingHours,
} from 'src/entities/MarketplaceKUDetails'

const props = defineProps<{
  modelValue: boolean
  coopname: string
  coreBraname: string
  existing?: IMarketplaceKUDetails | null
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

const isSaving = ref(false)
const store = useMarketplaceKUDetailsStore()

const form = reactive({
  addressFull: '',
  contactPhone: '',
  contactEmail: '',
  description: '',
  workingHours: Object.fromEntries(
    days.map((d) => [d.key, { enabled: false, open: '09:00', close: '18:00' }])
  ) as Record<(typeof days)[number]['key'], { enabled: boolean; open: string; close: string }>,
})

watch(
  () => props.existing,
  (next) => {
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
    }
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
    emit('saved', saved)
    emit('update:modelValue', false)
  } finally {
    isSaving.value = false
  }
}
</script>

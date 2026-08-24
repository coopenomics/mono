<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { BaseInput, BaseChip, BaseButton } from 'src/shared/ui/base'
import { FileUploader } from 'src/shared/ui/domain/FileUploader'
import {
  useConnectionAgreementStore,
  CONNECTION_STEP,
  previousVisibleStep,
} from 'src/entities/ConnectionAgreement'
import { useSystemStore } from 'src/entities/System/model'
import { useCooperativeCharter } from 'src/features/Union/UploadCooperativeCharter'
import StepFrame from '../ui/StepFrame.vue'

const connectionAgreement = useConnectionAgreementStore()
const system = useSystemStore()
const { charter, uploading, error: uploadError, load, upload } = useCooperativeCharter()

const description = ref<string>(connectionAgreement.formData.description || '')
const descriptionError = ref<string>('')
const charterError = ref<string>('')
const pendingFile = ref<File | null>(null)

watch(
  () => connectionAgreement.formData.description,
  (v) => {
    description.value = v || ''
  },
)

// Устав мог быть приложен в прошлый заход — заявку заполняют не за один присест.
onMounted(load)

const hasCharter = computed(() => !!charter.value)

const charterSize = computed(() => {
  const bytes = charter.value?.size_bytes ?? 0
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`
})

// Файл уходит на сервер сразу при выборе: так пайщик видит, что устав дошёл,
// не дожидаясь следующего шага, а мастер не таскает бинарь в своём состоянии.
const handleFilePicked = async (value: File | File[] | null) => {
  const file = Array.isArray(value) ? value[0] : value
  pendingFile.value = file ?? null
  if (!file) return
  charterError.value = ''
  const ok = await upload(file)
  pendingFile.value = null
  if (!ok) charterError.value = uploadError.value
}

const validate = (): boolean => {
  descriptionError.value = description.value.trim() ? '' : 'Расскажите, чем занимается кооператив'
  charterError.value = hasCharter.value ? '' : 'Приложите устав кооператива'
  return !descriptionError.value && !charterError.value
}

const handleContinue = () => {
  if (!validate()) return
  connectionAgreement.setFormData({
    ...connectionAgreement.formData,
    description: description.value.trim(),
  })
  connectionAgreement.setCurrentStep(CONNECTION_STEP.domain)
}

// Назад ведёт на предыдущий показанный шаг; если рассказ о кооперативе —
// первый экран мастера, возвращаться некуда и кнопки нет.
const previousStep = computed(() =>
  previousVisibleStep(connectionAgreement.currentStep, { isUnioned: !!system.info.is_unioned }),
)
const canGoBack = computed(() => previousStep.value !== null)
const handleBack = () => {
  if (previousStep.value === null) return
  connectionAgreement.setCurrentStep(previousStep.value)
}
</script>

<template lang="pug">
StepFrame(
  title="Расскажите о кооперативе"
  lead="С этого начинается заявка: совет читает рассказ и устав, когда решает, подключать ли кооператив к платформе. Напишите своими словами, чем кооператив занимается и что планирует, и приложите действующий устав."
  :can-back="canGoBack"
  :loading="uploading"
  @back="handleBack"
  @next="handleContinue"
)
  .row.q-col-gutter-lg
    .col-12.col-md-7
      BaseInput(
        v-model="description"
        type="textarea"
        :rows="8"
        autogrow
        label="Чем занимается кооператив"
        placeholder="Чем занимается кооператив, кто пайщики, какие товары или услуги производит, есть ли сайт и где вас найти, что планируете делать на платформе."
        hint="Этот текст увидит совет и он же станет описанием кооператива в реестре"
        :error="descriptionError || undefined"
      )

    .col-12.col-md-5
      .profile-step__charter
        .t-eyebrow.t-muted Устав кооператива

        .profile-step__attached(v-if="hasCharter")
          q-icon.profile-step__file-icon(name="description" size="24px")
          .profile-step__file
            .profile-step__file-name {{ charter?.original_filename || 'Устав' }}
            .t-meta.t-muted {{ charterSize }}
          BaseChip(variant="pos" size="sm")
            q-icon(name="check" size="12px").q-mr-xs
            span приложен
        .profile-step__replace(v-if="hasCharter")
          BaseButton(
            variant="ghost"
            size="sm"
            type="button"
            :loading="uploading"
            @click="charter = null"
          ) Заменить файл

        FileUploader(
          v-else
          :model-value="pendingFile"
          accept="application/pdf,image/jpeg,image/png"
          :max-size="20 * 1024 * 1024"
          title="Перетащите устав или нажмите для выбора"
          hint="PDF или скан, до 20 МБ"
          :disabled="uploading"
          @update:model-value="handleFilePicked"
        )

        p.t-sm.profile-step__error(v-if="charterError") {{ charterError }}
</template>

<style scoped>
.profile-step__charter {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.profile-step__attached {
  display: flex;
  align-items: center;
  gap: var(--p-3);
  padding: var(--p-3) var(--p-4);
  border: 1px solid var(--p-line-1);
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);
}
.profile-step__file {
  min-width: 0;
  flex: 1;
}
.profile-step__file-icon {
  color: var(--p-ink-2);
}
.profile-step__file-name {
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  color: var(--p-ink);
  overflow-wrap: anywhere;
}
.profile-step__replace {
  display: flex;
}
.profile-step__error {
  margin: 0;
  color: var(--p-neg);
}
</style>

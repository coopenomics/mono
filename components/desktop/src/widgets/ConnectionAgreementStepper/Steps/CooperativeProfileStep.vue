<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { BaseInput, BaseChip, BaseButton } from 'src/shared/ui/base'
import { FileUploader } from 'src/shared/ui/domain/FileUploader'
import {
  useConnectionAgreementStore,
  CONNECTION_STEP,
  previousVisibleStep,
} from 'src/entities/ConnectionAgreement'
import { useCooperativeCharter } from 'src/features/Union/UploadCooperativeCharter'
import { useLiveReload } from 'src/shared/lib/realtime'
import StepFrame from '../ui/StepFrame.vue'
import { t } from 'src/shared/i18n';

const connectionAgreement = useConnectionAgreementStore()
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
useLiveReload([{ code: 'core', table: 'cooperative_charters' }], async () => load())

const hasCharter = computed(() => !!charter.value)

const charterSize = computed(() => {
  const bytes = charter.value?.size_bytes ?? 0
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? t('connectionAgreementStepper.cooperativeProfileStep.sizeMb', { size: mb.toFixed(1) }) : t('connectionAgreementStepper.cooperativeProfileStep.sizeKb', { size: Math.max(1, Math.round(bytes / 1024)) })
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
  descriptionError.value = description.value.trim() ? '' : t('connectionAgreementStepper.cooperativeProfileStep.descriptionRequired')
  charterError.value = hasCharter.value ? '' : t('connectionAgreementStepper.cooperativeProfileStep.charterRequired')
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
const previousStep = computed(() => previousVisibleStep(connectionAgreement.currentStep))
const canGoBack = computed(() => previousStep.value !== null)
const handleBack = () => {
  if (previousStep.value === null) return
  connectionAgreement.setCurrentStep(previousStep.value)
}
</script>

<template lang="pug">
StepFrame(
  :title="$t('connectionAgreementStepper.cooperativeProfileStep.title')"
  :lead="$t('connectionAgreementStepper.cooperativeProfileStep.lead')"
  :can-back="canGoBack"
  :loading="uploading"
  @back="handleBack"
  @next="handleContinue"
)
  //- Два блока одного строения друг под другом, во всю ширину: заголовок,
  //- пояснение, поле. Между ними линия — описание и устав читаются двумя
  //- частями заявки, а длинным строкам (имя файла устава) хватает места.
  .profile-step
    section.profile-step__block
      .profile-step__head
        .profile-step__title {{ $t('connectionAgreementStepper.cooperativeProfileStep.descriptionLabel') }}
        .profile-step__note {{ $t('connectionAgreementStepper.cooperativeProfileStep.descriptionHint') }}
      BaseInput(
        v-model="description"
        type="textarea"
        :rows="7"
        autogrow
        :placeholder="$t('connectionAgreementStepper.cooperativeProfileStep.descriptionPlaceholder')"
        :error="descriptionError || undefined"
      )

    section.profile-step__block
      .profile-step__head
        .profile-step__title {{ $t('connectionAgreementStepper.cooperativeProfileStep.charterTitle') }}
        .profile-step__note {{ $t('connectionAgreementStepper.cooperativeProfileStep.charterNote') }}
      .profile-step__charter

        //- Приложенный устав — одной строкой: файл, отметка, замена.
        .profile-step__attached(v-if="hasCharter")
          q-icon.profile-step__file-icon(name="description" size="24px")
          .profile-step__file
            .profile-step__file-name {{ charter?.original_filename || $t('connectionAgreementStepper.cooperativeProfileStep.charterChip') }}
            .profile-step__file-size {{ charterSize }}
          BaseChip(variant="pos" size="sm")
            q-icon(name="check" size="12px").q-mr-xs
            span {{ $t('connectionAgreementStepper.cooperativeProfileStep.charterAttached') }}
          BaseButton(
            variant="secondary"
            size="sm"
            type="button"
            :loading="uploading"
            @click="charter = null"
          ) {{ $t('connectionAgreementStepper.cooperativeProfileStep.replaceFile') }}

        FileUploader(
          v-else
          :model-value="pendingFile"
          accept="application/pdf,image/jpeg,image/png"
          :max-size="20 * 1024 * 1024"
          :title="$t('connectionAgreementStepper.cooperativeProfileStep.dropzoneTitle')"
          :hint="$t('connectionAgreementStepper.cooperativeProfileStep.dropzoneHint')"
          :disabled="uploading"
          @update:model-value="handleFilePicked"
        )

        p.t-sm.profile-step__error(v-if="charterError") {{ charterError }}
</template>

<style scoped>
/* Содержимое шага отделено от вступления линией, блоки идут друг под
   другом и тоже разделены линией. */
.profile-step {
  margin-top: var(--p-2);
  padding-top: var(--p-5);
  border-top: 1px solid var(--p-line);
}
.profile-step__block + .profile-step__block {
  margin-top: var(--p-5);
  padding-top: var(--p-5);
  border-top: 1px solid var(--p-line);
}
.profile-step__head {
  margin-bottom: var(--p-3);
}
.profile-step__title {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
}
.profile-step__note {
  margin-top: var(--p-1);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.profile-step__file-size {
  font-size: var(--p-fs-meta);
  color: var(--p-ink-2);
}
.profile-step__error {
  margin: 0;
  color: var(--p-neg);
}
</style>

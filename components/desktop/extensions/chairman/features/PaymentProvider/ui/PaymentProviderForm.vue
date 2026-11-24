<template lang="pug">
form.pp-form(@submit.prevent='submit')
  q-select.pp-form__select(
    v-model='formData.provider_name'
    :options='providerOptions'
    :label='$t("chairman.paymentProviderForm.providerLabel")'
    :placeholder='$t("chairman.paymentProviderForm.providerPlaceholder")'
    dense
    outlined
    color='primary'
    emit-value
    map-options
    option-value='value'
    option-label='label'
    :loading='loading'
  )

  .pp-form__hint(v-if='selectedProviderDescription') {{ selectedProviderDescription }}

  .pp-form__actions
    q-btn(
      flat
      no-caps
      :label='$t("chairman.paymentProviderForm.cancelLabel")'
      color='grey-7'
      @click='resetForm'
      :loading='loading'
      :disable='!hasChanges'
    )
    q-btn(
      type='submit'
      no-caps
      unelevated
      :label='$t("common.action.save")'
      color='primary'
      :loading='loading'
      :disable='!hasChanges'
    )
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useSystemStore } from 'src/entities/System/model'
import { usePaymentProvider } from '../model'
import { api as extensionApi } from 'src/entities/Extension/api'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { t } from '../../../i18n';

interface Props {
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<{
  submit: []
  success: []
  error: [error: Error]
}>()

// Система настроек
const systemStore = useSystemStore()
const { updatePaymentProvider } = usePaymentProvider()

// Данные формы
const formData = ref({
  provider_name: ''
})

// Оригинальные данные для сравнения
const originalData = ref({ ...formData.value })

// Опции провайдеров платежей. ЮKassa предлагается, только когда расширение
// установлено и включено: без него сервер не найдёт провайдера и любой
// входящий платёж пайщика завершится ошибкой. Выбранная ранее ЮKassa
// остаётся в списке, чтобы форма показала текущее значение.
const yookassaReady = ref(false)
const providerOptions = computed(() => {
  const options = [
    {
      value: 'qrpay',
      label: t('chairman.paymentProviderForm.qrProviderName'),
      description: t('chairman.paymentProviderForm.qrProviderHint')
    }
  ]
  if (yookassaReady.value || originalData.value.provider_name === 'yookassa') {
    options.push({
      value: 'yookassa',
      label: t('chairman.paymentProviderForm.yookassaProviderName'),
      description: t('chairman.paymentProviderForm.yookassaProviderHint')
    })
  }
  return options
})

// Проверка наличия изменений
const hasChanges = computed(() => {
  return JSON.stringify(formData.value) !== JSON.stringify(originalData.value)
})

// Описание выбранного провайдера
const selectedProviderDescription = computed(() => {
  const selectedOption = providerOptions.value.find(option => option.value === formData.value.provider_name)
  return selectedOption?.description || ''
})

// Сброс формы
const resetForm = () => {
  formData.value = { ...originalData.value }
}

// Загрузка данных при монтировании
onMounted(() => {
  extensionApi
    .loadExtensions({ name: 'yookassa' })
    .then((list) => {
      const ext = list.find((e) => e.name === 'yookassa')
      yookassaReady.value = Boolean(ext?.is_installed && ext?.enabled)
    })
    .catch(() => (yookassaReady.value = false))

  if (systemStore.info?.settings) {
    const settings = systemStore.info.settings
    formData.value = {
      provider_name: settings.provider_name || ''
    }
    originalData.value = { ...formData.value }
  }
})

// Отправка формы
const submit = async () => {
  if (!hasChanges.value) return

  emit('submit')

  try {
    await updatePaymentProvider({
      provider_name: formData.value.provider_name,
    })

    // Обновляем оригинальные данные
    originalData.value = { ...formData.value }

    SuccessAlert(t('chairman.paymentProviderForm.successMessage'))
    emit('success')

  } catch (error: any) {
    console.error('Ошибка сохранения провайдера платежей:', error)
    FailAlert(error)
    emit('error', error)
  }
}
</script>

<style scoped lang="scss">
.pp-form {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
  width: 100%;
}
.pp-form__select {
  max-width: 480px;
}
.pp-form__hint {
  max-width: 640px;
  font-size: var(--p-fs-body-sm);
  line-height: 1.5;
  color: var(--p-ink-2);
}
.pp-form__actions {
  display: flex;
  gap: var(--p-2, 8px);
}
</style>

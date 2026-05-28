<template lang="pug">
form.pp-form(@submit.prevent='submit')
  q-select.pp-form__select(
    v-model='formData.provider_name'
    :options='providerOptions'
    label='Провайдер входящих платежей'
    placeholder='Выберите провайдера'
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
      label='Отменить'
      color='grey-7'
      @click='resetForm'
      :loading='loading'
      :disable='!hasChanges'
    )
    q-btn(
      type='submit'
      no-caps
      unelevated
      label='Сохранить'
      color='primary'
      :loading='loading'
      :disable='!hasChanges'
    )
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useSystemStore } from 'src/entities/System/model'
import { usePaymentProvider } from '../model'
import { FailAlert, SuccessAlert } from 'src/shared/api'

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

// Опции провайдеров платежей
const providerOptions = [
  {
    value: 'qrpay',
    label: 'Банковский платеж по QR-коду',
    description: 'Пайщик получает реквизиты для оплаты по QR-коду, который можно отсканировать любым банковским приложением. Обработка платежей производится вручную в разделе "Реестр платежей" кассиром.'
  }
]

// Проверка наличия изменений
const hasChanges = computed(() => {
  return JSON.stringify(formData.value) !== JSON.stringify(originalData.value)
})

// Описание выбранного провайдера
const selectedProviderDescription = computed(() => {
  const selectedOption = providerOptions.find(option => option.value === formData.value.provider_name)
  return selectedOption?.description || ''
})

// Сброс формы
const resetForm = () => {
  formData.value = { ...originalData.value }
}

// Загрузка данных при монтировании
onMounted(() => {
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

    SuccessAlert('Провайдер платежей сохранен успешно')
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

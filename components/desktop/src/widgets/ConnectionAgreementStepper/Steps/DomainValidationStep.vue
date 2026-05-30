<script setup lang="ts">
import { computed, onMounted } from 'vue'
import {
  BaseButton,
  BaseCard,
  BaseChip,
  BaseForm,
} from 'src/shared/ui/base'
import { DataRow } from 'src/shared/ui/domain'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'
import { useProviderSubscriptions } from 'src/features/Provider/model'

const connectionAgreement = useConnectionAgreementStore()
const { loadCurrentInstance } = connectionAgreement
const { SERVER_IP } = useProviderSubscriptions()

const coop = computed(() => connectionAgreement.coop)
const instance = computed(() => connectionAgreement.currentInstance)
const isDelegated = computed(() => !!instance.value?.is_delegated)

onMounted(async () => {
  if (!coop.value) {
    try {
      await connectionAgreement.reloadCooperative()
    } catch (error) {
      console.error('Ошибка загрузки кооператива:', error)
    }
  }
})

const handleBack = () => connectionAgreement.setCurrentStep(4)

const handleContinue = () => {
  if (!isDelegated.value) return
  if (connectionAgreement.currentStep < 7) {
    connectionAgreement.setCurrentStep(connectionAgreement.currentStep + 1)
  }
}

const handleReload = async () => {
  try {
    await loadCurrentInstance()
  } catch (error) {
    console.error('Ошибка обновления инстанса:', error)
  }
}
</script>

<template lang="pug">
BaseForm.dns-step(@submit="handleContinue")
  BaseCard(
    title="Делегирование домена"
    subtitle="Откройте панель управления вашим доменом и добавьте A-запись со значениями ниже. Делегирование проверим автоматически."
  )
    DataRow(label="Домен" :value="coop?.announce" mono)
    DataRow(label="IP-адрес" :value="SERVER_IP" mono copyable)

    .dns-step__status
      BaseChip(:variant="isDelegated ? 'pos' : 'warn'")
        span {{ isDelegated ? 'Домен делегирован' : 'Ожидаем делегирования' }}
      BaseButton(
        v-if="!isDelegated"
        variant="ghost"
        size="sm"
        type="button"
        @click="handleReload"
      ) Проверить сейчас

  template(#footer)
    .row.items-center.q-gutter-sm
      BaseButton(variant="ghost" size="sm" type="button" @click="handleBack") Назад
      q-space
      BaseButton(
        v-if="isDelegated"
        variant="primary"
        size="sm"
        type="submit"
      ) Дальше
</template>

<style scoped>
.dns-step {
  max-width: 640px;
}
.dns-step__status {
  display: inline-flex;
  align-items: center;
  gap: var(--p-3);
  margin-top: var(--p-4);
}
</style>

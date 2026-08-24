<script setup lang="ts">
import { computed, ref } from 'vue'
import { BaseButton, BaseChip } from 'src/shared/ui/base'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'
import StepFrame from '../ui/StepFrame.vue'

const connectionAgreement = useConnectionAgreementStore()
const instance = computed(() => connectionAgreement.currentInstance)
const isApproved = computed(() => instance.value?.blockchain_status === 'active')
const isChecking = ref(false)

const refreshStatus = async () => {
  isChecking.value = true
  try {
    await connectionAgreement.loadCurrentInstance()
  } catch (error) {
    console.error('Ошибка обновления статуса:', error)
  } finally {
    isChecking.value = false
  }
}
</script>

<template lang="pug">
StepFrame(
  title="Совет проверяет заявку"
  lead="Домен готов, соглашение подписано — с вашей стороны всё сделано. Заявку на подключение рассматривает совет. Как только подтверждение появится, установка начнётся сама — страницу можно закрыть и вернуться позже."
  :can-back="false"
  :has-next="false"
)
  .approval-step__status
    BaseChip(:variant="isApproved ? 'pos' : 'warn'")
      q-icon(:name="isApproved ? 'check' : 'schedule'" size="12px").q-mr-xs
      span {{ isApproved ? 'Подключение подтверждено' : 'Ждём подтверждения совета' }}
    BaseButton(
      v-if="!isApproved"
      variant="secondary"
      size="sm"
      type="button"
      :loading="isChecking"
      @click="refreshStatus"
    ) Проверить сейчас
</template>

<style scoped>
.approval-step__status {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-3);
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import {
  BaseButton,
  BaseCard,
  BaseChip,
} from 'src/shared/ui/base'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'

const connectionAgreement = useConnectionAgreementStore()
const instance = computed(() => connectionAgreement.currentInstance)

const isApproved = computed(() => instance.value?.blockchain_status === 'active')

const refreshStatus = async () => {
  try {
    await connectionAgreement.loadCurrentInstance()
  } catch (error) {
    console.error('Ошибка обновления статуса:', error)
  }
}
</script>

<template lang="pug">
.approval-step
  BaseCard(
    title="Подтверждение союза"
    subtitle="Технические подготовки завершены. Цифровой Кооператив готов к установке и подключению к платформе Кооперативной Экономики."
  )
    p.approval-step__body
      | Ждём подтверждения от представителя союза о готовности произвести стандартизацию документооборота. Как только оно появится — установка продолжится автоматически.

    .approval-step__status
      BaseChip(:variant="isApproved ? 'pos' : 'warn'")
        span {{ isApproved ? 'Подтверждено союзом' : 'Ожидаем подтверждения союза' }}
      BaseButton(
        v-if="!isApproved"
        variant="ghost"
        size="sm"
        type="button"
        @click="refreshStatus"
      ) Проверить
</template>

<style scoped>
.approval-step {
  max-width: 640px;
}
.approval-step__body {
  margin: 0;
  color: var(--p-ink-1);
  font-size: var(--p-fs-body);
  line-height: var(--p-lh-body);
}
.approval-step__status {
  display: inline-flex;
  align-items: center;
  gap: var(--p-3);
  margin-top: var(--p-4);
}
</style>

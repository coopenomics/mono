<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { BaseButton, BaseChip } from 'src/shared/ui/base'
import { DataRow } from 'src/shared/ui/domain'
import { useConnectionAgreementStore, CONNECTION_STEP } from 'src/entities/ConnectionAgreement'
import { useProviderSubscriptions } from 'src/features/Provider/model'
import StepFrame from '../ui/StepFrame.vue'

const connectionAgreement = useConnectionAgreementStore()
const { loadCurrentInstance } = connectionAgreement
const { SERVER_IP } = useProviderSubscriptions()

const coop = computed(() => connectionAgreement.coop)
const instance = computed(() => connectionAgreement.currentInstance)
const isDelegated = computed(() => !!instance.value?.is_delegated)
const isChecking = ref(false)

onMounted(async () => {
  if (!coop.value) {
    try {
      await connectionAgreement.reloadCooperative()
    } catch (error) {
      console.error('Ошибка загрузки кооператива:', error)
    }
  }
})

const handleBack = () => connectionAgreement.setCurrentStep(CONNECTION_STEP.agreement)

const handleContinue = () => {
  if (!isDelegated.value) return
  connectionAgreement.setCurrentStep(CONNECTION_STEP.approval)
}

const handleReload = async () => {
  isChecking.value = true
  try {
    await loadCurrentInstance()
  } catch (error) {
    console.error('Ошибка обновления инстанса:', error)
  } finally {
    isChecking.value = false
  }
}
</script>

<template lang="pug">
StepFrame(
  title="Направьте домен на сервер платформы"
  lead="Чтобы адрес кооператива открывал вашу копию платформы, домен нужно направить на сервер, где она будет установлена. Это делается в панели управления доменом у регистратора — там, где вы его покупали."
  :next-disabled="!isDelegated"
  @back="handleBack"
  @next="handleContinue"
)
  ol.dns-step__how
    li Откройте панель управления доменом у регистратора и найдите раздел DNS-записей.
    li Добавьте запись типа
      |  
      span.t-mono A
      |  для имени ниже со значением IP-адреса ниже. Если такая запись уже есть — замените значение.
    li Сохраните. Обычно запись вступает в силу за несколько минут, но у некоторых регистраторов это занимает до суток — мы проверяем автоматически и продолжим сами.

  .dns-step__values
    DataRow(label="Имя записи" :value="coop?.announce" mono copyable)
    DataRow(label="Значение (IP-адрес)" :value="SERVER_IP" mono copyable)

  .dns-step__status
    BaseChip(:variant="isDelegated ? 'pos' : 'warn'")
      q-icon(:name="isDelegated ? 'check' : 'schedule'" size="12px").q-mr-xs
      span {{ isDelegated ? 'Домен направлен на сервер' : 'Ждём, когда запись вступит в силу' }}
    BaseButton(
      v-if="!isDelegated"
      variant="secondary"
      size="sm"
      type="button"
      :loading="isChecking"
      @click="handleReload"
    ) Проверить сейчас
</template>

<style scoped>
.dns-step__how {
  margin: 0;
  padding-left: var(--p-5);
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  font-size: var(--p-fs-body);
  line-height: var(--p-lh-body);
  color: var(--p-ink-1);
}
.dns-step__values {
  margin-top: var(--p-4);
  border: 1px solid var(--p-line-1);
  border-radius: var(--p-r-md);
  padding: 0 var(--p-4);
  background: var(--p-surface-2);
}
.dns-step__status {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-3);
  margin-top: var(--p-4);
}
</style>

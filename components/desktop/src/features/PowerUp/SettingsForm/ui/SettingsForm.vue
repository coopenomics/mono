<template lang="pug">
.powerup-settings
  BaseCard(:title="$t('powerUp.settingsForm.title')" :subtitle="$t('powerUp.settingsForm.subtitle')")
    BaseForm(@submit="onSubmit")
      .powerup-settings__grid
        BaseInput(
          v-model.number="form.dailyPackageSize"
          :label="$t('powerUp.settingsForm.quotaLabel')"
          type="number"
          :hint="$t(`powerUp.settingsForm.quotaHint`, { symbol, resourceSymbol: symbol })"
          :rules="[(v) => v >= 5 || $t(`powerUp.settingsForm.quotaRule`, { symbol })]"
        )
        BaseInput(
          v-model.number="form.thresholds.cpu"
          :label="$t('powerUp.settingsForm.cpuLabel')"
          type="number"
          :rules="[(v) => v >= 0 && v <= 100 || $t('powerUp.settingsForm.percentRule')]"
        )
        BaseInput(
          v-model.number="form.thresholds.net"
          :label="$t('powerUp.settingsForm.netLabel')"
          type="number"
          :rules="[(v) => v >= 0 && v <= 100 || $t('powerUp.settingsForm.percentRule')]"
        )
        BaseInput(
          v-model.number="form.thresholds.ram"
          :label="$t('powerUp.settingsForm.ramLabel')"
          type="number"
          :rules="[(v) => v >= 0 && v <= 100 || $t('powerUp.settingsForm.percentRule')]"
        )
        BaseInput(
          v-model.number="form.cooldownMinutes"
          :label="$t('powerUp.settingsForm.cooldownLabel')"
          type="number"
          :rules="[(v) => v >= 0 || $t('powerUp.settingsForm.nonNegativeRule')]"
        )
        BaseInput(
          v-model.number="form.dailyAxonCap"
          :label="$t(`powerUp.settingsForm.dailyAxonCapLabel`, { symbol })"
          type="number"
          :rules="[(v) => v >= 0 || $t('powerUp.settingsForm.nonNegativeRule')]"
        )
        BaseInput(
          v-model.number="form.dailyPackageCap"
          :label="$t('powerUp.settingsForm.dailyPackageCapLabel')"
          type="number"
          :rules="[(v) => v >= 0 || $t('powerUp.settingsForm.nonNegativeRule')]"
        )
        BaseInput(
          v-model.number="form.monthlyRubCap"
          :label="$t(`powerUp.settingsForm.monthlyCapLabel`, { symbol: governSymbol })"
          type="number"
          :rules="[(v) => v >= 0 || $t('powerUp.settingsForm.nonNegativeRule')]"
        )
      .powerup-settings__actions
        BaseButton(type="submit" :label="$t('common.action.save')" :loading="isSaving" color="primary")
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue'
import { BaseButton, BaseCard, BaseForm, BaseInput } from 'src/shared/ui/base'
import { useSystemStore } from 'src/entities/System/model'

interface PowerupSettingsValue {
  dailyPackageSize: number
  thresholds: { cpu: number; net: number; ram: number }
  cooldownMinutes: number
  dailyAxonCap: number
  dailyPackageCap: number
  monthlyRubCap: number
}

const props = defineProps<{
  initial?: PowerupSettingsValue
  isSaving?: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', value: PowerupSettingsValue): void
}>()

const { info } = useSystemStore()
const symbol = computed(() => info.symbols?.root_symbol || 'AXON')
// Символ валюты членских взносов — из config системы (на случай смены символа).
const governSymbol = computed(() => info.symbols?.root_govern_symbol || 'RUB')

const form = reactive<PowerupSettingsValue>({
  dailyPackageSize: props.initial?.dailyPackageSize ?? 5,
  thresholds: {
    cpu: props.initial?.thresholds?.cpu ?? 70,
    net: props.initial?.thresholds?.net ?? 70,
    ram: props.initial?.thresholds?.ram ?? 70,
  },
  cooldownMinutes: props.initial?.cooldownMinutes ?? 5,
  dailyAxonCap: props.initial?.dailyAxonCap ?? 50,
  dailyPackageCap: props.initial?.dailyPackageCap ?? 10,
  monthlyRubCap: props.initial?.monthlyRubCap ?? 5000,
})

function onSubmit(): void {
  emit('submit', { ...form, thresholds: { ...form.thresholds } })
}
</script>

<style scoped>
.powerup-settings__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--p-3);
}
.powerup-settings__actions {
  margin-top: var(--p-4);
  display: flex;
  justify-content: flex-end;
}
</style>

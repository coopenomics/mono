<template lang="pug">
.powerup-settings
  BaseCard(title="Настройки PowerUp" subtitle="Размер пакета, пороги CPU/NET/RAM, лимиты Epic 13")
    BaseForm(@submit="onSubmit")
      .powerup-settings__grid
        BaseInput(
          v-model.number="form.dailyPackageSize"
          label="Размер минимальной квоты"
          type="number"
          :hint="`Минимум 5 ${symbol}. Каждое срабатывание триггера докупает столько ${symbol}`"
          :rules="[(v) => v >= 5 || `Минимум 5 ${symbol}`]"
        )
        BaseInput(
          v-model.number="form.thresholds.cpu"
          label="Порог CPU (%)"
          type="number"
          :rules="[(v) => v >= 0 && v <= 100 || 'От 0 до 100']"
        )
        BaseInput(
          v-model.number="form.thresholds.net"
          label="Порог NET (%)"
          type="number"
          :rules="[(v) => v >= 0 && v <= 100 || 'От 0 до 100']"
        )
        BaseInput(
          v-model.number="form.thresholds.ram"
          label="Порог RAM (%)"
          type="number"
          :rules="[(v) => v >= 0 && v <= 100 || 'От 0 до 100']"
        )
        BaseInput(
          v-model.number="form.cooldownMinutes"
          label="Cooldown между докупками (мин)"
          type="number"
          :rules="[(v) => v >= 0 || 'Не отрицательное']"
        )
        BaseInput(
          v-model.number="form.dailyAxonCap"
          :label="`Суточный потолок ${symbol}`"
          type="number"
          :rules="[(v) => v >= 0 || 'Не отрицательное']"
        )
        BaseInput(
          v-model.number="form.dailyPackageCap"
          label="Суточный лимит докупок (шт.)"
          type="number"
          :rules="[(v) => v >= 0 || 'Не отрицательное']"
        )
        BaseInput(
          v-model.number="form.monthlyRubCap"
          label="Месячный потолок RUB"
          type="number"
          :rules="[(v) => v >= 0 || 'Не отрицательное']"
        )
      .powerup-settings__actions
        BaseButton(type="submit" label="Сохранить" :loading="isSaving" color="primary")
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

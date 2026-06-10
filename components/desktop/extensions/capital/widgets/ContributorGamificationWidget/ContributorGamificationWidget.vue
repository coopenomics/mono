<template lang="pug">
//- Объединённый бейдж уровня и энергии: вариант чипа отражает запас энергии.
//- Мигающий красный «тик» влево — энергия затухает со временем, и требуемый
//- для следующего уровня взнос растёт.
BaseChip(:variant='energyVariant')
  q-icon.q-mr-xs(name='local_fire_department', size='14px')
  | Уровень {{ Number(contributorStore.self?.level) || 1 }} ·
  q-icon.energy-decay-tick(name='arrow_left', color='negative', size='16px')
  | {{ currentEnergy.toFixed(0) }}%
  q-tooltip До следующего уровня: {{ nextLevelRequirement }} {{ info.symbols.root_govern_symbol }}
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model';
import { useConfigStore } from 'app/extensions/capital/entities/Config/model';
import { useSystemStore } from 'src/entities/System/model';
import { BaseChip } from 'src/shared/ui/base';
import type { BaseChipVariant } from 'src/shared/ui/base/BaseChip/BaseChip.types';

const contributorStore = useContributorStore();
const configStore = useConfigStore();
const { info } = useSystemStore();

// Таймер для обновления энергии каждую секунду
let energyUpdateTimer: ReturnType<typeof window.setInterval> | null = null;

// Текущая энергия с учетом decay
const currentEnergy = ref(0);

// Вариант чипа по запасу энергии: высокая / средняя / на исходе
const energyVariant = computed<BaseChipVariant>(() => {
  if (currentEnergy.value >= 90) return 'pos';
  if (currentEnergy.value >= 25) return 'warn';
  return 'neg';
});

// Порог вклада для уровня (из GAMIFICATION.md)
const calculateLevelRequirement = (level: number): number => {
  if (!configStore.state?.config) return 0;
  const config = configStore.state.config;
  return config.level_depth_base * Math.pow(config.level_growth_coefficient, level - 1);
};

// Функция расчета снижения энергии со временем (из GAMIFICATION.md)
const calculateEnergyDecay = (lastUpdate: Date, currentTime: Date): { daysPassed: number; decayRate: number } => {
  if (!configStore.state?.config) return { daysPassed: 0, decayRate: 0 };
  const config = configStore.state.config;

  // Количество секунд с момента последнего обновления
  const secondsPassed = (currentTime.getTime() - lastUpdate.getTime()) / 1000;

  // Перевод в дни
  const daysPassed = secondsPassed / 86400;

  // Расчет decay (decay_rate_per_day хранится как десятичная дробь, например 0.02 для 2%)
  // ВАЖНО: decay считается как процент от ТЕКУЩЕЙ энергии (как в контракте)
  const decayRate = config.energy_decay_rate_per_day; // Уже в десятичном формате

  return { daysPassed, decayRate }; // Возвращаем параметры для расчета
};

// Обновление энергии в реальном времени
const updateCurrentEnergy = () => {
  if (!contributorStore.self || !configStore.state?.config) return;

  const contributor = contributorStore.self;
  if (!contributor.last_energy_update) return;

  const lastUpdate = new Date(contributor.last_energy_update); // last_energy_update приходит как ISO строка
  const now = new Date();

  const { daysPassed, decayRate } = calculateEnergyDecay(lastUpdate, now);
  const baseEnergy = Number(contributor.energy) || 0;

  // Применяем процентное затухание энергии (как в контракте)
  const decay = baseEnergy * decayRate * daysPassed;
  const newEnergy = Math.max(0, baseEnergy - decay);

  currentEnergy.value = newEnergy;
};

// Сумма для достижения следующего уровня (текущий уровень до 100%)
const nextLevelRequirement = computed(() => {
  if (!contributorStore.self || !configStore.state?.config) return '0';

  const contributor = contributorStore.self;
  const currentLevel = Number(contributor.level) || 1;

  // Используем текущую энергию с учетом decay
  const currentEnergyValue = currentEnergy.value;

  // Сколько энергии нужно для достижения 100%
  const energyNeeded = Math.max(0, 100 - currentEnergyValue);

  // Порог для текущего уровня (минимальные единицы вклада)
  const currentLevelRequirement = calculateLevelRequirement(currentLevel);

  // Сумма для достижения 100% энергии на текущем уровне
  // Учитываем коэффициент прироста энергии
  const energyGainCoefficient = configStore.state.config.energy_gain_coefficient || 1.0;
  const amountNeededInMinimalUnits = (energyNeeded / 100) * currentLevelRequirement / energyGainCoefficient;

  // Переводим из минимальных единиц (с точностью 4 знака) в RUB
  const amountNeeded = amountNeededInMinimalUnits / 10000;

  return amountNeeded.toFixed(4);
});

// Запуск таймера при монтировании
onMounted(() => {
  updateCurrentEnergy(); // Первичное обновление

  // Обновление каждую секунду
  energyUpdateTimer = setInterval(() => {
    updateCurrentEnergy();
  }, 1000);
});

// Очистка таймера при размонтировании
onUnmounted(() => {
  if (energyUpdateTimer) {
    clearInterval(energyUpdateTimer);
  }
});
</script>

<style scoped>
.energy-decay-tick {
  animation: energy-decay-blink 1s ease-in-out infinite;
}

@keyframes energy-decay-blink {
  0%,
  50% {
    opacity: 1;
  }
  51%,
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .energy-decay-tick {
    animation: none;
  }
}
</style>


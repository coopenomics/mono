<script setup lang="ts">
import { computed } from 'vue'
import type { ITariff } from './types'

const props = defineProps<{
  tariff: ITariff
  selected?: boolean
  disabled?: boolean
}>()

const emits = defineEmits<{
  select: [tariffId: string]
  deselect: [tariffId: string]
}>()

const isSelected = computed(() => props.selected)
const isDisabled = computed(() => props.disabled)

const cardClasses = computed(() => {
  const classes = ['tariff-card', 'cursor-pointer', 'transition-all', 'duration-200']

  if (isSelected.value) {
    classes.push('tariff-selected')
  }

  if (isDisabled.value) {
    classes.push('tariff-disabled')
  }

  return classes.join(' ')
})

const handleSelect = () => {
  if (!isDisabled.value) {
    // Если тариф уже выбран, снимаем выбор, иначе выбираем
    if (isSelected.value) {
      emits('deselect', props.tariff.id)
    } else {
      emits('select', props.tariff.id)
    }
  }
}
</script>

<template lang="pug">
div.tariff-card-container
  .tariff-card(
    :class="cardClasses"
    @click="handleSelect"
  )
    .tariff-header
      .tariff-checkmark(v-if="isSelected")
        q-icon(name="check_circle" size="24px" color="white")
      .tariff-title
        h6.text-h6 {{ tariff.name }}

    .tariff-content
      p.text-body2.text-grey-7.q-mb-md.text-center {{ tariff.description }}

      .tariff-features
        .feature-item(v-for="feature in tariff.features" :key="feature")
          q-icon(name="check" size="16px" color="positive").q-mr-xs
          span {{ feature }}

      template(v-if="tariff.additionalCosts && tariff.additionalCosts.length")
        .tariff-additional.q-mt-md
          p.text-subtitle2.text-grey-8 {{ $t('connectionAgreementStepper.tariffCard.additionalCostsTitle') }}
          .additional-item(v-for="cost in tariff.additionalCosts" :key="cost")
            q-icon(name="add_circle_outline" size="14px" color="info").q-mr-xs
            span.text-caption {{ cost }}

    .tariff-footer
      .tariff-price
        .price-display {{ tariff.price }}
        .price-period(v-if="tariff.price !== $t('connectionAgreementStepper.tariffCard.free')") {{ $t('connectionAgreementStepper.tariffCard.perMonthSuffix') }}
      .select-hint.text-caption.text-grey-6
        | {{ $t('connectionAgreementStepper.tariffCard.selectHint') }}
</template>

<style scoped>
.tariff-card-container {
  position: relative;
  height: 100%;
}

.tariff-card {
  position: relative;
  height: 100%;
  min-height: 360px; /* Уменьшенная минимальная высота */
  padding: 24px;
  border-radius: 16px;
  border: 2px solid #f0f0f0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tariff-card:hover:not(.tariff-disabled):not(.tariff-selected) {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  border-color: #e0e0e0;
}

.tariff-selected {
  border-color: var(--q-accent);
  background: linear-gradient(135deg, rgba(25, 118, 210, 0.05) 0%, rgba(25, 118, 210, 0.02) 100%);
  box-shadow:
    0 8px 32px rgba(25, 118, 210, 0.2),
    0 0 0 1px var(--q-accent);
  transform: translateY(-2px);
}

.tariff-disabled {
  opacity: 0.6;
  cursor: not-allowed !important;
  pointer-events: none;
}

.tariff-header {
  position: relative;
  height: 40px; /* Фиксированная высота для предотвращения прыжков */
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.tariff-checkmark {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%) scale(0.8);
  background: var(--q-accent);
  border-radius: 50%;
  padding: 4px;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.tariff-selected .tariff-checkmark {
  opacity: 1;
  transform: translateY(-50%) scale(1);
}

.tariff-title {
  text-align: center;
  margin-right: 36px; /* Отступ для иконки */
}

.tariff-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.tariff-features {
  flex: 1;
  margin-bottom: 16px;
}

.feature-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  padding: 4px 0;
  transition: color 0.2s ease;
}

.feature-item:hover {
  color: var(--q-primary);
}

.tariff-additional {
  border-top: 1px solid #f5f5f5;
  padding-top: 16px;
}

.additional-item {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
  color: #666;
  font-size: 12px;
}

.tariff-footer {
  position: relative;
  height: 80px; /* Увеличенная высота для богатого оформления */
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 20px 32px 20px 12px;
}

.tariff-price {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  text-align: right;
}

.price-display {
  font-size: 36px;
  font-weight: 600;
  letter-spacing: -1px;
  background: linear-gradient(135deg, var(--q-accent) 0%, rgba(25, 118, 210, 0.8) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  line-height: 1;
  text-shadow: 0 2px 4px rgba(25, 118, 210, 0.3);
}

.price-period {
  font-size: 12px;
  font-weight: 400;
  color: #888;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  opacity: 0.8;
}

.select-hint {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  color: #999;
  font-style: italic;
  opacity: 0;
  animation: pulse 2s infinite;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.tariff-card:not(.tariff-selected):not(.tariff-disabled) .select-hint {
  opacity: 1;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

/* Responsive adjustments */
@media (max-width: 599px) {
  .tariff-card {
    padding: 16px;
  }

  .tariff-header {
    margin-bottom: 12px;
  }

  .tariff-title h6 {
    font-size: 1rem;
  }
}
</style>

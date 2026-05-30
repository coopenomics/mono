<script setup lang="ts">
import { computed } from 'vue'
import type { ITariff } from './types'

const props = defineProps<{
  tariff: ITariff
  selected?: boolean
  disabled?: boolean
  groupName?: string
}>()

const emits = defineEmits<{
  select: [tariffId: string]
  deselect: [tariffId: string]
}>()

const isSelected = computed(() => !!props.selected)
const isDisabled = computed(() => !!props.disabled)
const isFree = computed(() => props.tariff.price === 'Бесплатно')

const onChange = () => {
  if (isDisabled.value) return
  emits('select', props.tariff.id)
}

const onClick = () => {
  if (isDisabled.value) return
  if (isSelected.value) emits('deselect', props.tariff.id)
}
</script>

<template lang="pug">
label.tariff-card(
  :class="{ 'is-selected': isSelected, 'is-disabled': isDisabled }"
  @click="onClick"
)
  input.tariff-card__input(
    type="radio"
    :name="groupName || 'tariff'"
    :value="tariff.id"
    :checked="isSelected"
    :disabled="isDisabled"
    @change="onChange"
  )
  .tariff-card__head
    span.tariff-card__box(aria-hidden="true")
    .tariff-card__title {{ tariff.name }}

  p.tariff-card__sub.t-sm.t-muted(v-if="tariff.description") {{ tariff.description }}

  ul.tariff-card__list
    li.tariff-card__item(v-for="feature in tariff.features" :key="feature") {{ feature }}

  .tariff-card__foot
    .tariff-card__price
      span.tariff-card__price-value.t-num {{ tariff.price }}
      span.tariff-card__price-period(v-if="!isFree") &nbsp;/ мес
</template>

<style scoped>
.tariff-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  padding: var(--p-6);
  border: 1px solid var(--p-line-1);
  border-radius: var(--p-r-lg);
  background: var(--p-surface);
  box-shadow: var(--p-shadow-card);
  cursor: pointer;
  transition:
    border-color var(--p-dur-fast) var(--p-ease-standard),
    background var(--p-dur-fast) var(--p-ease-standard),
    box-shadow var(--p-dur-fast) var(--p-ease-standard);
}
.tariff-card:hover:not(.is-disabled):not(.is-selected) {
  border-color: var(--p-line-2);
  box-shadow: var(--p-shadow-pop);
}
.tariff-card.is-selected {
  border-color: var(--p-primary);
  background: var(--p-primary-soft);
  box-shadow: var(--p-shadow-card);
}
.tariff-card.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.tariff-card__input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.tariff-card__input:focus-visible ~ .tariff-card__head .tariff-card__box {
  box-shadow: var(--p-focus-ring);
}

.tariff-card__head {
  display: flex;
  align-items: center;
  gap: var(--p-3);
}
.tariff-card__title {
  font-size: var(--p-fs-h2);
  line-height: var(--p-lh-h2);
  letter-spacing: var(--p-ls-h2);
  font-weight: 600;
  color: var(--p-ink);
}
.tariff-card__box {
  position: relative;
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  border: 1.5px solid var(--p-line-2);
  border-radius: var(--p-r-pill);
  background: var(--p-surface);
  transition: border-color var(--p-dur-fast) var(--p-ease-standard);
}
.tariff-card.is-selected .tariff-card__box {
  border-color: var(--p-primary);
}
.tariff-card.is-selected .tariff-card__box::after {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: var(--p-r-pill);
  background: var(--p-primary);
}

.tariff-card__sub {
  margin: 0;
}

.tariff-card__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.tariff-card__item {
  position: relative;
  padding: var(--p-3) 0;
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-1);
  border-bottom: 1px solid var(--p-line);
}
.tariff-card__item:last-child {
  border-bottom: 0;
}

.tariff-card__foot {
  margin-top: auto;
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
.tariff-card__price {
  display: inline-flex;
  align-items: baseline;
  gap: var(--p-1);
  color: var(--p-ink);
}
.tariff-card__price-value {
  font-family: var(--p-mono);
  font-size: var(--p-fs-h1);
  line-height: var(--p-lh-h1);
  letter-spacing: var(--p-ls-h1);
  font-weight: 600;
}
.tariff-card__price-period {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}
</style>

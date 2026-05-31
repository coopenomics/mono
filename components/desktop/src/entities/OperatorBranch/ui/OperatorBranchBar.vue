<script lang="ts" setup>
import { computed } from 'vue'
import { BaseBadge, BaseSelect } from 'src/shared/ui/base'
import type { BaseBadgeVariant, BaseSelectOption } from 'src/shared/ui/base'
import { useOperatorBranchStore } from '../model'

/**
 * Шапка-контекст Стола ПВЗ: показывает активный кооперативный участок
 * оператора (название + фактический адрес + статус ПВЗ) без служебных кодов.
 * Если оператор работает на нескольких КУ — селектор переключения активного.
 */
const store = useOperatorBranchStore()

const active = computed(() => store.activeBranch)

const title = computed(
  () => active.value?.name || active.value?.address || 'Пункт выдачи заказов',
)
const subtitle = computed(() => (active.value?.name ? active.value.address : ''))

const status = computed<{ label: string; variant: BaseBadgeVariant }>(() => {
  const d = active.value?.details
  if (!d) return { label: 'КУ не подключён как ПВЗ', variant: 'warn' }
  return d.status === 'ACTIVE'
    ? { label: 'ПВЗ активен', variant: 'pos' }
    : { label: 'ПВЗ деактивирован', variant: 'neutral' }
})

const options = computed<BaseSelectOption[]>(() =>
  store.branches.map((b) => ({ value: b.braname, label: b.name || b.address || 'Участок' })),
)
</script>

<template lang="pug">
.op-branch-bar(v-if='store.isOperator')
  q-icon.op-branch-bar__icon(name='storefront', size='24px')
  //- Несколько участков: селектор — основной идентификатор. Адрес кладём
  //- в hint самого поля (занимает уже зарезервированное место), без отдельной
  //- строки — иначе двойной зазор. Крупный заголовок не показываем: название
  //- КУ дублировалось бы в селекте.
  BaseSelect.op-branch-bar__select(
    v-if='store.hasMultiple',
    :model-value='store.activeBraname',
    :options='options',
    label='Участок',
    :hint='subtitle',
    @update:model-value='store.setActive(String($event))'
  )
  //- Один участок: выбора нет — показываем текстом.
  .op-branch-bar__info(v-else)
    .op-branch-bar__title {{ title }}
    .op-branch-bar__sub(v-if='subtitle') {{ subtitle }}
  BaseBadge.op-branch-bar__status(:variant='status.variant') {{ status.label }}
</template>

<style scoped lang="scss">
.op-branch-bar {
  display: flex;
  align-items: center;
  gap: var(--p-3, 12px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 8px);
  background: var(--p-surface-2);
  margin-bottom: var(--p-4, 16px);

  &__icon {
    color: var(--p-ink-3);
    flex-shrink: 0;
  }

  &__info {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
  }

  &__title {
    font-weight: 600;
    font-size: 1.0625rem;
    line-height: 1.3;
  }

  &__sub {
    color: var(--p-ink-3);
    font-size: 0.875rem;
  }

  &__select {
    min-width: 220px;
    max-width: 360px;
    // hint уже резервирует низ — гасим внешний margin q-field, чтобы бар не
    // распирало лишним зазором под полем.
    :deep(.q-field__bottom) {
      padding-top: var(--p-1, 4px);
    }
  }

  // Бейдж — к правому краю в обоих режимах (в одиночном его толкает __info).
  &__status {
    margin-left: auto;
    flex-shrink: 0;
  }
}
</style>

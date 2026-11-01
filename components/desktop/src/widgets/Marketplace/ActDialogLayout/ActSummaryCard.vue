<template lang="pug">
//- Сводка акта справа от позиций: подпись карточки, факты (сколько позиций,
//- ТТН), строки расчёта (стоимость, обеспечительная часть, возврат), итог
//- крупно и действия во всю ширину. Одна на приёмку, подпись поставщика и
//- выдачу пайщику.
BaseCard.act-summary
  .act-summary__eyebrow(v-if='eyebrow') {{ eyebrow }}

  .act-summary__facts(v-if='facts.length')
    DataRow(
      v-for='f in facts',
      :key='f.label',
      align='spread',
      :label='f.label',
      :value='f.value'
    )

  slot

  .act-summary__lines(v-if='lines.length')
    .act-summary__line(v-for='l in lines', :key='l.label')
      .act-summary__line-label
        | {{ l.label }}
        .act-summary__line-note(v-if='l.note') {{ l.note }}
      .act-summary__line-value {{ l.value }}

  .act-summary__total(v-if='totalLabel')
    .act-summary__total-label {{ totalLabel }}
    .act-summary__total-amount {{ total }}

  .act-summary__actions(v-if='$slots.actions')
    slot(name='actions')
</template>

<script setup lang="ts">
import { BaseCard } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';

withDefaults(
  defineProps<{
    /** Подпись карточки: «Акт приёмки». */
    eyebrow?: string;
    /** Факты строками «подпись — значение». */
    facts?: Array<{ label: string; value: string }>;
    /** Строки расчёта над итогом; `note` — мелкая строка под подписью. */
    lines?: Array<{ label: string; value: string; note?: string }>;
    totalLabel?: string;
    /** Итог, уже отформатированный: «100,00 ₽». */
    total?: string;
  }>(),
  { eyebrow: '', facts: () => [], lines: () => [], totalLabel: '', total: '' },
);
</script>

<style scoped lang="scss">
.act-summary {
  :deep(.base-card__body) {
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
  }

  &__eyebrow {
    font-size: var(--p-fs-eyebrow, 11px);
    font-weight: 600;
    letter-spacing: var(--p-ls-eyebrow, 0.08em);
    text-transform: uppercase;
    color: var(--p-ink-3);
  }

  &__facts,
  &__lines {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  // Подпись переносится, сумма — никогда.
  &__line {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--p-4, 16px);
    font-size: var(--p-fs-body-sm, 13px);
  }

  &__line-label {
    min-width: 0;
    color: var(--p-ink-2);
  }

  &__line-note {
    margin-top: 2px;
    color: var(--p-ink-3);
  }

  &__line-value {
    flex: 0 0 auto;
    white-space: nowrap;
    color: var(--p-ink);
    font-variant-numeric: tabular-nums;
  }

  &__total {
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
    padding-top: var(--p-4, 16px);
    border-top: 1px solid var(--p-line);
  }

  &__total-label {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
  }

  &__total-amount {
    font-size: var(--p-fs-h1, 24px);
    font-weight: 700;
    letter-spacing: var(--p-ls-h1, -0.018em);
    color: var(--p-ink);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  &__actions {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }
}
</style>

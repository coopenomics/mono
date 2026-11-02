<script setup lang="ts">
import { computed } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { BaseBadge, BaseCard, type BaseBadgeVariant } from 'src/shared/ui/base';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { formatDateToLocalTimezone } from 'src/shared/lib/utils/dates';
import { t } from 'src/shared/i18n';
import type { OrderSecurePart } from './OrderSecurePartCard.types';

/**
 * Обеспечительная часть паевого взноса по заказу (99D-18): сколько, в каком
 * состоянии и когда станет членским взносом участка. Одна карточка в заказе
 * пайщика и в реестре заказов администратора и участка — без отдельной
 * страницы учёта: обеспечительная часть принадлежит заказу, её срок задаёт
 * гарантия этого заказа.
 */

const props = defineProps<{ part: OrderSecurePart }>();

const STATE: Record<Zeus.MarketplaceSecurePartState, { label: string; variant: BaseBadgeVariant }> = {
  [Zeus.MarketplaceSecurePartState.RESERVED]: { label: t('marketplace.orderSecurePart.state.reserved'), variant: 'neutral' },
  [Zeus.MarketplaceSecurePartState.DUE]: { label: t('marketplace.orderSecurePart.state.due'), variant: 'info' },
  [Zeus.MarketplaceSecurePartState.SUSPENDED]: { label: t('marketplace.orderSecurePart.state.suspended'), variant: 'warn' },
  [Zeus.MarketplaceSecurePartState.CHARGED]: { label: t('marketplace.orderSecurePart.state.charged'), variant: 'pos' },
  [Zeus.MarketplaceSecurePartState.RETURNED]: { label: t('marketplace.orderSecurePart.state.returned'), variant: 'neutral' },
};

const state = computed(() => STATE[props.part.state]);

/**
 * Дата без времени, если момент приходится на полночь (первое число в
 * работе), и со временем — если нет: на стенде «месяц» длится минуты, и одна
 * дата не сказала бы, когда ждать списания.
 */
function moment(value: unknown): string {
  const date = formatDateToLocalTimezone(value, 'DD.MM.YYYY');
  const time = formatDateToLocalTimezone(value, 'HH:mm');
  if (!date) return '';
  return time && time !== '00:00' ? `${date} ${time}` : date;
}

/** Строка под суммой: только новое о состоянии — дата или причина. */
const note = computed(() => {
  switch (props.part.state) {
    case Zeus.MarketplaceSecurePartState.DUE:
      return props.part.charge_at
        ? t('marketplace.orderSecurePart.note.dueAt', { date: moment(props.part.charge_at) })
        : t('marketplace.orderSecurePart.note.due');
    case Zeus.MarketplaceSecurePartState.SUSPENDED:
      return t('marketplace.orderSecurePart.note.suspended');
    case Zeus.MarketplaceSecurePartState.CHARGED:
      return props.part.settled_at
        ? t('marketplace.orderSecurePart.note.chargedAt', { date: moment(props.part.settled_at) })
        : t('marketplace.orderSecurePart.note.charged');
    case Zeus.MarketplaceSecurePartState.RETURNED:
      return t('marketplace.orderSecurePart.note.returned');
    default:
      return t('marketplace.orderSecurePart.note.reserved');
  }
});
</script>

<template lang="pug">
BaseCard.order-secure-part
  template(#head)
    .t-h3 {{ $t('marketplace.orderSecurePart.title') }}
  .order-secure-part__row
    .order-secure-part__amount {{ formatAsset2Digits(part.amount) }} ₽
    BaseBadge(:variant='state.variant') {{ state.label }}
  .order-secure-part__note {{ note }}
</template>

<style scoped lang="scss">
.order-secure-part {
  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
  }

  &__amount {
    font-size: var(--p-fs-h2, 18px);
    font-weight: 700;
    color: var(--p-ink);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  &__note {
    margin-top: var(--p-2, 8px);
    font-size: var(--p-fs-body-sm, 13px);
    line-height: 1.45;
    color: var(--p-ink-2);
  }
}
</style>

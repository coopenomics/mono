<script lang="ts" setup>
import { BaseButton, BaseDialog } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { formatAsset2Digits } from 'src/shared/lib/utils';
import type { MarketplaceSupplierClaimView } from '../api';

/**
 * Несогласие поставщика с претензией (99D-13). В цепь ничего не пишется —
 * по умолчанию поставщик и так не согласен, сумма остаётся на кошельке
 * непризнанных претензий. Диалог показывает контакты участка, где лежит
 * имущество: поставщик связывается с оператором и разбирается на месте.
 */

defineProps<{
  modelValue: boolean;
  claim: MarketplaceSupplierClaimView | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
}>();
</script>

<template lang="pug">
BaseDialog(
  :model-value='modelValue',
  title='Не согласны с претензией?',
  @update:model-value='(v: boolean) => emit("update:modelValue", v)'
)
  .mp-claim-disagree(v-if='claim')
    p.mp-claim-disagree__lead
      | Претензия на {{ formatAsset2Digits(claim.amount) }} ₽ остаётся непризнанной — из ваших
      | выплат она не удерживается. Свяжитесь с кооперативным участком, где принято
      | имущество, и разберитесь с оператором на месте: имущество можно осмотреть и
      | забрать там же.
    DataRow(label='Участок', :value='claim.branch_contacts.name || claim.delivery_braname')
    DataRow(v-if='claim.branch_contacts.address', label='Адрес', :value='claim.branch_contacts.address')
    DataRow(v-if='claim.branch_contacts.phone', label='Телефон', :value='claim.branch_contacts.phone')
    DataRow(v-if='claim.branch_contacts.email', label='Почта', :value='claim.branch_contacts.email')
    DataRow(
      v-if='claim.branch_contacts.operator_name || claim.branch_contacts.operator_account',
      label='Оператор, принявший имущество',
      :value='claim.branch_contacts.operator_name || claim.branch_contacts.operator_account'
    )
    .mp-claim-disagree__actions
      BaseButton(variant='primary', size='sm', @click='emit("update:modelValue", false)') Понятно
</template>

<style scoped lang="scss">
.mp-claim-disagree {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);

  &__lead {
    margin: 0;
    color: var(--p-ink-2);
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    padding-top: var(--p-2, 8px);
  }
}
</style>

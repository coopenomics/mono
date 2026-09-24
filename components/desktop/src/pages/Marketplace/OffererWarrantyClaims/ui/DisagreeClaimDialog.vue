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
  :title='$t("marketplace.disagreeClaimDialog.dialogTitle")',
  @update:model-value='(v: boolean) => emit("update:modelValue", v)'
)
  .mp-claim-disagree(v-if='claim')
    p.mp-claim-disagree__lead
      | {{ $t('marketplace.disagreeClaimDialog.hintIntro', { amount: formatAsset2Digits(claim.amount) }) }}
      | {{ $t('marketplace.disagreeClaimDialog.hintContact') }}
      | {{ $t('marketplace.disagreeClaimDialog.hintInspect') }}
      | {{ $t('marketplace.disagreeClaimDialog.hintPickup') }}
    DataRow(:label='$t("marketplace.disagreeClaimDialog.kuLabel")', :value='claim.branch_contacts.name || claim.delivery_braname')
    DataRow(v-if='claim.branch_contacts.address', :label='$t("marketplace.disagreeClaimDialog.addressLabel")', :value='claim.branch_contacts.address')
    DataRow(v-if='claim.branch_contacts.phone', :label='$t("marketplace.disagreeClaimDialog.phoneLabel")', :value='claim.branch_contacts.phone')
    DataRow(v-if='claim.branch_contacts.email', :label='$t("marketplace.disagreeClaimDialog.emailLabel")', :value='claim.branch_contacts.email')
    DataRow(
      v-if='claim.branch_contacts.operator_name || claim.branch_contacts.operator_account',
      :label='$t("marketplace.disagreeClaimDialog.operatorLabel")',
      :value='claim.branch_contacts.operator_name || claim.branch_contacts.operator_account'
    )
    .mp-claim-disagree__actions
      BaseButton(variant='primary', size='sm', @click='emit("update:modelValue", false)') {{ $t('marketplace.disagreeClaimDialog.closeAction') }}
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

<template lang="pug">
.q-pa-md
  .row
    .col-md-7.col-xs-12.q-pa-sm
      WalletProgramWidget
  ConvertToBillingDialog
</template>
<script lang="ts" setup>
import { computed, onMounted, markRaw } from 'vue';
import { WalletProgramWidget } from 'src/widgets/Wallet';
import { DepositButton } from 'src/features/Wallet/DepositToWallet';
import { WithdrawButton } from 'src/features/Wallet/WithdrawFromWallet';
import { ConvertToBillingButton, ConvertToBillingDialog } from 'src/features/Billing/ConvertToBilling';
import { useHeaderActions } from 'src/shared/hooks';
import 'src/shared/ui/CardStyles';

// Кнопки для header
const headerButtons = computed(() => [
  {
    id: 'wallet-deposit-button',
    component: markRaw(DepositButton),
    order: 1,
  },
  {
    id: 'wallet-withdraw-button',
    component: markRaw(WithdrawButton),
    order: 2,
  },
  {
    id: 'wallet-convert-billing-button',
    component: markRaw(ConvertToBillingButton),
    order: 3,
  },
]);

// Регистрируем кнопки в header
const { registerAction } = useHeaderActions();

onMounted(() => {
  headerButtons.value.forEach(button => {
    registerAction(button);
  });
});

</script>

<style lang="scss" scoped>
// Минимальный остаток
.minimum-balance-card {
  background: rgba(255, 152, 0, 0.05);
  border: 1px solid rgba(255, 152, 0, 0.2);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s ease;

  .q-dark & {
    background: rgba(255, 152, 0, 0.08);
    border: 1px solid rgba(255, 152, 0, 0.3);
  }

  &:hover {
    background: rgba(255, 152, 0, 0.08);
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(255, 152, 0, 0.15);

    .q-dark & {
      background: rgba(255, 152, 0, 0.12);
    }
  }

  .minimum-balance-info {
    display: flex;
    align-items: center;

    .info-icon {
      margin-right: 12px;
    }

    .info-content {
      .info-label {
        font-size: 14px;
        margin-bottom: 2px;
        opacity: 0.7;
      }

      .info-value {
        font-size: 16px;
        font-weight: 500;
      }
    }
  }
}
</style>

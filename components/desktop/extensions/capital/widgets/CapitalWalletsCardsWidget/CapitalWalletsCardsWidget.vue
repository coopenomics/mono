<template lang="pug">
.row
  div.col-md-6.col-xs-12.q-pr-sm
    // Кошелек Генерации (generator)
    ColorCard(color='teal' :transparent="false")
      .wallet-section
        .wallet-header
          .wallet-icon
            q-icon(name="bolt", size="20px", color="blue")
          .wallet-title Кошелек Генерации
        .wallet-body
          .wallet-available
            .wallet-label Всего
            .wallet-value {{ formatAmount(generatorWallet.total) }}
  div.col-md-6.col-xs-12.q-pl-sm
    // Кошелек Благороста (blagorost)
    ColorCard(color='teal' :transparent="false")
      .wallet-section
        .wallet-header
          .wallet-icon
            q-icon(name="local_florist", size="20px", color="green")
          .wallet-title Кошелек Благороста
        .wallet-body
          .wallet-available
            .wallet-label Всего
            .wallet-value {{ formatAmount(blagorostWallet.total) }}
      CreateProgramInvestButton

</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useWalletStore } from 'src/entities/Wallet/model';
import { ColorCard } from 'src/shared/ui';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { Zeus } from '@coopenomics/sdk';
import { CreateProgramInvestButton } from 'app/extensions/capital/features/ProgramInvest/CreateProgramInvest/ui';

const walletStore = useWalletStore();

// Находим кошелек генерации
const generatorWallet = computed(() => {
  const wallet = walletStore.program_wallets.find(
    (wallet) => wallet.program_details.program_type.toLowerCase() === Zeus.ProgramType.GENERATOR.toLowerCase()
  );

  return {
    available: wallet?.available || '0.00',
    total: wallet?.available || '0.00',
  };
});

// Находим кошелек благороста
const blagorostWallet = computed(() => {

  const wallet = walletStore.program_wallets.find(
    (wallet) => (wallet.program_details.program_type).toLowerCase() === Zeus.ProgramType.BLAGOROST.toLowerCase()
  );

  return {
    available: wallet?.available || '0.00',
    total: wallet?.available || '0.00',
  };
});

// Форматирование суммы
const formatAmount = (amount: string | number | undefined) => {
  if (!amount) return '0.00';
  return formatAsset2Digits(`${amount}`);
};
</script>

<style lang="scss" scoped>

.wallet-section {
  .wallet-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;

    .wallet-icon {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .wallet-title {
      font-size: 16px;
      font-weight: 500;
    }
  }

  .wallet-body {
    .wallet-available {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid var(--q-grey-3, #e0e0e0);

      .q-dark & {
        border-color: var(--q-grey-7, #424242);
      }

      .wallet-label {
        font-size: 14px;
        font-weight: 400;
        opacity: 0.7;
      }

      .wallet-value {
        font-size: 18px;
        font-weight: 600;
      }
    }

    .wallet-detail {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-top: 10px;

      .wallet-address {
        font-size: 12px;
        font-family: monospace;
        opacity: 0.6;
        word-break: break-all;
      }
    }
  }
}
</style>

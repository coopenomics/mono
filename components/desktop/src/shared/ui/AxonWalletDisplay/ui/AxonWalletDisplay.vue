<template lang="pug">
.axon-wallet-display
  ColorCard(color='purple')
    // Заголовок
    .wallet-header
      .wallet-title
        q-icon(name="account_balance_wallet" size="20px").q-mr-sm
        | {{ $t('ui.axonWalletDisplay.title') }}

    // Описание
    .wallet-description
      .text-body2.text-white
        | {{ $t('ui.axonWalletDisplay.description') }}

    // Баланс
    .balance-section
      .balance-value {{ formattedBalance }}
      .balance-label {{ $t('ui.axonWalletDisplay.availableLabel') }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import { ColorCard } from 'src/shared/ui';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';

const session = useSessionStore();

// Форматированный баланс AXON
const formattedBalance = computed(() => {
  const balance = session.blockchainAccount?.core_liquid_balance || '0';
  return formatAsset2Digits(`${balance} AXON`);
});
</script>

<style lang="scss" scoped>
.axon-wallet-display {
  padding: 8px;

  // Переопределяем отступ ColorCard только для этого виджета
  :deep(.color-card) {
    margin-bottom: 0 !important;
  }

  .wallet-header {
    margin-bottom: 8px;

    .wallet-title {
      display: flex;
      align-items: center;
      font-size: 14px;
      font-weight: 600;
    }
  }

  .wallet-description {
    margin-bottom: 12px;

    .text-body2 {
      font-size: 12px;
      line-height: 1.4;
    }
  }

  .balance-section {
    padding: 12px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 8px;

    .balance-label {
      font-size: 11px;
      opacity: 0.8;
      margin-bottom: 4px;
    }

    .balance-value {
      font-size: 18px;
      font-weight: 700;
    }
  }
}
</style>

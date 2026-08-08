<template lang="pug">
q-card.main-wallet-card(flat)

  .wallet-actions.q-mb-md
    .row
      .col-6.q-pa-sm
        DepositButton.full-width.action-btn
      .col-6.q-pa-sm
        WithdrawButton.full-width.action-btn

  .wallet-balance
    ColorCard(color='blue').main-balance
      .balance-label Доступно
      .balance-value {{ availableBalance }}

    ColorCard(
      color='orange'
      v-if='minimumAmount > 0'
    ).minimum-reserve
      .balance-label Минимальный неснижаемый остаток
      .balance-value {{ minimumBalance }}

</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { DepositButton } from 'src/features/Wallet/DepositToWallet';
import { WithdrawButton } from 'src/features/Wallet/WithdrawFromWallet';
import { useWalletStore } from 'src/entities/Wallet';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { ColorCard } from 'src/shared/ui';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';

const walletStore = useWalletStore();
const session = useSessionStore();
const { info } = useSystemStore();

// Минимальный неснижаемый остаток (число — для условия видимости карточки)
const minimumAmount = computed(() => {
  return parseFloat(session.participantAccount?.minimum_amount || '0');
});

// Доступные средства с форматированием
const availableBalance = computed(() => {
  const available = walletStore.program_wallets[0]?.available || '0';
  return formatAsset2Digits(`${available} ${info.symbols?.root_govern_symbol ?? '₽'}`);
});

// Минимальный остаток с форматированием
const minimumBalance = computed(() => {
  const minimum = session.participantAccount?.minimum_amount || '0';
  return formatAsset2Digits(`${minimum} ${info.symbols?.root_govern_symbol ?? '₽'}`);
});
</script>

<style lang="scss" scoped>

// Основной кошелек
.main-wallet-card {
  .wallet-header {
    display: flex;
    align-items: center;
    margin-bottom: 24px;

    .wallet-icon {
      margin-right: 16px;
    }

    .wallet-title {
      .title {
        font-size: 20px;
        font-weight: 600;
        margin-bottom: 4px;
      }

      .subtitle {
        font-size: 14px;
      }
    }
  }

  .wallet-balance {
    margin-bottom: 32px;

    .main-balance,
    .minimum-reserve {
      // Переопределяем размеры шрифтов для сохранения оригинального дизайна
      .balance-label {
        font-size: 14px;
        margin-bottom: 6px;
        opacity: 0.6;
      }

      .balance-value {
        font-size: 24px;
        font-weight: 700;
      }
    }

    .main-balance {
      padding: 20px; // Больше padding для основного баланса
    }

    .minimum-reserve {
      padding: 16px; // Меньше padding для карточки минимального остатка
    }
  }

  .wallet-actions {
    .action-btn {
      border-radius: 10px;
      padding: 12px 0;
      font-weight: 500;
    }
  }
}

// Минимальный остаток
.minimum-balance {
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

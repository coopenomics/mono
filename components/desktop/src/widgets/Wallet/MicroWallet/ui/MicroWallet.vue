<template lang="pug">
.micro-wallet

  ColorCard(color='teal', @click='goToWallet').wallet-card
    // Профиль
    .profile-section
      .user-name
        span.ip-badge(v-if='isIP') ИП
        | {{ displayName }}
      .user-role
        q-badge(color='primary') {{ role }}

    // Баланс
    .balance-section(@click.stop)
      .balance-value {{ formattedBalance }}
      .balance-label Доступно

    // Действия
    .actions-section(@click.stop)
      .action-buttons
        DepositButton.action-btn(:micro='true')
        WithdrawButton.action-btn(:micro='true')

</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { useSessionStore } from 'src/entities/Session';
import { useWalletStore } from 'src/entities/Wallet';
import { useSystemStore } from 'src/entities/System/model';
import { ColorCard } from 'src/shared/ui';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { DepositButton } from 'src/features/Wallet/DepositToWallet';
import { WithdrawButton } from 'src/features/Wallet/WithdrawFromWallet';

const router = useRouter();
const session = useSessionStore();
const walletStore = useWalletStore();
const { info } = useSystemStore();

// Форматированный баланс доступных средств. Берём ЦК по
// Zeus.ProgramType.MAIN (GraphQL отдаёт enum ключами в UPPER_CASE).
const formattedBalance = computed(() => {
  const walletEntry = walletStore.program_wallets.find(
    (w) => w.program_type === Zeus.ProgramType.MAIN,
  );
  const available = walletEntry?.available || '0';
  return formatAsset2Digits(`${available} ${info.symbols.root_govern_symbol}`);
});

// Профиль
const currentProfile = computed(() => {
  return (
    session.privateAccount?.individual_data ||
    session.privateAccount?.entrepreneur_data ||
    session.privateAccount?.organization_data ||
    null
  );
});

// Используем computed для реактивности
const displayName = computed(() => {
  const profile = currentProfile.value;
  if (!profile) return '';

  if ('short_name' in profile) {
    return profile.short_name;
  } else if ('first_name' in profile && 'last_name' in profile) {
    return `${profile.last_name} ${profile.first_name} ${profile.middle_name || ''}`.trim();
  }

  return '';
});

const isIP = computed(() => {
  const profile = currentProfile.value;
  if (!profile) return false;

  return !('short_name' in profile) &&
         'details' in profile &&
         profile.details &&
         'inn' in profile.details &&
         'ogrn' in profile.details;
});

const role = computed(() => {
  if (session.isChairman) return 'Председатель';
  else if (session.isMember) return 'Член совета';
  else return 'Пайщик';
});

// Действия

const goToWallet = () => {
  router.push({ name: 'wallet' });
};
</script>

<style lang="scss" scoped>
.micro-wallet {
  padding: 8px;

  // Переопределяем отступ ColorCard только для этого виджета
  :deep(.color-card) {
    margin-bottom: 0 !important;
  }
  .wallet-card {
    cursor: pointer;

    .profile-section {
      margin-bottom: 6px;

      .user-name {
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 4px;
        line-height: 1.3;
        word-break: break-word;

        .ip-badge {
          background: rgba(0, 150, 136, 0.15);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
          margin-right: 4px;
          font-weight: 700;
        }
      }

      .user-role {
        :deep(.q-badge) {
          font-size: 10px;
          padding: 2px 6px;
        }
      }
    }

    .balance-section {

      padding: 8px;
      background: rgba(0, 150, 136, 0.05);
      border-radius: 8px;

      .balance-label {
        font-size: 11px;
        opacity: 0.7;
        margin-bottom: 4px;
      }

      .balance-value {
        font-size: 18px;
        font-weight: 700;
        color: var(--q-primary);
      }
    }

    .actions-section {
      .action-buttons {
        display: flex;
        justify-content: space-around;
        gap: 4px;

        .action-btn {
          flex: 1;
          min-width: 32px;
          height: 32px;
          border-radius: 8px;

          &:hover {
            background: rgba(0, 150, 136, 0.1);
          }
        }
      }
    }
  }
}

.q-dark {
  .balance-section {
    background: rgba(0, 150, 136, 0.08) !important;
  }
}
</style>


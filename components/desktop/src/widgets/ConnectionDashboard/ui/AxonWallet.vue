<template lang="pug">
.axon-wallet
  ColorCard(color='purple', @click.stop)
    // Заголовок
    .wallet-header
      .wallet-title
        q-icon(name="account_balance_wallet" size="20px").q-mr-sm
        | Кошелек AXON

    // Описание
    .wallet-description
      .text-body2.text-grey-7
        | AXON используется для оплаты пакетов документов. Минимально 5 AXON в день, по факту - от использования.

    // Баланс
    .balance-section
      .balance-value {{ formattedBalance }}
      .balance-label Доступно

    // Действия
    .actions-section
      .action-buttons.q-pa-sm
        q-btn(
          color="primary"
          icon="add"
          label="Пополнить"
          @click.stop="showDepositDialog = true"
        )

  // Диалог пополнения
  q-dialog(v-model="showDepositDialog", @hide="clear")
    ModalBase(title="Пополнение кошелька AXON", :style="dialogStyle")
      .q-pa-sm
        // Текущий баланс
        .current-balance-section.q-mb-md
          .text-body2.text-grey-7.q-mb-xs
            | Текущий баланс: {{ formattedRubBalance }}.
            | Для оплаты AXON используется паевой взнос на вашем кошельке.
            | При недостатке средств на балансе совершите паевой взнос:
            q-btn(
              flat,
              dense,
              no-caps,
              color="primary",
              label="перейти в кошелек",
              @click="goToWallet"
            )

        Form(
          :handler-submit="handlerSubmit",
          :is-submitting="isSubmitting",
          button-cancel-txt="Отменить",
          button-submit-txt="Пополнить",
          @cancel="clear"
        )
          q-input(
            v-model="depositAmount",
            standout="bg-teal text-white",
            placeholder="Введите сумму в RUB",
            type="number",
            :min="0",
            :step="10",
            :hint="depositHint",
            :rules="[(val) => val > 0 || 'Сумма должна быть положительной']"
          )
            template(#append)
              span.text-overline RUB
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSessionStore } from 'src/entities/Session';
import { useWalletStore } from 'src/entities/Wallet';
import { ColorCard } from 'src/shared/ui';
import { Form } from 'src/shared/ui/Form';
import { ModalBase } from 'src/shared/ui/ModalBase';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { formatToAsset } from 'src/shared/lib/utils/formatToAsset';
import { useProviderAxonConvert, AXON_GOVERN_RATE } from 'src/features/Provider/model';
import { useSystemStore } from 'src/entities/System/model';

const router = useRouter();
const session = useSessionStore();
const walletStore = useWalletStore();
const system = useSystemStore();
const { convertToAxon } = useProviderAxonConvert();

  // Диалог пополнения
const showDepositDialog = ref(false);
const depositAmount = ref('');
const isSubmitting = ref(false);

// Форматированный баланс AXON
const formattedBalance = computed(() => {
  const balance = session.blockchainAccount?.core_liquid_balance || '0';
  return formatAsset2Digits(`${balance} AXON`);
});

// Форматированный баланс RUB из MicroWallet
const formattedRubBalance = computed(() => {
  const available = walletStore.program_wallets[0]?.available || '0';
  return formatAsset2Digits(`${available} ${system.info.symbols?.root_govern_symbol ?? '₽'}`);
});

// Подсказка с расчетом AXON
const depositHint = computed(() => {
  if (!depositAmount.value || parseFloat(depositAmount.value) <= 0) {
    return '';
  }

  const rubAmount = parseFloat(depositAmount.value);
  const axonAmount = rubAmount / AXON_GOVERN_RATE;
  return `Будет зачислено: ${formatAsset2Digits(`${axonAmount} AXON`)} (курс: 1 AXON = ${AXON_GOVERN_RATE} RUB)`;
});

// Стиль диалога - адаптивная ширина
const dialogStyle = computed(() => {
  return {
    maxWidth: 'min(400px, 90vw)'
  };
});

// Закрыть диалог
const clear = () => {
  showDepositDialog.value = false;
  depositAmount.value = '';
  isSubmitting.value = false;
};

// Переход на страницу кошелька
const goToWallet = () => {
  router.push({ name: 'wallet' });
};

// Обработчик пополнения (конвертация RUB в AXON)
const handlerSubmit = async () => {
  isSubmitting.value = true;
  try {
    // Выполняем конвертацию RUB в AXON
    const success = await convertToAxon({
      convertAmount: formatToAsset(depositAmount.value, system.info.symbols?.root_govern_symbol ?? '₽', system.info.symbols?.root_govern_precision ?? 2),
      username: session.username || '',
      coopname: system.info.coopname || ''
    });

    if (success) {
      clear();
    } else {
      isSubmitting.value = false;
    }
  } catch (error) {
    console.error(error);
    isSubmitting.value = false;
  }
};
</script>

<style lang="scss" scoped>
.axon-wallet {
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
    margin-bottom: 12px;

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

  .actions-section {
    .action-buttons {
      display: flex;
      justify-content: center;

      .action-btn {
        min-width: 120px;
        height: 36px;
        border-radius: 8px;

        &:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      }
    }
  }

  .current-balance-section {
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);

    .text-body2 {
      font-weight: 600;
    }
  }

  .contribution-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
}
</style>

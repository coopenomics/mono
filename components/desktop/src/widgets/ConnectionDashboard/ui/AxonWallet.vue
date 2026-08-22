<template lang="pug">
.axon-wallet
  BaseCard(
    title="Кошелёк AXON"
    subtitle="Для оплаты пакетов документов. Минимально 5 AXON в день, по факту — от использования."
  )
    .axon-wallet__metric
      .axon-wallet__metric-label Доступно
      .axon-wallet__metric-value.t-mono {{ formattedBalance }}

    .axon-wallet__actions
      BaseButton(
        variant="primary"
        size="md"
        type="button"
        @click="showDepositDialog = true"
      )
        q-icon(name="add" size="16px").q-mr-xs
        | Пополнить

  BaseDialog(
    v-model="showDepositDialog"
    title="Пополнение кошелька AXON"
    size="md"
    @update:model-value="(v) => !v && clear()"
  )
    BaseBanner(variant="info")
      | Текущий баланс паевого: <b>{{ formattedRubBalance }}</b>.
      | Для оплаты AXON используется паевой взнос на вашем кошельке.
      | При недостатке средств совершите паевой взнос в разделе «Кошелёк».

    BaseForm.q-mt-md(:loading="isSubmitting" @submit="handlerSubmit")
      BaseInput(
        v-model="depositAmount"
        label="Сумма пополнения"
        type="number"
        :hint="depositHint"
        suffix="RUB"
        placeholder="Введите сумму в RUB"
      )

      template(#footer="{ loading }")
        .axon-wallet__form-actions
          BaseButton(
            variant="ghost"
            size="md"
            type="button"
            :disabled="loading"
            @click="clear"
          ) Отменить
          BaseButton(
            variant="primary"
            size="md"
            type="submit"
            :loading="loading"
          ) Пополнить
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import { useWalletStore } from 'src/entities/Wallet';
import {
  BaseBanner,
  BaseButton,
  BaseCard,
  BaseDialog,
  BaseForm,
  BaseInput,
} from 'src/shared/ui/base';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { formatToAsset } from 'src/shared/lib/utils/formatToAsset';
import { useProviderAxonConvert, AXON_GOVERN_RATE } from 'src/features/Provider/model';
import { useSystemStore } from 'src/entities/System/model';

const session = useSessionStore();
const walletStore = useWalletStore();
const system = useSystemStore();
const { convertToAxon } = useProviderAxonConvert();

const showDepositDialog = ref(false);
const depositAmount = ref('');
const isSubmitting = ref(false);

const formattedBalance = computed(() => {
  const balance = session.blockchainAccount?.core_liquid_balance || '0';
  return formatAsset2Digits(`${balance} AXON`);
});

const formattedRubBalance = computed(() => {
  const available = walletStore.program_wallets[0]?.available || '0';
  return formatAsset2Digits(`${available} ${system.info.symbols?.root_govern_symbol ?? '₽'}`);
});

const depositHint = computed(() => {
  if (!depositAmount.value || parseFloat(depositAmount.value) <= 0) return '';
  const rubAmount = parseFloat(depositAmount.value);
  const axonAmount = rubAmount / AXON_GOVERN_RATE;
  return `Будет зачислено: ${formatAsset2Digits(`${axonAmount} AXON`)} (курс: 1 AXON = ${AXON_GOVERN_RATE} RUB)`;
});

const clear = () => {
  showDepositDialog.value = false;
  depositAmount.value = '';
  isSubmitting.value = false;
};

const handlerSubmit = async () => {
  isSubmitting.value = true;
  try {
    const success = await convertToAxon({
      convertAmount: formatToAsset(depositAmount.value, system.info.symbols?.root_govern_symbol ?? '₽', system.info.symbols?.root_govern_precision ?? 2),
      username: session.username || '',
      coopname: system.info.coopname || '',
    });
    if (success) clear();
    else isSubmitting.value = false;
  } catch {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
.axon-wallet__metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--p-3) 0;
}
.axon-wallet__metric-label {
  font-size: var(--p-fs-meta);
  color: var(--p-ink-2);
}
.axon-wallet__metric-value {
  font-size: var(--p-fs-h1);
  font-weight: 700;
  color: var(--p-ink);
}
.axon-wallet__actions {
  display: flex;
  gap: var(--p-2);
}
.axon-wallet__form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--p-2);
}
</style>

<template lang="pug">
.payment-methods
  template(v-if='wallet.methods && wallet.methods.length > 0')
    BaseCard(
      v-for='method in wallet.methods',
      :key='method.method_id',
      :title='methodTitle(method)'
    )
      template(#actions)
        DeletePaymentButton(
          :username='username',
          :method_id='method.method_id',
          size='sm',
          flat,
          color='negative'
        )

      //- Система Быстрых Платежей
      template(v-if='method.method_type === "sbp" && isSBPData(method.data)')
        DataRow(label='Телефон', :value='method.data.phone', copyable)

      //- Банковский перевод
      template(
        v-if='method.method_type === "bank_transfer" && isBankTransferData(method.data)'
      )
        DataRow(label='Валюта', :value='method.data.currency')
        DataRow(label='Банк', :value='method.data.bank_name')
        DataRow(
          label='Номер счёта',
          :value='method.data.account_number',
          copyable,
          mono
        )
        DataRow(
          label='Корр. счёт',
          :value='method.data.details.corr',
          copyable,
          mono
        )
        DataRow(label='БИК', :value='method.data.details.bik', copyable, mono)
        DataRow(label='КПП', :value='method.data.details.kpp', copyable, mono)

  EmptyState(
    v-else,
    title='Способы получения платежей не добавлены',
    body='Добавьте банковскую карту или реквизиты для получения платежей от кооператива.'
  )
    template(#icon)
      q-icon(name='payment', size='48px')
</template>

<script lang="ts" setup>
import { useWalletStore } from 'src/entities/Wallet';
import { useSystemStore } from 'src/entities/System/model';
import { computed } from 'vue';
import type {
  IBankTransferData,
  ISBPData,
} from 'src/entities/Wallet/model/types';
import { DeletePaymentButton } from 'src/features/PaymentMethod/DeletePaymentMethod/ui';
import { BaseCard } from 'src/shared/ui/base/BaseCard';
import { DataRow } from 'src/shared/ui/domain/DataRow';
import { EmptyState } from 'src/shared/ui/base/EmptyState';

const props = defineProps({
  username: {
    type: String,
    required: true,
  },
});

const { info } = useSystemStore();
const wallet = useWalletStore();

const username = computed(() => props.username);

wallet.loadUserWallet({ coopname: info.coopname, username: username.value });

function isSBPData(data: ISBPData | IBankTransferData): data is ISBPData {
  return (data as ISBPData).phone !== undefined;
}

function isBankTransferData(
  data: ISBPData | IBankTransferData,
): data is IBankTransferData {
  return (data as IBankTransferData).account_number !== undefined;
}

function methodTitle(method: { method_type: string }): string {
  return method.method_type === 'sbp'
    ? 'Система Быстрых Платежей'
    : 'Банковский перевод';
}
</script>

<style lang="scss" scoped>
.payment-methods {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
  padding: var(--p-6, 24px);
}

@media (max-width: 768px) {
  .payment-methods {
    padding: var(--p-4, 16px);
  }
}
</style>

<template lang="pug">
.q-pa-md
  q-card.card-container.q-pa-lg(flat)
    // Заголовок секции
    .section-header.large
      .section-icon
        q-icon(name='payment', size='24px', color='primary')
      .section-title Способы получения платежей

    // Описание
    .q-mb-lg
      p.text-body2 Указанные реквизиты используются при платежах от кооператива в пользу пайщика

    // Список способов оплаты
    .profile-section
      .info-content(v-if='wallet.methods && wallet.methods.length > 0')
        .info-group
          .info-item(
            v-for='(method, index) in wallet.methods',
            :key='method.method_id'
          )
            .method-header
              .method-badge
                q-badge(color='primary', outline) {{ index + 1 }}
              .method-title
                .info-label Способ платежа
                .info-value {{ method.method_type === 'sbp' ? 'Система Быстрых Платежей' : 'Банковский перевод' }}

            // СБП данные
            .method-details(
              v-if='method.method_type === "sbp" && isSBPData(method.data)'
            )
              .info-label Телефон
              .info-value {{ method.data.phone }}

            // Банковский перевод данные
            .method-details(
              v-if='method.method_type === "bank_transfer" && isBankTransferData(method.data)'
            )
              .row.q-col-gutter-md.q-mb-md
                .col-12.col-md-4
                  .info-label Валюта
                  .info-value {{ method.data.currency }}
                .col-12.col-md-4
                  .info-label Банк
                  .info-value {{ method.data.bank_name }}
                .col-12.col-md-4
                  .info-label Номер счёта
                  .info-value {{ method.data.account_number }}

              .row.q-col-gutter-md
                .col-12.col-md-4
                  .info-label Корр. счёт
                  .info-value {{ method.data.details.corr }}
                .col-12.col-md-4
                  .info-label БИК
                  .info-value {{ method.data.details.bik }}
                .col-12.col-md-4
                  .info-label КПП
                  .info-value {{ method.data.details.kpp }}

            // Действия
            .method-actions
              DeletePaymentButton.card-action-btn(
                :username='username',
                :method_id='method.method_id',
                size='sm',
                flat,
                color='negative'
              )

      // Пустое состояние
      .empty-state(v-else)
        .empty-icon
          q-icon(name='payment', size='48px', color='grey-5')
        .empty-text Способы получения платежей не добавлены
        .empty-subtitle Добавьте банковскую карту или реквизиты для получения платежей от кооператива
</template>

<script lang="ts" setup>
import { useWalletStore } from 'src/entities/Wallet';
import { useSystemStore } from 'src/entities/System/model';
import { computed } from 'vue';
import type {
  IBankTransferData,
  ISBPData,
} from 'src/features/PaymentMethod/AddPaymentMethod/model';
import { DeletePaymentButton } from 'src/features/PaymentMethod/DeletePaymentMethod/ui';
import 'src/shared/ui/CardStyles/index.scss';

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
</script>

<style lang="scss" scoped>
// Дополнительные стили для способов оплаты
.method-header {
  display: flex;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 12px;

  .method-badge {
    flex-shrink: 0;
    margin-top: 4px;
  }

  .method-title {
    flex: 1;
  }
}

.method-details {
  margin-bottom: 16px;

  .info-label {
    font-size: 12px;
    margin-bottom: 4px;
    text-transform: uppercase;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.6);

    .q-dark & {
      color: rgba(255, 255, 255, 0.6);
    }
  }

  .info-value {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 12px;
    word-break: break-word;
  }
}

.method-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

// Адаптивность
@media (max-width: 768px) {
  .method-header {
    flex-direction: column;
    gap: 8px;

    .method-badge {
      align-self: flex-start;
    }
  }

  .method-details .row {
    flex-direction: column;
  }
}
</style>

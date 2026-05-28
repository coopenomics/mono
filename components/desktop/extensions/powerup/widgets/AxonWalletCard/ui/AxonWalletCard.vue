<template lang="pug">
.axon-wallet-card
  .axon-wallet-card__head
    .axon-wallet-card__icon
      i.fas.fa-wallet
    .axon-wallet-card__title Кошелёк AXON

  .axon-wallet-card__balance
    .axon-wallet-card__balance-value {{ formattedBalance }}
    .axon-wallet-card__balance-label Доступно

  .axon-wallet-card__details
    .detail-row
      span.detail-label Минимальных квот
      span.detail-value {{ minQuotasDays }} {{ minQuotasDaysText }}
    .detail-row
      span.detail-label Новых пайщиков
      span.detail-value {{ maxNewMembers }} {{ maxNewMembersText }}

  .axon-wallet-card__note
    | AXON используется для аренды вычислительных ресурсов (минимум 5 AXON/день) и регистрации пайщиков (1 AXON/аккаунт). Курс: 1 AXON = 10 RUB.

  BaseButton.axon-wallet-card__action(variant="primary", size="sm", block, @click="goToReplenishment")
    template(#icon-left)
      q-icon(name="open_in_new", size="16px")
    | Пополнить у оператора
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { pluralizeDays, pluralizeAccounts } from 'src/shared/lib/utils';
import { BaseButton } from 'src/shared/ui/base/BaseButton';

const systemStore = useSystemStore();

// Баланс AXON в числовом формате
const axonBalance = computed(() => {
  const balance = systemStore.info.blockchain_account?.core_liquid_balance || '0';
  return parseFloat(balance.replace(/[^\d.-]/g, '')) || 0;
});

// Форматированный баланс AXON
const formattedBalance = computed(() => {
  const balance = systemStore.info.blockchain_account?.core_liquid_balance || '0';
  return formatAsset2Digits(`${balance} AXON`);
});

// Минимальных квот в днях
const minQuotasDays = computed(() => {
  return Math.floor(axonBalance.value / 5);
});

// Максимум новых пайщиков
const maxNewMembers = computed(() => {
  return Math.floor(axonBalance.value);
});

// Текст для дней с правильным склонением
const minQuotasDaysText = computed(() => {
  return pluralizeDays(minQuotasDays.value);
});

// Текст для аккаунтов с правильным склонением
const maxNewMembersText = computed(() => {
  return pluralizeAccounts(maxNewMembers.value);
});

// Переход на сайт пополнения
const goToReplenishment = () => {
  window.open('https://лк.цифровой-кооператив.рф', '_blank');
};
</script>

<style lang="scss" scoped>
/* Канон-карточка кошелька AXON: плоская surface, без градиента/теней. */
.axon-wallet-card {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 16px);
  padding: var(--p-5, 20px);
  height: 100%;
}

.axon-wallet-card__head {
  display: flex;
  align-items: center;
  gap: var(--p-3, 12px);
}

.axon-wallet-card__icon {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  border-radius: var(--p-r-md, 12px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--prog-generator-soft);
  color: var(--prog-generator);

  i {
    font-size: 1.1rem;
  }
}

.axon-wallet-card__title {
  font-size: var(--p-fs-h3, 15px);
  font-weight: 600;
  color: var(--p-ink);
}

.axon-wallet-card__balance {
  text-align: center;
  padding: var(--p-2, 8px) 0;

  .axon-wallet-card__balance-value {
    font-size: 1.9rem;
    font-weight: 700;
    line-height: 1.2;
    color: var(--p-ink);
  }

  .axon-wallet-card__balance-label {
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-3);
    margin-top: var(--p-1, 4px);
  }
}

.axon-wallet-card__details {
  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--p-3, 12px);
    padding: var(--p-2, 8px) 0;
    border-bottom: 1px solid var(--p-line);

    &:last-child {
      border-bottom: none;
    }
  }

  .detail-label {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
  }

  .detail-value {
    font-size: var(--p-fs-mono, 13px);
    font-weight: 600;
    color: var(--p-ink);
    font-family: var(--p-mono);
    text-align: right;
  }
}

.axon-wallet-card__note {
  background: var(--p-surface-2);
  border-radius: var(--p-r-md, 12px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
  line-height: 1.5;
}

.axon-wallet-card__action {
  margin-top: auto;
}
</style>

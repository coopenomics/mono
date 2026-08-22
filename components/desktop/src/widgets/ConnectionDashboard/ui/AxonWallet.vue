<template lang="pug">
.axon-wallet
  BaseCard(
    title="Кошелёк AXON"
    subtitle="Вычислительные ресурсы для документооборота. Минимально 5 AXON в день, по факту — от использования."
  )
    .axon-wallet__metric
      .axon-wallet__metric-label Доступно
      .axon-wallet__metric-value.t-mono {{ formattedBalance }}

    BaseBanner(variant="info")
      | AXON пополняется оператором платформы автоматически из членских взносов
      | на вашем биллинг-кошельке (см. «Кошелёк членских взносов» ниже).
      | Прямое пополнение AXON паевым взносом не предусмотрено.
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import { BaseBanner, BaseCard } from 'src/shared/ui/base';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';

/**
 * Баланс AXON кооператива. Кнопка «Пополнить» убрана (Epic 13, решение @ant
 * 2026-06-11): действие soviet::converttoaxn упразднено — паевой → членский
 * переводит пайщик через ConvertToBillingDialog (MembershipWallet), а AXON
 * кооперативу докупает хаб оператора из w.wal.bill.
 */
const session = useSessionStore();

const formattedBalance = computed(() => {
  const balance = session.blockchainAccount?.core_liquid_balance || '0';
  return formatAsset2Digits(`${balance} AXON`);
});
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

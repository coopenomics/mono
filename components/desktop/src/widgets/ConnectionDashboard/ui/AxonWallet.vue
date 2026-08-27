<template lang="pug">
WalletCard(
  neutral
  icon="bolt"
  title="AXON"
  subtitle="Ресурс документооборота"
  :balance="axon.amount"
  :symbol="axon.symbol || 'AXON'"
)
  //- Ёмкость баланса тремя показателями по тарифам платформы. Живёт в слоте
  //- действий: там уже есть своя линия-разделитель, и карточка не становится
  //- выше соседней. Показатели независимы (ресурсы делят один баланс) — это
  //- объясняет подсказка, в строку такое пояснение не помещается.
  template(v-if="metrics.length" #actions)
    .axon-capacity
      .axon-capacity__item(v-for="metric in metrics" :key="metric.key")
        .axon-capacity__value.t-mono.t-num {{ metric.value }}
        .axon-capacity__label.t-meta {{ metric.label }}
      q-tooltip {{ capacityHint }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import { WalletCard } from 'src/shared/ui/domain';
import { splitAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { AXON_CAPACITY_HINT, axonCapacityMetrics } from 'src/shared/lib/axon';

/**
 * Баланс AXON кооператива. Кнопка «Пополнить» убрана (Epic 13, решение @ant
 * 2026-06-11): действие soviet::converttoaxn упразднено — паевой → членский
 * переводит пайщик через ConvertToBillingDialog (MembershipWallet), а AXON
 * кооперативу докупает хаб оператора из w.wal.bill. Как устроена эта цепочка,
 * рассказывает подсказка страницы, а не баннер внутри карточки: пояснение на
 * весь экран одно.
 */
const session = useSessionStore();

const axon = computed(() =>
  splitAsset2Digits(`${session.blockchainAccount?.core_liquid_balance || '0'} AXON`),
);

/** Числовой баланс для прикидки запаса: в строке цепи есть символ и разделители. */
const axonBalance = computed(() => {
  const raw = session.blockchainAccount?.core_liquid_balance || '0';
  return Number.parseFloat(String(raw).replace(/[^\d.-]/g, '')) || 0;
});

const metrics = computed(() => axonCapacityMetrics(axonBalance.value));
const capacityHint = AXON_CAPACITY_HINT;
</script>

<style scoped>
.axon-capacity {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-2) var(--p-6);
}

.axon-capacity__value {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
  line-height: 1.2;
}

.axon-capacity__label {
  color: var(--p-ink-3);
}
</style>

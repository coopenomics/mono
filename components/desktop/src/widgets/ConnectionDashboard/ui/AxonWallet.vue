<template lang="pug">
WalletCard(
  neutral
  icon="bolt"
  title="AXON"
  subtitle="Ресурс документооборота"
  :balance="axon.amount"
  :symbol="axon.symbol || 'AXON'"
)
  //- Прикидка «на сколько хватит» по тарифам платформы — теми же формулами,
  //- что на столе «Системные ресурсы». Живёт в слоте действий: там уже есть
  //- своя линия-разделитель, и карточка не становится выше соседней.
  template(v-if="capacity" #actions)
    .axon-wallet__capacity.t-meta {{ capacity }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import { WalletCard } from 'src/shared/ui/domain';
import { splitAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { axonCapacitySummary } from 'src/shared/lib/axon';

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

const capacity = computed(() => axonCapacitySummary(axonBalance.value));
</script>

<style scoped>
.axon-wallet__capacity {
  color: var(--p-ink-2);
}
</style>

<template lang="pug">
WalletCard(
  neutral
  icon="bolt"
  title="AXON"
  subtitle="Ресурс документооборота"
  :balance="axon.amount"
  :symbol="axon.symbol || 'AXON'"
)
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import { WalletCard } from 'src/shared/ui/domain';
import { splitAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';

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
</script>

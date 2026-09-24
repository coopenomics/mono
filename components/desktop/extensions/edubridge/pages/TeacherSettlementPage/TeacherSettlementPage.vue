<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:teacher-settlement:banner-dismissed")
    | {{ $t('edubridge.teacherSettlementPage.hintAccrual') }}
    | {{ $t('edubridge.teacherSettlementPage.hintReturn') }}
  .row.q-col-gutter-md
    .col-12.col-md-6
      BaseCard(variant="default" :title="$t('edubridge.teacherSettlementPage.title')")
        CardListSkeleton(v-if="!settlement" :count="1")
        template(v-else)
          DataRow(:label="$t('edubridge.teacherSettlementPage.acceptedTotalLabel')" :value="formatAsset2Digits(settlement.accepted_total)")
          DataRow(:label="$t('edubridge.teacherSettlementPage.availableLabel')" :value="formatAsset2Digits(settlement.available)")
          DataRow(:label="$t('edubridge.teacherSettlementPage.lastAcceptedLabel')" :value="settlement.last_accepted_at ? formatDate(settlement.last_accepted_at) : '______'")
          .q-mt-md
            BaseButton(variant="primary" @click="goToWallet") {{ $t('edubridge.teacherSettlementPage.walletReturnButton') }}
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { asDateInput } from 'src/shared/lib/utils';
import { FailAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseButton, BaseCard, CardListSkeleton } from 'src/shared/ui/base';
import { DataRow, PageHint } from 'src/shared/ui/domain';
import { fetchMySettlement, type ISettlement } from '../../entities/Teacher';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';

const route = useRoute();
const router = useRouter();
const settlement = ref<ISettlement | null>(null);
const formatDate = (v: unknown) => {
  const input = asDateInput(v);
  return input ? new Date(input).toLocaleDateString('ru-RU') : '______';
};

function goToWallet(): void {
  void router.push({ name: 'wallet', params: { coopname: route.params.coopname } });
}

async function loadSettlement(): Promise<void> {
  settlement.value = await fetchMySettlement();
}

// Живое обновление: взносы по урокам и выплаты меняют расчёт без перезагрузки.
useLiveReload([EduLive.contributions, EduLive.userWallets], loadSettlement);

onMounted(async () => {
  try {
    await loadSettlement();
  } catch (e) {
    FailAlert(e);
  }
});
</script>

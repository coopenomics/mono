<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:teacher-settlement:banner-dismissed")
    | Принятые советом взносы результатами работы зачисляются в ваш главный паевой кошелёк правом требования.
    | Возврат паевого взноса оформляется в кошельке — штатным механизмом кооператива.
  .row.q-col-gutter-md
    .col-12.col-md-6
      BaseCard(variant="default" title="Расчёт")
        CardListSkeleton(v-if="!settlement" :count="1")
        template(v-else)
          DataRow(label="Принято взносов на сумму" :value="formatAsset2Digits(settlement.accepted_total)")
          DataRow(label="Доступно в главном кошельке" :value="formatAsset2Digits(settlement.available)")
          DataRow(label="Последний принятый взнос" :value="settlement.last_accepted_at ? formatDate(settlement.last_accepted_at) : '—'")
          .q-mt-md
            BaseButton(variant="primary" @click="goToWallet") Получить возврат в кошельке
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseButton, BaseCard, CardListSkeleton } from 'src/shared/ui/base';
import { DataRow, PageHint } from 'src/shared/ui/domain';
import { fetchMySettlement, type ISettlement } from '../../entities/Teacher';

const route = useRoute();
const router = useRouter();
const settlement = ref<ISettlement | null>(null);
const formatDate = (v: string | Date) => new Date(v).toLocaleDateString('ru-RU');

function goToWallet(): void {
  void router.push({ name: 'wallet', params: { coopname: route.params.coopname } });
}

onMounted(async () => {
  try {
    settlement.value = await fetchMySettlement();
  } catch (e) {
    FailAlert(e);
  }
});
</script>

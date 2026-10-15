<template lang="pug">
//- Возврат в правой панели: состояние по платежу, сумма, когда подан, оба заявления.
.edu-share-return-details
  BaseBadge.q-mb-md(:variant="status.variant") {{ status.label }}
  DataRow(:label="$t('edubridge.shareReturnDetails.amountLabel')" :value="formatAsset2Digits(entry.amount)" align="spread")
  DataRow(:label="$t('edubridge.shareReturnDetails.createdAtLabel')" :value="formatDateTime(entry.at)" align="spread")
  .edu-share-return-details__section(v-if="documentsLoading || documents.length")
    .t-eyebrow.q-mb-sm {{ $t('edubridge.shareReturnDetails.documents') }}
    CardListSkeleton(v-if="documentsLoading" :count="2")
    .column.q-gutter-y-sm(v-else)
      ComplexDocument(v-for="d in documents" :key="d.kind" :document="d.document" collapsible)
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { asDateInput } from 'src/shared/lib/utils';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, CardListSkeleton } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { ComplexDocument } from 'src/shared/ui/ComplexDocument';
import { SETTLEMENT_STATUS_LABELS, fetchMyShareReturnDocuments, type ISettlementEntry, type IShareReturnDocument } from '../../entities/Teacher';

const props = defineProps<{ entry: ISettlementEntry }>();

const status = computed(() => SETTLEMENT_STATUS_LABELS[props.entry.status] ?? { label: props.entry.status, variant: 'neutral' as const });
const formatDateTime = (v: unknown) => {
  const input = asDateInput(v);
  return input ? new Date(input).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '______';
};

/** Оба заявления — с сервера; ошибка чтения карточку не ломает. */
const documents = ref<IShareReturnDocument[]>([]);
const documentsLoading = ref(true);
async function loadDocuments(id: string | null): Promise<void> {
  documentsLoading.value = true;
  documents.value = [];
  try {
    documents.value = id ? await fetchMyShareReturnDocuments(id) : [];
  } catch {
    documents.value = [];
  } finally {
    documentsLoading.value = false;
  }
}
watch(() => props.entry.return_id, loadDocuments, { immediate: true });
</script>

<style scoped>
.edu-share-return-details__section {
  margin-top: var(--p-5);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
</style>

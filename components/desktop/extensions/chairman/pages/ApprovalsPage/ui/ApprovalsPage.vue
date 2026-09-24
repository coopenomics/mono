<template lang="pug">
.approvals-page
  q-card(flat)

    // Фильтры
    q-card-section
      .row.q-gutter-md
        q-select(
          v-model='filters.statuses'
          :options='statusOptions'
          :label='$t("chairman.approvalsPage.statusFilterLabel")'
          :placeholder='$t("chairman.approvalsPage.statusFilterPlaceholder")'
          dense
          outlined
          color="primary"
          @update:model-value='onFiltersChange'
          style="width: 250px"
        )

    // Таблица одобрений
    ApprovalsTableWidget(
      :approvals='approvalStore.approvals?.items || []',
      :loading='loading',
      :pagination='pagination',
      @request='onRequest'
    )
</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { ApprovalsTableWidget } from 'app/extensions/chairman/widgets/ApprovalsTableWidget/ui';
import { useApprovalStore } from 'app/extensions/chairman/entities/Approval/model';

import { Zeus } from '@coopenomics/sdk';
import { t } from '../../../i18n';
import { useLiveReload, type ChainTableRef } from 'src/shared/lib/realtime';

const approvalStore = useApprovalStore();
const route = useRoute();

const loading = ref(false);

// Фильтры
const filters = ref({
  statuses: { label: t('chairman.approval.status.pending'), value: Zeus.ApprovalStatus.PENDING },
});

// Опции статусов
const statusOptions = [
  { label: t('chairman.approvalsPage.allStatusesOption'), value: null},
  { label: t('chairman.approval.status.pending'), value: Zeus.ApprovalStatus.PENDING},
  { label: t('chairman.approval.status.approved'), value: Zeus.ApprovalStatus.APPROVED},
  { label: t('chairman.approval.status.declined'), value: Zeus.ApprovalStatus.DECLINED},
];

// Пагинация
const pagination = ref({
  sortBy: 'created_at',
  descending: true,
  page: 1,
  rowsPerPage: 25,
  rowsNumber: 0,
});

// Загрузка одобрений. Тихая — без оверлея загрузки: так перечитывает лента,
// чтобы таблица не мигала на каждом решении председателя.
const loadApprovals = async (silent = false) => {
  try {
    if (!silent) loading.value = true;

    const coopname = route.params.coopname as string;

    const data = {
      filter: {
        coopname,
        statuses: filters.value.statuses.value !== null ? [filters.value.statuses.value] : undefined,
      },
      options: {
        page: pagination.value.page,
        limit: pagination.value.rowsPerPage,
        sortBy: pagination.value.sortBy,
        sortOrder: pagination.value.descending ? 'DESC' : 'ASC',
      },
    };

    await approvalStore.loadApprovals(data);
    // Общее число — в пагинацию таблицы: её подвал и листание работают от него,
    // отдельный пагинатор под таблицей больше не нужен.
    pagination.value.rowsNumber = approvalStore.approvals?.totalCount || 0;
  } catch (error) {
    console.error('Ошибка загрузки одобрений:', error);
    // Фоновое перечитывание не пугает отказом: следующий сигнал повторит.
    if (!silent) FailAlert(t('chairman.approvalsPage.loadError'));
  } finally {
    loading.value = false;
  }
};

// Обработчик изменения фильтров
const onFiltersChange = () => {
  pagination.value.page = 1; // Сбрасываем на первую страницу
  loadApprovals();
};

// Обработчик запроса пагинации
const onRequest = (props: { pagination: any }) => {
  pagination.value = props.pagination;
  loadApprovals();
};

// Инициализация
onMounted(() => {
  loadApprovals();
});

// Одобрения — таблица базы узла расширения председателя: новое одобрение,
// подпись и отказ приходят по ленте изменений, список перечитывается сам.
const APPROVALS_TABLE: ChainTableRef = { code: 'chairman', table: 'chairman_approvals' };
useLiveReload([APPROVALS_TABLE], () => loadApprovals(true));

// Следим за изменением параметров маршрута
watch(() => route.params.coopname, () => {
  loadApprovals();
});
</script>

<style scoped lang="scss">
.approvals-page {
  padding: var(--p-6, 24px);
  @media (max-width: 768px) {
    padding: var(--p-4, 16px);
  }
}
</style>

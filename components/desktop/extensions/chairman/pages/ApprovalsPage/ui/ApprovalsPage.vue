<template lang="pug">
.q-pa-md
  FilterBar.q-mb-md
    BaseSelect(
      v-model="statusFilter"
      label="Состояние"
      :options="statusOptions"
      style="width: 240px"
      @update:model-value="onFiltersChange"
    )

  ApprovalsTableWidget(
    :approvals="approvalStore.approvals?.items || []"
    :loading="loading"
    :pagination="pagination"
    @update:page="onPageChange"
  )
</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { ApprovalsTableWidget } from 'app/extensions/chairman/widgets/ApprovalsTableWidget/ui';
import { BaseSelect } from 'src/shared/ui/base';
import { FilterBar } from 'src/shared/ui/domain';
import { useApprovalStore } from 'app/extensions/chairman/entities/Approval/model';

import { Zeus } from '@coopenomics/sdk';

const approvalStore = useApprovalStore();
const route = useRoute();

const loading = ref(false);

// Фильтр по состоянию: по умолчанию показываем то, что ждёт решения.
const statusFilter = ref<string>(Zeus.ApprovalStatus.PENDING);

const statusOptions = [
  { label: 'Все состояния', value: '' },
  { label: 'Ожидает', value: Zeus.ApprovalStatus.PENDING },
  { label: 'Одобрено', value: Zeus.ApprovalStatus.APPROVED },
  { label: 'Отклонено', value: Zeus.ApprovalStatus.DECLINED },
];

// Пагинация
const pagination = ref({
  sortBy: 'created_at',
  descending: true,
  page: 1,
  rowsPerPage: 25,
  rowsNumber: 0,
});

// Загрузка одобрений
const loadApprovals = async () => {
  try {
    loading.value = true;

    const coopname = route.params.coopname as string;

    const data = {
      filter: {
        coopname,
        statuses: statusFilter.value ? [statusFilter.value as Zeus.ApprovalStatus] : undefined,
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
    FailAlert('Ошибка загрузки одобрений');
  } finally {
    loading.value = false;
  }
};

// Обработчик изменения фильтров
const onFiltersChange = () => {
  pagination.value.page = 1; // Сбрасываем на первую страницу
  loadApprovals();
};

// Листание: страницы считает сервер, экран только просит нужную.
const onPageChange = (page: number) => {
  pagination.value.page = page;
  loadApprovals();
};

// Инициализация
onMounted(() => {
  loadApprovals();
});

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

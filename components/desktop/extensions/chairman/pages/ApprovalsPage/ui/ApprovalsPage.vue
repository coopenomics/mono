<template lang="pug">
.approvals-page
  q-card(flat)

    // Фильтры
    q-card-section
      .row.q-gutter-md
        q-select(
          v-model='filters.statuses'
          :options='statusOptions'
          label='Статус'
          placeholder='без фильтра'
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

    // Пагинация
    q-card-actions(align='center')
      q-pagination(
        v-model='pagination.page',
        :max='Math.ceil((approvalStore.approvals?.totalCount || 0) / pagination.rowsPerPage)',
        :max-pages='5',
        direction-links,
        boundary-links,
        @update:model-value='onPageChange'
      )
</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { ApprovalsTableWidget } from 'app/extensions/chairman/widgets/ApprovalsTableWidget/ui';
import { useApprovalStore } from 'app/extensions/chairman/entities/Approval/model';

import { Zeus } from '@coopenomics/sdk';

const approvalStore = useApprovalStore();
const route = useRoute();

const loading = ref(false);

// Фильтры
const filters = ref({
  statuses: { label: 'Ожидает', value: Zeus.ApprovalStatus.PENDING },
});

// Опции статусов
const statusOptions = [
  { label: 'Все статусы', value: null},
  { label: 'Ожидает', value: Zeus.ApprovalStatus.PENDING},
  { label: 'Одобрено', value: Zeus.ApprovalStatus.APPROVED},
  { label: 'Отклонено', value: Zeus.ApprovalStatus.DECLINED},
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

// Обработчик изменения страницы
const onPageChange = () => {
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

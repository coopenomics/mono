<template lang="pug">
div
  .table-header
    .table-title {{ $t('capital.importResultsTable.title', { count: items.length }) }}
    .table-actions
      q-btn(
        v-if='hasErrors',
        color='warning',
        icon='refresh',
        @click='$emit("retryAllFailed")',
        :label='$t("capital.importResultsTable.retryAllButton")',
        flat
      )
      q-btn(
        color='grey-7',
        icon='clear',
        @click='$emit("clear")',
        :label='$t("capital.importResultsTable.clearButton")',
        flat
      )

  q-table.import-results-table(
    :rows='items',
    :columns='columns',
    row-key='id',
    :loading='isImporting',
    :pagination='{ rowsPerPage: 25 }',
    binary-state-sort
  )
    template(v-slot:body-cell-status='props')
      q-td(:props='props')
        .status-cell
          q-chip(
            :color='getStatusColor(props.value)',
            :icon='getStatusIcon(props.value)',
            :label='getStatusLabel(props.value)',
            size='sm'
          )

    template(v-slot:body-cell-actions='props')
      q-td(:props='props')
        .action-cell
          q-btn(
            v-if='props.row.status === "error"',
            size='sm',
            color='primary',
            icon='refresh',
            @click='$emit("retry", props.rowIndex)',
            :label='$t("common.action.retry")',
            flat
          )
          q-tooltip(v-if='props.row.status === "error" && props.row.error') {{ props.row.error }}

    template(v-slot:body-cell-error='props')
      q-td(:props='props')
        .error-cell
          span(v-if='props.value', :title='props.value') {{ truncateText(props.value, 50) }}
          span(v-else) -

  .table-footer(v-if='items.length > 0')
    .stats
      .stat-item
        .stat-label {{ $t('capital.importResultsTable.totalLabel') }}
        .stat-value {{ items.length }}
      .stat-item
        .stat-label {{ $t('capital.importResultsTable.successLabel') }}
        .stat-value.success {{ successCount }}
      .stat-item
        .stat-label {{ $t('capital.importResultsTable.errorLabel') }}
        .stat-value.error {{ errorCount }}
      .stat-item(v-if='isImporting')
        .stat-label {{ $t('capital.importResultsTable.progressLabel') }}
        .stat-value {{ (currentIndex ?? 0) + 1 }}/{{ items.length }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ICsvContributor } from 'app/extensions/capital/shared/lib/composables/useCsvParser';
import { t } from '../../i18n';

interface Props {
  items: ICsvContributor[];
  isImporting?: boolean;
  currentIndex?: number;
}

interface Emits {
  (e: 'retry', index: number): void;
  (e: 'retryAllFailed'): void;
  (e: 'clear'): void;
}

const props = defineProps<Props>();
defineEmits<Emits>();

const columns = [
  {
    name: 'username',
    label: t('capital.importResultsTable.columnUsername'),
    align: 'left' as const,
    field: 'username',
    sortable: true,
  },
  {
    name: 'contribution_amount',
    label: t('capital.importResultsTable.columnContributionAmount'),
    align: 'left' as const,
    field: 'contribution_amount',
    sortable: true,
  },
  {
    name: 'contributor_hash',
    label: t('capital.importResultsTable.columnContributorHash'),
    align: 'left' as const,
    field: 'contributor_hash',
    sortable: true,
  },
  {
    name: 'memo',
    label: t('capital.importResultsTable.columnMemo'),
    align: 'left' as const,
    field: 'memo',
    sortable: true,
  },
  {
    name: 'status',
    label: t('capital.importResultsTable.columnStatus'),
    align: 'center' as const,
    field: 'status',
  },
  {
    name: 'actions',
    label: t('capital.importResultsTable.columnActions'),
    align: 'center' as const,
    field: 'actions',
  },
  {
    name: 'error',
    label: t('capital.importResultsTable.columnError'),
    align: 'left' as const,
    field: 'error',
  },
];

const successCount = computed(() => {
  return props.items.filter((item) => item.status === 'success').length;
});

const errorCount = computed(() => {
  return props.items.filter((item) => item.status === 'error').length;
});

const hasErrors = computed(() => {
  return props.items.some((item) => item.status === 'error');
});

const getStatusColor = (status: string) => {
  switch (status) {
    case 'success':
      return 'positive';
    case 'error':
      return 'negative';
    case 'pending':
      return 'warning';
    default:
      return 'grey';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'success':
      return 'check_circle';
    case 'error':
      return 'error';
    case 'pending':
      return 'schedule';
    default:
      return 'help';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'success':
      return t('capital.importResultsTable.statusSuccess');
    case 'error':
      return t('capital.importResultsTable.statusError');
    case 'pending':
      return t('capital.importResultsTable.statusPending');
    default:
      return t('capital.importResultsTable.statusUnknown');
  }
};

const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};
</script>

<style lang="scss" scoped>
.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  .table-title {
    font-size: 18px;
    font-weight: 600;
  }

  .table-actions {
    display: flex;
    gap: 8px;
  }
}

.import-results-table {
  .status-cell {
    display: flex;
    justify-content: center;
  }

  .action-cell {
    display: flex;
    justify-content: center;
  }

  .error-cell {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.table-footer {
  margin-top: 16px;
  padding: 16px;
  border-radius: 4px;

  .stats {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;

    .stat-item {
      display: flex;
      align-items: center;
      gap: 8px;

      .stat-label {
        font-weight: 500;
      }

      .stat-value {
        font-weight: 600;

        &.success {
          color: #4caf50;
        }

        &.error {
          color: #f44336;
        }
      }
    }
  }
}
</style>

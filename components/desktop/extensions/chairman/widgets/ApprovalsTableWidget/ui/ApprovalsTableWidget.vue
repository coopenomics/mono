<template lang="pug">
div
  q-table(
    :rows='approvals',
    :columns='columns',
    row-key='approval_hash',
    :loading='loading',
    :pagination='pagination',
    @request='onRequest',
    binary-state-sort,
    flat,
    square,
    no-data-label='У председателя нет запросов предварительных одобрений'
  )


    template(#body='props')
      q-tr(:props='props')
        q-td(auto-width)
          ExpandToggleButton(
            :expanded='isExpanded(props.row.approval_hash)',
            @click='handleToggleExpand(props.row.approval_hash)'
          )

        q-td {{ props.row.username }}
        q-td {{ get_approval_action_label(props.row.callback_contract, props.row.callback_action_approve) }}
        q-td
          q-chip(
            :color='getStatusColor(props.row.status)',
            text-color='white',
            :label='getStatusLabel(props.row.status)',
            size='sm'
          )
        q-td {{ formatDate(props.row.created_at) }}
        q-td
          .row.items-center.q-gutter-sm
            ConfirmApprovalButton(
              v-if='props.row.status === "PENDING"'
              :approval-hash='props.row.approval_hash'
              :coopname='props.row.coopname'
              :approved-document='props.row.document'
            )
            DeclineApprovalButton(
              v-if='props.row.status === "PENDING" && is_approval_declinable(props.row.callback_contract, props.row.callback_action_approve)'
              :approval-hash='props.row.approval_hash'
              :coopname='props.row.coopname'
            )

      q-tr.q-virtual-scroll--with-prev(
        no-hover,
        v-if='isExpanded(props.row.approval_hash)',
        :key='`e_${props.row.approval_hash}`',
        :props='props'
      )
        q-td(colspan='6')
          div.row.justify-center
            BaseDocument(
              v-if='props.row.document'
              :documentAggregate='props.row.document'
            ).documents-gap.col-md-7.col-xs-12
</template>

<script lang="ts" setup>
import { onMounted, watch } from 'vue';
import type { IApproval } from 'app/extensions/chairman/entities/Approval/model/types';
import { ConfirmApprovalButton } from 'app/extensions/chairman/features/Approval/ConfirmApproval';
import { DeclineApprovalButton } from 'app/extensions/chairman/features/Approval/DeclineApproval';
import { get_approval_action_label, is_approval_declinable } from 'app/extensions/chairman/shared';
import { useExpandableState } from 'src/shared/lib/composables';
import { BaseDocument } from 'src/shared/ui/BaseDocument';
import type { Zeus } from '@coopenomics/sdk';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';


interface Props {
  approvals: IApproval[];
  loading?: boolean;
  pagination?: {
    page: number;
    rowsPerPage: number;
    sortBy: string;
    descending: boolean;
  };
}

interface Emits {
  (e: 'request', props: { pagination: any }): void;
}

const emit = defineEmits<Emits>();
const props = withDefaults(defineProps<Props>(), {
  approvals: () => [],
  loading: false,
  pagination: () => ({
    page: 1,
    rowsPerPage: 25,
    sortBy: 'created_at',
    descending: true,
  }),
});

// Управление развертыванием строк
const APPROVALS_EXPANDED_KEY = 'chairman_approvals_expanded';
const {
  loadExpandedState,
  cleanupExpandedByKeys,
  toggleExpanded,
  isExpanded,
} = useExpandableState(APPROVALS_EXPANDED_KEY);

// Загружаем состояние при монтировании
onMounted(() => {
  loadExpandedState();
});

// Определяем столбцы таблицы
const columns = [
  {
    name: 'expand',
    label: '',
    align: 'center' as const,
    field: 'expand' as const,
  },
  {
    name: 'username',
    label: 'Пользователь',
    align: 'left' as const,
    field: 'username' as const,
    sortable: true,
  },
  {
    name: 'callback_action_approve',
    label: 'Действие',
    align: 'left' as const,
    field: 'callback_action_approve' as const,
    sortable: true,
  },
  {
    name: 'status',
    label: 'Статус',
    align: 'center' as const,
    field: 'status' as const,
    sortable: true,
  },
  {
    name: 'created_at',
    label: 'Дата создания',
    align: 'left' as const,
    field: 'created_at' as const,
    sortable: true,
  },
  {
    name: 'actions',
    label: 'Действия',
    align: 'center' as const,
    field: 'actions' as const,
  },
];

// Получаем цвет для статуса
const getStatusColor = (status: Zeus.ApprovalStatus) => {
  switch (status) {
    case 'PENDING':
      return 'orange';
    case 'APPROVED':
      return 'positive';
    case 'DECLINED':
      return 'negative';
    default:
      return 'grey';
  }
};

// Получаем метку для статуса
const getStatusLabel = (status: Zeus.ApprovalStatus) => {
  switch (status) {
    case 'PENDING':
      return 'Ожидает';
    case 'APPROVED':
      return 'Одобрено';
    case 'DECLINED':
      return 'Отклонено';
    default:
      return status;
  }
};

// Форматируем дату
const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('ru-RU');
};

// Обработчик переключения развертывания
const handleToggleExpand = (approvalHash: string) => {
  toggleExpanded(approvalHash);
};

// Следим за изменениями в approvals и очищаем устаревшие состояния
watch(() => props.approvals, (newApprovals) => {
  if (newApprovals?.length) {
    const currentKeys: string[] = [];
    for (const approval of newApprovals) {
      if (approval) {
        currentKeys.push(approval.approval_hash);
      }
    }
    cleanupExpandedByKeys(currentKeys);
  }
}, { immediate: true });

// Обработчик запроса пагинации
const onRequest = (props: { pagination: any }) => {
  emit('request', props);
};
</script>

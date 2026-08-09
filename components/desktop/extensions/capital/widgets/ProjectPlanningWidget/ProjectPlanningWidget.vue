<template lang="pug">
.planning-table.table-wrap
  table.table
    thead
      tr
        th Показатель
        th.col-num План
        th.col-num Факт
    tbody
      tr(v-for='row in comparisonFields', :key='row.key')
        td
          .doc-primary {{ row.label }}
        td.col-num.t-mono {{ planCell(row.key) }}
        td.col-num.t-mono {{ factCell(row.key) }}
</template>

<script setup lang="ts">
import { toRefs } from 'vue';
import type {
  IProject,
  IProjectComponent,
  IProjectPermissions,
} from '../../entities/Project/model';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { formatHours } from 'src/shared/lib/utils/pluralizeHours';

const props = defineProps<{
  project: IProject | IProjectComponent | null | undefined;
  permissions?: IProjectPermissions | null;
  alwaysShowPlan?: boolean;
}>();

const { project } = toRefs(props);

const comparisonFields = [
  { key: 'hour_cost', label: 'Стоимость часа исполнителей' },
  { key: 'creators_hours', label: 'Требуемый ресурс времени исполнителей' },
  {
    key: 'creators_base_pool',
    label: 'Стоимость профессионального времени исполнителей',
  },
  {
    key: 'authors_base_pool',
    label: 'Стоимость профессионального времени соавторов',
  },
  {
    key: 'coordinators_base_pool',
    label: 'Стоимость профессионального времени координаторов',
  },
  {
    key: 'creators_bonus_pool',
    label: 'Стоимость общественно-полезного времени исполнителей',
  },
  {
    key: 'authors_bonus_pool',
    label: 'Стоимость общественно-полезного времени соавторов',
  },
  {
    key: 'contributors_bonus_pool',
    label: 'Распределение на участников Благороста',
  },
  { key: 'target_expense_pool', label: 'Дополнительные расходы' },
  { key: 'total_received_investments', label: 'Привлекаемые инвестиции' },
  {
    key: 'total',
    label: 'Стоимость результата интеллектуальной деятельности',
  },
];

const getPlanValue = (key: string) => {
  if (key === 'used_expense_pool') {
    return (project.value as any)?.plan?.['target_expense_pool'];
  }
  return (project.value as any)?.plan?.[key];
};

const formatValue = (value: unknown, fieldKey?: string): string => {
  if (value == null || value === '') {
    return '—';
  }

  if (fieldKey === 'creators_hours') {
    if (typeof value === 'number') {
      return formatHours(value);
    }
    return String(value);
  }

  if (fieldKey === 'use_invest_percent') {
    if (typeof value === 'number') {
      return `${value.toFixed(2)}%`;
    }
    return String(value);
  }

  if (typeof value === 'string') {
    return formatAsset2Digits(value);
  }
  if (typeof value === 'number') {
    return formatAsset2Digits(value.toString());
  }
  return String(value);
};

const planCell = (key: string): string => {
  if (!(props.alwaysShowPlan || project.value?.is_planed)) {
    return 'не установлено';
  }
  return formatValue(getPlanValue(key), key);
};

const factCell = (key: string): string => {
  return formatValue((project.value as any)?.fact?.[key], key);
};
</script>

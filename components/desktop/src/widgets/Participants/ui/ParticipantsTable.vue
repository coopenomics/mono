<template lang="pug">
q-table(
  flat,
  :grid='isMobile',
  :rows='accounts',
  :columns='columns',
  row-key='username',
  :pagination='pagination',
  virtual-scroll,
  :virtual-scroll-item-size='48',
  :rows-per-page-options='[10]',
  :loading='loading',
  :no-data-label='"У кооператива нет пайщиков"'
)
  template(#header='props')
    q-tr(:props='props')
      q-th(auto-width)
      q-th(v-for='col in props.cols', :key='col.name', :props='props') {{ col.label }}

  template(#body='props')
    q-tr(:key='`m_${props.row.username}`', :props='props')
      q-td(auto-width)
        ExpandToggleButton(
          :expanded='expanded.get(props.row.username)',
          @click='onToggleExpand(props.row.username)'
        )

      q-td(
        style='max-width: 150px; word-wrap: break-word; white-space: normal'
      ) {{ getName(props.row) }}
      q-td {{ props.row.username }}

      q-td {{ props.row.provider_account?.email || 'Не указан' }}

      q-td {{ formatDate(props.row.participant_account?.created_at) == '' ? 'отсутствует' : formatDate(props.row.participant_account?.created_at) }}

      q-td
        q-checkbox(
          :model-value='props.row.participant_account?.status === "accepted"',
          disable,
          color='primary',
          size='sm'
        )

    q-tr.q-virtual-scroll--with-prev.no-hover(
      no-hover,
      v-if='expanded.get(props.row.username)',
      :key='`e_${props.row.username}`',
      :props='props'
    )
      q-td.no-hover(colspan='100%' style="padding: 0px !important;")
        ParticipantDetails(
          :participant='props.row',
          @update='(newData) => onUpdate(props.row, newData)'
        )

  template(#item='props')
    ParticipantCard(
      :participant='props.row',
      :expanded='expanded.get(props.row.username)',
      @toggle-expand='() => onToggleExpand(props.row.username)',
      @update='onUpdate'
    )
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useWindowSize } from 'src/shared/hooks';
import moment from 'src/shared/lib/utils/dates/moment';
import { ParticipantCard, ParticipantDetails } from '.';
import { getName } from 'src/shared/lib/utils';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';
import {
  type IAccount,
  type IIndividualData,
  type IOrganizationData,
  type IEntrepreneurData,
} from 'src/entities/Account/types';

// Props
defineProps<{
  accounts: IAccount[];
  loading: boolean;
}>();

// Emits
const emit = defineEmits<{
  (e: 'toggle-expand', id: string): void;
  (
    e: 'update',
    account: IAccount,
    newData: IIndividualData | IOrganizationData | IEntrepreneurData,
  ): void;
}>();

// Локальное состояние
const expanded = reactive(new Map<string, boolean>());
const pagination = ref({ rowsPerPage: 10 });
const { isMobile } = useWindowSize();

// Колонки таблицы
const columns: any[] = [
  {
    name: 'name',
    align: 'left',
    label: 'ФИО / Наименование',
    field: 'name',
    sortable: true,
  },
  {
    name: 'username',
    align: 'left',
    label: 'Аккаунт',
    field: 'username',
    sortable: true,
  },
  {
    name: 'email',
    align: 'left',
    label: 'Email',
    field: 'email',
    sortable: true,
  },
  {
    name: 'created_at',
    align: 'left',
    label: 'Дата вступления',
    field: 'created_at',
    sortable: true,
  },
  {
    name: 'status',
    align: 'left',
    label: 'Активен',
    field: 'status',
    sortable: true,
  },
];

// Форматирование даты
const formatDate = (date?: string) =>
  date ? moment(date).format('DD.MM.YY HH:mm:ss') : '';

// События
const onToggleExpand = (id: string) => {
  expanded.set(id, !expanded.get(id));
  emit('toggle-expand', id);
};

const onUpdate = (
  account: IAccount,
  newData: IIndividualData | IOrganizationData | IEntrepreneurData,
) => {
  emit('update', account, newData);
};
</script>

<style>
.no-hover.q-tr--hover,
.no-hover.q-table__tr--hover,
.no-hover:hover,
.no-hover:focus {
  background: transparent !important;
  box-shadow: none !important;
  cursor: default !important;
}
</style>

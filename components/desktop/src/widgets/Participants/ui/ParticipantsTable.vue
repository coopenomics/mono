<template lang="pug">
q-table.participants-table(
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

      q-td {{ joinDate(props.row) }}

      q-td
        .participants-table__status
          BaseBadge(:variant='getAccountStatusBadge(props.row).variant') {{ getAccountStatusBadge(props.row).label }}

      q-td
        .participants-table__verification
          BaseBadge(:variant='verificationCell(props.row).variant') {{ verificationCell(props.row).short }}
            q-tooltip {{ verificationCell(props.row).tooltip }}

    q-tr.q-virtual-scroll--with-prev.no-hover(
      no-hover,
      v-if='expanded.get(props.row.username)',
      :key='`e_${props.row.username}`',
      :props='props'
    )
      q-td.no-hover(colspan='100%' style="padding: 0px !important;")
        ParticipantDetails(
          :participant='props.row',
          :naming='naming',
          @update='(newData) => onUpdate(props.row, newData)',
          @verification-changed='emit("verification-changed")'
        )

  template(#item='props')
    ParticipantCard(
      :participant='props.row',
      :expanded='expanded.get(props.row.username)',
      :naming='naming',
      @toggle-expand='() => onToggleExpand(props.row.username)',
      @update='onUpdate',
      @verification-changed='emit("verification-changed")'
    )
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useWindowSize } from 'src/shared/hooks';
import moment from 'src/shared/lib/utils/dates/moment';
import { ParticipantCard, ParticipantDetails } from '.';
import { getName } from 'src/shared/lib/utils';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';
import { getAccountStatusBadge } from 'src/entities/Account';
import {
  highestVerificationLevel,
  participantVerificationView,
  verificationBadgeVariant,
  type VerificationNaming,
} from 'src/shared/lib/verification';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge';
import {
  type IAccount,
  type IIndividualData,
  type IOrganizationData,
  type IEntrepreneurData,
} from 'src/entities/Account/types';

// Props
const props = defineProps<{
  accounts: IAccount[];
  loading: boolean;
  /** Как называть верификатора и участок в подписи уровня. */
  naming?: VerificationNaming;
}>();

// Emits
const emit = defineEmits<{
  (e: 'toggle-expand', id: string): void;
  (e: 'verification-changed'): void;
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
    label: 'Статус',
    field: 'status',
    sortable: true,
  },
  {
    name: 'verification',
    align: 'left',
    label: 'Верификация',
    field: 'verification',
  },
];

// Ячейка верификации: показываем один уровень — самый высокий из достигнутых
// (уровни складываются в лестницу, и совету важно, докуда пайщик поднялся), а
// у неверифицированного — тот же бейдж со своей подписью. Хелпер возвращает
// ячейку всегда: ветвление по null в шаблоне обходится без сужения типов,
// которого Vue-шаблону не даёт вызов функции.
const NOT_VERIFIED_CELL = {
  variant: 'neutral' as BaseBadgeVariant,
  short: 'Не верифицирован',
  tooltip: 'Личность не подтверждена: паспорт сверяет председатель совета или кооперативный участок',
};

const verificationCell = (row: IAccount) => {
  const level = highestVerificationLevel(participantVerificationView(row, props.naming));
  if (!level) return NOT_VERIFIED_CELL;
  return {
    variant: verificationBadgeVariant(level.type),
    short: level.short,
    tooltip: level.hint ? `${level.label} — ${level.hint}` : level.label,
  };
};

// Форматирование даты
const formatDate = (date?: string) =>
  date ? moment(date).format('DD.MM.YY HH:mm:ss') : '';

// Дата вступления: дата приёма советом (participant_account.created_at). У вышедших
// пайщик-запись стёрта (delpartcpnt) — фолбэк на дату регистрации аккаунта on-chain
// (user_account.registered_at), чтобы не показывать «отсутствует».
const joinDate = (row: IAccount): string => {
  const raw = row.participant_account?.created_at || row.user_account?.registered_at;
  const f = formatDate(raw ? String(raw) : undefined);
  return f === '' ? 'отсутствует' : f;
};

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
.participants-table__status {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
}

.participants-table__verification {
  display: flex;
  align-items: center;
  gap: var(--p-1);
  flex-wrap: wrap;
}

/* Грид-режим (мобайл): карточки во всю ширину. Вертикальный отступ задаёт
   сама .participant-card (margin-bottom) — его virtual-scroll учитывает,
   тогда как margin/padding на grid-item игнорируется. */
.participants-table .q-table__grid-item {
  width: 100%;
  padding: 0;
}

.no-hover.q-tr--hover,
.no-hover.q-table__tr--hover,
.no-hover:hover,
.no-hover:focus {
  background: transparent !important;
  box-shadow: none !important;
  cursor: default !important;
}
</style>

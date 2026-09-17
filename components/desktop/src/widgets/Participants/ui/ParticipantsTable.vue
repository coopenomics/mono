<template lang="pug">
div
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
        q-th(v-for='col in props.cols', :key='col.name', :props='props') {{ col.label }}
        q-th(auto-width)

    //- Строка открывает данные пайщика в правом дроуэре (канон вместо
    //- раскрывающихся строк); «Подробнее» — явная подсказка, что это можно.
    template(#body='props')
      q-tr.participants-table__row(:key='props.row.username', :props='props', @click='openDetails(props.row)')
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

        q-td(auto-width)
          BaseButton(variant='ghost', size='sm', @click.stop='openDetails(props.row)')
            q-icon.q-mr-xs(name='open_in_new', size='16px')
            | Подробнее

    //- Ключ обязателен: грид-режим Quasar рендерит карточки без ключа, и Vue
    //- сопоставлял их по позиции — после смены страницы или фильтра карточка
    //- показывала шапку нового пайщика.
    template(#item='props')
      ParticipantCard(
        :key='props.row.username',
        :participant='props.row',
        @open='openDetails(props.row)'
      )

  //- Данные пайщика: верификация, сброс второго фактора, сведения при
  //- вступлении, редактируемая анкета. На телефоне дроуэр во весь экран.
  DetailsDrawer(
    v-model='detailsOpen',
    :title='selected ? getName(selected) : "Пайщик"',
    :width='640'
  )
    ParticipantDetails(
      v-if='selected',
      :key='selected.username',
      :participant='selected',
      :naming='naming',
      @update='(newData) => onUpdate(selected, newData)',
      @verification-changed='emit("verification-changed")'
    )
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useWindowSize } from 'src/shared/hooks';
import moment from 'src/shared/lib/utils/dates/moment';
import { ParticipantCard, ParticipantDetails } from '.';
import { getName } from 'src/shared/lib/utils';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseBadge } from 'src/shared/ui/base/BaseBadge';
import { DetailsDrawer } from 'src/shared/ui/domain';
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
  (e: 'verification-changed'): void;
  (
    e: 'update',
    account: IAccount,
    newData: IIndividualData | IOrganizationData | IEntrepreneurData,
  ): void;
}>();

// Локальное состояние
// Открытый в дроуэре пайщик. Храним имя аккаунта, а запись берём из свежего
// списка: после правки анкеты или верификации список перечитывается, и дроуэр
// должен показывать уже обновлённые данные.
const detailsOpen = ref(false);
const selectedUsername = ref<string | null>(null);
const selected = computed(() =>
  props.accounts.find((account) => account.username === selectedUsername.value) ?? null,
);
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
const openDetails = (account: IAccount) => {
  selectedUsername.value = account.username;
  detailsOpen.value = true;
};

const onUpdate = (
  account: IAccount | null,
  newData: IIndividualData | IOrganizationData | IEntrepreneurData,
) => {
  if (account) emit('update', account, newData);
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

.participants-table__row {
  cursor: pointer;
}
</style>

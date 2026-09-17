<template lang="pug">
div
  //- Компьютер: канон-таблица. Строка открывает данные пайщика в правом
  //- дроуэре, «Подробнее» — явная подсказка, что это можно. Все пайщики
  //- кооператива уже загружены страницей, поэтому показываем их целиком с
  //- сортировкой, без нарезки на страницы.
  template(v-if='!isMobile')
    BaseTable(
      v-if='firstLoad || accounts.length',
      :columns='columns',
      :rows='accounts',
      row-key='username',
      :loading='loading',
      :skeleton-rows='8',
      clickable-rows,
      sticky-header,
      max-height='70vh',
      min-width='960px',
      sort-by='created_at',
      descending,
      @row-click='openDetails'
    )
      template(#cell-status='{ row }')
        BaseBadge(:variant='getAccountStatusBadge(row).variant') {{ getAccountStatusBadge(row).label }}

      template(#cell-verification='{ row }')
        BaseBadge(:variant='verificationCell(row).variant') {{ verificationCell(row).short }}
          q-tooltip {{ verificationCell(row).tooltip }}

      template(#cell-actions='{ row }')
        BaseButton(variant='ghost', size='sm', @click.stop='openDetails(row)')
          q-icon.q-mr-xs(name='open_in_new', size='16px')
          | Подробнее

    EmptyState(v-else, title='Пайщиков не найдено', body='Под выбранный фильтр никто не подходит, или в кооперативе пока нет пайщиков.')
      template(#icon)
        q-icon(name='groups', size='32px')

  //- Телефон: карточки; каждая открывает тот же дроуэр во весь экран.
  template(v-else)
    CardListSkeleton(v-if='firstLoad', :count='4')
    .participants-list(v-else-if='accounts.length')
      ParticipantCard(
        v-for='account in accounts',
        :key='account.username',
        :participant='account',
        @open='openDetails(account)'
      )
    EmptyState(v-else, title='Пайщиков не найдено', body='Под выбранный фильтр никто не подходит, или в кооперативе пока нет пайщиков.')
      template(#icon)
        q-icon(name='groups', size='32px')

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
import {
  BaseBadge,
  BaseButton,
  BaseTable,
  CardListSkeleton,
  EmptyState,
  type BaseTableColumn,
} from 'src/shared/ui/base';
import { DetailsDrawer } from 'src/shared/ui/domain';
import { useFirstLoad } from 'src/shared/lib/composables';
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
const { isMobile } = useWindowSize();

// Каркас и пустое состояние — только по первой загрузке: повторные дочитки
// (после правки анкеты, верификации) идут молча, без мерцания.
const firstLoad = useFirstLoad(() => props.loading);

// Дата вступления для сортировки: та же, что в ячейке, но числом.
const joinTimestamp = (row: IAccount): number => {
  const raw = row.participant_account?.created_at || row.user_account?.registered_at;
  return raw ? moment(String(raw)).valueOf() : 0;
};

// Колонки таблицы
const columns: BaseTableColumn<IAccount>[] = [
  { key: 'name', label: 'ФИО / Наименование', field: (row) => getName(row), sortable: true },
  { key: 'username', label: 'Аккаунт', field: 'username', width: '140px', nowrap: true, sortable: true },
  {
    key: 'email',
    label: 'Email',
    field: (row) => row.provider_account?.email || 'Не указан',
    width: '220px',
    sortable: true,
  },
  {
    key: 'created_at',
    label: 'Дата вступления',
    field: (row) => joinDate(row),
    width: '160px',
    nowrap: true,
    sortable: true,
    sort: (_a, _b, rowA, rowB) => joinTimestamp(rowA) - joinTimestamp(rowB),
  },
  {
    key: 'status',
    label: 'Статус',
    field: (row) => getAccountStatusBadge(row).label,
    width: '200px',
    sortable: true,
  },
  {
    key: 'verification',
    label: 'Верификация',
    field: (row) => verificationCell(row).short,
    width: '170px',
    sortable: true,
  },
  { key: 'actions', label: '', width: '140px', align: 'right' },
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
/* Телефон: карточки столбиком, отступ задаёт сама .participant-card. */
.participants-list {
  display: flex;
  flex-direction: column;
}

</style>

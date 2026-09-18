<template lang="pug">
div
  //- Компьютер: канон-таблица. Строка открывает данные пайщика в правом
  //- дроуэре, «Подробнее» — явная подсказка, что это можно. Страницы, отбор и
  //- сортировку по дате вступления делает сервер.
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
      min-width='1460px',
      server-sort,
      :sort-by='sortBy',
      :descending='sortDescending',
      @sort='(sort) => emit("sort", sort)',
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

      template(v-if='showPager', #footer)
        TablePager(
          label='Пайщики',
          :page='pagination.page',
          :rows-per-page='pagination.rowsPerPage',
          :rows-number='pagination.rowsNumber',
          @update:page='(page) => emit("update:page", page)'
        )

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
      TablePager(
        v-if='showPager',
        label='Пайщики',
        :page='pagination.page',
        :rows-per-page='pagination.rowsPerPage',
        :rows-number='pagination.rowsNumber',
        @update:page='(page) => emit("update:page", page)'
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
  TablePager,
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
  /** Текущая страница реестра; число строк всего знает сервер. */
  pagination: { page: number; rowsPerPage: number; rowsNumber: number };
  /** Колонка сортировки: `created_at` (добавлен) или `joined_at` (вступил). */
  sortBy: string;
  /** Сначала новые (true) или сначала старые. */
  sortDescending: boolean;
}>();

// Emits
const emit = defineEmits<{
  (e: 'verification-changed'): void;
  (e: 'update:page', page: number): void;
  (e: 'sort', sort: { sortBy: string; descending: boolean }): void;
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
// Снимок на момент открытия — на случай, если пайщика нет в текущей странице
// (переключили страницу или отбор, не закрыв дроуэр).
const selectedSnapshot = ref<IAccount | null>(null);
const selected = computed(
  () =>
    props.accounts.find((account) => account.username === selectedUsername.value) ??
    selectedSnapshot.value,
);
const { isMobile } = useWindowSize();

// Каркас и пустое состояние — только по первой загрузке: повторные дочитки
// (после правки анкеты, верификации) идут молча, без мерцания.
const firstLoad = useFirstLoad(() => props.loading);

// Переключатель страниц нужен, только когда пайщиков больше одной страницы.
const showPager = computed(() => props.pagination.rowsNumber > props.pagination.rowsPerPage);

// Колонки таблицы. Даты две, и они о разном: «Добавлен» — когда запись о
// человеке появилась на узле (есть у всех), «Вступил» — когда его принял совет
// (у заявок ещё нет). Сортируют обе на сервере: реестр приходит страницами, и
// сортировка одной страницы вводила бы в заблуждение. Остальные поля в базе
// узла не лежат, по ним сортировки нет. Сумма заданных ширин (1200px) меньше
// min-width таблицы (1460px) — остаток достаётся колонке ФИО; без этого запаса
// она схлопывалась в ноль и буквы шли столбиком.
const columns: BaseTableColumn<IAccount>[] = [
  { key: 'name', label: 'ФИО / Наименование', field: (row) => getName(row) },
  { key: 'username', label: 'Аккаунт', field: 'username', width: '140px', nowrap: true },
  {
    key: 'email',
    label: 'Email',
    field: (row) => row.provider_account?.email || 'Не указан',
    width: '220px',
  },
  {
    key: 'created_at',
    label: 'Добавлен',
    field: (row) => addedDate(row),
    width: '170px',
    nowrap: true,
    sortable: true,
  },
  {
    key: 'joined_at',
    label: 'Дата вступления',
    field: (row) => joinDate(row),
    width: '190px',
    nowrap: true,
    sortable: true,
  },
  { key: 'status', label: 'Статус', field: (row) => getAccountStatusBadge(row).label, width: '200px' },
  { key: 'verification', label: 'Верификация', field: (row) => verificationCell(row).short, width: '170px' },
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
// Когда запись о человеке появилась на узле: у заявок это дата подачи, у
// заведённых председателем — дата заведения. Есть у всех.
const addedDate = (row: IAccount): string => {
  const raw = row.provider_account?.created_at;
  return raw ? formatDate(String(raw)) : 'отсутствует';
};

const joinDate = (row: IAccount): string => {
  const raw = row.participant_account?.created_at || row.user_account?.registered_at;
  const f = formatDate(raw ? String(raw) : undefined);
  return f === '' ? 'отсутствует' : f;
};

// События
const openDetails = (account: IAccount) => {
  selectedUsername.value = account.username;
  selectedSnapshot.value = account;
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

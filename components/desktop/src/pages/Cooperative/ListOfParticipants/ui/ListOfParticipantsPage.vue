<template lang="pug">
q-page.participants-page
  PageTabs.participants-page__tabs(
    :tabs='tabs',
    :active-key='activeTab',
    @select='(tab) => (activeTab = tab.key)'
  )

  .participants-page__card(v-if='activeTab === "participants"')
    FilterBar.q-mb-md(
      hide-search,
      :filters='verificationFilterDefs',
      v-model='filterValues'
    )
    ParticipantsTable(
      :accounts='accountStore.accounts.items',
      :loading='onLoading',
      :pagination='pagination',
      :sort-descending='sortDescending',
      @update:page='goToPage',
      @sort='changeSort',
      :naming='verificationNaming',
      @update='update',
      @verification-changed='onVerificationChanged'
    )

  VerificationsJournal(
    v-else,
    ref='journalRef',
    :naming='verificationNaming',
    @changed='loadParticipants'
  )
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { FilterBar, type FilterDefinition, type FilterValues } from 'src/shared/ui/domain/FilterBar';
import type { VerificationNaming } from 'src/shared/lib/verification';
import { useBranchStore } from 'src/entities/Branch/model';
import { useSystemStore } from 'src/entities/System/model';
import { getName } from 'src/shared/lib/utils';
import { FailAlert } from 'src/shared/api';
import { useAccountStore } from 'src/entities/Account/model';
import { useSessionStore } from 'src/entities/Session';
import { AddUserButton } from 'src/features/User/AddUser/ui';
import { ImportParticipantsButton } from 'src/features/User/ImportParticipants';
import { ParticipantsTable } from 'src/widgets/Participants';
import { VerificationsJournal } from 'src/widgets/Verifications';
import { PageTabs, type PageTab } from 'src/shared/ui/layout/PageTabs';
import { useHeaderActions } from 'src/shared/hooks';
import {
  AccountTypes,
  type IAccount,
  type IIndividualData,
  type IOrganizationData,
  type IEntrepreneurData,
  type IGetAccounts,
} from 'src/entities/Account/types';

const accountStore = useAccountStore();
const session = useSessionStore();
const branchStore = useBranchStore();
const systemStore = useSystemStore();
const onLoading = ref(false);

// Подписи уровней верификации — человеческими именами: кто сверил личность
// и на каком участке. Служебные account-id и имена участков в цепи остаются
// запасным вариантом, когда человеческого имени нет.
//
// Реестр приходит страницами, и сверявший (председатель, доверенное лицо
// участка) может оказаться на другой странице. Поэтому имена берём из
// загруженной страницы, а недостающие дочитываем по одному и запоминаем.
const knownNames = reactive(new Map<string, string>());
const requestedNames = new Set<string>();
const resolveName = (username: string): string => {
  const known = knownNames.get(username);
  if (known !== undefined) return known;
  if (username && !requestedNames.has(username)) {
    requestedNames.add(username);
    void accountStore
      .fetchAccount(username)
      .then((account) => knownNames.set(username, (account && getName(account)) || ''))
      .catch(() => knownNames.set(username, ''));
  }
  return '';
};
watch(
  () => accountStore.accounts.items,
  (items) => {
    for (const account of items) knownNames.set(account.username, getName(account) || '');
  },
  { immediate: true },
);

const verificationNaming = computed((): VerificationNaming => {
  const branches = new Map(
    branchStore.publicBranches.map((branch) => [
      branch.braname,
      branch.short_name || branch.full_name || branch.braname,
    ]),
  );
  return {
    attestorName: resolveName,
    branchName: (braname: string) => branches.get(braname) || '',
  };
});

// Фильтр по уровню верификации: совету важно видеть, кого ещё предстоит
// верифицировать на кооперативных участках (без базового уровня — нужен паспорт).
const verificationFilterDefs: FilterDefinition[] = [
  {
    key: 'verification',
    label: 'Верификация',
    type: 'select',
    options: [
      { label: 'Все', value: '' },
      { label: 'Без базовой — нужен паспорт', value: 'no_passport' },
      { label: 'С базовой — паспорт проверен', value: 'passport' },
      { label: 'Не верифицированные', value: 'none' },
    ],
  },
];
const filterValues = ref<FilterValues>({});

// Отбор по верификации и постраничность делает сервер: уровни верификации
// живут в цепи, и отбирать их на одной загруженной странице было бы неверно.
const VERIFICATION_FILTER = {
  no_passport: 'NO_PASSPORT',
  passport: 'PASSPORT',
  none: 'NONE',
} as const;
type AccountsInput = NonNullable<IGetAccounts['data']>;

const PAGE_SIZE = 20;
const page = ref(1);
// Сортировка по дате вступления (на сервере): сначала новые. Ещё не принятые
// советом — без даты — при этом порядке идут первыми.
const sortDescending = ref(true);
const pagination = computed(() => ({
  page: page.value,
  rowsPerPage: PAGE_SIZE,
  rowsNumber: accountStore.accounts.totalCount,
}));

// Вторая вкладка — журнал верификаций: что, когда и кем сверено. Совету он
// нужен как рабочая очередь: сверки с участков ждут его решения.
const activeTab = ref('participants');
const journalRef = ref<InstanceType<typeof VerificationsJournal> | null>(null);
// Журнал верификаций читает и решает только председатель совета — остальным
// сервер откажет, и вкладка была бы кнопкой в никуда.
const tabs = computed((): PageTab[] => [
  { key: 'participants', label: 'Пайщики', count: accountStore.accounts.totalCount },
  ...(session.isChairman ? [{ key: 'verifications', label: 'Верификации' }] : []),
]);

// Сверка из реестра сразу попадает в журнал — перечитываем оба списка, чтобы
// вкладки не расходились.
const onVerificationChanged = async () => {
  await loadParticipants();
  await journalRef.value?.reload();
};

// Инжектим кнопку добавления пользователя в заголовок
const { registerAction } = useHeaderActions();

onMounted(() => {
  registerAction({
    id: 'add-user',
    component: AddUserButton,
    order: 1,
  });
  registerAction({
    id: 'import-participants',
    component: ImportParticipantsButton,
    order: 2,
  });
});

const loadParticipants = async () => {
  try {
    onLoading.value = true;
    const selected = filterValues.value.verification as keyof typeof VERIFICATION_FILTER | undefined;
    const verification = selected ? VERIFICATION_FILTER[selected] : undefined;
    await accountStore.getAccounts({
      data: (verification ? { verification } : {}) as AccountsInput,
      options: {
        page: page.value,
        limit: PAGE_SIZE,
        sortBy: `joined_at:${sortDescending.value ? 'desc' : 'asc'}`,
        sortOrder: sortDescending.value ? 'DESC' : 'ASC',
      },
    });
    // Названия участков нужны только для подписи «где сверили» — грузим их
    // один раз и не роняем реестр, если участков в кооперативе нет.
    if (!branchStore.publicBranches.length) {
      await branchStore.loadPublicBranches({ coopname: systemStore.info.coopname }).catch(() => undefined);
    }
  } catch (e: any) {
    FailAlert(e);
  } finally {
    onLoading.value = false;
  }
};

const changeSort = (descending: boolean) => {
  sortDescending.value = descending;
  page.value = 1;
  void loadParticipants();
};

const goToPage = (next: number) => {
  page.value = next;
  void loadParticipants();
};

// Сменили отбор — показываем его с первой страницы.
watch(
  () => filterValues.value.verification,
  () => {
    page.value = 1;
    void loadParticipants();
  },
);

loadParticipants();

const update = (
  account: IAccount,
  newData: IIndividualData | IOrganizationData | IEntrepreneurData,
) => {
  switch (account.private_account?.type) {
    case AccountTypes.individual:
      account.private_account.individual_data = {
        ...(newData as IIndividualData),
        passport: (newData as IIndividualData).passport ?? undefined,
      };
      break;
    case AccountTypes.entrepreneur:
      account.private_account.entrepreneur_data = newData as IEntrepreneurData;
      break;
    case AccountTypes.organization:
      account.private_account.organization_data = newData as IOrganizationData;
      break;
  }
  // Смена паспорта снимает сверку на сервере — перечитываем реестр и журнал,
  // чтобы бейдж верификации не показывал прежний уровень.
  void onVerificationChanged();
};
</script>

<style lang="scss" scoped>
.participants-page {
  /* Сверху отступа нет: полоса вкладок примыкает к шапке, как ей и положено —
     её собственная высота и нижняя линия и создают разделение. */
  padding: 0 var(--p-6, 24px) var(--p-6, 24px);
}

/* Таблица реестра в обрамлённой канон-поверхности */
.participants-page__card {
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 16px);
  overflow: hidden;
}

/* Мобайл (<768px ⇒ q-table grid-режим): пайщики рендерятся карточками, у
   каждой своя рамка. Внешняя обрамлённая поверхность страницы тут лишняя —
   даёт «подложку»/двойное обрамление, поэтому убираем её, карточки лежат
   прямо на холсте. На десктопе рамка остаётся (там таблица). */
@media (max-width: 767px) {
  .participants-page {
    padding: 0 var(--p-4, 16px) var(--p-4, 16px);
  }

  .participants-page__card {
    background: transparent;
    border: none;
    border-radius: 0;
    overflow: visible;
  }
}
</style>

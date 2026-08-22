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
      :accounts='filteredAccounts',
      :loading='onLoading',
      :naming='verificationNaming',
      @toggle-expand='toggleExpand',
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
import { ref, reactive, computed, onMounted } from 'vue';
import { FilterBar, type FilterDefinition, type FilterValues } from 'src/shared/ui/domain/FilterBar';
import { participantVerificationView, type VerificationNaming } from 'src/shared/lib/verification';
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
} from 'src/entities/Account/types';

const accountStore = useAccountStore();
const session = useSessionStore();
const branchStore = useBranchStore();
const systemStore = useSystemStore();
const onLoading = ref(false);

// Подписи уровней верификации — человеческими именами: кто сверил личность
// и на каком участке. Служебные account-id и имена участков в цепи остаются
// запасным вариантом, когда человеческого имени нет.
const verificationNaming = computed((): VerificationNaming => {
  const names = new Map(accountStore.accounts.items.map((account) => [account.username, getName(account)]));
  const branches = new Map(
    branchStore.publicBranches.map((branch) => [
      branch.braname,
      branch.short_name || branch.full_name || branch.braname,
    ]),
  );
  return {
    attestorName: (username: string) => names.get(username) || '',
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
const filteredAccounts = computed(() => {
  const selected = filterValues.value.verification;
  const items = accountStore.accounts.items;
  if (!selected) return items;
  return items.filter((account) => {
    const types = participantVerificationView(account).map((level) => level.type);
    if (selected === 'no_passport') return !types.includes('passport_onsite');
    if (selected === 'passport') return types.includes('passport_onsite');
    if (selected === 'none') return types.length === 0;
    return true;
  });
});
const expanded = reactive(new Map<string, boolean>());

// Вторая вкладка — журнал верификаций: что, когда и кем сверено. Совету он
// нужен как рабочая очередь: сверки с участков ждут его решения.
const activeTab = ref('participants');
const journalRef = ref<InstanceType<typeof VerificationsJournal> | null>(null);
// Журнал верификаций читает и решает только председатель совета — остальным
// сервер откажет, и вкладка была бы кнопкой в никуда.
const tabs = computed((): PageTab[] => [
  { key: 'participants', label: 'Пайщики', count: accountStore.accounts.items.length },
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

const toggleExpand = (id: string) => {
  expanded.set(id, !expanded.get(id));
};

const loadParticipants = async () => {
  try {
    onLoading.value = true;
    await accountStore.getAccounts({
      options: { page: 1, limit: 1000, sortOrder: 'DESC' },
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
};
</script>

<style lang="scss" scoped>
.participants-page {
  /* Сверху отступа нет: полоса вкладок примыкает к шапке, как ей и положено —
     её собственная высота и нижняя линия и создают разделение. */
  padding: 0 var(--p-6, 24px) var(--p-6, 24px);
}

/* Полоса вкладок тянется во всю ширину страницы: её нижняя линия отделяет
   вкладки от содержимого, а обрезанная по бокам линия читается как ошибка. */
.participants-page__tabs {
  margin: 0 calc(-1 * var(--p-6, 24px)) var(--p-4, 16px);
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

  .participants-page__tabs {
    margin: 0 calc(-1 * var(--p-4, 16px)) var(--p-3, 12px);
  }
  .participants-page__card {
    background: transparent;
    border: none;
    border-radius: 0;
    overflow: visible;
  }
}
</style>

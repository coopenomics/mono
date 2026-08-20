<template lang="pug">
q-page.participants-page
  .participants-page__card
    FilterBar.q-mb-md(
      hide-search,
      :filters='verificationFilterDefs',
      v-model='filterValues'
    )
    ParticipantsTable(
      :accounts='filteredAccounts',
      :loading='onLoading',
      @toggle-expand='toggleExpand',
      @update='update'
    )
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { FilterBar, type FilterDefinition, type FilterValues } from 'src/shared/ui/domain/FilterBar';
import { participantVerificationView } from 'src/shared/lib/verification';
import { FailAlert } from 'src/shared/api';
import { useAccountStore } from 'src/entities/Account/model';
import { AddUserButton } from 'src/features/User/AddUser/ui';
import { ImportParticipantsButton } from 'src/features/User/ImportParticipants';
import { ParticipantsTable } from 'src/widgets/Participants';
import { useHeaderActions } from 'src/shared/hooks';
import {
  AccountTypes,
  type IAccount,
  type IIndividualData,
  type IOrganizationData,
  type IEntrepreneurData,
} from 'src/entities/Account/types';

const accountStore = useAccountStore();
const onLoading = ref(false);

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
  padding: var(--p-6, 24px);
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
    padding: var(--p-4, 16px);
  }
  .participants-page__card {
    background: transparent;
    border: none;
    border-radius: 0;
    overflow: visible;
  }
}
</style>

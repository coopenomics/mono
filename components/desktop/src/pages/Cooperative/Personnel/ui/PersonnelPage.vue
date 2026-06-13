<template lang="pug">
q-page.personnel-page
  BaseBanner.personnel-page__hint(variant='info')
    | Назначайте пайщикам роли — наборы возможностей (например «Бухгалтер», «Кассир»).
    | Роль открывает доступ к соответствующим столам и страницам кооператива.

  .personnel-page__card
    q-table.personnel-table(
      flat,
      :grid='isMobile',
      :rows='accountStore.accounts.items',
      :columns='columns',
      row-key='username',
      :pagination='pagination',
      :rows-per-page-options='[10, 20, 50]',
      :loading='onLoading',
      :no-data-label='"У кооператива нет пайщиков"'
    )
      template(#body-cell-actions='props')
        q-td(:props='props')
          BaseButton(variant='ghost', size='sm', @click='openRoles(props.row)')
            template(#icon-left)
              q-icon(name='manage_accounts', size='18px')
            | Роли

      template(#item='props')
        .personnel-card
          .personnel-card__info
            .personnel-card__name {{ getName(props.row) }}
            .personnel-card__login {{ props.row.username }}
          BaseButton(variant='ghost', size='sm', @click='openRoles(props.row)')
            template(#icon-left)
              q-icon(name='manage_accounts', size='18px')
            | Роли

  BaseDialog(
    :model-value='dialogOpen',
    :title='dialogTitle',
    size='md',
    @update:model-value='onDialog'
  )
    .personnel-roles
      .personnel-roles__label.t-sm Назначенные роли
      .personnel-roles__chips(v-if='assignments.length')
        BaseChip(v-for='a in assignments', :key='a.setKey', variant='accent')
          | {{ titleOf(a.setKey) }}
          q-icon.personnel-roles__remove(
            name='close',
            size='14px',
            role='button',
            aria-label='Снять роль',
            @click='onRevoke(a.setKey)'
          )
      EmptyState(
        v-else,
        title='Ролей пока нет',
        caption='Добавьте роль из списка ниже'
      )

      .personnel-roles__add
        BaseSelect(
          v-model='selectedSet',
          :options='addableOptions',
          label='Добавить роль',
          placeholder='Выберите набор возможностей'
        )
        .personnel-roles__grants(v-if='selectedGrants.length')
          span.t-sm.t-muted Эта роль открывает:
          .personnel-roles__grant-chips
            BaseChip(
              v-for='g in selectedGrants',
              :key='g.action + g.resource',
              variant='neutral',
              size='sm'
            ) {{ g.action }} · {{ g.resource }}

    template(#footer)
      BaseButton(variant='ghost', @click='dialogOpen = false') Закрыть
      BaseButton(
        variant='primary',
        :disabled='!selectedSet',
        :loading='saving',
        @click='onAssign'
      ) Назначить
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useWindowSize } from 'src/shared/hooks';
import { getName } from 'src/shared/lib/utils';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { useAccountStore } from 'src/entities/Account/model';
import { useCapabilitySets } from 'src/features/Personnel';
import type { IAccount } from 'src/entities/Account/types';

const accountStore = useAccountStore();
const onLoading = ref(false);
const { isMobile } = useWindowSize();
const pagination = ref({ rowsPerPage: 10 });

const { catalog, assignments, loadCatalog, loadFor, assign, revoke } = useCapabilitySets();

const dialogOpen = ref(false);
const target = ref<IAccount | null>(null);
const selectedSet = ref<string>('');
const saving = ref(false);

const dialogTitle = computed(() =>
  target.value ? `Роли пайщика: ${getName(target.value)}` : 'Роли пайщика',
);

const titleOf = (setKey: string): string =>
  catalog.value.find((c) => c.setKey === setKey)?.title ?? setKey;

// Наборы, ещё не назначенные этому пайщику — для селекта добавления.
const addableOptions = computed(() =>
  catalog.value
    .filter((c) => !assignments.value.some((a) => a.setKey === c.setKey))
    .map((c) => ({ value: c.setKey, label: c.title })),
);

// Что откроет выбранный в селекте набор (демонстрация «роль → доступ»).
const selectedGrants = computed(
  () => catalog.value.find((c) => c.setKey === selectedSet.value)?.grants ?? [],
);

const columns: any[] = [
  { name: 'name', align: 'left', label: 'ФИО / Наименование', field: 'name', sortable: true },
  { name: 'username', align: 'left', label: 'Аккаунт', field: 'username', sortable: true },
  { name: 'actions', align: 'right', label: '', field: 'actions' },
];

const openRoles = async (row: IAccount): Promise<void> => {
  target.value = row;
  selectedSet.value = '';
  dialogOpen.value = true;
  try {
    await loadFor(row.username);
  } catch (e: any) {
    FailAlert(e);
  }
};

const onDialog = (v: boolean): void => {
  dialogOpen.value = v;
};

const onAssign = async (): Promise<void> => {
  if (!target.value || !selectedSet.value) return;
  try {
    saving.value = true;
    await assign(target.value.username, selectedSet.value);
    SuccessAlert('Роль назначена');
    selectedSet.value = '';
  } catch (e: any) {
    FailAlert(e);
  } finally {
    saving.value = false;
  }
};

const onRevoke = async (setKey: string): Promise<void> => {
  if (!target.value) return;
  try {
    await revoke(target.value.username, setKey);
    SuccessAlert('Роль снята');
  } catch (e: any) {
    FailAlert(e);
  }
};

const load = async (): Promise<void> => {
  try {
    onLoading.value = true;
    await Promise.all([
      accountStore.getAccounts({ options: { page: 1, limit: 1000, sortOrder: 'DESC' } }),
      loadCatalog(),
    ]);
  } catch (e: any) {
    FailAlert(e);
  } finally {
    onLoading.value = false;
  }
};
load();
</script>

<style lang="scss" scoped>
.personnel-page {
  padding: var(--p-6, 24px);
}

.personnel-page__hint {
  margin-bottom: var(--p-4, 16px);
}

.personnel-page__card {
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 16px);
  overflow: hidden;
}

.personnel-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3, 12px);
  width: 100%;
  padding: var(--p-4, 16px);
  margin-bottom: var(--p-3, 12px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
}

.personnel-card__name {
  font-weight: 600;
}

.personnel-card__login {
  color: var(--p-ink-3);
  font-family: var(--p-mono);
  font-size: var(--p-fs-sm, 13px);
}

.personnel-roles__label {
  margin-bottom: var(--p-2, 8px);
}

.personnel-roles__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-2, 8px);
}

.personnel-roles__remove {
  margin-left: var(--p-1, 4px);
  cursor: pointer;
}

.personnel-roles__add {
  margin-top: var(--p-4, 16px);
}

.personnel-roles__grants {
  margin-top: var(--p-3, 12px);
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
}

.personnel-roles__grant-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-2, 8px);
}

@media (max-width: 767px) {
  .personnel-page {
    padding: var(--p-4, 16px);
  }
  .personnel-page__card {
    background: transparent;
    border: none;
    border-radius: 0;
    overflow: visible;
  }
}
</style>

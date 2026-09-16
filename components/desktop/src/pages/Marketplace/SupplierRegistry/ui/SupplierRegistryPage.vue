<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session/model';
import {
  BaseBadge,
  BaseButton,
  BaseInput,
  BaseDialog,
  BaseTable,
  EmptyState,
} from 'src/shared/ui/base';
import type { BaseTableColumn } from 'src/shared/ui/base';
import { IdentityCell, PageHint } from 'src/shared/ui/domain';
import { useHeaderActions } from 'src/shared/hooks';
import AddSupplierButton from './AddSupplierButton.vue';
import { useQueryOverlay } from 'src/shared/lib/navigation';
import SupplierDetailOverlay from './SupplierDetailOverlay.vue';
import { getName } from 'src/shared/lib/utils/account';
import { api as accountApi } from 'src/entities/Account/api';
import {
  addSupplier,
  approveSupplier,
  fetchSuppliers,
  rejectSupplier,
  type MarketplaceSupplierView,
} from '../api';
import {
  SUPPLIER_MODEL_LABEL,
  SUPPLIER_STATUS_LABEL,
  SUPPLIER_STATUS_VARIANT,
} from '../types';

/**
 * Реестр поставщиков на столе администратора. Все поставщики проходят через
 * реестр: модель работы, договор (номер + дата), статус допуска. Одобрение и
 * отклонение заявок — действие председателя (кнопки видны только ему). Прямое
 * добавление поставщика (сразу одобрен) — путь 2.
 */

const session = useSessionStore();
const isChairman = computed(() => session.isChairman);
const { registerAction } = useHeaderActions();

const items = ref<MarketplaceSupplierView[]>([]);
// true до первого запроса: иначе первый кадр до загрузки показывает пустое
// состояние вместо скелетона, и первая загрузка неотличима от пустого списка.
const loading = ref(true);
const acting = ref<string | null>(null);
const supplierOverlay = useQueryOverlay('supplier');

// Резолв ФИО/наименования организации по username (реестр несёт только
// member_account) — канон из NotificationJournalWidget. Кэш на компонент.
const supplierNames = ref<Record<string, string>>({});

function supplierName(username: string): string {
  return supplierNames.value[username] ?? '';
}

async function resolveSupplierNames(): Promise<void> {
  const usernames = [...new Set(items.value.map((i) => i.member_account).filter(Boolean))];
  const missing = usernames.filter((u) => !(u in supplierNames.value));
  if (!missing.length) return;
  await Promise.all(
    missing.map(async (username) => {
      let name = '';
      try {
        const account = await accountApi.getAccount(username);
        name = account
          ? (getName(account) ?? '').replace(/undefined/g, '').replace(/\s+/g, ' ').trim()
          : '';
      } catch {
        name = '';
      }
      supplierNames.value = { ...supplierNames.value, [username]: name };
    }),
  );
}

/**
 * Колонка решений появляется, только когда есть что решать: одобрить или
 * отклонить можно лишь заявку, и у прочих строк там стоял один прочерк на всю
 * ширину колонки (жалоба владельца 14.09.2026).
 */
const hasPendingRequests = computed(
  () => isChairman.value && items.value.some((row) => row.status === 'PENDING'),
);

const columns = computed<BaseTableColumn<MarketplaceSupplierView>[]>(() => [
  {
    key: 'member',
    label: 'Поставщик',
    width: '280px',
    sortable: true,
    field: (row) => supplierName(row.member_account) || row.member_account,
  },
  { key: 'model', label: 'Модель', width: '200px', sortable: true, field: 'model' },
  { key: 'contract', label: 'Договор', width: '220px' },
  { key: 'status', label: 'Статус', width: '170px', sortable: true, field: 'status' },
  ...(hasPendingRequests.value
    ? [{ key: 'actions', label: 'Решение', width: '230px' } as BaseTableColumn<MarketplaceSupplierView>]
    : []),
]);

const addOpen = ref(false);
const addMember = ref('');
const addNumber = ref('');
const addDate = ref('');
const adding = ref(false);
const canAdd = computed(
  () => addMember.value.trim().length > 0 && addNumber.value.trim().length > 0 && addDate.value.length > 0,
);

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = await fetchSuppliers();
    void resolveSupplierNames();
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

async function onApprove(row: MarketplaceSupplierView): Promise<void> {
  acting.value = row.member_account;
  try {
    await approveSupplier({ member_account: row.member_account });
    SuccessAlert('Поставщик одобрен');
    await load();
  } catch (e) {
    FailAlert(e);
  } finally {
    acting.value = null;
  }
}

async function onReject(row: MarketplaceSupplierView): Promise<void> {
  acting.value = row.member_account;
  try {
    await rejectSupplier({ member_account: row.member_account });
    SuccessAlert('Заявка отклонена');
    await load();
  } catch (e) {
    FailAlert(e);
  } finally {
    acting.value = null;
  }
}

async function onAdd(): Promise<void> {
  if (!canAdd.value) return;
  adding.value = true;
  try {
    await addSupplier({
      member_account: addMember.value.trim(),
      model: Zeus.MarketplaceSupplierModel.MEMBERSHIP,
      contract_number: addNumber.value.trim(),
      contract_date: addDate.value,
    });
    SuccessAlert('Поставщик добавлен и допущен');
    addOpen.value = false;
    addMember.value = '';
    addNumber.value = '';
    addDate.value = '';
    await load();
  } catch (e) {
    FailAlert(e);
  } finally {
    adding.value = false;
  }
}

function contractLabel(row: MarketplaceSupplierView): string {
  if (!row.contract_number) return '—';
  return row.contract_date
    ? `№ ${row.contract_number} от ${row.contract_date}`
    : `№ ${row.contract_number}`;
}

onMounted(() => {
  // Добавление поставщика — главное действие страницы, поэтому живёт в шапке
  // (канон), а пояснение — в общей карточке-подсказке, как на соседних столах.
  registerAction({
    id: 'mp-supplier-registry-add',
    component: AddSupplierButton,
    props: { onClick: () => (addOpen.value = true) },
    order: 1,
  });
  void load();
});
</script>

<template lang="pug">
q-page.mp-role-admin.supplier-registry(role="region", aria-label="Реестр поставщиков")
  PageHint(storage-key="mp:supplier-registry:banner-dismissed")
    | Все поставщики действуют по договору. Заявку пайщика одобряет председатель;
    | администратор может добавить поставщика напрямую.

  BaseTable(
    v-if="loading || items.length",
    :columns="columns",
    :rows="items",
    row-key="id",
    hover,
    :loading="loading",
    :min-width="hasPendingRequests ? '1100px' : '880px'",
    sort-by="member",
    clickable-rows,
    @row-click="(row) => supplierOverlay.open(row.member_account)"
  )
    template(#cell-member="{ row }")
      IdentityCell(
        :account-name="row.member_account",
        :full-name="supplierName(row.member_account)"
      )
    template(#cell-model="{ row }")
      | {{ SUPPLIER_MODEL_LABEL[row.model] || row.model }}
    template(#cell-contract="{ row }")
      | {{ contractLabel(row) }}
    template(#cell-status="{ row }")
      BaseBadge(:variant="SUPPLIER_STATUS_VARIANT[row.status] || 'neutral'") {{ SUPPLIER_STATUS_LABEL[row.status] || row.status }}
    template(#cell-actions="{ row }")
      .cell-actions(v-if="row.status === 'PENDING'", @click.stop)
        BaseButton(
          variant="primary",
          size="sm",
          :loading="acting === row.member_account",
          @click="onApprove(row)"
        ) Одобрить
        BaseButton(
          variant="ghost",
          size="sm",
          :disabled="acting === row.member_account",
          @click="onReject(row)"
        ) Отклонить

  EmptyState(
    v-else,
    title="Поставщиков пока нет",
    body="Здесь появятся поставщики кооператива. Добавьте поставщика напрямую или дождитесь заявок."
  )
    template(#icon)
      q-icon(name="storefront", size="48px")

  BaseDialog(v-model="addOpen", title="Добавить поставщика", size="sm")
    template(#default)
      .supplier-registry__form
        BaseInput(
          v-model="addMember",
          label="Аккаунт поставщика",
          placeholder="например, ivanov",
          mono,
          :disabled="adding"
        )
        BaseInput(
          v-model="addNumber",
          label="Номер договора",
          placeholder="например, 17/2026",
          :disabled="adding"
        )
        BaseInput(
          v-model="addDate",
          type="date",
          label="Дата заключения договора",
          :disabled="adding"
        )
    template(#footer)
      BaseButton(variant="ghost", :disabled="adding", @click="addOpen = false") Отмена
      BaseButton(variant="primary", :loading="adding", :disabled="!canAdd", @click="onAdd") Добавить

  //- Карточка поставщика — оверлеем поверх реестра (?supplier= в адресе):
  //- отдельной страницы у поставщика нет, решение принимается здесь же
  SupplierDetailOverlay(
    :items="items",
    :can-moderate="isChairman",
    :acting="!!acting",
    :name-by-account="supplierNames",
    @approve="onApprove",
    @reject="onReject"
  )
</template>

<style scoped lang="scss">
.supplier-registry {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__form {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }
}
</style>

<template lang="pug">
//- Вкладка «Стол заказов» на странице кооперативного участка.
//- Зоны: пункт выдачи — «когда работает»; карточки — «сколько денег у участка
//- и у его инициаторов»; таблица — «как двигались деньги общего кошелька».
.branch-summary
  //- Пункт выдачи: режим работы и переход в каталог.
  BaseCard(v-if='summary?.issuance_point', :title='$t("marketplace.branchSummaryTab.issuancePointTitle")')
    template(#actions)
      .row.items-center.q-gutter-sm
        BaseBadge(v-if='!summary.issuance_point.active', variant='neutral')
          | {{ $t('marketplace.branchSummaryTab.issuancePointInactive') }}
        BaseButton(
          v-if='canOrder && summary.issuance_point.active',
          variant='secondary',
          size='sm',
          @click='openCatalog'
        ) {{ $t('marketplace.branchSummaryTab.openCatalogAction') }}
    DataRow(:label='$t("marketplace.branchSummaryTab.workingHoursLabel")')
      template(#value-override)
        .column
          span(v-for='line in workingHoursLines', :key='line') {{ line }}
          span(v-if='!workingHoursLines.length') {{ $t('marketplace.branchSummaryTab.workingHoursEmpty') }}

  //- Суммы участка: порядок карточек — путь денег.
  .wallet-grid(v-if='firstLoad || cards.length')
    template(v-if='firstLoad')
      WalletCard(v-for='n in 2', :key='n', program='wallet', balance='', symbol='', loading)
    template(v-else)
      WalletCard(
        v-for='card in cards',
        :key='card.key',
        program='wallet',
        :icon='card.icon',
        :title='card.title',
        :subtitle='card.subtitle',
        :balance='card.balance',
        :symbol='card.symbol',
        :balance-label='card.label'
      )

  //- Движения общего кошелька есть только у пункта выдачи: кошелёк пополняют выданные заказы.
  template(v-if='firstLoad || summary?.issuance_point')
    BaseTable(
      v-if='firstLoad || movements.length',
      :columns='movementColumns',
      :rows='movements',
      row-key='global_sequence',
      :loading='firstLoad',
      min-width='560px'
    )
      template(#cell-date='{ row }')
        span.t-mono {{ formatDateToLocalTimezone(row.created_at, 'DD.MM.YYYY HH:mm') }}
      template(#cell-operation='{ row }')
        | {{ operationLabel({ operationCode: row.operation_code, action: 'apply' }) }}
      template(#cell-amount='{ row }')
        span.t-mono {{ formatProcessAmount(row.quantity) }}
    .banner.banner--info(v-else)
      q-icon.banner__icon(name='info', size='18px')
      .banner__body {{ $t('marketplace.branchSummaryTab.movementsEmpty') }}

    .row.justify-center(v-if='hasMoreMovements')
      BaseButton(variant='secondary', size='sm', :loading='loadingMore', @click='loadMoreMovements')
        | {{ $t('marketplace.branchSummaryTab.showMoreAction') }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Ledger2Contract, MarketContract } from 'cooptypes';
import {
  getBranchSummaryMovements,
  useMarketplaceBranchSummaryStore,
  type MarketplaceBranchSummaryMovement,
} from 'src/entities/MarketplaceBranchSummary';
import { formatWorkingHours } from 'src/entities/MarketplaceKUDetails';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert } from 'src/shared/api';
import { useFirstLoad } from 'src/shared/lib/composables';
import { formatProcessAmount, operationLabel } from 'src/shared/lib/ledger2';
import { marketLiveTables } from 'src/shared/lib/marketplace';
import { liveTable, useLiveReload } from 'src/shared/lib/realtime';
import { formatDateToLocalTimezone } from 'src/shared/lib/utils/dates';
import { splitAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseCard, BaseTable } from 'src/shared/ui/base';
import type { BaseTableColumn } from 'src/shared/ui/base';
import { DataRow, WalletCard } from 'src/shared/ui/domain';
import { t } from 'src/shared/i18n';

/**
 * Что Стол заказов показывает о кооперативном участке каждому пайщику
 * кооператива: пункт выдачи с режимом работы, кошельки участка, итоги взносов
 * инициаторов и движения общего кошелька.
 *
 * Границы. Вкладка только читает. Документов, получателей распределения и
 * заказов пайщиков в ней нет — они остаются на «Экономике участка» стола ПВЗ у
 * председателя и доверенных лиц. Раздел рисуется, только когда участок в нём
 * участвует: пункт выдачи — у подключённого участка, взносы — у участка с
 * инициаторами.
 */
const props = defineProps<{ braname: string }>();

/** Движений на одну дочитку. */
const MOVEMENTS_PAGE = 20;
/** Порядок движений: новые первыми. */
const NEWEST_FIRST = 'DESC';

const router = useRouter();
const system = useSystemStore();
const desktop = useDesktopStore();
const summaryStore = useMarketplaceBranchSummaryStore();

// До первого ответа — каркас, а не пустые разделы.
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const loadingMore = ref(false);

const summary = computed(() => summaryStore.summaries[props.braname]);
const movements = ref<MarketplaceBranchSummaryMovement[]>([]);
const movementsPage = ref(1);
const movementsTotalPages = ref(1);
const hasMoreMovements = computed(() => movementsPage.value < movementsTotalPages.value);

const workingHoursLines = computed(() => formatWorkingHours(summary.value?.issuance_point?.working_hours));

// Каталог открыт пайщику, который подключён к Столу заказов; остальным кнопка не показывается.
const canOrder = computed(() => desktop.hasGrant('market', 'Order:create'));

interface SumCard {
  key: string;
  icon: string;
  title: string;
  subtitle: string;
  balance: string;
  symbol: string;
  label: string;
}

function sumCard(key: string, icon: string, labelKey: 'now' | 'total', asset: string): SumCard {
  const { amount, symbol } = splitAsset2Digits(asset);
  return {
    key,
    icon,
    title: t(`marketplace.branchSummaryTab.card.${key}.title`),
    subtitle: t(`marketplace.branchSummaryTab.card.${key}.subtitle`),
    balance: amount,
    symbol,
    label: t(`marketplace.branchSummaryTab.cardLabel.${labelKey}`),
  };
}

const cards = computed<SumCard[]>(() => {
  const view = summary.value;
  if (!view) return [];
  const list: SumCard[] = [];
  if (view.issuance_point) {
    list.push(sumCard('common', 'account_balance_wallet', 'now', view.common_balance));
    list.push(sumCard('socialFund', 'diversity_3', 'now', view.social_fund_balance));
  }
  if (view.initiators) {
    list.push(sumCard('initiatorsMoney', 'payments', 'total', view.initiators.money_total));
    list.push(sumCard('initiatorsProperty', 'inventory_2', 'total', view.initiators.property_total));
    list.push(sumCard('initiatorsRepaid', 'replay', 'total', view.initiators.repaid_total));
    list.push(sumCard('initiatorsOutstanding', 'hourglass_bottom', 'now', view.initiators.outstanding));
  }
  return list;
});

const movementColumns: BaseTableColumn<MarketplaceBranchSummaryMovement>[] = [
  { key: 'date', label: t('marketplace.branchSummaryTab.columnDate'), width: '170px', nowrap: true },
  { key: 'operation', label: t('marketplace.branchSummaryTab.columnOperation') },
  { key: 'amount', label: t('marketplace.branchSummaryTab.columnAmount'), width: '170px', numeric: true },
];

/**
 * Перечитать сводку и показанные движения. Движения читаются одной страницей
 * на всё уже показанное: перечитывание по ленте не сворачивает дочитанный список.
 */
async function reload(): Promise<void> {
  if (!props.braname) return;
  try {
    const view = await summaryStore.load(props.braname);
    if (view.issuance_point) {
      const shown = Math.max(movements.value.length, MOVEMENTS_PAGE);
      const pages = Math.ceil(shown / MOVEMENTS_PAGE);
      const history = await getBranchSummaryMovements(props.braname, { page: 1, limit: pages * MOVEMENTS_PAGE, sortOrder: NEWEST_FIRST });
      movements.value = history.items;
      movementsPage.value = pages;
      movementsTotalPages.value = Math.ceil(history.totalCount / MOVEMENTS_PAGE);
    } else {
      movements.value = [];
      movementsPage.value = 1;
      movementsTotalPages.value = 1;
    }
  } catch (e: unknown) {
    FailAlert(e, t('marketplace.branchSummaryTab.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function loadMoreMovements(): Promise<void> {
  loadingMore.value = true;
  try {
    const next = movementsPage.value + 1;
    const history = await getBranchSummaryMovements(props.braname, { page: next, limit: MOVEMENTS_PAGE, sortOrder: NEWEST_FIRST });
    movements.value = [...movements.value, ...history.items];
    movementsPage.value = next;
    movementsTotalPages.value = history.totalPages;
  } catch (e: unknown) {
    FailAlert(e, t('marketplace.branchSummaryTab.loadFailed'));
  } finally {
    loadingMore.value = false;
  }
}

function openCatalog(): void {
  void router.push({ name: 'marketplace-catalog', params: { coopname: system.info.coopname } });
}

// Сводка живёт по ленте: подключение пункта выдачи, движения учёта по кошелькам
// кооператива и счетам, взносы инициаторов участка.
useLiveReload(
  [
    ...marketLiveTables('ku'),
    liveTable(Ledger2Contract, Ledger2Contract.Tables.Wallets),
    liveTable(Ledger2Contract, Ledger2Contract.Tables.Accounts),
    liveTable(MarketContract, MarketContract.Tables.InvBranches),
  ],
  reload,
);

watch(
  () => props.braname,
  () => {
    movements.value = [];
    loading.value = true;
    void reload();
  },
);

onMounted(reload);
</script>

<style scoped>
.branch-summary {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}
</style>

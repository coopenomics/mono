<template lang="pug">
.contributors-table
  .contributors-table__skel(v-if='loading && !contributors.length')
    .skel(v-for='i in 6', :key='i')

  EmptyState(
    v-else-if='!loading && !contributors.length',
    title='Участников пока нет',
    body='У кооператива ещё нет участников программы «Благорост».'
  )
    template(#icon)
      q-icon(name='group')

  template(v-else)
    .table-wrap
      .table-scroll
        table.table
          thead
            tr
              th.col-toggle
              th.col-sort(@click='onSort("username")')
                | ФИО {{ sortMark('username') }}
              th.col-sort(@click='onSort("status")')
                | Статус {{ sortMark('status') }}
              th.col-num Главный кошелёк
              th.col-num Генерация
              th.col-num Благорост
              th.col-sort.col-num(@click='onSort("rate_per_hour")')
                | Ставка/час {{ sortMark('rate_per_hour') }}
              th.col-sort.col-num(@click='onSort("hours_per_day")')
                | Часы/день {{ sortMark('hours_per_day') }}
          tbody
            template(
              v-for='row in contributors',
              :key='row.contributor_hash'
            )
              tr.data-row(@click='handleToggleExpand(row.contributor_hash)')
                td.col-toggle
                  button.icon-btn(
                    type='button',
                    :aria-label='isExpanded(row.contributor_hash) ? "Свернуть" : "Развернуть"',
                    @click.stop='handleToggleExpand(row.contributor_hash)'
                  )
                    q-icon(
                      :name='isExpanded(row.contributor_hash) ? "expand_more" : "chevron_right"'
                    )
                td.cell-name {{ row.display_name || row.username || '—' }}
                td
                  BaseBadge(:variant='statusVariant(row.status)')
                    | {{ getContributorStatusLabel(row.status) }}
                td.col-num.t-mono {{ formatAsset2Digits(calculateMainWalletTotal(row)) }}
                td.col-num.t-mono {{ formatAsset2Digits(calculateGenerationWalletTotal(row)) }}
                td.col-num.t-mono {{ formatAsset2Digits(calculateBlagorostWalletTotal(row)) }}
                td.col-num.t-mono {{ formatAsset2Digits(row.rate_per_hour) }}
                td.col-num {{ row.hours_per_day || '—' }}

              tr.expand-row(v-if='isExpanded(row.contributor_hash)')
                td(colspan='8')
                  .contributors-table__details
                    .contributors-table__block
                      .contributors-table__block-title.t-eyebrow О себе
                      p.contributors-table__about.t-sm {{ row.about || 'Информация отсутствует' }}

                    .contributors-table__block
                      .contributors-table__block-title.t-eyebrow Взносы по ролям
                      .contributors-table__rows
                        DataRow(
                          label='Инвестор',
                          :value='formatAsset2Digits(calculateInvestorTotal(row))',
                          mono
                        )
                        DataRow(
                          label='Исполнитель',
                          :value='formatAsset2Digits(row.contributed_as_creator)',
                          mono
                        )
                        DataRow(
                          label='Соавтор',
                          :value='formatAsset2Digits(row.contributed_as_author)',
                          mono
                        )
                        DataRow(
                          label='Координатор',
                          :value='formatAsset2Digits(row.contributed_as_coordinator)',
                          mono
                        )
                        DataRow(
                          label='Участник',
                          :value='formatAsset2Digits(row.contributed_as_contributor)',
                          mono
                        )
                        DataRow(
                          label='Общий взнос',
                          :value='formatAsset2Digits(calculateTotalContribution(row))',
                          mono
                        )

                    .contributors-table__block(
                      v-if='row.document_parameters && hasDocumentParameters(row.document_parameters)'
                    )
                      .contributors-table__block-title.t-eyebrow Параметры документов
                      .contributors-table__rows.contributors-table__rows--docs
                        DataRow(
                          v-if='row.document_parameters.blagorost_contributor_contract_number',
                          label='Договор УХД',
                          :value='docLabel(row.document_parameters.blagorost_contributor_contract_number, row.document_parameters.blagorost_contributor_contract_created_at)',
                          align='vertical',
                          mono
                        )
                        DataRow(
                          v-if='row.document_parameters.generator_agreement_number',
                          label='Соглашение Генератор',
                          :value='docLabel(row.document_parameters.generator_agreement_number, row.document_parameters.generator_agreement_created_at)',
                          align='vertical',
                          mono
                        )
                        DataRow(
                          v-if='row.document_parameters.blagorost_agreement_number',
                          label='Соглашение Благорост',
                          :value='docLabel(row.document_parameters.blagorost_agreement_number, row.document_parameters.blagorost_agreement_created_at)',
                          align='vertical',
                          mono
                        )
                        DataRow(
                          v-if='row.document_parameters.blagorost_storage_agreement_number',
                          label='Соглашение о хранении',
                          :value='docLabel(row.document_parameters.blagorost_storage_agreement_number, row.document_parameters.blagorost_storage_agreement_created_at)',
                          align='vertical',
                          mono
                        )

    .table-foot
      span.t-sm.t-muted {{ rangeLabel }}
      .contributors-table__pager
        BaseButton(
          variant='ghost',
          size='sm',
          :disabled='pagination.page <= 1',
          @click='goToPage(pagination.page - 1)'
        ) Назад
        BaseButton(
          variant='ghost',
          size='sm',
          :disabled='pagination.page * pagination.rowsPerPage >= totalCount',
          @click='goToPage(pagination.page + 1)'
        ) Ещё
</template>

<script lang="ts" setup>
import { reactive, computed } from 'vue';
import type { IContributor } from 'app/extensions/capital/entities/Contributor/model/types';
import { formatAsset2Digits } from 'src/shared/lib/utils';
import { getContributorStatusLabel } from 'app/extensions/capital/shared/lib/contributorStatus';
import { EmptyState, BaseBadge, BaseButton } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain/DataRow';
import { useSystemStore } from 'src/entities/System/model';
import { Zeus } from '@coopenomics/sdk';

interface Props {
  contributors: IContributor[];
  loading?: boolean;
  totalCount?: number;
  pagination?: {
    page: number;
    rowsPerPage: number;
    sortBy: string;
    descending: boolean;
  };
}

interface Emits {
  (
    e: 'request',
    props: {
      pagination: {
        page: number;
        rowsPerPage: number;
        sortBy: string;
        descending: boolean;
      };
    },
  ): void;
}

const props = withDefaults(defineProps<Props>(), {
  contributors: () => [],
  loading: false,
  totalCount: 0,
  pagination: () => ({
    page: 1,
    rowsPerPage: 25,
    sortBy: 'created_at',
    descending: true,
  }),
});

const emit = defineEmits<Emits>();

const system = useSystemStore();
const governSymbol = computed(
  () => system.info?.symbols?.root_govern_symbol || 'GOV',
);

const expanded = reactive<Record<string, boolean>>({});

const isExpanded = (contributorHash: string) =>
  expanded[contributorHash] || false;

const handleToggleExpand = (contributorHash: string) => {
  expanded[contributorHash] = !expanded[contributorHash];
};

const statusVariant = (status: string): BaseBadgeVariant => {
  switch (status) {
    case Zeus.ContributorStatus.ACTIVE:
      return 'pos';
    case Zeus.ContributorStatus.APPROVED:
      return 'info';
    case Zeus.ContributorStatus.PENDING:
    case Zeus.ContributorStatus.IMPORT:
      return 'warn';
    case Zeus.ContributorStatus.INACTIVE:
      return 'neg';
    default:
      return 'neutral';
  }
};

const sortMark = (field: string) => {
  if (props.pagination.sortBy !== field) return '';
  return props.pagination.descending ? '↓' : '↑';
};

const onSort = (field: string) => {
  const same = props.pagination.sortBy === field;
  emit('request', {
    pagination: {
      ...props.pagination,
      sortBy: field,
      descending: same ? !props.pagination.descending : true,
      page: 1,
    },
  });
};

const goToPage = (page: number) => {
  emit('request', {
    pagination: {
      ...props.pagination,
      page,
    },
  });
};

const rangeLabel = computed(() => {
  const total = props.totalCount || props.contributors.length;
  if (!total) return '0 из 0';
  const from = (props.pagination.page - 1) * props.pagination.rowsPerPage + 1;
  const to = Math.min(
    props.pagination.page * props.pagination.rowsPerPage,
    total,
  );
  return `${from}–${to} из ${total}`;
});

const assetAmount = (raw?: string | null) => {
  const availableStr = raw || `0 ${governSymbol.value}`;
  const total = Number(availableStr.split(' ')[0] || '0');
  const currency = availableStr.split(' ')[1] || governSymbol.value;
  return currency ? `${total} ${currency}` : total.toString();
};

const calculateInvestorTotal = (contributor: IContributor) => {
  const investor = Number(
    contributor?.contributed_as_investor?.split(' ')[0] || '0',
  );
  const propertor = Number(
    contributor?.contributed_as_propertor?.split(' ')[0] || '0',
  );
  const total = investor + propertor;
  const currency =
    contributor?.contributed_as_investor?.split(' ')[1] ||
    contributor?.contributed_as_propertor?.split(' ')[1] ||
    governSymbol.value;
  return currency ? `${total} ${currency}` : total.toString();
};

const calculateMainWalletTotal = (contributor: IContributor) =>
  assetAmount(contributor?.main_wallet?.available);

const calculateGenerationWalletTotal = (contributor: IContributor) =>
  assetAmount(contributor?.generation_wallet?.available);

const calculateBlagorostWalletTotal = (contributor: IContributor) =>
  assetAmount(contributor?.blagorost_wallet?.available);

const calculateTotalContribution = (contributor: IContributor) => {
  const parts = [
    contributor?.contributed_as_investor,
    contributor?.contributed_as_creator,
    contributor?.contributed_as_author,
    contributor?.contributed_as_coordinator,
    contributor?.contributed_as_contributor,
    contributor?.contributed_as_propertor,
  ];
  const total = parts.reduce(
    (sum, raw) => sum + Number(raw?.split(' ')[0] || '0'),
    0,
  );
  const currency =
    parts.map((p) => p?.split(' ')[1]).find(Boolean) || governSymbol.value;
  return currency ? `${total} ${currency}` : total.toString();
};

const hasDocumentParameters = (params: Record<string, unknown> | null | undefined) => {
  if (!params) return false;
  return !!(
    params.blagorost_contributor_contract_number ||
    params.generator_agreement_number ||
    params.blagorost_agreement_number ||
    params.blagorost_storage_agreement_number
  );
};

const docLabel = (number?: string | null, date?: string | null) => {
  if (!number) return '—';
  return date ? `${number} от ${date}` : number;
};
</script>

<style lang="scss" scoped>
.contributors-table {
  min-width: 0;
}

.contributors-table__skel {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);

  .skel {
    height: 48px;
    border-radius: var(--p-r-sm);
  }
}

.table-wrap {
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);
  overflow: hidden;
}

.table-scroll {
  overflow-x: auto;
  max-width: 100%;
}

.col-toggle {
  width: 40px;
}

.col-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.col-sort {
  cursor: pointer;
  user-select: none;

  &:hover {
    color: var(--p-ink);
  }
}

.cell-name {
  font-weight: 500;
  color: var(--p-ink);
  min-width: 12rem;
}

.data-row {
  cursor: pointer;
}

.expand-row td {
  padding: 0 !important;
  background: var(--p-surface);
  border-bottom: 1px solid var(--p-line);
}

.contributors-table__details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--p-5);
  padding: var(--p-4) var(--p-5);
}

.contributors-table__block {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  min-width: 0;
}

.contributors-table__block-title {
  color: var(--p-ink-3);
}

.contributors-table__about {
  margin: 0;
  color: var(--p-ink-1);
  line-height: var(--p-lh-body);
  white-space: pre-wrap;
}

.contributors-table__rows {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  min-width: 0;

  :deep(.data-row--horizontal) {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  :deep(.data-row__value-text) {
    white-space: nowrap;
  }
}

.contributors-table__rows--docs {
  :deep(.data-row) {
    min-width: 0;
  }

  :deep(.data-row__value-text) {
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-all;
    font-variant-numeric: tabular-nums;
  }
}

.table-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
  padding: var(--p-3) 0 0;
}

.contributors-table__pager {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
}
</style>

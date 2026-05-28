<template lang="pug">
q-card(flat)

  q-table(
    :rows='contributors',
    :columns='columns',
    row-key='contributor_hash',
    :loading='loading',
    :pagination='pagination',
    @request='onRequest',
    binary-state-sort,
    flat,
    square,
    no-data-label='У кооператива нет участников Благороста'
  )

    template(#body='props')
      q-tr(:props='props')
        q-td
          .row.items-center
            ExpandToggleButton(
              :expanded='isExpanded(props.row.contributor_hash)',
              @click='handleToggleExpand(props.row.contributor_hash)'
            )

        q-td {{ props.row.display_name || '-' }}
        q-td
          q-chip(
            :color='getContributorStatusColor(props.row.status)',
            text-color='white',
            :label='getContributorStatusLabel(props.row.status)',
            size='sm'
          )

        q-td.text-right {{ formatAsset2Digits(calculateMainWalletTotal(props.row)) }}
        q-td.text-right {{ formatAsset2Digits(calculateGenerationWalletTotal(props.row)) }}
        q-td.text-right {{ formatAsset2Digits(calculateBlagorostWalletTotal(props.row)) }}
        q-td.text-right {{ formatAsset2Digits(props.row.rate_per_hour) }}
        q-td.text-right {{ props.row.hours_per_day || '-' }}

      // Раскрывающаяся строка с информацией "О себе" и параметрами документов
      q-tr.q-virtual-scroll--with-prev(
        no-hover,
        v-if='isExpanded(props.row.contributor_hash)',
        :key='`${props.row.contributor_hash}-about`'
      )
        q-td(colspan='100%', style='padding: 0px !important')
          .q-pa-md
            .row.q-col-gutter-md
              .col-12.col-md-4
                .text-subtitle2.q-mb-md О себе
                .text-body2 {{ props.row.about || 'Информация отсутствует' }}

              .col-12.col-md-4
                .text-subtitle2.q-mb-md Вклады по ролям
                q-list(dense)
                  q-item.q-mb-md(dense)
                    q-item-section
                      q-item-label.text-caption.text-grey-7 Инвестор
                      q-item-label {{ formatAsset2Digits(calculateInvestorTotal(props.row)) }}
                  q-item.q-mb-md(dense)
                    q-item-section
                      q-item-label.text-caption.text-grey-7 Исполнитель
                      q-item-label {{ formatAsset2Digits(props.row.contributed_as_creator) }}
                  q-item.q-mb-md(dense)
                    q-item-section
                      q-item-label.text-caption.text-grey-7 Соавтор
                      q-item-label {{ formatAsset2Digits(props.row.contributed_as_author) }}
                  q-item.q-mb-md(dense)
                    q-item-section
                      q-item-label.text-caption.text-grey-7 Координатор
                      q-item-label {{ formatAsset2Digits(props.row.contributed_as_coordinator) }}
                  q-item.q-mb-md(dense)
                    q-item-section
                      q-item-label.text-caption.text-grey-7 Участник
                      q-item-label {{ formatAsset2Digits(props.row.contributed_as_contributor) }}
                  q-item.q-mb-md(dense)
                    q-item-section
                      q-item-label.text-caption.text-grey-7 Общий вклад
                      q-item-label {{ formatAsset2Digits(calculateTotalContribution(props.row)) }}

              .col-12.col-md-4(v-if='props.row.document_parameters && hasDocumentParameters(props.row.document_parameters)')
                .text-subtitle2.q-mb-md Параметры документов
                q-list(dense)
                  q-item.q-mb-md(
                    v-if='props.row.document_parameters.blagorost_contributor_contract_number',
                    dense
                  )
                    q-item-section
                      q-item-label.text-caption.text-grey-7 Договор УХД
                      q-item-label {{ props.row.document_parameters.blagorost_contributor_contract_number }}
                      q-item-label.text-caption(v-if='props.row.document_parameters.blagorost_contributor_contract_created_at') от {{ props.row.document_parameters.blagorost_contributor_contract_created_at }}

                  q-item.q-mb-md(
                    v-if='props.row.document_parameters.generator_agreement_number',
                    dense
                  )
                    q-item-section
                      q-item-label.text-caption.text-grey-7 Соглашение Генератор
                      q-item-label {{ props.row.document_parameters.generator_agreement_number }}
                      q-item-label.text-caption(v-if='props.row.document_parameters.generator_agreement_created_at') от {{ props.row.document_parameters.generator_agreement_created_at }}

                  q-item.q-mb-md(
                    v-if='props.row.document_parameters.blagorost_agreement_number',
                    dense
                  )
                    q-item-section
                      q-item-label.text-caption.text-grey-7 Соглашение Благорост
                      q-item-label {{ props.row.document_parameters.blagorost_agreement_number }}
                      q-item-label.text-caption(v-if='props.row.document_parameters.blagorost_agreement_created_at') от {{ props.row.document_parameters.blagorost_agreement_created_at }}

                  q-item.q-mb-md(
                    v-if='props.row.document_parameters.blagorost_storage_agreement_number',
                    dense
                  )
                    q-item-section
                      q-item-label.text-caption.text-grey-7 Соглашение о хранении
                      q-item-label {{ props.row.document_parameters.blagorost_storage_agreement_number }}
                      q-item-label.text-caption(v-if='props.row.document_parameters.blagorost_storage_agreement_created_at') от {{ props.row.document_parameters.blagorost_storage_agreement_created_at }}
</template>

<script lang="ts" setup>
import { reactive, computed } from 'vue';
import type { IContributor } from 'app/extensions/capital/entities/Contributor/model/types';
import { formatAsset2Digits } from 'src/shared/lib/utils';
import { getContributorStatusColor, getContributorStatusLabel } from 'app/extensions/capital/shared/lib/contributorStatus';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';
import { useSystemStore } from 'src/entities/System/model';

interface Props {
  contributors: IContributor[];
  loading?: boolean;
  pagination?: {
    page: number;
    rowsPerPage: number;
    sortBy: string;
    descending: boolean;
  };
}

interface Emits {
  (e: 'request', props: { pagination: any }): void;
}

withDefaults(defineProps<Props>(), {
  contributors: () => [],
  loading: false,
  pagination: () => ({
    page: 1,
    rowsPerPage: 25,
    sortBy: 'created_at',
    descending: true,
  }),
});

const emit = defineEmits<Emits>();

const system = useSystemStore();
const governSymbol = computed(() => system.info?.symbols?.root_govern_symbol || 'GOV');

// Определяем столбцы таблицы
const columns = [
  {
    name: 'expand',
    label: '',
    align: 'left' as const,
    field: '' as const,
    sortable: false,
  },
  {
    name: 'username',
    label: 'ФИО',
    align: 'left' as const,
    field: 'username' as const,
    sortable: true,
  },
  {
    name: 'status',
    label: 'Статус',
    align: 'center' as const,
    field: 'status' as const,
    sortable: true,
  },
  {
    name: 'main_wallet',
    label: 'Главный кошелек',
    align: 'right' as const,
    field: '' as const,
    sortable: false,
  },
  {
    name: 'generation_wallet',
    label: 'Генерация',
    align: 'right' as const,
    field: '' as const,
    sortable: false,
  },
  {
    name: 'blagorost_wallet',
    label: 'Благорост',
    align: 'right' as const,
    field: '' as const,
    sortable: false,
  },
  {
    name: 'rate_per_hour',
    label: 'Ставка/час',
    align: 'right' as const,
    field: 'rate_per_hour' as const,
    sortable: true,
  },
  {
    name: 'hours_per_day',
    label: 'Часы/день',
    align: 'right' as const,
    field: 'hours_per_day' as const,
    sortable: true,
  },
];

// Состояние для раскрывающихся строк
const expanded = reactive<Record<string, boolean>>({});

// Функция для безопасного получения состояния раскрытия
const isExpanded = (contributorHash: string) => {
  return expanded[contributorHash] || false;
};

// Обработчик переключения раскрытия
const handleToggleExpand = (contributorHash: string) => {
  expanded[contributorHash] = !expanded[contributorHash];
};

// Функция для расчета суммы инвестора + пропертора
const calculateInvestorTotal = (contributor: IContributor) => {
  const investor = Number(contributor?.contributed_as_investor?.split(' ')[0] || '0');
  const propertor = Number(contributor?.contributed_as_propertor?.split(' ')[0] || '0');
  const total = investor + propertor;
  const currency = contributor?.contributed_as_investor?.split(' ')[1] ||
                  contributor?.contributed_as_propertor?.split(' ')[1] || '';
  return currency ? `${total} ${currency}` : total.toString();
};

// Функции для расчета сумм кошельков
const calculateMainWalletTotal = (contributor: IContributor) => {
  const availableStr = contributor?.main_wallet?.available || '0.0000';
  const total = Number(availableStr.split(' ')[0] || '0');

  // Определяем валюту из поля available или используем системный символ
  const currency = availableStr.split(' ')[1] || governSymbol.value;

  return currency ? `${total} ${currency}` : total.toString();
};

const calculateGenerationWalletTotal = (contributor: IContributor) => {
  const availableStr = contributor?.generation_wallet?.available || '0.0000';
  const total = Number(availableStr.split(' ')[0] || '0');

  // Определяем валюту из поля available или используем системный символ
  const currency = availableStr.split(' ')[1] || governSymbol.value;

  return currency ? `${total} ${currency}` : total.toString();
};

const calculateBlagorostWalletTotal = (contributor: IContributor) => {
  const availableStr = contributor?.blagorost_wallet?.available || '0.0000';
  const total = Number(availableStr.split(' ')[0] || '0');

  // Определяем валюту из поля available или используем системный символ
  const currency = availableStr.split(' ')[1] || governSymbol.value;

  return currency ? `${total} ${currency}` : total.toString();
};

// Функция для расчета общего вклада
const calculateTotalContribution = (contributor: IContributor) => {
  const investor = Number(contributor?.contributed_as_investor?.split(' ')[0] || '0');
  const creator = Number(contributor?.contributed_as_creator?.split(' ')[0] || '0');
  const author = Number(contributor?.contributed_as_author?.split(' ')[0] || '0');
  const coordinator = Number(contributor?.contributed_as_coordinator?.split(' ')[0] || '0');
  const contributorAmount = Number(contributor?.contributed_as_contributor?.split(' ')[0] || '0');
  const propertor = Number(contributor?.contributed_as_propertor?.split(' ')[0] || '0');

  const total = investor + creator + author + coordinator + contributorAmount + propertor;

  // Определяем валюту из любого поля, которое ее содержит
  const currency = contributor?.contributed_as_investor?.split(' ')[1] ||
                  contributor?.contributed_as_creator?.split(' ')[1] ||
                  contributor?.contributed_as_author?.split(' ')[1] ||
                  contributor?.contributed_as_coordinator?.split(' ')[1] ||
                  contributor?.contributed_as_contributor?.split(' ')[1] ||
                  contributor?.contributed_as_propertor?.split(' ')[1] || '';

  return currency ? `${total} ${currency}` : total.toString();
};

// Обработчик запросов пагинации и сортировки
const onRequest = (props: { pagination: any }) => {
  emit('request', props);
};

// Проверяет, есть ли хотя бы один параметр документа
const hasDocumentParameters = (params: any) => {
  if (!params) return false;
  return !!(
    params.blagorost_contributor_contract_number ||
    params.generator_agreement_number ||
    params.blagorost_agreement_number ||
    params.blagorost_storage_agreement_number
  );
};
</script>

<style lang="scss" scoped>
.q-chip {
  font-weight: 500;
}
</style>

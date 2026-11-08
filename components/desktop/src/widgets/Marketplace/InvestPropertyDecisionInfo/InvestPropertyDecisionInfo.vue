<template lang="pug">
//- Вопрос совета о приёме имущества в кооперативный участок (заявление 1120,
//- одобренное председателем участка). Совет видит, что и на какую сумму
//- вносится, в какой участок и кто одобрил заявление, — без открытия
//- документа. Зоны: что вносится (наименование, цена приёма) → подробности
//- (вносящий, количество, описание) → участок и одобривший председатель.
.invest-property
  .invest-property__label
    q-icon(name='inventory_2', size='18px')
    span.t-eyebrow {{ $t('marketplace.investPropertyDecisionInfo.title') }}
  .invest-property__panel
    .invest-property__name {{ meta.property_name || '______' }}
    .invest-property__amount.t-mono {{ amount }}
    DataRow(:label='$t("marketplace.investPropertyDecisionInfo.applicantLabel")', :value='applicantName', align='spread')
    DataRow(:label='$t("marketplace.investPropertyDecisionInfo.quantityLabel")', :value='quantity', align='spread')
    DataRow(:label='$t("marketplace.investPropertyDecisionInfo.branchLabel")', :value='meta.branch_name || meta.braname || "______"', align='spread')
    DataRow(:label='$t("marketplace.investPropertyDecisionInfo.approvedByLabel")', :value='meta.branch_chairman_name || "______"', align='spread')
    DataRow(
      :label='$t("marketplace.investPropertyDecisionInfo.descriptionLabel")',
      :value='meta.property_description || "______"',
      align='vertical'
    )
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { IAgenda } from 'src/entities/Agenda/model';
import { DataRow } from 'src/shared/ui/domain/DataRow';
import { getShortNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';

/** Поля заявления 1120, которые совет видит в вопросе. */
interface StatementMeta {
  braname?: string;
  branch_name?: string;
  branch_chairman_name?: string;
  property_name?: string;
  property_description?: string;
  property_quantity?: string;
  property_unit?: string;
  property_amount?: string;
}

const props = defineProps<{ agenda: IAgenda }>();

function parseMeta(raw: unknown): StatementMeta {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as StatementMeta;
  try {
    return JSON.parse(String(raw)) as StatementMeta;
  } catch {
    return {};
  }
}

// Мета заявления: из строки вопроса, дополненная документом повестки.
const meta = computed<StatementMeta>(() => ({
  ...parseMeta(props.agenda.table?.statement?.meta),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...parseMeta((props.agenda.documents as any)?.statement?.documentAggregate?.rawDocument?.meta),
}));

const applicantName = computed(() => {
  const certificate = props.agenda.table?.username_certificate;
  return certificate ? getShortNameFromCertificate(certificate) : props.agenda.table?.username || '______';
});

const quantity = computed(() => [meta.value.property_quantity, meta.value.property_unit].filter(Boolean).join(' ') || '______');
const amount = computed(() => (meta.value.property_amount ? formatAsset2Digits(meta.value.property_amount) : '______'));
</script>

<style lang="scss" scoped>
.invest-property {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  margin-top: var(--p-3);
  min-width: 0;

  &__label {
    display: inline-flex;
    align-items: center;
    gap: var(--p-1);
    color: var(--p-ink-2);

    .q-icon {
      color: var(--p-primary);
    }
  }

  &__panel {
    display: flex;
    flex-direction: column;
    gap: var(--p-1);
    padding: var(--p-4) var(--p-5);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md);
    background: var(--p-surface-2);
    min-width: 0;
  }

  &__name {
    font-size: var(--p-fs-h3);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__amount {
    font-size: var(--p-fs-h2);
    font-weight: 700;
    color: var(--p-ink);
    margin-bottom: var(--p-2);
  }
}
</style>

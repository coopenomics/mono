<template lang="pug">
//- Вопрос повестки о приёме имущества: совет видит, что и на какую сумму
//- вносится, без открытия заявления.
.decision-property
  .decision-property__label
    q-icon(name='inventory_2', size='18px')
    span.t-eyebrow {{ $t('capital.programPropertyDecisionInfo.title') }}
  .decision-property__panel
    .decision-property__name {{ meta.property_name || '______' }}
    .decision-property__amount.t-mono {{ amount }}
    DataRow(:label='$t("capital.programPropertyDecisionInfo.applicantLabel")', :value='applicantName', align='spread')
    DataRow(:label='$t("capital.programPropertyDecisionInfo.quantityLabel")', :value='quantity', align='spread')
    DataRow(
      :label='$t("capital.programPropertyDecisionInfo.descriptionLabel")',
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

interface StatementMeta {
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

// Мета заявления 1070: из документа повестки, иначе из строки вопроса.
const meta = computed<StatementMeta>(() => ({
  ...parseMeta(props.agenda.table?.statement?.meta),
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
.decision-property {
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

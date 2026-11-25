<template lang="pug">
//- Вопрос совета о приёме имущества в кооперативный участок (заявление 1120,
//- одобренное председателем участка): что вносится, по какой цене, в какой
//- участок и кто одобрил заявление. Строками сведений, как у вопросов
//- «Образования», — совет читает их рядом с заявлением.
.invest-property-info
  DataRow(:label='$t("marketplace.investPropertyDecisionInfo.nameLabel")', :value='meta.property_name || "______"')
  DataRow(:label='$t("marketplace.investPropertyDecisionInfo.amountLabel")', :value='amount')
  DataRow(:label='$t("marketplace.investPropertyDecisionInfo.applicantLabel")', :value='applicantName')
  DataRow(:label='$t("marketplace.investPropertyDecisionInfo.quantityLabel")', :value='quantity')
  DataRow(:label='$t("marketplace.investPropertyDecisionInfo.branchLabel")', :value='meta.branch_name || meta.braname || "______"')
  DataRow(:label='$t("marketplace.investPropertyDecisionInfo.approvedByLabel")', :value='meta.branch_chairman_name || "______"')
  DataRow(:label='$t("marketplace.investPropertyDecisionInfo.descriptionLabel")', :value='meta.property_description || "______"')
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
.invest-property-info {
  margin-top: var(--p-3);
}
</style>

<template lang="pug">
//- Вопрос совета о выплате материальной помощи из средств кооперативного
//- участка (заявление 1109): основание выплаты, участок, получатель и сумма —
//- строками сведений, как у вопросов «Образования». Совет видит их рядом с
//- заявлением, не открывая документ (слово владельца 08.11.2026).
.branch-aid-info
  DataRow(:label='$t("marketplace.branchAidDecisionInfo.sourceLabel")', :value='$t("marketplace.branchAidDecisionInfo.sourceValue")')
  DataRow(:label='$t("marketplace.branchAidDecisionInfo.branchLabel")', :value='branchName')
  DataRow(:label='$t("marketplace.branchAidDecisionInfo.receiverLabel")', :value='receiverName')
  DataRow(:label='$t("marketplace.branchAidDecisionInfo.amountLabel")', :value='amount')
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { IAgenda } from 'src/entities/Agenda/model';
import { useBranchStore } from 'src/entities/Branch/model';
import { useSystemStore } from 'src/entities/System/model';
import { DataRow } from 'src/shared/ui/domain/DataRow';
import { getShortNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';

/** Поля заявления 1109, которые совет видит в вопросе. */
interface StatementMeta {
  braname?: string;
  amount?: string;
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

const meta = computed<StatementMeta>(() => ({
  ...parseMeta(props.agenda.table?.statement?.meta),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...parseMeta((props.agenda.documents as any)?.statement?.documentAggregate?.rawDocument?.meta),
}));

// Названия участков — из общего справочника; грузим один раз, без него
// показываем код участка.
const branches = useBranchStore();
const system = useSystemStore();
if (!branches.publicBranches.length) {
  void branches.loadPublicBranches({ coopname: system.info.coopname }).catch(() => undefined);
}

const branchName = computed(() => {
  const code = meta.value.braname;
  if (!code) return '______';
  const branch = branches.publicBranches.find((b) => b.braname === code);
  return branch?.short_name || branch?.full_name || code;
});

const receiverName = computed(() => {
  const certificate = props.agenda.table?.username_certificate;
  return certificate ? getShortNameFromCertificate(certificate) : props.agenda.table?.username || '______';
});

const amount = computed(() => (meta.value.amount ? formatAsset2Digits(meta.value.amount) : '______'));
</script>

<style lang="scss" scoped>
.branch-aid-info {
  margin-top: var(--p-3);
}
</style>

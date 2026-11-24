<template lang="pug">
//- Сведения собрания сбоку от основного содержания: явка, ведущие, даты и
//- документы. Главное — явка: набран ли кворум.
.meet-facts
  section.meet-facts__section(v-if='turnout')
    .meet-facts__eyebrow {{ $t('meet.statusView.turnoutLabel') }}
    .meet-facts__turnout
      span.meet-facts__turnout-value {{ turnout.percent }}%
      BaseBadge(v-if='turnout.reached', variant='pos') {{ $t('meet.meetFacts.quorumReached') }}
    .meet-facts__bar
      .meet-facts__bar-fill(:style='{ width: `${Math.min(turnout.percent, 100)}%` }')
      .meet-facts__bar-mark(:style='{ left: `${Math.min(turnout.required, 100)}%` }')
    .meet-facts__caption
      | {{ $t('meet.statusView.turnoutBallots', { ballots: turnout.ballots }) }} · {{ $t('meet.statusView.turnoutRequired', { required: turnout.required }) }}

  section.meet-facts__section(v-else-if='quorumRequired')
    DataRow(align='spread', :label='$t("meet.meetFacts.quorumLabel")', :value='`${quorumRequired}%`')

  section.meet-facts__section
    DataRow(align='spread', :label='$t("meet.meetFacts.presiderLabel")', :value='presiderName')
    DataRow(align='spread', :label='$t("meet.meetFacts.secretaryLabel")', :value='secretaryName')

  section.meet-facts__section
    DataRow(align='spread', :label='$t("meet.meetFacts.openLabel")', :value='openAt')
    DataRow(align='spread', :label='$t("meet.meetFacts.closeLabel")', :value='closeAt')

  section.meet-facts__section(v-if='documents.length')
    .meet-facts__eyebrow {{ $t('meet.meetFacts.documentsLabel') }}
    DocumentRow(
      v-for='doc in documents',
      :key='doc.title',
      clickable,
      :document='{ type: "html", title: doc.title }',
      @open='openDocument(doc)'
    )

  DocumentViewerDialog(
    v-model='viewerOpen',
    :document-aggregate='viewerDoc?.aggregate ?? null',
    :title='viewerDoc?.title'
  )
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { BaseBadge } from 'src/shared/ui/base';
import { DataRow, DocumentRow } from 'src/shared/ui/domain';
import { DocumentViewerDialog } from 'src/shared/ui/domain/DocumentViewerDialog';
import { meetTurnout, type IMeet } from 'src/entities/Meet';
import type { IDocumentAggregate } from 'src/entities/Document/model';
import { getNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate';
import { formatDateToLocalTimezone, getTimezoneLabel } from 'src/shared/lib/utils/dates/timezone';
import { t } from 'src/shared/i18n';

const props = defineProps<{ meet: IMeet }>();

const S = Zeus.ExtendedMeetStatus;
// До открытия голосования явки нет: показывается только требование кворума.
const BEFORE_VOTING: string[] = [S.NONE, S.CREATED, S.AUTHORIZED, S.WAITING_FOR_OPENING, S.ONRESTART];

const row = computed(() => props.meet.processing?.meet ?? null);
const turnout = computed(() =>
  BEFORE_VOTING.includes(props.meet.processing?.extendedStatus ?? S.NONE) ? null : meetTurnout(props.meet),
);
const quorumRequired = computed(() => Math.round(Number(row.value?.quorum_percent ?? 0)));

const presiderName = computed(
  () => getNameFromCertificate(row.value?.presider_certificate as never) || row.value?.presider || '—',
);
const secretaryName = computed(
  () => getNameFromCertificate(row.value?.secretary_certificate as never) || row.value?.secretary || '—',
);

const dateTime = (value: unknown) => (value ? `${formatDateToLocalTimezone(value)} ${getTimezoneLabel()}` : '—');
const openAt = computed(() => dateTime(row.value?.open_at));
const closeAt = computed(() => dateTime(row.value?.close_at));

interface MeetDocument {
  title: string;
  aggregate: IDocumentAggregate;
}

// Документы собрания по порядку жизни собрания: предложение повестки, решение
// совета о созыве, протокол. Протокол — утверждённый, а до утверждения — с
// подписью секретаря.
const documents = computed<MeetDocument[]>(() => {
  const list: MeetDocument[] = [];
  if (row.value?.proposal) list.push({ title: t('meet.meetFacts.proposalDoc'), aggregate: row.value.proposal as IDocumentAggregate });
  if (row.value?.authorization)
    list.push({ title: t('meet.meetFacts.authorizationDoc'), aggregate: row.value.authorization as IDocumentAggregate });
  const protocol = props.meet.processed?.decisionAggregate ?? row.value?.decision1;
  if (protocol) list.push({ title: t('meet.meetFacts.protocolDoc'), aggregate: protocol as IDocumentAggregate });
  return list;
});

const viewerOpen = ref(false);
const viewerDoc = ref<MeetDocument | null>(null);
function openDocument(doc: MeetDocument): void {
  viewerDoc.value = doc;
  viewerOpen.value = true;
}
</script>

<style lang="scss" scoped>
.meet-facts {
  display: flex;
  flex-direction: column;
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 16px);
}

.meet-facts__section {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
  padding: var(--p-4, 16px) var(--p-5, 20px);

  & + & {
    border-top: 1px solid var(--p-line);
  }
}

.meet-facts__eyebrow {
  font-size: var(--p-fs-eyebrow, 11px);
  letter-spacing: var(--p-ls-eyebrow, 0.08em);
  text-transform: uppercase;
  color: var(--p-ink-3);
}

.meet-facts__turnout {
  display: flex;
  align-items: center;
  gap: var(--p-3, 12px);
}

.meet-facts__turnout-value {
  font-size: var(--p-fs-h1, 28px);
  font-weight: 700;
  line-height: 1.1;
  color: var(--p-ink);
  font-variant-numeric: tabular-nums;
}

// Полоса явки с отметкой порога кворума.
.meet-facts__bar {
  position: relative;
  height: 6px;
  margin: var(--p-1, 4px) 0;
  border-radius: var(--p-r-pill, 999px);
  background: var(--p-surface-2);
}

.meet-facts__bar-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--p-primary);
}

.meet-facts__bar-mark {
  position: absolute;
  top: -3px;
  width: 2px;
  height: 12px;
  margin-left: -1px;
  background: var(--p-ink-2);
}

.meet-facts__caption {
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-ink-3);
}
</style>

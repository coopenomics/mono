<template lang="pug">
//- Взнос результатом работы целиком — для правой панели. Зоны сверху вниз:
//- состояние, сумма, кто и что передал, сроки, материалы, документы цепи.
.edu-contrib-details
  .edu-contrib-details__state
    BaseBadge(:variant="status.variant") {{ status.label }}
    .t-sm.text-negative(v-if="contribution.decline_reason") {{ contribution.decline_reason }}

  .edu-contrib-details__amount
    .t-eyebrow {{ $t('edubridge.contributionDetails.amount') }}
    FeeAmount(:value="contribution.amount" size="lg")

  DataRow(v-if="showTeacher" :label="$t('edubridge.contributionDetails.teacher')")
    template(#value-override)
      IdentityCell(:account-name="contribution.teacher_username" :full-name="teacherName" copyable)
  DataRow(:label="$t('edubridge.contributionDetails.kind')" :value="ridType")
  DataRow(:label="$t('edubridge.contributionDetails.description')" :value="contribution.description || '______'")
  DataRow(:label="$t('edubridge.contributionDetails.createdAt')" :value="formatDate(contribution.created_at)")
  DataRow(v-if="contribution.hold_until" :label="$t('edubridge.contributionDetails.holdUntil')" :value="formatDate(contribution.hold_until)")
  DataRow(v-if="contribution.decided_at" :label="$t('edubridge.contributionDetails.decidedAt')" :value="formatDate(contribution.decided_at)")

  //- Что именно передано кооперативу: ссылки на запись, конспект, задания.
  .edu-contrib-details__section
    .t-eyebrow.q-mb-sm {{ $t('edubridge.contributionDetails.materials') }}
    .edu-contrib-details__files(v-if="contribution.links.length")
      a.edu-contrib-details__link(v-for="link in contribution.links" :key="link" :href="link" target="_blank" rel="noopener")
        q-icon(name="link" size="14px")
        span {{ link }}
    .t-muted.t-sm(v-else) ______

  //- След взноса в цепи: каждый документ — по своему шагу.
  .edu-contrib-details__section(v-if="documents.length")
    .t-eyebrow.q-mb-sm {{ $t('edubridge.contributionDetails.documents') }}
    DataRow(v-for="d in documents" :key="d.label" :label="d.label" :value="d.hash" mono copyable)
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { asDateInput } from 'src/shared/lib/utils';
import { BaseBadge } from 'src/shared/ui/base';
import { DataRow, IdentityCell } from 'src/shared/ui/domain';
import { CONTRIBUTION_STATUS_LABELS, RID_TYPE_LABELS, type IContribution } from '../../entities/Teacher';
import { FeeAmount } from '../../shared/ui/FeeAmount';
import { t } from '../../i18n';

/**
 * Одна карточка взноса на оба стола: администратор видит её с преподавателем,
 * преподаватель — без него. Действия над взносом карточке не принадлежат:
 * их ставит владелец в подвал панели.
 */
const props = withDefaults(defineProps<{ contribution: IContribution; teacherName?: string | null; showTeacher?: boolean }>(), {
  teacherName: null,
  showTeacher: false,
});

const status = computed(() => CONTRIBUTION_STATUS_LABELS[props.contribution.status] ?? { label: props.contribution.status, variant: 'neutral' as const });
const ridType = computed(() => RID_TYPE_LABELS[props.contribution.rid_type] ?? props.contribution.rid_type);
const formatDate = (v: unknown) => {
  const input = asDateInput(v);
  return input ? new Date(input).toLocaleDateString('ru-RU') : '______';
};
/** Документы по шагам взноса; без хэша шаг ещё не пройден и строки нет. */
const documents = computed(() =>
  [
    { label: t('edubridge.contributionDetails.doc.statement'), hash: props.contribution.statement_hash },
    { label: t('edubridge.contributionDetails.doc.storageAct'), hash: props.contribution.storage_act_hash },
    { label: t('edubridge.contributionDetails.doc.decision'), hash: props.contribution.decision_hash },
    { label: t('edubridge.contributionDetails.doc.act'), hash: props.contribution.act_hash },
  ].filter((d): d is { label: string; hash: string } => Boolean(d.hash)),
);
</script>

<style scoped>
.edu-contrib-details__state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-2);
  margin-bottom: var(--p-4);
}
.edu-contrib-details__amount {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  padding-bottom: var(--p-4);
  margin-bottom: var(--p-2);
  border-bottom: 1px solid var(--p-line);
}
.edu-contrib-details__section {
  margin-top: var(--p-5);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
.edu-contrib-details__files {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}
.edu-contrib-details__link {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2);
  min-width: 0;
  color: var(--p-primary);
  text-decoration: none;
  font-size: var(--p-fs-body-sm);
  word-break: break-all;
}
.edu-contrib-details__link:hover {
  text-decoration: underline;
}
</style>

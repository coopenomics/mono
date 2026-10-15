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
  DataRow(v-if="contribution.learners_count" :label="$t('edubridge.contributionDetails.learners')" :value="String(contribution.learners_count)")
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

  //- Документы взноса — как договор у преподавателя: строка с названием,
  //- текст раскрывается по нажатию. Хэши человеку не нужны.
  .edu-contrib-details__section(v-if="documentsLoading || documents.length")
    .t-eyebrow.q-mb-sm {{ $t('edubridge.contributionDetails.documents') }}
    CardListSkeleton(v-if="documentsLoading" :count="1")
    .edu-contrib-details__docs(v-else)
      ComplexDocument(v-for="d in documents" :key="d.kind" :document="d.document" collapsible)
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { asDateInput, asText } from 'src/shared/lib/utils';
import { BaseBadge, CardListSkeleton } from 'src/shared/ui/base';
import { DataRow, IdentityCell } from 'src/shared/ui/domain';
import { ComplexDocument } from 'src/shared/ui/ComplexDocument';
import {
  CONTRIBUTION_STATUS_LABELS,
  RID_TYPE_LABELS,
  fetchContributionDocuments,
  fetchMyContributionDocuments,
  type IContribution,
  type IContributionDocument,
} from '../../entities/Teacher';
import { FeeAmount } from '../../shared/ui/FeeAmount';

/**
 * Одна карточка взноса на оба стола: администратор видит её с преподавателем,
 * преподаватель — без него. Документы карточка читает сама: администратор —
 * по любому взносу, преподаватель — по своему (`scope`). Действия над взносом
 * карточке не принадлежат: их ставит владелец в подвал панели.
 */
const props = withDefaults(defineProps<{ contribution: IContribution; teacherName?: string | null; showTeacher?: boolean; scope?: 'admin' | 'own' }>(), {
  teacherName: null,
  showTeacher: false,
  scope: 'admin',
});

const status = computed(() => CONTRIBUTION_STATUS_LABELS[props.contribution.status] ?? { label: props.contribution.status, variant: 'neutral' as const });
const ridType = computed(() => RID_TYPE_LABELS[props.contribution.rid_type] ?? props.contribution.rid_type);
const formatDate = (v: unknown) => {
  const input = asDateInput(v);
  return input ? new Date(input).toLocaleDateString('ru-RU') : '______';
};
/** Документы взноса — с сервера, по шагам его пути; ошибка чтения карточку не ломает. */
const documents = ref<IContributionDocument[]>([]);
const documentsLoading = ref(true);
async function loadDocuments(): Promise<void> {
  documentsLoading.value = true;
  const id = asText(props.contribution.id);
  try {
    documents.value = props.scope === 'own' ? await fetchMyContributionDocuments(id) : await fetchContributionDocuments(id);
  } catch {
    documents.value = [];
  } finally {
    documentsLoading.value = false;
  }
}
// Новый документ появляется, когда взнос проходит шаг: перечитываем по смене состояния.
// realtime: карточка живёт внутри панели — ленту слушает страница и обновляет сам взнос.
watch(() => [asText(props.contribution.id), props.contribution.status], loadDocuments, { immediate: true });
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
.edu-contrib-details__files,
.edu-contrib-details__docs {
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

<template lang="pug">
//- Гарантийные условия подписки на карточке курса: срок, кнопка заявления и ход поданного.
BaseCard(v-if="states.length" variant="default" :title="$t('edubridge.guaranteeClaim.title')")
  .edu-guarantee__row(v-for="s in states" :key="asText(s.enrollment_id)")
    .edu-guarantee__main
      .t-sm(v-if="s.claim") {{ $t('edubridge.guaranteeClaim.claimNumber', { number: s.claim.number }) }}
      .t-sm(v-else-if="s.guarantee_until") {{ $t('edubridge.guaranteeClaim.until', { date: formatDate(s.guarantee_until) }) }}
      .t-sm(v-else) {{ $t('edubridge.guaranteeClaim.beforeStart') }}
      .t-meta.t-muted {{ $t('edubridge.guaranteeClaim.amount', { amount: formatAsset2Digits(s.amount) }) }}
    BaseBadge(v-if="s.claim" :variant="statusOf(s.claim.status).variant") {{ statusOf(s.claim.status).label }}
    BaseButton(v-else variant="secondary" size="sm" @click="open(s)") {{ $t('edubridge.guaranteeClaim.open') }}

  BaseDialog(v-model="dialogOpen" :title="$t('edubridge.guaranteeClaim.dialogTitle')" size="md")
    BaseForm(:loading="busy" @submit="onSubmit")
      DataRow(:label="$t('edubridge.guaranteeClaim.refundLabel')" :value="formatAsset2Digits(target?.amount ?? '')" align="spread")
      BaseInput.q-mt-md(v-model="reason" :label="$t('edubridge.guaranteeClaim.reasonLabel')" type="textarea" :rows="4" required)
      BaseInput(v-model="linksText" :label="$t('edubridge.guaranteeClaim.linksLabel')" type="textarea" :rows="2" :hint="$t('edubridge.guaranteeClaim.linksHint')")
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" :disabled="busy" @click="dialogOpen = false") {{ $t('edubridge.guaranteeClaim.cancel') }}
          BaseButton(variant="primary" type="submit" :loading="busy" :disabled="!reason.trim()") {{ $t('edubridge.guaranteeClaim.submit') }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { asDateInput, asText } from 'src/shared/lib/utils';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseCard, BaseDialog, BaseForm, BaseInput } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../../shared/lib/live';
import { fetchMyEnrollments } from '../../../entities/Learner';
import { fetchMyGuarantees, submitGuaranteeClaim, type IGuaranteeState } from '../api';
import { t } from '../../../i18n';

/**
 * Участник может аннулировать подписку по гарантийным условиям, пока идёт его
 * гарантийный срок: заявление с причиной рассматривает совет, при
 * удовлетворении вся стоимость возвращается. Блок показывает только подписки
 * этого курса, у которых гарантия объявлена либо заявление уже подано.
 */
const props = defineProps<{ courseId: string }>();
const emit = defineEmits<{ submitted: [] }>();

const all = ref<IGuaranteeState[]>([]);
const ownEnrollmentIds = ref<Set<string>>(new Set());
const dialogOpen = ref(false);
const target = ref<IGuaranteeState | null>(null);
const reason = ref('');
const linksText = ref('');
const busy = ref(false);

const states = computed(() => all.value.filter((s) => ownEnrollmentIds.value.has(asText(s.enrollment_id)) && (s.available || s.claim)));

const STATUS: Record<string, { label: string; variant: 'info' | 'pos' | 'neg' | 'neutral' }> = {
  [Zeus.EduGuaranteeClaimStatus.SUBMITTED]: { label: t('edubridge.guaranteeClaim.status.SUBMITTED'), variant: 'info' },
  [Zeus.EduGuaranteeClaimStatus.APPROVED]: { label: t('edubridge.guaranteeClaim.status.APPROVED'), variant: 'pos' },
  [Zeus.EduGuaranteeClaimStatus.DECLINED]: { label: t('edubridge.guaranteeClaim.status.DECLINED'), variant: 'neg' },
  [Zeus.EduGuaranteeClaimStatus.EXPIRED]: { label: t('edubridge.guaranteeClaim.status.EXPIRED'), variant: 'neutral' },
};
const statusOf = (s: string) => STATUS[s] ?? { label: s, variant: 'neutral' as const };
const formatDate = (v: unknown) => {
  const input = asDateInput(v);
  return input ? new Date(input).toLocaleDateString('ru-RU') : '______';
};

async function load(): Promise<void> {
  try {
    const [enrollments, guarantees] = await Promise.all([fetchMyEnrollments(), fetchMyGuarantees()]);
    ownEnrollmentIds.value = new Set(enrollments.filter((e) => asText(e.course_id) === props.courseId).map((e) => asText(e.id)));
    all.value = guarantees;
  } catch (e) {
    FailAlert(e);
  }
}

function open(state: IGuaranteeState): void {
  target.value = state;
  reason.value = '';
  linksText.value = '';
  dialogOpen.value = true;
}

async function onSubmit(): Promise<void> {
  if (!target.value) return;
  busy.value = true;
  try {
    const links = linksText.value.split('\n').map((l) => l.trim()).filter(Boolean);
    await submitGuaranteeClaim({ enrollment_id: asText(target.value.enrollment_id), reason: reason.value.trim(), links });
    dialogOpen.value = false;
    SuccessAlert(t('edubridge.guaranteeClaim.success'));
    await load();
    emit('submitted');
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

// Живое обновление: совет рассматривает заявление на своём столе, подписка закрывается в цепи.
useLiveReload([EduLive.enrollments, EduLive.guaranteeClaims], load);

onMounted(load);
</script>

<style scoped>
.edu-guarantee__row {
  display: flex;
  /* В узкой колонке кнопка переносится под текст, а не сжимает его. */
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
  padding: var(--p-2) 0;
  border-bottom: 1px solid var(--p-line);
}
.edu-guarantee__row:last-child {
  border-bottom: 0;
}
.edu-guarantee__main {
  min-width: 0;
}
</style>

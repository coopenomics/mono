<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:teacher-assignments:banner-dismissed")
    | Назначения — курс, расписание, ожидаемый результат и период сдачи. Назначение действует после подписи
    | приложения к договору участия в хозяйственной деятельности вами и председателем совета.

  CardListSkeleton(v-if="firstLoad" :count="2")
  template(v-else)
    //- Что ждёт подписи — сверху карточками: преподаватель должен сразу видеть, что ему подписать.
    template(v-if="awaiting.length")
      .t-eyebrow.q-mb-sm Ждут вашей подписи
      BaseBanner.q-mb-md(v-if="!contractActive" variant="info")
        template(#icon)
          q-icon(name="schedule")
        | Приложения подписываются, когда договор участия действует: сейчас он ждёт подписи председателя совета.
      .row.q-col-gutter-md.q-mb-lg
        .col-12.col-md-6(v-for="a in awaiting" :key="asText(a.id)")
          BaseCard(variant="default" :title="a.course_title" subtitle="Приложение к договору участия в хозяйственной деятельности")
            DataRow(label="Расписание" :value="a.schedule || '______'")
            DataRow(label="Период" :value="`${a.period_from} — ${a.period_to}`")
            DataRow(label="Ожидаемый результат" :value="a.expected_result || '______'")
            BaseBanner.q-mt-sm(v-if="a.status === Zeus.EduAssignmentStatus.DECLINED" variant="neg")
              template(#icon)
                q-icon(name="block")
              | Председатель отказал в подписи{{ a.decline_reason ? `: ${a.decline_reason}` : '' }}. Прочитайте и подпишите приложение заново.
            .row.justify-end.q-mt-md
              BaseButton(variant="primary" :disabled="!contractActive" @click="openAnnex(a)") Прочитать и подписать

    BaseTable(v-if="others.length" :columns="columns" :rows="others" row-key="id" min-width="960px")
      template(#cell-period="{ row }") {{ row.period_from }} — {{ row.period_to }}
      template(#cell-status="{ row }")
        BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
    EmptyState(v-if="!assignments.length" title="Назначений пока нет" body="Администратор ещё не назначил вам курс.")
      template(#icon)
        q-icon(name="assignment" size="32px")

  BaseDialog(v-model="annexOpen" size="lg" :title="signing ? `Приложение: ${signing.course_title}` : ''")
    EduGateDocumentStep(
      v-if="signing"
      :step-key="asText(signing.id)"
      agree-label="Я прочитал(а) приложение к договору участия в хозяйственной деятельности и согласен(на) с его условиями."
      action-label="Подписать приложение"
      :build="buildAnnex"
      :sign="signCurrent"
      @signed="onSigned"
    )
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { asText } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import type { DigitalDocument } from 'src/shared/lib/document';
import { refreshMenuBadges } from 'src/shared/lib/menuBadges';
import { BaseBadge, BaseBanner, BaseButton, BaseCard, BaseDialog, BaseTable, CardListSkeleton, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { DataRow, PageHint } from 'src/shared/ui/domain';
import {
  ASSIGNMENT_STATUS_LABELS,
  awaitsTeacherSignature,
  buildAnnexDocument,
  fetchMyAssignments,
  fetchMyContract,
  signAnnex,
  type IAssignment,
  type IContract,
} from '../../entities/Teacher';
import { EduGateDocumentStep } from '../../features/OfferGate';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';

/**
 * Назначения преподавателя. Назначение рождается черновиком, когда
 * администратор ставит преподавателя на курс, и действует после подписи
 * приложения к договору преподавателем и председателем. Неподписанные — сверху
 * карточками с документом к чтению и подписи; остальные — таблицей.
 */
// Договор нужен для подписи приложений (его номер уходит в документ); показывается он в профиле.
const contract = ref<IContract | null>(null);
const assignments = ref<IAssignment[]>([]);
const loading = ref(false);
const firstLoad = useFirstLoad(loading);

const annexOpen = ref(false);
const signing = ref<IAssignment | null>(null);
const annexDoc = ref<DigitalDocument | null>(null);

const columns: BaseTableColumn<IAssignment>[] = [
  { key: 'course_title', label: 'Курс' },
  { key: 'schedule', label: 'Расписание', width: '180px' },
  { key: 'expected_result', label: 'Ожидаемый результат' },
  { key: 'period', label: 'Период сдачи', width: '200px' },
  { key: 'status', label: 'Состояние', width: '200px' },
];
const statusOf = (s: string) => ASSIGNMENT_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
// Приложение подписывается только при действующем договоре.
const contractActive = computed(() => contract.value?.status === Zeus.EduContractStatus.ACTIVE);
const awaiting = computed(() => assignments.value.filter(awaitsTeacherSignature));
const others = computed(() => assignments.value.filter((a) => !awaitsTeacherSignature(a)));

async function load(): Promise<void> {
  loading.value = true;
  try {
    [contract.value, assignments.value] = await Promise.all([fetchMyContract(), fetchMyAssignments()]);
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function openAnnex(a: IAssignment): void {
  signing.value = a;
  annexDoc.value = null;
  annexOpen.value = true;
}

/** Экземпляр приложения для чтения — подписывается ровно он. */
async function buildAnnex(): Promise<string> {
  if (!signing.value || !contract.value) throw new Error('Нет назначения или договора');
  annexDoc.value = await buildAnnexDocument(signing.value, contract.value.contract_number);
  return annexDoc.value.data?.html ?? '';
}

async function signCurrent(): Promise<void> {
  if (!signing.value || !annexDoc.value) throw new Error('Приложение ещё не сформировано');
  const updated = await signAnnex(signing.value, annexDoc.value);
  assignments.value = assignments.value.map((x) => (x.id === updated.id ? updated : x));
}

function onSigned(): void {
  annexOpen.value = false;
  signing.value = null;
  SuccessAlert('Приложение подписано — ждёт подписи председателя совета');
  void refreshMenuBadges(['edubridge-assignments']);
}

// Живое обновление: черновик появляется, когда администратор ставит на курс,
// решение председателя приходит со стола совета.
useLiveReload([EduLive.teacherContracts, EduLive.assignments], load);

onMounted(load);
</script>

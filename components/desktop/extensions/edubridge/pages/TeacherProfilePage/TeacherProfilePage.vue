<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:teacher-profile:banner-dismissed")
    | Профиль преподавателя открывается договором участия в хозяйственной деятельности. Учётное имя из профиля
    | администратор указывает, назначая вас на курс; курсы и взносы ведутся отдельными страницами стола.

  CardListSkeleton(v-if="firstLoad" :count="2")

  .row.q-col-gutter-md(v-else)
    .col-12.col-md-7
      BaseCard(variant="default" title="Преподаватель")
        //- Фотография одна на пайщика: она же стоит в удостоверении пайщика.
        AvatarUpload.q-mb-md(:name="fullName || username" :src="avatarUrl" @changed="onAvatarChanged")
        IdentityCell(:account-name="username" :full-name="fullName" copyable)
        q-separator.q-my-md
        DataRow(label="Курсов ведётся" :value="String(activeAssignments)")
        DataRow(label="Назначений всего" :value="String(assignments.length)")

      BaseCard.q-mt-md(variant="default" title="Курсы")
        q-list(v-if="assignments.length" separator)
          q-item(v-for="a in assignments" :key="asText(a.id)")
            q-item-section
              .text-weight-medium {{ a.course_title }}
              .t-muted.t-sm {{ a.period_from }} — {{ a.period_to }}
            q-item-section(side)
              BaseBadge(:variant="statusOf(a.status).variant") {{ statusOf(a.status).label }}
        .t-muted.t-sm(v-else) Назначений пока нет — администратор ещё не назначил вам курс.

    .col-12.col-md-5
      BaseCard(variant="default" title="Договор участия в хозяйственной деятельности")
        template(v-if="contract")
          DataRow(label="Номер" :value="contract.contract_number" mono copyable)
          DataRow(label="Подписан вами" :value="formatDate(contract.signed_at)")
          DataRow(label="Подписан председателем" :value="contract.approved_at ? formatDate(contract.approved_at) : '______'")
          DataRow(label="Состояние")
            template(#value-override)
              BaseBadge(:variant="contractStatus.variant") {{ contractStatus.label }}
          .t-muted.t-meta.q-mt-sm(v-if="pendingApproval") Договор ждёт подписи председателя совета. До неё назначения не активируются.
          .t-muted.t-meta.q-mt-sm(v-else-if="declined && contract.decline_reason") Причина отказа: {{ contract.decline_reason }}
        .t-muted.t-sm(v-else) Договор не подписан.
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';
import { AvatarUpload } from 'src/features/User/Avatar';
import { getName } from 'src/shared/lib/utils/account';
import { asDateInput, asText } from 'src/shared/lib/utils';
import { BaseBadge, BaseCard, CardListSkeleton } from 'src/shared/ui/base';
import { DataRow, IdentityCell, PageHint } from 'src/shared/ui/domain';
import { ASSIGNMENT_STATUS_LABELS, fetchMyAssignments, fetchMyContract, type IAssignment, type IContract } from '../../entities/Teacher';

/**
 * Профиль преподавателя: кто он в кооперативе, чем подтверждено участие и какие
 * курсы за ним закреплены. Профиль открывается подписанным договором участия в
 * хозяйственной деятельности — сам договор показан здесь, а не в реестре
 * назначений. Учётное имя отсюда администратор указывает при назначении на курс.
 */
const CONTRACT_STATUS_LABELS: Record<string, { label: string; variant: 'pos' | 'warn' | 'neg' | 'neutral' }> = {
  [Zeus.EduContractStatus.PENDING_APPROVAL]: { label: 'Ждёт председателя', variant: 'warn' },
  [Zeus.EduContractStatus.ACTIVE]: { label: 'Действует', variant: 'pos' },
  [Zeus.EduContractStatus.DECLINED]: { label: 'Председатель отказал', variant: 'neg' },
};

const session = useSessionStore();

const contract = ref<IContract | null>(null);
const assignments = ref<IAssignment[]>([]);
const loading = ref(true);
const firstLoad = useFirstLoad(loading);

const username = computed(() => session.username ?? '');
// Заменённую фотографию показываем сразу, не дожидаясь перезагрузки стола.
const uploadedAvatar = ref<string | null | undefined>(undefined);
const avatarUrl = computed(() => (uploadedAvatar.value !== undefined ? uploadedAvatar.value : session.currentUserAccount?.avatar_url ?? null));

function onAvatarChanged(url: string | null): void {
  uploadedAvatar.value = url;
}
const fullName = computed(() => (session.currentUserAccount ? getName(session.currentUserAccount) : ''));
const contractStatus = computed(
  () => CONTRACT_STATUS_LABELS[contract.value?.status ?? ''] ?? { label: contract.value?.status ?? '', variant: 'neutral' as const },
);
const pendingApproval = computed(() => contract.value?.status === Zeus.EduContractStatus.PENDING_APPROVAL);
const declined = computed(() => contract.value?.status === Zeus.EduContractStatus.DECLINED);
const activeAssignments = computed(() => assignments.value.filter((a) => a.status === Zeus.EduAssignmentStatus.ACTIVE).length);

const statusOf = (s: string) => ASSIGNMENT_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const formatDate = (v: unknown) => {
  const input = asDateInput(v);
  return input ? new Date(input).toLocaleDateString('ru-RU') : '______';
};

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [c, a] = await Promise.all([fetchMyContract(), fetchMyAssignments()]);
    contract.value = c;
    assignments.value = a;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

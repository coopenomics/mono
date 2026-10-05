<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:teacher-profile:banner-dismissed")
    | {{ $t('edubridge.teacherProfilePage.hintContract') }}

  CardListSkeleton(v-if="firstLoad" :count="2")

  .row.q-col-gutter-md(v-else)
    .col-12.col-md-7
      BaseCard(variant="default" :title="$t('edubridge.teacherProfilePage.teacherTitle')")
        //- Фотография одна на пайщика: она же стоит в удостоверении пайщика.
        //- Загрузка открывается наведением на кружок, рядом с ним — ФИО и учётное имя.
        IdentityPanel(:identity="identity" flat)
          template(#avatar)
            AvatarUpload(:name="fullName || username" :src="avatarUrl" size="xl")
        q-separator.q-my-md
        DataRow(:label="$t('edubridge.teacherProfilePage.activeCoursesLabel')" :value="String(activeAssignments)")
        DataRow(:label="$t('edubridge.teacherProfilePage.assignmentsTotalLabel')" :value="String(assignments.length)")
        DataRow(:label="$t('edubridge.teacherProfilePage.hourlyRateLabel')" :value="formatAsset2Digits(profile?.hourly_rate ?? '')")

      //- Рассказ о себе: его видит администратор, когда допускает преподавателя к курсу.
      BaseCard.q-mt-md(variant="default" :title="$t('edubridge.teacherProfilePage.aboutTitle')")
        template(#actions)
          BaseButton(variant="ghost" size="sm" @click="openAbout") {{ profile?.about ? $t('edubridge.teacherProfilePage.aboutEdit') : $t('edubridge.teacherProfilePage.aboutFill') }}
        .edu-profile__about(v-if="profile?.about") {{ profile.about }}
        .t-muted.t-sm(v-else) {{ $t('edubridge.teacherProfilePage.aboutEmpty') }}

      BaseCard.q-mt-md(variant="default" :title="$t('edubridge.teacherProfilePage.coursesTitle')")
        q-list(v-if="assignments.length" separator)
          q-item(v-for="a in assignments" :key="asText(a.id)")
            q-item-section
              .text-weight-medium {{ a.course_title }}
              .t-muted.t-sm {{ a.period_from }} — {{ a.period_to }}
            q-item-section(side)
              BaseBadge(:variant="statusOf(a.status).variant") {{ statusOf(a.status).label }}
        .t-muted.t-sm(v-else) {{ $t('edubridge.teacherProfilePage.noAssignmentsEmpty') }}

    .col-12.col-md-5
      BaseCard(variant="default" :title="$t('edubridge.teacherProfilePage.contractTitle')")
        template(v-if="contract")
          DataRow(:label="$t('edubridge.teacherProfilePage.contractNumberLabel')" :value="contract.contract_number" mono copyable)
          DataRow(:label="$t('edubridge.teacherProfilePage.signedAtLabel')" :value="formatDate(contract.signed_at)")
          DataRow(:label="$t('edubridge.teacherProfilePage.approvedAtLabel')" :value="contract.approved_at ? formatDate(contract.approved_at) : '______'")
          DataRow(:label="$t('edubridge.teacherProfilePage.contractStatusLabel')")
            template(#value-override)
              BaseBadge(:variant="contractStatus.variant") {{ contractStatus.label }}
          .t-muted.t-meta.q-mt-sm(v-if="pendingApproval") {{ $t('edubridge.teacherProfilePage.pendingApprovalNotice') }}
          .t-muted.t-meta.q-mt-sm(v-else-if="declined && contract.decline_reason") {{ $t('edubridge.teacherProfilePage.declineReason', { reason: contract.decline_reason }) }}
        .t-muted.t-sm(v-else) {{ $t('edubridge.teacherProfilePage.noContract') }}

  BaseDialog(v-model="aboutOpen" size="lg" :title="$t('edubridge.teacherProfilePage.aboutTitle')")
    BaseForm(:loading="aboutBusy" @submit="saveAbout")
      BaseInput(
        v-model="aboutDraft"
        :label="$t('edubridge.teacherProfilePage.aboutLabel')"
        :hint="$t('edubridge.teacherProfilePage.aboutHint')"
        type="textarea"
        :rows="6"
        autogrow
        stack-label
        required
      )
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" :disabled="aboutBusy" @click="aboutOpen = false") {{ $t('common.action.cancel') }}
          BaseButton(variant="primary" type="submit" :disabled="!aboutDraft.trim()" :loading="aboutBusy") {{ $t('common.action.save') }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';
import { AvatarUpload } from 'src/features/User/Avatar';
import { getName } from 'src/shared/lib/utils/account';
import { asDateInput, asText } from 'src/shared/lib/utils';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseCard, BaseDialog, BaseForm, BaseInput, CardListSkeleton } from 'src/shared/ui/base';
import { DataRow, IdentityPanel, PageHint, type Identity } from 'src/shared/ui/domain';
import {
  ASSIGNMENT_STATUS_LABELS,
  fetchMyAssignments,
  fetchMyContract,
  fetchMyTeacherProfile,
  saveTeacherProfile,
  type IAssignment,
  type IContract,
  type ITeacherProfile,
} from '../../entities/Teacher';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { t } from '../../i18n';

/**
 * Профиль преподавателя: кто он в кооперативе, чем подтверждено участие и какие
 * курсы за ним закреплены. Профиль открывается подписанным договором участия в
 * хозяйственной деятельности — сам договор показан здесь, а не в реестре
 * назначений. Учётное имя отсюда администратор указывает при назначении на курс.
 */
const CONTRACT_STATUS_LABELS: Record<string, { label: string; variant: 'pos' | 'warn' | 'neg' | 'neutral' }> = {
  [Zeus.EduContractStatus.PENDING_APPROVAL]: { label: t('edubridge.teacherProfilePage.contractStatus.PENDING_APPROVAL'), variant: 'warn' },
  [Zeus.EduContractStatus.ACTIVE]: { label: t('edubridge.teacherProfilePage.contractStatus.ACTIVE'), variant: 'pos' },
  [Zeus.EduContractStatus.DECLINED]: { label: t('edubridge.teacherProfilePage.contractStatus.DECLINED'), variant: 'neg' },
  [Zeus.EduContractStatus.TERMINATED]: { label: t('edubridge.teacherProfilePage.contractStatus.TERMINATED'), variant: 'neg' },
};

const session = useSessionStore();

const contract = ref<IContract | null>(null);
const assignments = ref<IAssignment[]>([]);
const profile = ref<ITeacherProfile | null>(null);
const aboutOpen = ref(false);
const aboutDraft = ref('');
const aboutBusy = ref(false);
const loading = ref(true);
const firstLoad = useFirstLoad(loading);

const username = computed(() => session.username ?? '');
// Фотография живёт в аккаунте сессии: заменённая здесь видна и в удостоверении.
const avatarUrl = computed(() => session.currentUserAccount?.avatar_url ?? null);
const fullName = computed(() => (session.currentUserAccount ? getName(session.currentUserAccount) : ''));
const identity = computed<Identity>(() => ({
  fullName: fullName.value || username.value,
  accountName: username.value,
  avatar: avatarUrl.value ?? undefined,
}));
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
    const [c, a, p] = await Promise.all([fetchMyContract(), fetchMyAssignments(), fetchMyTeacherProfile()]);
    contract.value = c;
    assignments.value = a;
    profile.value = p;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function openAbout(): void {
  aboutDraft.value = profile.value?.about ?? '';
  aboutOpen.value = true;
}

/** Сохранить рассказ о себе; ставку сервер оставляет прежней. */
async function saveAbout(): Promise<void> {
  if (!aboutDraft.value.trim()) return;
  aboutBusy.value = true;
  try {
    profile.value = await saveTeacherProfile({ about: aboutDraft.value.trim() });
    aboutOpen.value = false;
    SuccessAlert(t('edubridge.teacherProfilePage.aboutSaved'));
  } catch (e) {
    FailAlert(e);
  } finally {
    aboutBusy.value = false;
  }
}

// Живое обновление: данные меняются в цепи и на столах других участников.
useLiveReload([EduLive.teacherContracts, EduLive.assignments], load);

onMounted(load);
</script>

<style scoped>
.edu-profile__about {
  white-space: pre-wrap;
  font-size: var(--p-fs-body);
  line-height: 1.6;
}
</style>

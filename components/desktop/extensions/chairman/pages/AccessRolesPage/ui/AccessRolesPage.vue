<template lang="pug">
.access-roles-page
  PageHint(storage-key='chairman:access-roles:banner-dismissed')
    | {{ $t('chairman.accessRolesPage.hint') }}

  CardListSkeleton(v-if='firstLoad', :count='2')

  EmptyState(
    v-else-if='!roles.length',
    :title='$t("chairman.accessRolesPage.emptyTitle")',
    :body='$t("chairman.accessRolesPage.emptyBody")'
  )
    template(#icon)
      q-icon(name='admin_panel_settings', size='48px')

  //- Зоны карточки роли: опознание (роль и приложение) → что роль открывает →
  //- кому назначена → действие «Назначить» в шапке.
  BaseCard.role-card(v-for='role in roles', :key='role.key')
    template(#head)
      .role-card__head
        .role-card__title {{ role.title }}
        .role-card__meta {{ $t('chairman.accessRolesPage.appLabel', { app: role.extension_title }) }}
    template(#actions)
      BaseButton(variant='secondary', size='sm', @click='openAssign(role)')
        | {{ $t('chairman.accessRolesPage.assignAction') }}

    .role-card__description {{ role.description }}

    .role-card__holders
      .role-card__eyebrow {{ $t('chairman.accessRolesPage.holdersLabel', { count: role.assignments.length }) }}
      .role-card__empty(v-if='!role.assignments.length') {{ $t('chairman.accessRolesPage.noHolders') }}
      .holder-row(v-for='holder in role.assignments', :key='holder.username')
        Avatar(:name='holder.display_name', size='sm')
        .holder-row__identity
          .holder-row__name {{ holder.display_name }}
          .holder-row__meta {{ $t('chairman.accessRolesPage.assignedMeta', { date: formatDocumentDate(holder.assigned_at), by: holder.assigned_by }) }}
        BaseButton(variant='secondary', size='sm', @click='openRevoke(role, holder)')
          | {{ $t('chairman.accessRolesPage.revokeAction') }}

  BaseDialog(
    v-model='assignDialog',
    :title='$t("chairman.accessRolesPage.assignDialogTitle", { role: activeRole?.title ?? "" })',
    size='md'
  )
    .access-roles-page__dialog-text {{ activeRole?.description }}
    UserSearchSelector(
      v-model='selectedUsername',
      :label='$t("chairman.accessRolesPage.participantLabel")',
      :exclude='activeHolders',
      outlined
    )
    template(#footer)
      BaseButton(variant='ghost', @click='assignDialog = false') {{ $t('common.action.cancel') }}
      BaseButton(variant='primary', :loading='saving', :disabled='!selectedUsername', @click='assign')
        | {{ $t('chairman.accessRolesPage.assignAction') }}

  BaseDialog(
    v-model='revokeDialog',
    :title='$t("chairman.accessRolesPage.revokeDialogTitle", { role: activeRole?.title ?? "" })',
    size='sm'
  )
    .access-roles-page__dialog-text
      | {{ $t('chairman.accessRolesPage.revokeDialogBody', { name: activeHolder?.display_name ?? '' }) }}
    template(#footer)
      BaseButton(variant='ghost', @click='revokeDialog = false') {{ $t('common.action.cancel') }}
      BaseButton(variant='danger', :loading='saving', @click='revoke')
        | {{ $t('chairman.accessRolesPage.revokeAction') }}
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { Avatar, BaseButton, BaseCard, BaseDialog, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { UserSearchSelector } from 'src/shared/ui';
import { useFirstLoad } from 'src/shared/lib/composables';
import { formatDocumentDate } from 'src/shared/lib/utils/dates/formatDocumentDate';
import { accessRoleApi, type IAssignableRole, type IRoleAssignment } from 'app/extensions/chairman/entities/AccessRole';
import { t } from '../../../i18n';

// realtime: нет источника — назначения ролей лежат в базе узла вне ленты изменений, меняет их только эта страница

const roles = ref<IAssignableRole[]>([]);
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const saving = ref(false);

const assignDialog = ref(false);
const revokeDialog = ref(false);
const activeRole = ref<IAssignableRole | null>(null);
const activeHolder = ref<IRoleAssignment | null>(null);
const selectedUsername = ref<string | undefined>();

const activeHolders = computed(() => activeRole.value?.assignments.map((holder) => holder.username) ?? []);

async function load(): Promise<void> {
  try {
    roles.value = await accessRoleApi.loadAssignableRoles();
  } catch (error) {
    FailAlert(error);
  } finally {
    loading.value = false;
  }
}

// Операция отвечает ролью с новым составом держателей — подставляем её на место.
function replaceRole(updated: IAssignableRole): void {
  roles.value = roles.value.map((role) => (role.key === updated.key ? updated : role));
}

function openAssign(role: IAssignableRole): void {
  activeRole.value = role;
  selectedUsername.value = undefined;
  assignDialog.value = true;
}

function openRevoke(role: IAssignableRole, holder: IRoleAssignment): void {
  activeRole.value = role;
  activeHolder.value = holder;
  revokeDialog.value = true;
}

async function assign(): Promise<void> {
  if (!activeRole.value || !selectedUsername.value) return;
  saving.value = true;
  try {
    replaceRole(await accessRoleApi.assignRole({ username: selectedUsername.value, role: activeRole.value.key }));
    assignDialog.value = false;
    SuccessAlert(t('chairman.accessRolesPage.assignedMessage'));
  } catch (error) {
    FailAlert(error);
  } finally {
    saving.value = false;
  }
}

async function revoke(): Promise<void> {
  if (!activeRole.value || !activeHolder.value) return;
  saving.value = true;
  try {
    replaceRole(await accessRoleApi.revokeRole({ username: activeHolder.value.username, role: activeRole.value.key }));
    revokeDialog.value = false;
    SuccessAlert(t('chairman.accessRolesPage.revokedMessage'));
  } catch (error) {
    FailAlert(error);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped lang="scss">
.access-roles-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  padding: var(--p-6);

  @media (max-width: 768px) {
    padding: var(--p-4);
  }

  &__dialog-text {
    margin-bottom: var(--p-4);
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm);
  }
}

.role-card {
  &__title {
    font-size: var(--p-fs-h3);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__meta,
  &__empty {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-3);
  }

  &__description {
    color: var(--p-ink-2);
  }

  &__holders {
    display: flex;
    flex-direction: column;
    gap: var(--p-2);
    margin-top: var(--p-4);
  }

  &__eyebrow {
    font-size: var(--p-fs-eyebrow);
    color: var(--p-ink-3);
    text-transform: uppercase;
    letter-spacing: var(--p-ls-eyebrow);
  }
}

.holder-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--p-3);
  padding: var(--p-2) 0;
  border-top: 1px solid var(--p-line);

  &__name {
    font-weight: 600;
    color: var(--p-ink);
  }

  &__meta {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-3);
  }
}
</style>

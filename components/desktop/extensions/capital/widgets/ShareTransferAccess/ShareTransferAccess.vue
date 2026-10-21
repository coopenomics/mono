<template lang="pug">
//- Зоны: кто допущен к странице трансляции (строка на пайщика: опознание →
//- действие «Снять») и действие «Выдать доступ» в шапке карточки.
BaseCard.access-card
  template(#head)
    .access-card__head
      .access-card__title {{ $t('capital.shareTransfer.access.title') }}
      .access-card__meta {{ $t('capital.shareTransfer.access.meta') }}
  template(#actions)
    BaseButton(variant='primary', size='sm', :disabled='!role', @click='openGrant')
      template(#icon-left)
        q-icon(name='person_add', size='16px')
      | {{ $t('capital.shareTransfer.access.grantAction') }}

  CardListSkeleton(v-if='firstLoad', :count='2')
  template(v-else)
    .access-card__empty(v-if='!holders.length') {{ $t('capital.shareTransfer.access.empty') }}
    .holder-row(v-for='holder in holders', :key='holder.username')
      Avatar(:name='holder.display_name', size='sm')
      .holder-row__identity
        .holder-row__name {{ holder.display_name }}
        .holder-row__meta {{ $t('capital.shareTransfer.access.assignedMeta', { date: formatDateToLocalTimezone(holder.assigned_at, 'DD.MM.YYYY'), by: holder.assigned_by_name || holder.assigned_by }) }}
      BaseButton(variant='danger', size='sm', :loading='saving === holder.username', @click='revoke(holder)')
        template(#icon-left)
          q-icon(name='person_remove', size='16px')
        | {{ $t('capital.shareTransfer.access.revokeAction') }}

  BaseDialog(v-model='grantDialog', :title='$t("capital.shareTransfer.access.grantDialogTitle")', size='md')
    .access-card__dialog-text {{ $t('capital.shareTransfer.access.grantDialogText') }}
    UserSearchSelector(
      v-model='selectedUsername',
      :label='$t("capital.shareTransfer.access.participantLabel")',
      :exclude='holderNames',
      outlined
    )
    template(#footer)
      BaseButton(variant='ghost', @click='grantDialog = false') {{ $t('common.action.cancel') }}
      BaseButton(variant='primary', :loading='saving === selectedUsername', :disabled='!selectedUsername', @click='grant')
        | {{ $t('capital.shareTransfer.access.grantAction') }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Avatar, BaseButton, BaseCard, BaseDialog, CardListSkeleton } from 'src/shared/ui/base';
import { UserSearchSelector } from 'src/shared/ui';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { useConfirm, useFirstLoad } from 'src/shared/lib/composables';
import { formatDateToLocalTimezone } from 'src/shared/lib/utils/dates/timezone';
import {
  SHARE_TRANSFER_ROLE,
  shareTransferApi,
  type IAccessRole,
  type IAccessRoleHolder,
} from 'app/extensions/capital/entities/ShareTransfer';
import { t } from '../../i18n';

/**
 * Кто допущен к странице трансляции паевого взноса. Видит и меняет только
 * председатель: это те же назначения роли, что на его странице управления
 * доступом, — список здесь, чтобы не уходить со страницы.
 */

// realtime: нет источника — назначения ролей лежат в базе узла вне ленты изменений, меняет их председатель здесь или на странице доступа

const { confirm } = useConfirm();
const role = ref<IAccessRole | null>(null);
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const saving = ref<string | null>(null);
const grantDialog = ref(false);
const selectedUsername = ref<string | undefined>();

const holders = computed<IAccessRoleHolder[]>(() => role.value?.assignments ?? []);
const holderNames = computed(() => holders.value.map((holder) => holder.username));

async function load(): Promise<void> {
  try {
    role.value = await shareTransferApi.loadAccessRole();
  } catch (error) {
    FailAlert(error);
  } finally {
    loading.value = false;
  }
}

function openGrant(): void {
  selectedUsername.value = undefined;
  grantDialog.value = true;
}

// Операции отвечают ролью с новым составом держателей — подставляем её.
async function grant(): Promise<void> {
  const username = selectedUsername.value;
  if (!username) return;
  saving.value = username;
  try {
    role.value = await shareTransferApi.grantAccess({ username, role: SHARE_TRANSFER_ROLE });
    grantDialog.value = false;
    SuccessAlert(t('capital.shareTransfer.access.grantedMessage'));
  } catch (error) {
    FailAlert(error);
  } finally {
    saving.value = null;
  }
}

async function revoke(holder: IAccessRoleHolder): Promise<void> {
  const ok = await confirm({
    title: t('capital.shareTransfer.access.revokeConfirmTitle'),
    message: t('capital.shareTransfer.access.revokeConfirmMessage', { name: holder.display_name }),
    confirmLabel: t('capital.shareTransfer.access.revokeAction'),
    danger: true,
  });
  if (!ok) return;
  saving.value = holder.username;
  try {
    role.value = await shareTransferApi.revokeAccess({ username: holder.username, role: SHARE_TRANSFER_ROLE });
    SuccessAlert(t('capital.shareTransfer.access.revokedMessage'));
  } catch (error) {
    FailAlert(error);
  } finally {
    saving.value = null;
  }
}

onMounted(load);
</script>

<style scoped lang="scss">
.access-card__head {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}

.access-card__title {
  font-size: var(--p-fs-h3);
  font-weight: 600;
}

.access-card__meta,
.access-card__empty,
.access-card__dialog-text {
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm);
}

.access-card__dialog-text {
  margin-bottom: var(--p-4);
}

.holder-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--p-3);
  padding: var(--p-3) 0;
  border-top: 1px solid var(--p-line);

  &:first-child {
    border-top: none;
  }
}

.holder-row__name {
  font-weight: 600;
}

.holder-row__meta {
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm);
}
</style>

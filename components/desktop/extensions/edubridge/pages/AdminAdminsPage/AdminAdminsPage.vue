<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-admins:banner-dismissed")
    | {{ $t('edubridge.adminAdminsPage.hint') }}

  BaseTable(v-if="loading || items.length" :columns="columns" :rows="items" row-key="id" :loading="firstLoad" min-width="720px")
    template(#cell-admin="{ row }")
      IdentityCell(:account-name="row.username" :full-name="row.display_name || null")
    template(#cell-appointed_by="{ row }")
      IdentityCell(:account-name="row.appointed_by" :full-name="row.appointed_by_display_name || null")
    template(#cell-created_at="{ row }") {{ formatDate(row.created_at) }}
    template(#cell-actions="{ row }")
      BaseButton(variant="ghost" size="sm" :loading="busyDismiss === row.id" @click="onDismiss(row)") {{ $t('edubridge.adminAdminsPage.dismissButton') }}
  EmptyState(v-if="!firstLoad && !items.length" :title="$t('edubridge.adminAdminsPage.emptyTitle')" :body="$t('edubridge.adminAdminsPage.emptyBody')")
    template(#icon)
      q-icon(name="admin_panel_settings" size="32px")

  BaseDialog(v-model="dialogOpen" :title="$t('edubridge.adminAdminsPage.appointDialogTitle')" size="md")
    .text-body2.q-mb-md {{ $t('edubridge.adminAdminsPage.appointDialogHint') }}
    UserSearchSelector(v-model="username" :label="$t('edubridge.adminAdminsPage.memberLabel')" :exclude="items.map((a) => a.username)")
    template(#footer)
      BaseButton(variant="ghost" :disabled="busy" @click="dialogOpen = false") {{ $t('edubridge.adminAdminsPage.cancel') }}
      BaseButton(variant="primary" :disabled="!username" :loading="busy" @click="onAppoint") {{ $t('edubridge.adminAdminsPage.appointSubmit') }}
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { asText } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useHeaderActions } from 'src/shared/hooks';
import { BaseButton, BaseDialog, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { IdentityCell, PageHint } from 'src/shared/ui/domain';
import { UserSearchSelector } from 'src/shared/ui/UserSearchSelector';
import { appointAdmin, dismissAdmin, fetchAdmins, type IAdmin } from '../../entities/Admin';
import AppointAdminHeaderButton from './AppointAdminHeaderButton.vue';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { t } from '../../i18n';

/** Администраторы приложения: список с ФИО, назначение — поиском пайщика по ФИО из шапки страницы. */
const { registerAction } = useHeaderActions();

const items = ref<IAdmin[]>([]);
const loading = ref(false);
const firstLoad = useFirstLoad(loading);
const busy = ref(false);
const busyDismiss = ref<string | null>(null);
const dialogOpen = ref(false);
const username = ref<string | undefined>(undefined);

const columns: BaseTableColumn<IAdmin>[] = [
  { key: 'admin', label: t('edubridge.adminAdminsPage.columnAdmin') },
  { key: 'appointed_by', label: t('edubridge.adminAdminsPage.columnAppointedBy'), width: '260px' },
  { key: 'created_at', label: t('edubridge.adminAdminsPage.columnSince'), width: '120px' },
  { key: 'actions', label: '', align: 'right', width: '100px' },
];
const formatDate = (v: string | Date) => new Date(v).toLocaleDateString('ru-RU');

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = await fetchAdmins();
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}
function openDialog(): void {
  username.value = undefined;
  dialogOpen.value = true;
}
async function onAppoint(): Promise<void> {
  if (!username.value) return;
  busy.value = true;
  try {
    const a = await appointAdmin(username.value);
    if (!items.value.some((x) => x.id === a.id)) items.value.push(a);
    dialogOpen.value = false;
    SuccessAlert(t('edubridge.adminAdminsPage.appointSuccess'));
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}
async function onDismiss(a: IAdmin): Promise<void> {
  busyDismiss.value = asText(a.id);
  try {
    await dismissAdmin(a.username);
    items.value = items.value.filter((x) => x.id !== a.id);
  } catch (e) {
    FailAlert(e);
  } finally {
    busyDismiss.value = null;
  }
}
// Живое обновление: данные меняются в цепи и на столах других участников.
useLiveReload([EduLive.admins], load);

onMounted(() => {
  registerAction({ id: 'edubridge:appoint-admin', component: AppointAdminHeaderButton, props: { onClick: openDialog } });
  void load();
});
</script>

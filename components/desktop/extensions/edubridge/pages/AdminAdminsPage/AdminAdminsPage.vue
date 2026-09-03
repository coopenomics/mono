<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-admins:banner-dismissed")
    | Администраторы ведут курсы, назначения, реестры и очередь. Контакты пайщиков и ключи площадок им не видны.

  BaseTable(v-if="loading || items.length" :columns="columns" :rows="items" row-key="id" :loading="loading && !items.length" min-width="720px")
    template(#cell-admin="{ row }")
      .text-weight-medium {{ row.display_name || row.username }}
      .t-muted.t-sm.t-mono {{ row.username }}
    template(#cell-appointed_by="{ row }")
      div {{ row.appointed_by_display_name || row.appointed_by }}
      .t-muted.t-sm.t-mono(v-if="row.appointed_by_display_name") {{ row.appointed_by }}
    template(#cell-created_at="{ row }") {{ formatDate(row.created_at) }}
    template(#cell-actions="{ row }")
      BaseButton(variant="ghost" size="sm" :loading="busyDismiss === row.id" @click="onDismiss(row)") Снять
  EmptyState(v-if="!loading && !items.length" title="Администраторов нет" body="Председатель ведёт приложение сам. Назначить администратора можно кнопкой в правом верхнем углу.")
    template(#icon)
      q-icon(name="admin_panel_settings" size="32px")

  BaseDialog(v-model="dialogOpen" title="Назначить администратора" size="md")
    .text-body2.q-mb-md Найдите пайщика по фамилии, имени или наименованию организации.
    UserSearchSelector(v-model="username" label="Пайщик" :exclude="items.map((a) => a.username)")
    template(#footer)
      BaseButton(variant="ghost" :disabled="busy" @click="dialogOpen = false") Отменить
      BaseButton(variant="primary" :disabled="!username" :loading="busy" @click="onAppoint") Назначить
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useHeaderActions } from 'src/shared/hooks';
import { BaseButton, BaseDialog, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { UserSearchSelector } from 'src/shared/ui/UserSearchSelector';
import { appointAdmin, dismissAdmin, fetchAdmins, type IAdmin } from '../../entities/Admin';
import AppointAdminHeaderButton from './AppointAdminHeaderButton.vue';

/** Администраторы приложения: список с ФИО, назначение — поиском пайщика по ФИО из шапки страницы. */
const { registerAction } = useHeaderActions();

const items = ref<IAdmin[]>([]);
const loading = ref(false);
const busy = ref(false);
const busyDismiss = ref<string | null>(null);
const dialogOpen = ref(false);
const username = ref<string | undefined>(undefined);

const columns: BaseTableColumn<IAdmin>[] = [
  { key: 'admin', label: 'Администратор' },
  { key: 'appointed_by', label: 'Назначил', width: '220px' },
  { key: 'created_at', label: 'С', width: '120px' },
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
    SuccessAlert('Администратор назначен');
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}
async function onDismiss(a: IAdmin): Promise<void> {
  busyDismiss.value = a.id;
  try {
    await dismissAdmin(a.username);
    items.value = items.value.filter((x) => x.id !== a.id);
  } catch (e) {
    FailAlert(e);
  } finally {
    busyDismiss.value = null;
  }
}
onMounted(() => {
  registerAction({ id: 'edubridge:appoint-admin', component: AppointAdminHeaderButton, props: { onClick: openDialog } });
  void load();
});
</script>

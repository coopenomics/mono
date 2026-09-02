<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-admins:banner-dismissed")
    | Администраторы ведут курсы, назначения, реестры и очередь. Контакты пайщиков и ключи площадок им не видны.
  .row.q-col-gutter-md
    .col-12.col-md-6
      BaseForm(:loading="busy" @submit="onAppoint")
        BaseInput(v-model="username" label="Учётное имя пайщика" mono required)
        template(#footer)
          .row.justify-end
            BaseButton(variant="primary" type="submit" :loading="busy") Назначить
    .col-12
      BaseTable(:columns="columns" :rows="items" row-key="id" :loading="loading && !items.length" min-width="480px")
        template(#cell-username="{ row }")
          span.t-mono {{ row.username }}
        template(#cell-created_at="{ row }") {{ formatDate(row.created_at) }}
        template(#cell-actions="{ row }")
          BaseButton(variant="ghost" size="sm" @click="onDismiss(row)") Снять
      EmptyState(v-if="!loading && !items.length" title="Администраторов нет" body="Председатель ведёт приложение сам.")
        template(#icon)
          q-icon(name="admin_panel_settings" size="32px")
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton, BaseForm, BaseInput, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { appointAdmin, dismissAdmin, fetchAdmins, type IAdmin } from '../../entities/Admin';

const items = ref<IAdmin[]>([]);
const loading = ref(false);
const busy = ref(false);
const username = ref('');
const columns: BaseTableColumn<IAdmin>[] = [
  { key: 'username', label: 'Администратор' },
  { key: 'appointed_by', label: 'Назначил', width: '160px' },
  { key: 'created_at', label: 'С', width: '130px' },
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
async function onAppoint(): Promise<void> {
  busy.value = true;
  try {
    const a = await appointAdmin(username.value.trim());
    if (!items.value.some((x) => x.id === a.id)) items.value.push(a);
    username.value = '';
    SuccessAlert('Администратор назначен');
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}
async function onDismiss(a: IAdmin): Promise<void> {
  try {
    await dismissAdmin(a.username);
    items.value = items.value.filter((x) => x.id !== a.id);
  } catch (e) {
    FailAlert(e);
  }
}
onMounted(load);
</script>

<template lang="pug">
q-page(padding)
  .q-pa-md
    BaseBanner.q-mb-md(variant='info')
      | {{ $t('developer.publishers.intro') }}

    .publishers__toolbar.q-mb-md
      BaseButton(variant='primary', @click='openAdd') {{ $t('developer.publishers.add') }}

    TableSkeleton(v-if='loading && !items.length', :columns='skeletonColumns', :rows='3')

    BaseBanner.q-mb-md(v-else-if='error', variant='neg') {{ error }}

    EmptyState(
      v-else-if='!items.length',
      :title="$t('developer.publishers.emptyTitle')",
      :body="$t('developer.publishers.emptyBody')"
    )
      template(#icon)
        q-icon(name='key', size='28px')

    .table-wrap(v-else)
      .table-scroll
        table.table
          thead
            tr
              th {{ $t('developer.column.member') }}
              th {{ $t('developer.column.package') }}
              th {{ $t('developer.column.assigned') }}
              th.col-action {{ $t('developer.column.actions') }}
          tbody
            tr(v-for='p in items', :key="`${p.username}:${p.packageId}`")
              td
                span.t-mono {{ p.username }}
              td
                span.t-mono {{ p.packageId }}
              td
                div {{ formatDate(p.createdAt) }}
                .t-sm.t-muted {{ p.addedBy }}
              td.col-action
                BaseButton(variant='danger', size='sm', @click='openRemove(p)') {{ $t('developer.publishers.remove') }}

  BaseDialog(v-model='addDialog', :title="$t('developer.publishers.add')", size='sm')
    BaseInput(
      v-model='form.username',
      :label="$t('developer.publishers.usernameLabel')",
      placeholder='developer1',
      :hint="$t('developer.publishers.usernameHint')",
      :error='formErrors.username',
      required
    )
    BaseInput(
      v-model='form.packageId',
      :label="$t('developer.publishers.packageLabel')",
      placeholder='@voskhod/demoapp',
      :hint="$t('developer.publishers.packageHint')",
      :error='formErrors.packageId',
      required
    )
    BaseBanner.q-mt-sm(v-if='actionError', variant='neg') {{ actionError }}
    template(#footer)
      BaseButton(variant='ghost', :disabled='isSubmitting', @click='addDialog = false') {{ $t('common.action.cancel') }}
      BaseButton(variant='primary', :loading='isSubmitting', @click='confirmAdd') {{ $t('developer.publishers.assign') }}

  BaseDialog(v-model='removeDialog', :title="$t('developer.publishers.removeTitle')", size='sm')
    p.t-sm.t-muted.q-mb-sm
      | {{ $t('developer.publishers.removeText', { username: selected?.username, packageId: selected?.packageId }) }}
    BaseBanner.q-mt-sm(v-if='actionError', variant='neg') {{ actionError }}
    template(#footer)
      BaseButton(variant='ghost', :disabled='isSubmitting', @click='removeDialog = false') {{ $t('common.action.cancel') }}
      BaseButton(variant='danger', :loading='isSubmitting', @click='confirmRemove') {{ $t('developer.publishers.remove') }}
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { BaseBanner, BaseButton, BaseDialog, BaseInput, EmptyState, TableSkeleton } from 'src/shared/ui/base';
import type { TableSkeletonColumn } from 'src/shared/ui/base/TableSkeleton/TableSkeleton.types';
import { useAppsPublishers, type IAppsPublisher } from '../features/AppsPublishers/model';
import { t } from '../i18n';

const { items, loading, error, isSubmitting, actionError, load, add, remove } = useAppsPublishers();

const skeletonColumns: TableSkeletonColumn[] = [
  { label: t('developer.column.member'), width: '140px' },
  { label: t('developer.column.package') },
  { label: t('developer.column.assigned'), width: '140px' },
  { label: t('developer.column.actions'), cell: 'icon', class: 'col-action' },
];

const ANTELOPE_NAME_RE = /^[a-z1-5.]{1,12}$/;
const PACKAGE_ID_RE = /^@[a-z0-9-]+\/[a-z0-9-]+$/;

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU');
}

const addDialog = ref(false);
const removeDialog = ref(false);
const selected = ref<IAppsPublisher | null>(null);
const form = reactive({ username: '', packageId: '' });
const formErrors = reactive({ username: '', packageId: '' });

function openAdd() {
  form.username = '';
  form.packageId = '';
  formErrors.username = '';
  formErrors.packageId = '';
  actionError.value = null;
  addDialog.value = true;
}

async function confirmAdd() {
  formErrors.username = ANTELOPE_NAME_RE.test(form.username.trim()) ? '' : t('developer.publishers.usernameHint');
  formErrors.packageId = PACKAGE_ID_RE.test(form.packageId.trim()) ? '' : t('developer.publishers.packageIdFormat');
  if (formErrors.username || formErrors.packageId) return;
  const ok = await add({ username: form.username.trim(), packageId: form.packageId.trim() });
  if (ok) addDialog.value = false;
}

function openRemove(p: IAppsPublisher) {
  selected.value = p;
  actionError.value = null;
  removeDialog.value = true;
}

async function confirmRemove() {
  if (!selected.value) return;
  const ok = await remove({ username: selected.value.username, packageId: selected.value.packageId });
  if (ok) removeDialog.value = false;
}

// realtime: нет источника — назначения издателей хранятся в базе кооператива вне ленты цепи; список перечитывается после каждого действия на странице.
onMounted(load);
</script>

<style scoped>
.publishers__toolbar {
  display: flex;
  justify-content: flex-end;
}
</style>

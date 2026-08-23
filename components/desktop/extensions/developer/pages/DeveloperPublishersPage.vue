<template>
  <q-page padding>
    <div class="q-pa-md">
      <BaseBanner variant="info" class="q-mb-md">
        Издатель — пайщик, которому кооператив доверяет публиковать одно
        конкретное приложение. Назначенный издатель сам выпускает ключ на
        свой пакет в столе «Мои приложения», кладёт его в репозиторий и
        публикует обычным <span class="t-mono">npm publish</span>. Снятие
        издателя отзывает все его ключи на пакет.
      </BaseBanner>

      <div class="publishers__toolbar q-mb-md">
        <BaseButton variant="primary" @click="openAdd">Назначить издателя</BaseButton>
      </div>

      <TableSkeleton v-if="loading && !items.length" :columns="skeletonColumns" :rows="3" />

      <BaseBanner v-else-if="error" variant="neg" class="q-mb-md">{{ error }}</BaseBanner>

      <EmptyState
        v-else-if="!items.length"
        title="Издателей пока нет"
        body="Назначьте пайщика издателем пакета — он получит стол «Мои приложения» и выпустит ключ сам."
      >
        <template #icon><q-icon name="key" size="28px" /></template>
      </EmptyState>

      <div v-else class="table-wrap">
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>Пайщик</th>
                <th>Пакет</th>
                <th>Назначен</th>
                <th class="col-action">Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in items" :key="`${p.username}:${p.packageId}`">
                <td><span class="t-mono">{{ p.username }}</span></td>
                <td><span class="t-mono">{{ p.packageId }}</span></td>
                <td>
                  <div>{{ formatDate(p.createdAt) }}</div>
                  <div class="t-sm t-muted">{{ p.addedBy }}</div>
                </td>
                <td class="col-action">
                  <BaseButton variant="danger" size="sm" @click="openRemove(p)">Снять</BaseButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <BaseDialog v-model="addDialog" title="Назначить издателя" size="sm">
      <BaseInput
        v-model="form.username"
        label="Аккаунт пайщика"
        placeholder="developer1"
        hint="1..12 символов: [a-z], [1-5], точка."
        :error="formErrors.username"
        required
      />
      <BaseInput
        v-model="form.packageId"
        label="Пакет"
        placeholder="@voskhod/demoapp"
        hint="Формат @scope/name; scope — ваш кооператив."
        :error="formErrors.packageId"
        required
      />
      <BaseBanner v-if="actionError" variant="neg" class="q-mt-sm">{{ actionError }}</BaseBanner>
      <template #footer>
        <BaseButton variant="ghost" :disabled="isSubmitting" @click="addDialog = false">Отмена</BaseButton>
        <BaseButton variant="primary" :loading="isSubmitting" @click="confirmAdd">Назначить</BaseButton>
      </template>
    </BaseDialog>

    <BaseDialog v-model="removeDialog" title="Снять издателя" size="sm">
      <p class="t-sm t-muted q-mb-sm">
        <span class="t-mono">{{ selected?.username }}</span> больше не сможет публиковать
        <span class="t-mono">{{ selected?.packageId }}</span>; все его ключи на пакет будут отозваны.
      </p>
      <BaseBanner v-if="actionError" variant="neg" class="q-mt-sm">{{ actionError }}</BaseBanner>
      <template #footer>
        <BaseButton variant="ghost" :disabled="isSubmitting" @click="removeDialog = false">Отмена</BaseButton>
        <BaseButton variant="danger" :loading="isSubmitting" @click="confirmRemove">Снять</BaseButton>
      </template>
    </BaseDialog>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { BaseBanner, BaseButton, BaseDialog, BaseInput, EmptyState, TableSkeleton } from 'src/shared/ui/base';
import type { TableSkeletonColumn } from 'src/shared/ui/base/TableSkeleton/TableSkeleton.types';
import { useAppsPublishers, type IAppsPublisher } from '../features/AppsPublishers/model';

const { items, loading, error, isSubmitting, actionError, load, add, remove } = useAppsPublishers();

const skeletonColumns: TableSkeletonColumn[] = [
  { label: 'Пайщик', width: '140px' },
  { label: 'Пакет' },
  { label: 'Назначен', width: '140px' },
  { label: 'Действия', cell: 'icon', class: 'col-action' },
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
  formErrors.username = ANTELOPE_NAME_RE.test(form.username.trim()) ? '' : '1..12 символов: [a-z], [1-5], точка.';
  formErrors.packageId = PACKAGE_ID_RE.test(form.packageId.trim()) ? '' : 'Ожидается @scope/name.';
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

onMounted(load);
</script>

<style scoped>
.publishers__toolbar {
  display: flex;
  justify-content: flex-end;
}
</style>

<template>
  <q-page padding>
    <div class="q-pa-md">
      <BaseBanner variant="info" class="q-mb-md">
        Ключ выпускается на одно приложение и действует только для него.
        Положите его в <span class="t-mono">.npmrc</span> репозитория приложения —
        дальше обычный <span class="t-mono">npm publish</span> и
        <span class="t-mono">POST /v1/releases</span> (скрипт
        <span class="t-mono">catalog-release.sh</span>). Первый релиз проходит
        модерацию, следующие принимаются автоматически. Ключ показывается один раз.
      </BaseBanner>

      <TableSkeleton v-if="loading && !packages.length" :columns="skeletonColumns" :rows="2" />
      <BaseBanner v-else-if="error" variant="neg" class="q-mb-md">{{ error }}</BaseBanner>
      <EmptyState
        v-else-if="!packages.length"
        title="Вы не назначены издателем"
        body="Попросите председателя назначить вас издателем пакета на столе разработчика."
      >
        <template #icon><q-icon name="key" size="28px" /></template>
      </EmptyState>

      <template v-else>
        <div v-for="p in packages" :key="p.packageId" class="q-mb-lg">
          <div class="myapps__head q-mb-sm">
            <h3 class="myapps__title t-mono">{{ p.packageId }}</h3>
            <BaseButton variant="primary" size="sm" @click="openIssue(p.packageId)">Выпустить ключ</BaseButton>
          </div>
          <div class="table-wrap">
            <div class="table-scroll">
              <table class="table">
                <thead>
                  <tr>
                    <th>Метка</th>
                    <th>Ключ</th>
                    <th>Выпущен</th>
                    <th>Использован</th>
                    <th>Статус</th>
                    <th class="col-action">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!tokensFor(p.packageId).length">
                    <td colspan="6" class="t-muted">Ключей ещё нет.</td>
                  </tr>
                  <tr v-for="t in tokensFor(p.packageId)" :key="t.id">
                    <td>{{ t.label }}</td>
                    <td><span class="t-mono">{{ t.tokenPrefix }}…</span></td>
                    <td>{{ formatDate(t.createdAt) }}</td>
                    <td>{{ formatDate(t.lastUsedAt) }}</td>
                    <td>
                      <BaseBadge :variant="statusOf(t).variant">{{ statusOf(t).label }}</BaseBadge>
                    </td>
                    <td class="col-action">
                      <BaseButton
                        variant="danger"
                        size="sm"
                        :disabled="!!t.revokedAt"
                        @click="openRevoke(t)"
                      >
                        Отозвать
                      </BaseButton>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </template>
    </div>

    <BaseDialog v-model="issueDialog" title="Выпустить ключ" size="sm">
      <template v-if="!issuedToken">
        <p class="t-sm t-muted q-mb-sm">Пакет: <span class="t-mono">{{ issuePackageId }}</span></p>
        <BaseInput
          v-model="form.label"
          label="Метка"
          placeholder="CI github/voskhod/demoapp"
          hint="Где живёт ключ: репозиторий, раннер."
          :error="formErrors.label"
          required
        />
        <BaseInput
          v-model="form.expiresInDays"
          label="Срок, дней"
          placeholder="бессрочно"
          hint="Пусто — бессрочно. 1..3650."
          :error="formErrors.expiresInDays"
        />
        <BaseBanner v-if="actionError" variant="neg" class="q-mt-sm">{{ actionError }}</BaseBanner>
      </template>
      <template v-else>
        <BaseBanner variant="warn" class="q-mb-sm">Скопируйте ключ сейчас — повторно он не показывается.</BaseBanner>
        <BaseInput :model-value="issuedToken" label="Ключ" readonly hint="Секрет CI: CATALOG_PUBLISHER_TOKEN." />
        <div class="t-fs-13 t-muted q-mt-sm">
          В репозитории приложения (<span class="t-mono">.npmrc</span>):
        </div>
        <pre class="myapps__snippet t-mono t-fs-13">{{ npmrcSnippet }}</pre>
        <div class="myapps__copy">
          <BaseButton variant="secondary" size="sm" @click="copyToken">{{ copied ? 'Скопировано' : 'Скопировать ключ' }}</BaseButton>
        </div>
      </template>
      <template #footer>
        <template v-if="!issuedToken">
          <BaseButton variant="ghost" :disabled="isSubmitting" @click="issueDialog = false">Отмена</BaseButton>
          <BaseButton variant="primary" :loading="isSubmitting" @click="confirmIssue">Выпустить</BaseButton>
        </template>
        <BaseButton v-else variant="primary" @click="issueDialog = false">Готово</BaseButton>
      </template>
    </BaseDialog>

    <BaseDialog v-model="revokeDialog" title="Отозвать ключ" size="sm">
      <p class="t-sm t-muted q-mb-sm">
        Ключ «{{ selected?.label }}» (<span class="t-mono">{{ selected?.tokenPrefix }}…</span>)
        перестанет работать немедленно.
      </p>
      <BaseBanner v-if="actionError" variant="neg" class="q-mt-sm">{{ actionError }}</BaseBanner>
      <template #footer>
        <BaseButton variant="ghost" :disabled="isSubmitting" @click="revokeDialog = false">Отмена</BaseButton>
        <BaseButton variant="danger" :loading="isSubmitting" @click="confirmRevoke">Отозвать</BaseButton>
      </template>
    </BaseDialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { BaseBadge, BaseBanner, BaseButton, BaseDialog, BaseInput, EmptyState, TableSkeleton } from 'src/shared/ui/base';
import type { TableSkeletonColumn } from 'src/shared/ui/base/TableSkeleton/TableSkeleton.types';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge/BaseBadge.types';
import { useMyPublisherTokens, type IMyToken } from '../features/MyPublisherTokens/model';

const { packages, tokens, loading, error, isSubmitting, actionError, issuedToken, load, issue, revoke } =
  useMyPublisherTokens();

const skeletonColumns: TableSkeletonColumn[] = [
  { label: 'Метка' },
  { label: 'Ключ', width: '140px' },
  { label: 'Выпущен', width: '120px' },
  { label: 'Использован', width: '120px' },
  { label: 'Статус', cell: 'badge' },
  { label: 'Действия', cell: 'icon', class: 'col-action' },
];

function tokensFor(packageId: string): IMyToken[] {
  return tokens.value.filter((t) => t.packageId === packageId);
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU');
}

function statusOf(t: IMyToken): { label: string; variant: BaseBadgeVariant } {
  if (t.revokedAt) return { label: 'Отозван', variant: 'neutral' };
  if (t.expiresAt && new Date(t.expiresAt).getTime() <= Date.now()) return { label: 'Истёк', variant: 'warn' };
  return { label: 'Действует', variant: 'pos' };
}

const issueDialog = ref(false);
const revokeDialog = ref(false);
const issuePackageId = ref('');
const selected = ref<IMyToken | null>(null);
const copied = ref(false);
const form = reactive({ label: '', expiresInDays: '' });
const formErrors = reactive({ label: '', expiresInDays: '' });

const npmrcSnippet = computed(() => {
  const scope = issuePackageId.value.split('/')[0] ?? '@coop';
  const host = window.location.host.replace(/^[^.]+\./, 'catalog.');
  return `${scope}:registry=https://${host}/registry/\n//${host}/registry/:_authToken=${issuedToken.value ?? ''}`;
});

function openIssue(packageId: string) {
  issuePackageId.value = packageId;
  form.label = '';
  form.expiresInDays = '';
  formErrors.label = '';
  formErrors.expiresInDays = '';
  actionError.value = null;
  issuedToken.value = null;
  copied.value = false;
  issueDialog.value = true;
}

async function confirmIssue() {
  formErrors.label = form.label.trim() ? '' : 'Укажите метку.';
  const days = form.expiresInDays.trim();
  formErrors.expiresInDays =
    days === '' || (/^\d+$/.test(days) && Number(days) >= 1 && Number(days) <= 3650) ? '' : 'Целое число от 1 до 3650.';
  if (formErrors.label || formErrors.expiresInDays) return;
  await issue({
    packageId: issuePackageId.value,
    label: form.label.trim(),
    ...(days ? { expiresInDays: Number(days) } : {}),
  });
}

async function copyToken() {
  if (!issuedToken.value) return;
  try {
    await navigator.clipboard.writeText(issuedToken.value);
    copied.value = true;
  } catch {
    copied.value = false;
  }
}

function openRevoke(t: IMyToken) {
  selected.value = t;
  actionError.value = null;
  revokeDialog.value = true;
}

async function confirmRevoke() {
  if (!selected.value) return;
  const ok = await revoke(selected.value.id);
  if (ok) revokeDialog.value = false;
}

onMounted(load);
</script>

<style scoped>
.myapps__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.myapps__title {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}
.myapps__snippet {
  margin: 4px 0 0;
  padding: 8px;
  border-radius: 6px;
  background: rgba(127, 127, 127, 0.1);
  white-space: pre-wrap;
  word-break: break-all;
}
.myapps__copy {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}
</style>

<template>
  <q-page padding>
    <div class="q-pa-md">
      <BaseBanner variant="info" class="q-mb-md">
        Издатели — пайщики, которым кооператив доверяет публиковать
        приложения от своего имени. Токен кладётся в секрет CI:
        каждый push собирает версию, заливает её в каталог и подаёт релиз.
        Первый релиз пакета проходит модерацию, следующие принимаются
        автоматически. Токен показывается один раз — при выдаче.
      </BaseBanner>

      <div class="publishers__toolbar q-mb-md">
        <BaseButton variant="primary" @click="openCreate">
          Выдать токен
        </BaseButton>
      </div>

      <TableSkeleton
        v-if="loading && !items.length"
        :columns="skeletonColumns"
        :rows="3"
      />

      <BaseBanner v-else-if="error" variant="neg" class="q-mb-md">
        {{ error }}
      </BaseBanner>

      <EmptyState
        v-else-if="!items.length"
        title="Издателей пока нет"
        body="Выдайте пайщику токен — и его CI сможет публиковать приложения в scope кооператива."
      >
        <template #icon>
          <q-icon name="key" size="28px" />
        </template>
      </EmptyState>

      <div v-else class="table-wrap">
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>Пайщик</th>
                <th>Метка</th>
                <th>Токен</th>
                <th>Выдан</th>
                <th>Использован</th>
                <th>Статус</th>
                <th class="col-action">Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in items" :key="t.id">
                <td><span class="t-mono">{{ t.username }}</span></td>
                <td>{{ t.label }}</td>
                <td><span class="t-mono">{{ t.tokenPrefix }}…</span></td>
                <td>
                  <div>{{ formatDate(t.createdAt) }}</div>
                  <div class="t-sm t-muted">{{ t.createdBy }}</div>
                </td>
                <td>{{ formatDate(t.lastUsedAt) }}</td>
                <td>
                  <BaseBadge :variant="statusOf(t).variant">
                    {{ statusOf(t).label }}
                  </BaseBadge>
                </td>
                <td class="col-action">
                  <BaseButton
                    variant="danger"
                    size="sm"
                    :disabled="t.revokedAt !== null && t.revokedAt !== undefined"
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

    <BaseDialog v-model="createDialog" title="Выдать токен издателя" size="sm">
      <template v-if="!issuedToken">
        <BaseInput
          v-model="form.username"
          label="Аккаунт пайщика"
          placeholder="developer1"
          hint="1..12 символов: [a-z], [1-5], точка."
          :error="formErrors.username"
          required
        />
        <BaseInput
          v-model="form.label"
          label="Метка"
          placeholder="CI demo-app"
          hint="Для чего токен: репозиторий, приложение."
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
        <BaseBanner v-if="actionError" variant="neg" class="q-mt-sm">
          {{ actionError }}
        </BaseBanner>
      </template>
      <template v-else>
        <BaseBanner variant="warn" class="q-mb-sm">
          Скопируйте токен сейчас — повторно он не показывается.
        </BaseBanner>
        <BaseInput
          :model-value="issuedToken"
          label="Токен"
          readonly
          hint="Положите в секрет CI: CATALOG_PUBLISHER_TOKEN."
        />
        <div class="publishers__copy">
          <BaseButton variant="secondary" size="sm" @click="copyToken">
            {{ copied ? 'Скопировано' : 'Скопировать' }}
          </BaseButton>
        </div>
      </template>
      <template #footer>
        <template v-if="!issuedToken">
          <BaseButton variant="ghost" :disabled="isSubmitting" @click="createDialog = false">
            Отмена
          </BaseButton>
          <BaseButton variant="primary" :loading="isSubmitting" @click="confirmCreate">
            Выдать
          </BaseButton>
        </template>
        <BaseButton v-else variant="primary" @click="createDialog = false">
          Готово
        </BaseButton>
      </template>
    </BaseDialog>

    <BaseDialog v-model="revokeDialog" title="Отзыв токена" size="sm">
      <p class="t-sm t-muted q-mb-sm">
        CI пайщика <span class="t-mono">{{ selected?.username }}</span>
        («{{ selected?.label }}») перестанет публиковать немедленно.
      </p>
      <BaseBanner v-if="actionError" variant="neg" class="q-mt-sm">
        {{ actionError }}
      </BaseBanner>
      <template #footer>
        <BaseButton variant="ghost" :disabled="isSubmitting" @click="revokeDialog = false">
          Отмена
        </BaseButton>
        <BaseButton variant="danger" :loading="isSubmitting" @click="confirmRevoke">
          Отозвать
        </BaseButton>
      </template>
    </BaseDialog>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import {
  BaseBadge,
  BaseBanner,
  BaseButton,
  BaseDialog,
  BaseInput,
  EmptyState,
  TableSkeleton,
} from 'src/shared/ui/base';
import type { TableSkeletonColumn } from 'src/shared/ui/base/TableSkeleton/TableSkeleton.types';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge/BaseBadge.types';
import { usePublisherTokens, type IPublisherToken } from '../features/PublisherTokens/model';

const {
  items,
  loading,
  error,
  isSubmitting,
  actionError,
  issuedToken,
  load,
  create,
  revoke,
} = usePublisherTokens();

const skeletonColumns: TableSkeletonColumn[] = [
  { label: 'Пайщик', width: '140px' },
  { label: 'Метка' },
  { label: 'Токен', width: '140px' },
  { label: 'Выдан', width: '120px' },
  { label: 'Использован', width: '120px' },
  { label: 'Статус', cell: 'badge' },
  { label: 'Действия', cell: 'icon', class: 'col-action' },
];

const ANTELOPE_NAME_RE = /^[a-z1-5.]{1,12}$/;

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU');
}

function statusOf(t: IPublisherToken): { label: string; variant: BaseBadgeVariant } {
  if (t.revokedAt) return { label: 'Отозван', variant: 'neutral' };
  if (t.expiresAt && new Date(t.expiresAt).getTime() <= Date.now()) {
    return { label: 'Истёк', variant: 'warn' };
  }
  return { label: 'Действует', variant: 'pos' };
}

const createDialog = ref(false);
const revokeDialog = ref(false);
const selected = ref<IPublisherToken | null>(null);
const copied = ref(false);

const form = reactive({ username: '', label: '', expiresInDays: '' });
const formErrors = reactive({ username: '', label: '', expiresInDays: '' });

function openCreate() {
  form.username = '';
  form.label = '';
  form.expiresInDays = '';
  formErrors.username = '';
  formErrors.label = '';
  formErrors.expiresInDays = '';
  actionError.value = null;
  issuedToken.value = null;
  copied.value = false;
  createDialog.value = true;
}

function validate(): boolean {
  formErrors.username = ANTELOPE_NAME_RE.test(form.username.trim())
    ? ''
    : '1..12 символов: [a-z], [1-5], точка.';
  formErrors.label = form.label.trim().length > 0 ? '' : 'Укажите метку.';
  const days = form.expiresInDays.trim();
  formErrors.expiresInDays =
    days === '' || (/^\d+$/.test(days) && Number(days) >= 1 && Number(days) <= 3650)
      ? ''
      : 'Целое число от 1 до 3650.';
  return !formErrors.username && !formErrors.label && !formErrors.expiresInDays;
}

async function confirmCreate() {
  if (!validate()) return;
  const days = form.expiresInDays.trim();
  await create({
    username: form.username.trim(),
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

function openRevoke(t: IPublisherToken) {
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
.publishers__toolbar {
  display: flex;
  justify-content: flex-end;
}
.publishers__copy {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}
</style>

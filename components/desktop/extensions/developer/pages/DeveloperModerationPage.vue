<template>
  <q-page padding>
    <div class="q-pa-md">
      <BaseBanner variant="info" class="q-mb-md">
        Заявки разработчиков на публикацию релизов. Одобрение активирует
        релиз on-chain и делает пакет доступным кооперативам по подписке;
        отказ возвращается разработчику с причиной.
      </BaseBanner>

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
        title="Заявок на модерацию нет"
        body="Когда разработчик опубликует релиз, заявка появится здесь."
      >
        <template #icon>
          <q-icon name="fact_check" size="28px" />
        </template>
      </EmptyState>

      <div v-else class="table-wrap">
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>Пакет</th>
                <th>Версия</th>
                <th>Описание</th>
                <th>Статус</th>
                <th class="col-action">Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in items" :key="m.id">
                <td>
                  <div class="t-mono">{{ m.packageId }}</div>
                  <div class="t-sm t-muted">{{ m.submittedBy }} · {{ formatDate(m.submittedAt) }}</div>
                </td>
                <td><span class="t-mono">{{ m.version }}</span></td>
                <td class="moderation__brief">{{ m.brief }}</td>
                <td>
                  <BaseBadge :variant="statusMap[m.status]?.variant ?? 'neutral'">
                    {{ statusMap[m.status]?.label ?? m.status }}
                  </BaseBadge>
                  <BaseBadge
                    v-if="m.requiresOverride"
                    variant="neg"
                    class="q-ml-xs"
                  >
                    уязвимость
                  </BaseBadge>
                </td>
                <td class="col-action">
                  <div class="moderation__actions">
                    <BaseButton
                      variant="primary"
                      size="sm"
                      :disabled="m.status !== 'SUBMITTED'"
                      @click="openApprove(m)"
                    >
                      Одобрить
                    </BaseButton>
                    <BaseButton
                      variant="danger"
                      size="sm"
                      :disabled="m.status !== 'SUBMITTED'"
                      @click="openReject(m)"
                    >
                      Отклонить
                    </BaseButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <BaseDialog v-model="approveDialog" title="Одобрение релиза" size="sm">
      <p class="t-sm t-muted q-mb-sm">
        Релиз <span class="t-mono">{{ selected?.packageId }}@{{ selected?.version }}</span>
        будет активирован для всех кооперативов.
      </p>
      <BaseCheckbox
        v-if="selected?.requiresOverride"
        v-model="approveOverride"
        label="Подтверждаю одобрение пакета с критической уязвимостью"
      />
      <BaseBanner v-if="actionError" variant="neg" class="q-mt-sm">
        {{ actionError }}
      </BaseBanner>
      <template #footer>
        <BaseButton variant="ghost" :disabled="actionLoading" @click="approveDialog = false">
          Отмена
        </BaseButton>
        <BaseButton variant="primary" :loading="actionLoading" @click="confirmApprove">
          Одобрить
        </BaseButton>
      </template>
    </BaseDialog>

    <BaseDialog v-model="rejectDialog" title="Отказ в публикации" size="sm">
      <p class="t-sm t-muted q-mb-sm">
        Причину увидит разработчик пакета
        <span class="t-mono">{{ selected?.packageId }}</span>.
      </p>
      <BaseInput
        v-model="rejectReason"
        label="Причина отказа"
        :error="rejectReasonError"
        required
      />
      <BaseBanner v-if="actionError" variant="neg" class="q-mt-sm">
        {{ actionError }}
      </BaseBanner>
      <template #footer>
        <BaseButton variant="ghost" :disabled="actionLoading" @click="rejectDialog = false">
          Отмена
        </BaseButton>
        <BaseButton variant="danger" :loading="actionLoading" @click="confirmReject">
          Отклонить
        </BaseButton>
      </template>
    </BaseDialog>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  BaseBadge,
  BaseBanner,
  BaseButton,
  BaseCheckbox,
  BaseDialog,
  BaseInput,
  EmptyState,
  TableSkeleton,
} from 'src/shared/ui/base';
import type { TableSkeletonColumn } from 'src/shared/ui/base/TableSkeleton/TableSkeleton.types';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge/BaseBadge.types';
import { api as extensionApi } from 'src/entities/Extension/api';
import { Zeus, type Queries } from '@coopenomics/sdk';

type ModerationRow = Queries.Extensions.AppsCatalogPendingModerations.IOutput[
  typeof Queries.Extensions.AppsCatalogPendingModerations.name
][number];

const items = ref<ModerationRow[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const skeletonColumns: TableSkeletonColumn[] = [
  { label: 'Пакет' },
  { label: 'Версия', width: '100px' },
  { label: 'Описание' },
  { label: 'Статус', cell: 'badge' },
  { label: 'Действия', cell: 'icon', class: 'col-action' },
];

const statusMap: Record<string, { label: string; variant: BaseBadgeVariant }> = {
  SUBMITTED: { label: 'На модерации', variant: 'warn' },
  APPROVED: { label: 'Одобрена', variant: 'pos' },
  APPROVED_PENDING_CHAIN: { label: 'Одобрена, ждёт блокчейн', variant: 'info' },
  REJECTED: { label: 'Отклонена', variant: 'neg' },
  WITHDRAWN: { label: 'Отозвана', variant: 'neutral' },
};

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU');
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    items.value = await extensionApi.loadPendingModerations();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

const selected = ref<ModerationRow | null>(null);
const approveDialog = ref(false);
const rejectDialog = ref(false);
const approveOverride = ref(false);
const rejectReason = ref('');
const rejectReasonError = ref('');
const actionLoading = ref(false);
const actionError = ref<string | null>(null);

function openApprove(m: ModerationRow) {
  selected.value = m;
  approveOverride.value = false;
  actionError.value = null;
  approveDialog.value = true;
}

function openReject(m: ModerationRow) {
  selected.value = m;
  rejectReason.value = '';
  rejectReasonError.value = '';
  actionError.value = null;
  rejectDialog.value = true;
}

async function confirmApprove() {
  if (!selected.value) return;
  actionLoading.value = true;
  actionError.value = null;
  try {
    const result = await extensionApi.approveModeration({
      moderationId: selected.value.id,
      scope: { type: Zeus.ReleaseScopeType.ALL },
      ...(approveOverride.value ? { override: true } : {}),
    });
    if (
      result.status === Zeus.ApproveModerationStatus.APPLIED ||
      result.status === Zeus.ApproveModerationStatus.PENDING_CHAIN
    ) {
      approveDialog.value = false;
      await load();
    } else if (result.status === Zeus.ApproveModerationStatus.REQUIRES_OVERRIDE) {
      actionError.value =
        'Пакет с критической уязвимостью: подтвердите одобрение галочкой.';
    } else {
      actionError.value = result.error || 'Не удалось одобрить заявку';
    }
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e);
  } finally {
    actionLoading.value = false;
  }
}

async function confirmReject() {
  if (!selected.value) return;
  rejectReasonError.value = '';
  const reason = rejectReason.value.trim();
  if (reason.length < 3) {
    rejectReasonError.value = 'Минимум 3 символа.';
    return;
  }
  actionLoading.value = true;
  actionError.value = null;
  try {
    const result = await extensionApi.rejectModeration({
      moderationId: selected.value.id,
      reason,
    });
    if (result.status === Zeus.RejectModerationStatus.APPLIED) {
      rejectDialog.value = false;
      await load();
    } else {
      actionError.value = result.error || 'Не удалось отклонить заявку';
    }
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e);
  } finally {
    actionLoading.value = false;
  }
}

onMounted(load);
</script>

<style scoped lang="scss">
.table-scroll {
  overflow-x: auto;
}

.moderation__brief {
  max-width: 320px;
}

.moderation__actions {
  display: flex;
  gap: var(--p-2);
  justify-content: flex-end;
}
</style>

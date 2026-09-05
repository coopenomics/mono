<template lang="pug">
.q-pa-md
  .banner.banner--info.q-mb-md(v-if='!dismissed')
    q-icon.banner__icon(name='info', size='20px')
    .banner__body
      | Состояние робота для председателя: у кого из членов совета робот держит ключ и совпадает ли он
      | с разрешением в цепи, какие решения застряли и почему. Застрявшее решение можно повторить.
    button.icon-btn(type='button', aria-label='Скрыть', @click='dismiss')
      q-icon(name='close')

  BaseCard.q-mb-md(title='Ключи членов совета', subtitle='Разрешения робота и ключи в хранилище')
    BaseTable(:columns='keyColumns', :rows='keys', row-key='member', :loading='loadingKeys && !keys.length')
      template(#cell-member='{ row }')
        .doc-primary {{ row.member }}
        .t-sm.t-muted {{ row.permission_name }}
      template(#cell-state='{ row }')
        BaseBadge(:variant='keyVariant(row)') {{ keyLabel(row) }}
      template(#cell-public_key='{ row }')
        span.t-mono-sm(v-if='row.public_key') {{ row.public_key }}
        span.t-muted(v-else) —

  BaseCard(title='Застрявшие решения', subtitle='Попытки исчерпаны — нужен ручной повтор')
    BaseTable(:columns='failedColumns', :rows='failed', row-key='id', :loading='loadingJournal && !failed.length')
      template(#cell-decision='{ row }')
        .doc-primary №{{ row.decision_id }} · {{ typeTitle(row.decision_type) }}
        .t-sm.t-muted попыток: {{ row.attempts }}
      template(#cell-error='{ row }')
        span.text-negative {{ row.last_error || '—' }}
      template(#cell-actions='{ row }')
        BaseButton(variant='secondary', size='sm', :loading='retrying === row.decision_id', @click='retry(row.decision_id)') Повторить
    EmptyState(v-if='!loadingJournal && !failed.length', title='Застрявших решений нет', body='Робот справляется сам.')
      template(#icon)
        q-icon(name='task_alt', size='48px')
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useDismissibleBanner } from 'src/shared/hooks/useDismissibleBanner';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseCard, BaseTable, EmptyState } from 'src/shared/ui/base';
import type { BaseTableColumn } from 'src/shared/ui/base';
import { robotApi, useRobotStore } from '../../../entities/robot';
import type { IRobotDecision, IRobotKeyStatus } from '../../../entities/robot';

const robotStore = useRobotStore();
const { dismissed, dismiss } = useDismissibleBanner('robot:admin:banner-dismissed');

const loadingKeys = ref(true);
const loadingJournal = ref(true);
const retrying = ref<number | null>(null);

const keys = computed<IRobotKeyStatus[]>(() => robotStore.keys);
const failed = computed<IRobotDecision[]>(() => (robotStore.journal?.items ?? []).filter((item) => item.stage === 'failed'));

const keyColumns: BaseTableColumn<IRobotKeyStatus>[] = [
  { key: 'member', label: 'Член совета' },
  { key: 'state', label: 'Состояние', width: '200px' },
  { key: 'public_key', label: 'Публичный ключ у робота' },
];

const failedColumns: BaseTableColumn<IRobotDecision>[] = [
  { key: 'decision', label: 'Решение' },
  { key: 'error', label: 'Ошибка' },
  { key: 'actions', label: '', width: '140px', align: 'right' },
];

function keyVariant(row: IRobotKeyStatus): 'pos' | 'warn' | 'neutral' | 'neg' {
  if (row.has_key && row.chain_key_matches) return 'pos';
  if (row.has_key && !row.chain_key_matches) return 'neg';
  if (row.chain_has_permission) return 'warn';
  return 'neutral';
}

function keyLabel(row: IRobotKeyStatus): string {
  if (row.has_key && row.chain_key_matches) return 'Ключ передан';
  if (row.has_key && !row.chain_key_matches) return 'Ключ не совпадает с цепью';
  if (row.chain_has_permission) return 'Разрешение без ключа';
  return 'Не делегировал';
}

function typeTitle(type: string): string {
  return robotStore.titleByType[type] ?? type;
}

async function retry(decisionId: number) {
  retrying.value = decisionId;
  try {
    await robotApi.retryDecision({ decision_id: decisionId });
    await robotStore.loadJournal({ options: { page: 1, limit: 100, sortBy: 'decision_id', sortOrder: 'DESC' } });
    SuccessAlert('Решение отправлено на повтор');
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    retrying.value = null;
  }
}

onMounted(async () => {
  try {
    if (!robotStore.registry.length) await robotStore.loadRegistry();
  } catch {
    // названия типов — украшение
  }
  try {
    await robotStore.loadKeys();
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    loadingKeys.value = false;
  }
  try {
    await robotStore.loadJournal({ options: { page: 1, limit: 100, sortBy: 'decision_id', sortOrder: 'DESC' } });
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    loadingJournal.value = false;
  }
});
</script>

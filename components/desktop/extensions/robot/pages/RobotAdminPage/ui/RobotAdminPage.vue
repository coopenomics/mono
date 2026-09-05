<template lang="pug">
.q-pa-md
  .banner.banner--info.q-mb-md(v-if='!dismissed')
    q-icon.banner__icon(name='info', size='20px')
    .banner__body
      | Состояние робота для председателя: за кого из членов совета робот может голосовать,
      | какие решения застряли и почему. Застрявшее решение можно повторить.
    button.icon-btn(type='button', aria-label='Скрыть', @click='dismiss')
      q-icon(name='close')

  BaseCard.q-mb-md(title='За кого голосует робот', subtitle='Члены совета, доверившие роботу подпись')
    BaseTable(:columns='keyColumns', :rows='keys', row-key='member', :loading='loadingKeys && !keys.length')
      template(#cell-member='{ row }')
        .doc-primary {{ robotStore.memberName(row.member) }}
      template(#cell-state='{ row }')
        BaseBadge(:variant='keyVariant(row)') {{ keyLabel(row) }}
      template(#cell-updated='{ row }')
        span(v-if='row.updated_at') {{ formatWhen(row.updated_at) }}
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
const failed = computed<IRobotDecision[]>(() => (robotStore.journal?.items ?? []).filter((item) => String(item.stage).toLowerCase() === 'failed'));

const keyColumns: BaseTableColumn<IRobotKeyStatus>[] = [
  { key: 'member', label: 'Член совета' },
  { key: 'state', label: 'Состояние', width: '220px' },
  { key: 'updated', label: 'Ключ передан', width: '180px', nowrap: true },
];

/** Когда робот получил ключ — датой и временем, без секунд. */
function formatWhen(value: string | Date): string {
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? '—' : at.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

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
  if (row.has_key && row.chain_key_matches) return 'Робот голосует';
  if (row.has_key && !row.chain_key_matches) return 'Ключ устарел — нужно передать заново';
  if (row.chain_has_permission) return 'Ключ не передан';
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
    // Состав совета — источник ФИО; названия типов решений — для журнала.
    if (!robotStore.council) await robotStore.loadCouncil();
    if (!robotStore.registry.length) await robotStore.loadRegistry();
  } catch {
    // имена и названия типов — украшение, без них страница всё равно работает
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

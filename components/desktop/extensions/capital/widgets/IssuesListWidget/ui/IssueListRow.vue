<template lang="pug">
.issue-row(role='row')
  // 1. Левые колонки — та же сетка, что у проектов/компонентов:
  // приоритет (на месте chevron) → плоский ID фиксированной ширины.
  .row-lead
    q-icon.priority-icon(
      :name='priorityIcon'
      :color='priorityColor'
      size='18px'
    )
      q-tooltip(anchor='bottom middle', self='top middle') Приоритет: {{ priorityLabel }}
  .row-id
    EntityIdBadge(
      :raw-id='issue.id'
      copy-on-click
      address-clipboard
      flat
    )

  // 2. Тайтл: занимает всё свободное место, переносится по словам, ellipsis по необходимости.
  .title-block(@click.stop="onTitleClick")
    span.title-text {{ issue.title }}
    BaseChip.label-chip(
      v-for='tag in tags'
      :key='tag'
      variant='neutral'
      size='sm'
    ) {{ tag }}

  // 3. Правая сетка строки — те же фиксированные колонки, что у проектов
  // и компонентов: время | статус | люди
  .actions-block(@click.stop)
    .cell-time
      IssueTimeChip(
        :issue-hash='issue.issue_hash'
        :estimate='issue.estimate'
        :fact='legacyFactHours'
        :readonly='!canChangeEstimate'
      )
    .cell-side
      IssueStatusChip(
        :model-value='issue.status'
        :issue-hash='issue.issue_hash'
        :readonly='!issue.permissions.can_change_status'
        :allowed-transitions='issue.permissions.allowed_status_transitions'
      )
    .cell-actions
      SetCreatorAvatars(
        :issue='issue'
        :permissions='issue.permissions'
      )
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { EntityIdBadge } from 'src/shared/ui';
import { BaseChip } from 'src/shared/ui/base';
import { IssueStatusChip } from '../../../features/Issue/UpdateIssue/ui/UpdateStatus';
import { IssueTimeChip } from '../../../features/Issue/UpdateIssue/ui/UpdateEstimate';
import { SetCreatorAvatars } from '../../../features/Issue/SetCreator';
import {
  getIssuePriorityIcon,
  getIssuePriorityColor,
  getIssueLabels,
} from 'app/extensions/capital/shared/lib';
import type { IIssue } from 'app/extensions/capital/entities/Issue/model';

const props = defineProps<{ issue: IIssue }>();
const emit = defineEmits<{ (e: 'click', issue: IIssue): void }>();

const onTitleClick = () => emit('click', props.issue);

const tags = computed(() => getIssueLabels(props.issue));
const priorityIcon = computed(() => getIssuePriorityIcon(props.issue.priority));
const priorityColor = computed(() =>
  getIssuePriorityColor(props.issue.priority)
);
const priorityLabel = computed(() => props.issue.priority || '—');

const canChangeEstimate = computed(
  () => !!props.issue.permissions?.can_set_estimate
);

/** Легаси: пока бэкенд не отдаёт факт из учёта — при отсутствии факта показываем план (как на странице задачи). */
const legacyFactHours = computed(() => {
  const estimate = Number(props.issue?.estimate) || 0;
  const fact = Number(props.issue?.fact) || 0;
  return fact > 0 ? fact : estimate;
});
</script>

<style lang="scss" scoped>
.issue-row {
  display: flex;
  // Разрешаем перенос: на узких колонках (страница задач внутри компонента
  // имеет ещё и левую панель — реальная ширина списка ~600px) actions-блок
  // мигрирует на вторую строку, не клипается за правый край.
  flex-wrap: wrap;
  align-items: center;
  row-gap: var(--p-2);
  min-height: 48px;
  padding: var(--p-2) var(--p-3) var(--p-2) 0;
  width: 100%;
  box-sizing: border-box;
}

// 1. Левые колонки — сетка, синхронная со строками проектов/компонентов.
.row-lead {
  width: 28px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.row-id {
  width: 96px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.priority-icon {
  flex-shrink: 0;
}


// 2. Title — растягивается, ellipsis при нехватке места. flex-basis 200px:
// если в строке есть место для (meta + 200 + actions) — однорядный layout;
// если нет — title съезжает на 100% и actions переносится на вторую строку.
.title-block {
  flex: 1 1 200px;
  min-width: 200px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-1);
  cursor: pointer;
  font-weight: 500;
  font-size: var(--p-fs-body);
  transition: color 0.15s ease;

  &:hover {
    color: var(--p-primary);
  }
}

.title-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  max-width: 100%;
}

.label-chip {
  max-width: 140px;

  :deep(.q-chip__content) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

// 3. Actions — фиксированная колоночная сетка справа, синхронная со
// строками проектов/компонентов (см. .row-cells в их виджетах).
.actions-block {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: auto;
}

.cell-time {
  width: 110px;
  display: flex;
  justify-content: flex-end;
}

.cell-side {
  width: 132px;
  display: flex;
  justify-content: flex-end;
}

.cell-actions {
  width: 160px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--p-2);
}

// Mobile: meta + title в первой строке (title справа от меты), actions
// переносится во вторую строку и прижимается вправо.
@media (max-width: 640px) {
  .issue-row {
    flex-wrap: wrap;
    row-gap: var(--p-2);
  }

  .title-block {
    flex: 1 1 0;
    min-width: 0;
  }

  .actions-block {
    width: 100%;
    margin-left: 0;
    justify-content: flex-end;
    gap: var(--p-2);
  }

  .cell-time,
  .cell-side,
  .cell-actions {
    width: auto;
  }
}
</style>

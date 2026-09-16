<template lang="pug">
DetailsDrawer(
  :model-value='overlay.isOpen.value',
  :width='760',
  title='Задача',
  @update:model-value='(v) => !v && overlay.close()'
)
  template(#actions)
    BaseButton(
      variant='ghost',
      size='sm',
      aria-label='Открыть задачу на отдельной странице',
      @click='openFullPage'
    )
      template(#icon-left)
        q-icon(name='open_in_full', size='16px')
      | Открыть задачу

  .issue-overlay__body(v-if='issue')
    //- Заголовок правится тем же редактором, что на полной странице
    IssueTitleEditor.full-width(
      :issue='issue',
      @update:title='handleTitleUpdate',
      @save='handleTitleUpdate'
    )
      template(#prepend-icon)
        q-icon(name='task', size='24px', color='primary')
    IssueSidebarWidget(
      :issue='issue',
      :permissions='issue.permissions',
      :project-hash='issue.project_hash ?? undefined',
      compact-mobile,
      @update:status='patch("status", $event)',
      @update:priority='patch("priority", $event)',
      @update:estimate='patch("estimate", $event)',
      @update:labels='onLabelsUpdate',
      @issue-updated='reload',
      @issue-deleted='overlay.close()',
      @issue-moved='reload'
    )
    .row.items-center
      .col
        AutoSaveIndicator(:is-auto-saving='isAutoSaving', :auto-save-error='autoSaveError')
      .col-auto
        RevisionsButton(
          :entity-type='Zeus.CapitalContentEntityType.ISSUE',
          :entity-hash='issue.issue_hash',
          :current-title='issue.title || ""',
          :current-description='issue.description || ""',
          :current-rev='issue.content_rev ?? 0',
          :can-edit='!!issue.permissions?.can_edit_issue',
          @restored='reload'
        )

    //- Правка описания — та же машина, что на полной странице (автосохранение
    //- с редакциями и слиянием), общая через useIssueContentSave
    Editor(
      v-model='issue.description',
      label='Описание задачи',
      placeholder='Опишите задачу подробно...',
      :readonly='!issue.permissions?.can_edit_issue',
      :padded='false',
      @change='handleDescriptionChange'
    )

  .issue-overlay__loading(v-else)
    q-spinner(size='28px', color='primary')

  ConflictDialog(
    v-model='conflictOpen',
    :conflict='conflict',
    @resolve='applyConflictResolution'
  )
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQueryOverlay } from 'src/shared/lib/navigation';
import { FailAlert } from 'src/shared/api';
import { Zeus } from '@coopenomics/sdk';
import { DetailsDrawer } from 'src/shared/ui/domain';
import { BaseButton } from 'src/shared/ui/base';
import { Editor, AutoSaveIndicator } from 'src/shared/ui';
import {
  ConflictDialog,
  RevisionsButton,
} from 'app/extensions/capital/features/ContentRevisions';
import { useIssueContentSave } from 'app/extensions/capital/features/Issue/UpdateIssue';
import { api as IssueApi } from 'app/extensions/capital/entities/Issue/api';
import { useIssueStore, withLabels } from 'app/extensions/capital/entities/Issue/model';
import type { IIssue } from 'app/extensions/capital/entities/Issue/model';
import { IssueSidebarWidget, IssueTitleEditor } from 'app/extensions/capital/widgets';
import { capitalRouteName } from 'app/extensions/capital/shared/lib/capitalWorkspaceRoutes';

/**
 * Задача в оверлее поверх списка (`?issue=<hash>`, см. useQueryOverlay):
 * список под оверлеем не размонтируется и сохраняет скролл и ленту, «назад»
 * закрывает оверлей, ссылка пересылается, F5 восстанавливает.
 *
 * Компактный срез: заголовок, поля сайдбара (статус, приоритет, оценка,
 * метки — редактируются прямо здесь, сайдбар сам пишет на сервер) и описание
 * для чтения. Полная работа с текстом — по кнопке «Открыть задачу».
 */
const overlay = useQueryOverlay('issue');
const route = useRoute();
const router = useRouter();
const issueStore = useIssueStore();

const issue = ref<IIssue | null>(null);
const issueProjectHash = computed(() => issue.value?.project_hash ?? null);

// Та же машина автосохранения, что на полной странице задачи
const {
  isAutoSaving,
  autoSaveError,
  conflict,
  conflictOpen,
  saveIssueContent,
  applyConflictResolution,
} = useIssueContentSave(issue, issueProjectHash);

async function handleTitleUpdate(value: string): Promise<void> {
  if (!issue.value) return;
  issue.value.title = value;
  await saveIssueContent({ title: value });
  void issueStore.updateIssueByHash(issue.value.project_hash, issue.value.issue_hash);
}

async function handleDescriptionChange(): Promise<void> {
  if (!issue.value) return;
  await saveIssueContent({ description: issue.value.description ?? '' });
  void issueStore.updateIssueByHash(issue.value.project_hash, issue.value.issue_hash);
}

async function fetchIssue(hash: string): Promise<void> {
  try {
    const row = await IssueApi.loadIssue({ issue_hash: hash });
    if (!row) {
      FailAlert('Задача не найдена или недоступна');
      overlay.close();
      return;
    }
    issue.value = row;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    FailAlert('Не удалось загрузить задачу: ' + msg);
    overlay.close();
  }
}

watch(
  overlay.value,
  async (hash) => {
    if (!hash) {
      issue.value = null;
      return;
    }
    if (issue.value?.issue_hash === hash) return;
    issue.value = null;
    await fetchIssue(hash);
  },
  { immediate: true },
);

// Сайдбар пишет на сервер сам и эмитит применённое значение — здесь только
// локальный патч и синхронизация ленты списка под оверлеем
/**
 * Метки — не поле задачи, а часть `metadata` (см. withLabels): `patch("labels", …)`
 * не проходил проверку типов и валил сборку.
 */
function onLabelsUpdate(value: string[]): void {
  if (!issue.value) return;
  issue.value.metadata = withLabels(issue.value.metadata, value);
  void issueStore.updateIssueByHash(issue.value.project_hash, issue.value.issue_hash);
}

function patch(field: keyof IIssue, value: unknown): void {
  if (!issue.value) return;
  (issue.value as Record<string, unknown>)[field] = value;
  void issueStore.updateIssueByHash(issue.value.project_hash, issue.value.issue_hash);
}

async function reload(): Promise<void> {
  if (!issue.value) return;
  const hash = issue.value.issue_hash;
  void issueStore.updateIssueByHash(issue.value.project_hash, hash);
  await fetchIssue(hash);
}

function openFullPage(): void {
  if (!issue.value?.project_hash) return;
  void router.push({
    name: capitalRouteName('component-issue-description', route),
    params: {
      project_hash: issue.value.project_hash,
      issue_hash: issue.value.issue_hash,
    },
  });
}
</script>

<style lang="scss" scoped>
.issue-overlay__body {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}


.issue-overlay__loading {
  display: grid;
  place-items: center;
  padding: var(--p-8) 0;
}
</style>

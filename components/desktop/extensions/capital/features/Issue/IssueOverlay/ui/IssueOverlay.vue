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
    .issue-overlay__title {{ issue.title }}
    IssueSidebarWidget(
      :issue='issue',
      :permissions='issue.permissions',
      :project-hash='issue.project_hash ?? undefined',
      compact-mobile,
      @update:status='patch("status", $event)',
      @update:priority='patch("priority", $event)',
      @update:estimate='patch("estimate", $event)',
      @update:labels='patch("labels", $event)',
      @issue-updated='reload',
      @issue-deleted='overlay.close()',
      @issue-moved='reload'
    )
    //- Описание в оверлее только для чтения: правка текста живёт на полной
    //- странице — там автосохранение, редакции и слияние конфликтов
    Editor(
      v-if='issue.description',
      :model-value='issue.description',
      label='Описание задачи',
      readonly,
      :padded='false'
    )
  .issue-overlay__loading(v-else)
    q-spinner(size='28px', color='primary')
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQueryOverlay } from 'src/shared/lib/navigation';
import { FailAlert } from 'src/shared/api';
import { DetailsDrawer } from 'src/shared/ui/domain';
import { BaseButton } from 'src/shared/ui/base';
import { Editor } from 'src/shared/ui';
import { api as IssueApi } from 'app/extensions/capital/entities/Issue/api';
import { useIssueStore } from 'app/extensions/capital/entities/Issue/model';
import type { IIssue } from 'app/extensions/capital/entities/Issue/model';
import { IssueSidebarWidget } from 'app/extensions/capital/widgets';
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

.issue-overlay__title {
  font-size: var(--p-fs-h5, 18px);
  font-weight: 600;
  color: var(--p-ink);
  line-height: var(--p-lh-h5, 1.35);
  overflow-wrap: anywhere;
}

.issue-overlay__loading {
  display: grid;
  place-items: center;
  padding: var(--p-8) 0;
}
</style>

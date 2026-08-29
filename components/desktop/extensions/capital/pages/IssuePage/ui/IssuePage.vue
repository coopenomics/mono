<template lang="pug">
.issue-page-shell.page-shell.column.flex-1.min-h-0.min-w-0.no-wrap
  PageTabs(
    v-if="issue"
    :tabs="issueTabs"
    :active-key="activeTabKey"
  )
    template(#actions)
      BaseButton(
        v-if="isRequirementsTab && canCreateRequirement"
        variant="primary"
        size="sm"
        aria-label="Создать артефакт"
        @click="openCreateRequirementDialog"
      )
        template(#icon-left)
          q-icon(name="add", size="18px")
        | Артефакт

  .issue-page-missing(v-if="issueNotFound")
    EmptyState(
      title="Задача недоступна"
      body="Она удалена или закрыта для вас. Ссылку из избранного можно снять звёздочкой в списке."
    )
      template(#icon)
        q-icon(name="assignment_late" size="32px")

  .issue-page-skeleton(v-else-if="!issue")
    .issue-page-skeleton__side(v-if="showSidebar")
      .skel(v-for="i in 4", :key="i")
    .issue-page-skeleton__main
      .skel.skel--title
      .skel.skel--text(v-for="i in 3", :key="i")

  // Мобильный layout. no-wrap обязателен: quasar-«column» по умолчанию wrap,
  // и контент, не влезший в фиксированную высоту оболочки, уезжал во
  // «вторую колонку» вправо
  .page-surface.column.no-wrap.col.flex-1.min-h-0.min-w-0(
    v-else-if="isMobileLayout"
  )
    //- Заголовок, управление и контент прокручиваются одной лентой
    div.col.min-h-0.overflow-auto.min-w-0(v-if="showSidebar")
      .q-px-md.q-pb-sm
        IssueTitleEditor(
          :issue="issue"
          @field-change="handleFieldChange"
          @update:title="handleTitleUpdate"
          @save="handleTitleUpdate"
        ).full-width
          template(#prepend-icon)
            q-icon(name="task", size="24px", color="primary")
          template(#hint)
            ProjectPathWidget(v-if="parentProject", :project="parentProject")
        IssueSidebarWidget(
          :issue="issue"
          :permissions="issue.permissions"
          :project-hash="projectHash"
          :parent-project-hash="parentProjectHash"
          compact-mobile
          @update:status="handleStatusUpdate"
          @update:priority="handlePriorityUpdate"
          @update:estimate="handleEstimateUpdate"
          @update:labels="handleLabelsUpdate"
          @creators-set="handleCreatorsSet"
          @issue-updated="handleIssueUpdated"
          @issue-deleted="handleIssueDeleted"
          @issue-moved="handleIssueMoved"
        )
      router-view
    div.col.flex-1.min-h-0.min-w-0.column.no-wrap.overflow-hidden.relative-position(v-else)
      div.col.min-h-0.overflow-auto.min-w-0
        router-view

  .page-surface.column.col.flex-1.min-h-0.min-w-0(
    v-else-if="showSidebar"
  )
    .q-px-md.q-pb-md
      IssueTitleEditor(
        :issue="issue"
        @field-change="handleFieldChange"
        @update:title="handleTitleUpdate"
        @save="handleTitleUpdate"
      ).full-width
        template(#prepend-icon)
          q-icon(name="task", size="24px", color="primary")
        template(#hint)
          ProjectPathWidget(v-if="parentProject", :project="parentProject")
    q-splitter.col.flex-1.min-h-0(
      v-model="sidebarWidth"
      :limits="[200, 800]"
      unit="px"
      separator-class="bg-grey-3"
      before-class="column no-wrap overflow-hidden"
      after-class="min-h-0"
      @update:model-value="saveSidebarWidth"
    )
      template(#before)
        .issue-sidebar-pane.column.no-wrap.full-height.min-h-0
          IssueSidebarWidget.col.min-h-0(
            :issue="issue"
            :permissions="issue.permissions"
            :project-hash="projectHash"
            :parent-project-hash="parentProjectHash"
            @update:status="handleStatusUpdate"
            @update:priority="handlePriorityUpdate"
            @update:estimate="handleEstimateUpdate"
            @update:labels="handleLabelsUpdate"
            @creators-set="handleCreatorsSet"
            @issue-updated="handleIssueUpdated"
            @issue-deleted="handleIssueDeleted"
            @issue-moved="handleIssueMoved"
          )
      template(#after)
        div.column.full-height.min-h-0.relative-position
          div.col.min-h-0.overflow-auto.min-w-0
            router-view

  .page-surface.column.col.flex-1.min-h-0.min-w-0.relative-position(v-else)
    div.col.min-h-0.overflow-auto.min-w-0
      router-view

  CreateRequirementWithEditorDialog(
    ref="createRequirementDialog"
    :filter="createRequirementFilter"
    @success="handleRequirementCreated"
  )
  ConflictDialog(v-model="conflictOpen" :conflict="conflict" @resolve="applyConflictResolution")
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch, provide } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWindowSize } from 'src/shared/hooks/useWindowSize'
import { FailAlert } from 'src/shared/api'
import { api as IssueApi } from 'app/extensions/capital/entities/Issue/api'
import { api as ProjectApi } from 'app/extensions/capital/entities/Project/api'
import type { IIssue } from 'app/extensions/capital/entities/Issue/model'
import type { IProject } from 'app/extensions/capital/entities/Project/model'
import { EMPTY_HASH } from 'src/shared/lib/consts'
import { goBackOr, useBackButton } from 'src/shared/lib/navigation'
import { PageTabs } from 'src/shared/ui/layout'
import { BaseButton, EmptyState } from 'src/shared/ui/base'
import { toMarkdown } from 'src/shared/lib/utils'
import { useUpdateIssue } from 'app/extensions/capital/features/Issue/UpdateIssue'
import { ConflictDialog, extractContentConflict, type IContentConflict } from 'app/extensions/capital/features/ContentRevisions'
import { IssueSidebarWidget } from 'app/extensions/capital/widgets'
import { IssueTitleEditor } from 'app/extensions/capital/widgets/IssueTitleEditor'
import { ProjectPathWidget } from 'app/extensions/capital/widgets/ProjectPathWidget'
import { CreateRequirementWithEditorDialog } from 'app/extensions/capital/features/Story/CreateStory'
import type { IGetStoriesInput } from 'app/extensions/capital/entities/Story/model'
import { ISSUE_PAGE_KEY } from '../model/context'
import {
  isMyProjectsWorkspace,
  capitalRouteName,
} from 'app/extensions/capital/shared/lib/capitalWorkspaceRoutes'

const route = useRoute()
const router = useRouter()
const { isMobile } = useWindowSize()

const issue = ref<IIssue | null>(null)
const parentProject = ref<IProject | null>(null)
const logsRefreshTrigger = ref(0)

const SIDEBAR_WIDTH_KEY = 'sidebar-width'
const DEFAULT_SIDEBAR_WIDTH = 300
const sidebarWidth = ref(DEFAULT_SIDEBAR_WIDTH)

const loadSidebarWidth = () => {
  const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY)
  if (saved) {
    const parsed = parseInt(saved, 10)
    if (!isNaN(parsed) && parsed >= 200 && parsed <= 800) {
      sidebarWidth.value = parsed
    }
  }
}

const saveSidebarWidth = (width: number) => {
  localStorage.setItem(SIDEBAR_WIDTH_KEY, width.toString())
}

const isMobileLayout = isMobile
const { debounceSave, isAutoSaving, autoSaveError } = useUpdateIssue()

const issueHash = computed(() => route.params.issue_hash as string)
const isMyTaskContext = computed(() =>
  String(route.name ?? '').startsWith('my-task-issue'),
)
const isMyProjectsContext = computed(
  () => isMyProjectsWorkspace(route) && !isMyTaskContext.value,
)
const issueRoutePrefix = computed(() => {
  if (isMyTaskContext.value) return 'my-task-issue'
  if (isMyProjectsContext.value) return 'my-component-issue'
  return 'component-issue'
})
const projectHash = computed(() => {
  const fromRoute = route.params.project_hash as string | undefined
  if (fromRoute && fromRoute !== 'free') return fromRoute
  return issue.value?.project_hash || ''
})
const isFreeIssue = computed(() => !issue.value?.project_hash)

const linkedGitCommits = computed(() => (issue.value as { linked_git_commits?: unknown[] } | null)?.linked_git_commits ?? [])

const requirementsFilter = computed<Partial<IGetStoriesInput['filter']>>(() => ({
  issue_hash: issue.value?.issue_hash ?? '',
}))

const createRequirementFilter = computed(() => ({
  project_hash: projectHash.value,
  issue_hash: issue.value?.issue_hash ?? '',
}))

const canCreateRequirement = computed((): boolean => {
  return Boolean(issue.value?.permissions?.can_create_requirement)
})

const createRequirementDialog = ref<InstanceType<typeof CreateRequirementWithEditorDialog> | null>(null)
const openCreateRequirementDialog = () => {
  createRequirementDialog.value?.openDialog()
}
const handleRequirementCreated = () => {}

const activeTabKey = computed(() => {
  const name = String(route.name ?? '')
  const prefix = issueRoutePrefix.value
  if (
    name === prefix ||
    name === `${prefix}-redirect` ||
    name === 'component-issue' ||
    name === 'component-issue-redirect' ||
    name === 'my-component-issue' ||
    name === 'my-component-issue-redirect' ||
    name === 'my-task-issue' ||
    name === 'my-task-issue-redirect'
  ) {
    return `${prefix}-description`
  }
  return name
})

const isDescriptionTab = computed(
  () => activeTabKey.value.endsWith('issue-description') || activeTabKey.value.endsWith('component-issue-description'),
)
const isRequirementsTab = computed(
  () => activeTabKey.value.endsWith('issue-requirements') || activeTabKey.value.endsWith('component-issue-requirements'),
)
const showSidebar = computed(() => isDescriptionTab.value)

const issueTabs = computed(() => {
  const prefix = issueRoutePrefix.value
  const params = isMyTaskContext.value
    ? { issue_hash: issueHash.value }
    : {
        project_hash: projectHash.value,
        issue_hash: issueHash.value,
      }

  return [
    { key: `${prefix}-description`, label: 'Описание', route: { name: `${prefix}-description`, params } },
    { key: `${prefix}-requirements`, label: 'Артефакты', route: { name: `${prefix}-requirements`, params } },
    { key: `${prefix}-commits`, label: 'Коммиты', route: { name: `${prefix}-commits`, params } },
    { key: `${prefix}-history`, label: 'История', route: { name: `${prefix}-history`, params } },
  ]
})

const parentProjectHash = computed(() => {
  const p = parentProject.value?.parent_hash?.trim()
  if (!p || p === EMPTY_HASH) return null
  return p
})

const routeIssueKey = computed(
  () => `${String(route.params.issue_hash)}:${String(route.params.project_hash ?? '')}`,
)

const ensureMarkdownFormat = (description: unknown) => {
  if (!description) return ''
  return toMarkdown(description)
}

const loadParentInfo = async () => {
  if (isFreeIssue.value || !projectHash.value) {
    parentProject.value = null
    return
  }
  try {
    const projectData = await ProjectApi.loadProject({ hash: projectHash.value })
    parentProject.value = projectData || null
  } catch (error) {
    console.error('Ошибка при загрузке информации о родителе:', error)
    parentProject.value = null
  }
}

const handleFieldChange = () => {}

// Конфликт редакций: сервер не смог слить автоматически — показываем обе версии
const conflict = ref<IContentConflict | null>(null)
const conflictOpen = ref(false)

/**
 * Автосохранение задачи с редакцией: base_rev = content_rev, с которого начата правка.
 * Сервер сливает параллельные правки и возвращает итоговый текст — подменяем его в редакторе;
 * настоящий конфликт открывает диалог выбора.
 */
const saveIssueContent = async (patch: { title?: string; description?: string }) => {
  if (!issue.value) return
  const baseRev = issue.value.content_rev
  try {
    const updated = await debounceSave(
      { issue_hash: issue.value.issue_hash, ...patch, base_rev: baseRev },
      projectHash.value || '',
    )
    if (updated && issue.value) {
      issue.value.content_rev = updated.content_rev
      if (patch.description !== undefined && updated.description !== patch.description) {
        issue.value.description = updated.description ?? ''
      }
      if (patch.title !== undefined && updated.title !== patch.title) {
        issue.value.title = updated.title
      }
    }
    logsRefreshTrigger.value++
  } catch (error) {
    const c = extractContentConflict(error)
    if (c) {
      conflict.value = c
      conflictOpen.value = true
      return
    }
    console.error('Failed to save issue content:', error)
  }
}

const applyConflictResolution = async (value: { title: string; description: string; base_rev: number }) => {
  if (!issue.value) return
  issue.value.title = value.title
  issue.value.description = value.description
  issue.value.content_rev = value.base_rev
  await saveIssueContent({ title: value.title, description: value.description })
}

const handleTitleUpdate = async (value: string) => {
  if (!issue.value) return
  issue.value.title = value
  await saveIssueContent({ title: value })
}

const handleDescriptionChange = async () => {
  if (!issue.value) return
  await saveIssueContent({ description: issue.value.description ?? '' })
}

// Назад — туда, откуда пришли (см. smartBack.ts); при прямом заходе по
// ссылке — на список задач компонента-владельца или в свой контекст my-*
useBackButton({
  text: 'Назад',
  componentId: 'issue-page-' + issueHash.value,
  onClick: () => {
    const fallback = isMyTaskContext.value
      ? { name: 'capital-my-tasks', params: { coopname: route.params.coopname } }
      : projectHash.value
        ? {
            name: capitalRouteName('component-tasks', route),
            params: { coopname: route.params.coopname, project_hash: projectHash.value },
          }
        : { name: 'capital-my-projects', params: { coopname: route.params.coopname } }
    goBackOr(router, fallback)
  },
})

// Попытка загрузки завершилась, а задачи нет — она удалена или недоступна.
// Без этого признака страница не отличает «ещё грузится» от «уже никогда
// не загрузится» и крутит скелетон бесконечно.
const issueNotFound = ref(false)

const loadIssue = async () => {
  try {
    const issueData = await IssueApi.loadIssue({ issue_hash: issueHash.value })
    issue.value = issueData || null
    if (issue.value?.description) {
      issue.value.description = ensureMarkdownFormat(issue.value.description)
    }
    issueNotFound.value = !issue.value
  } catch (error) {
    console.error('Ошибка при загрузке задачи:', error)
    FailAlert('Не удалось загрузить задачу')
    issueNotFound.value = true
  }
}

const handleStatusUpdate = (value: unknown) => {
  if (issue.value) {
    issue.value.status = value as IIssue['status']
    logsRefreshTrigger.value++
  }
}

const handlePriorityUpdate = (value: unknown) => {
  if (issue.value) {
    issue.value.priority = value as IIssue['priority']
    logsRefreshTrigger.value++
  }
}

const handleEstimateUpdate = (value: number) => {
  if (issue.value) {
    issue.value.estimate = value
    logsRefreshTrigger.value++
  }
}

const handleLabelsUpdate = (value: string[]) => {
  if (!issue.value) return
  const prev = issue.value.metadata
  const base: Record<string, unknown> =
    prev && typeof prev === 'object' && prev !== null && !Array.isArray(prev)
      ? { ...(prev as Record<string, unknown>) }
      : {}
  base.labels = value
  issue.value.metadata = base as IIssue['metadata']
  logsRefreshTrigger.value++
}

const handleCreatorsSet = (creators: unknown[]) => {
  if (issue.value) {
    issue.value.creators = (creators as { username: string }[]).map((c) => c.username)
    logsRefreshTrigger.value++
  }
}

const handleIssueUpdated = (updatedIssue: unknown) => {
  if (updatedIssue && issue.value) {
    issue.value = { ...issue.value, ...(updatedIssue as IIssue) }
  }
}

const handleIssueDeleted = () => {
  const coopname = route.params.coopname as string
  if (isMyTaskContext.value || isFreeIssue.value) {
    router.push({ name: 'capital-my-tasks', params: { coopname } })
    return
  }
  router.push({
    name: capitalRouteName('component-tasks', route),
    params: { coopname, project_hash: projectHash.value },
  })
}

const handleIssueMoved = ({
  updatedIssue,
  toProjectHash,
}: {
  updatedIssue: IIssue
  fromProjectHash: string
  toProjectHash: string
}) => {
  const coopname = route.params.coopname as string
  void router.replace({
    name: capitalRouteName('component-issue-description', route),
    params: {
      coopname,
      project_hash: toProjectHash,
      issue_hash: updatedIssue.issue_hash,
    },
  })
}

provide(ISSUE_PAGE_KEY, {
  issue,
  parentProject,
  projectHash,
  logsRefreshTrigger,
  isAutoSaving,
  autoSaveError,
  requirementsFilter,
  createRequirementFilter,
  canCreateRequirement,
  linkedGitCommits,
  handleDescriptionChange,
  openCreateRequirementDialog,
  reloadIssue: loadIssue,
})

watch(routeIssueKey, async (_key, prev) => {
  if (prev === undefined) return
  issueNotFound.value = false
  await loadIssue()
  await loadParentInfo()
})

// Дефолт: пустой/родительский маршрут → вкладка «Описание»
watch(
  () => route.name,
  (name) => {
    const n = String(name ?? '')
    if (
      n === 'component-issue' ||
      n === 'component-issue-redirect' ||
      n === 'my-component-issue' ||
      n === 'my-component-issue-redirect' ||
      n === 'my-task-issue' ||
      n === 'my-task-issue-redirect'
    ) {
      void router.replace({
        name: `${issueRoutePrefix.value}-description`,
        params: route.params,
        query: route.query,
      })
    }
  },
  { immediate: true },
)

onMounted(async () => {
  loadSidebarWidth()
  await loadIssue()
  await loadParentInfo()
})
</script>

<style lang="scss" scoped>
// Рабочая плоскость: контент на --p-surface, табы на --p-canvas
.page-surface {
  background: var(--p-surface);

  // Вкладки уже на surface — вложенные q-card дают «карточку в карточке»
  // (скругления/бордер срезают плоскость). Сглаживаем только здесь:
  // те же виджеты вне оболочки (трекер, списки и т.п.) сохраняют карточный вид.
  :deep(.q-card) {
    background: transparent;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
}

// Обёртка before-панели сплиттера: на всю высоту, чтобы сайдбар
// (flex-колонка + margin-top: auto у «Удалить») мог прижаться вниз.
.issue-sidebar-pane {
  height: 100%;
  min-height: 0;
  min-width: 0;
  width: 100%;
}

.issue-page-missing {
  display: flex;
  flex: 1;
  min-height: 0;
  align-items: center;
  justify-content: center;
  padding: var(--p-6);
  background: var(--p-surface);
}

.issue-page-skeleton {
  display: flex;
  gap: var(--p-4);
  padding: var(--p-4);
  background: var(--p-surface);
  flex: 1;
  min-height: 0;

  &__side {
    width: 300px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: var(--p-3);

    .skel {
      height: 40px;
    }
  }

  &__main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--p-3);

    .skel--title {
      width: 240px;
      max-width: 60%;
    }
  }

  @media (max-width: 640px) {
    flex-direction: column;

    &__side {
      width: 100%;
    }
  }
}
</style>

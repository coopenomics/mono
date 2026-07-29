<template lang="pug">
.issue-page-shell.column.flex-1.min-h-0.min-w-0.no-wrap
  PageTabs(
    v-if="issue"
    :tabs="issueTabs"
    :active-key="activeTabKey"
  )
    template(#actions)
      BaseButton(
        v-if="activeTabKey === 'component-issue-requirements' && canCreateRequirement"
        variant="primary"
        size="sm"
        aria-label="Создать артефакт"
        @click="openCreateRequirementDialog"
      )
        template(#icon-left)
          q-icon(name="add", size="18px")
        | Артефакт

  .issue-page-skeleton(v-if="!issue")
    .issue-page-skeleton__side(v-if="showSidebar")
      .skel(v-for="i in 4", :key="i")
    .issue-page-skeleton__main
      .skel.skel--title
      .skel.skel--text(v-for="i in 3", :key="i")

  .page-surface.column.col.flex-1.min-h-0.min-w-0(
    v-else-if="isMobileLayout"
  )
    .q-px-md.q-pb-sm(v-if="showSidebar")
      IssueTitleEditor(
        :issue="issue"
        @field-change="handleFieldChange"
        @update:title="handleTitleUpdate"
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
    div.col.flex-1.min-h-0.min-w-0.column.overflow-hidden.relative-position
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
import { useBackButton } from 'src/shared/lib/navigation'
import { PageTabs } from 'src/shared/ui/layout'
import { BaseButton } from 'src/shared/ui/base'
import { toMarkdown } from 'src/shared/lib/utils'
import { useUpdateIssue } from 'app/extensions/capital/features/Issue/UpdateIssue'
import { IssueSidebarWidget } from 'app/extensions/capital/widgets'
import { IssueTitleEditor } from 'app/extensions/capital/widgets/IssueTitleEditor'
import { ProjectPathWidget } from 'app/extensions/capital/widgets/ProjectPathWidget'
import { CreateRequirementWithEditorDialog } from 'app/extensions/capital/features/Story/CreateStory'
import type { IGetStoriesInput } from 'app/extensions/capital/entities/Story/model'
import { ISSUE_PAGE_KEY } from '../model/context'

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
const projectHash = computed(() => {
  const fromRoute = route.params.project_hash as string
  if (fromRoute && fromRoute !== 'free') return fromRoute
  return issue.value?.project_hash || fromRoute || ''
})
const isFreeIssue = computed(
  () =>
    !issue.value?.project_hash ||
    (route.params.project_hash as string) === 'free',
)

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
  if (name === 'component-issue' || name === 'component-issue-redirect') {
    return 'component-issue-description'
  }
  return name
})

const showSidebar = computed(() => activeTabKey.value === 'component-issue-description')

const issueTabs = computed(() => {
  const params = {
    project_hash: projectHash.value,
    issue_hash: issueHash.value,
  }
  const currentBackRoute = route.query._backRoute as string
  const query = currentBackRoute ? { _backRoute: currentBackRoute } : {}

  return [
    { key: 'component-issue-description', label: 'Описание', route: { name: 'component-issue-description', params, query } },
    { key: 'component-issue-requirements', label: 'Артефакты', route: { name: 'component-issue-requirements', params, query } },
    { key: 'component-issue-commits', label: 'Коммиты', route: { name: 'component-issue-commits', params, query } },
    { key: 'component-issue-history', label: 'История', route: { name: 'component-issue-history', params, query } },
  ]
})

const parentProjectHash = computed(() => {
  const p = parentProject.value?.parent_hash?.trim()
  if (!p || p === EMPTY_HASH) return null
  return p
})

const routeIssueKey = computed(
  () => `${String(route.params.issue_hash)}:${String(route.params.project_hash)}`,
)

const ensureMarkdownFormat = (description: unknown) => {
  if (!description) return ''
  return toMarkdown(description)
}

const loadParentInfo = async () => {
  if (isFreeIssue.value || !projectHash.value || projectHash.value === 'free') {
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

const handleTitleUpdate = async (value: string) => {
  if (!issue.value) return
  issue.value.title = value
  try {
    await debounceSave({ issue_hash: issue.value.issue_hash, title: value }, projectHash.value)
    logsRefreshTrigger.value++
  } catch (error) {
    console.error('Failed to update title:', error)
  }
}

const handleDescriptionChange = async () => {
  if (!issue.value) return
  try {
    await debounceSave(
      { issue_hash: issue.value.issue_hash, description: issue.value.description },
      projectHash.value,
    )
    logsRefreshTrigger.value++
  } catch (error) {
    console.error('Failed to update description:', error)
  }
}

useBackButton({
  text: 'Назад',
  componentId: 'issue-page-' + issueHash.value,
  onClick: () => {
    const backRoute = route.query._backRoute as string
    if (backRoute) {
      const storedRoute = sessionStorage.getItem(backRoute)
      if (storedRoute) {
        try {
          const routeData = JSON.parse(storedRoute)
          router.push({
            name: routeData.name,
            params: routeData.params,
            query: routeData.query,
          })
          sessionStorage.removeItem(backRoute)
          return
        } catch (error) {
          console.warn('Failed to parse stored route:', error)
        }
      }
      router.push({ name: backRoute })
    } else {
      router.back()
    }
  },
})

const loadIssue = async () => {
  try {
    const issueData = await IssueApi.loadIssue({ issue_hash: issueHash.value })
    issue.value = issueData || null
    if (issue.value?.description) {
      issue.value.description = ensureMarkdownFormat(issue.value.description)
    }
  } catch (error) {
    console.error('Ошибка при загрузке задачи:', error)
    FailAlert('Не удалось загрузить задачу')
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
  if (isFreeIssue.value) {
    router.push({ name: 'capital-my-tasks', params: { coopname } })
    return
  }
  router.push({
    name: 'component-tasks',
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
    name: 'component-issue-description',
    params: {
      coopname,
      project_hash: toProjectHash,
      issue_hash: updatedIssue.issue_hash,
    },
    query: { ...route.query },
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
})

watch(routeIssueKey, async (_key, prev) => {
  if (prev === undefined) return
  await loadIssue()
  await loadParentInfo()
})

// Дефолт: пустой/родительский маршрут → вкладка «Описание»
watch(
  () => route.name,
  (name) => {
    if (name === 'component-issue' || name === 'component-issue-redirect') {
      void router.replace({
        name: 'component-issue-description',
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
// Оболочка заполняет вьюпорт под топбаром — единая высота surface на всех вкладках
.issue-page-shell {
  height: calc(100vh - var(--p-topbar-h));
  max-height: calc(100vh - var(--p-topbar-h));
  overflow: hidden;
}

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

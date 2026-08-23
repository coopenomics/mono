<template lang="pug">
div(
  :class="compactMobile ? 'capital-sidebar-mobile-compact q-px-md q-pb-sm' : 'capital-sidebar-root-desktop q-pa-md column no-wrap min-w-0 w-full'"
)

  //- Мобильный: управление видно сразу, без тоггла «Подробнее» — скрытая
  //- за кнопкой форма ломала прокрутку и читалась как пустая страница
  template(v-if="compactMobile")
    ProjectControls(:project='project').full-width.q-mt-xs
    DeleteProjectSidebarButton(
      v-if='project'
      :coopname='project.coopname'
      :project-hash='project.project_hash'
      :can-delete='project.permissions?.can_delete_project ?? false'
      entity-label='проект'
      @deleted='emit("project-deleted")'
    )

  template(v-else)
    ProjectControls(:project='project').full-width

    .capital-sidebar-delete-footer.q-pt-md(
      v-if="project?.permissions?.can_delete_project"
    )
      DeleteProjectSidebarButton(
        :coopname='project.coopname'
        :project-hash='project.project_hash'
        :can-delete='true'
        entity-label='проект'
        @deleted='emit("project-deleted")'
      )
</template>

<script lang="ts" setup>
import type { IProject } from 'app/extensions/capital/entities/Project/model'
import { ProjectControls } from 'app/extensions/capital/widgets/ProjectControls'
import { DeleteProjectSidebarButton } from 'app/extensions/capital/features/Project/DeleteProject'

interface Props {
  project: IProject | null | undefined
  /** Мобильный layout: компактные отступы, удаление по правам без футера */
  compactMobile?: boolean
}

withDefaults(defineProps<Props>(), {
  compactMobile: false,
})

const emit = defineEmits<{
  'project-deleted': []
}>()
</script>

<style lang="scss" scoped>
.capital-sidebar-root-desktop {
  flex-shrink: 0;
}

.capital-sidebar-delete-footer {
  flex-shrink: 0;
  border-top: 1px solid var(--p-line);

  :deep(.q-btn) {
    margin-top: 0;
  }
}

.capital-sidebar-mobile-compact {
  padding-top: 0;
}
</style>

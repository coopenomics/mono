<template lang="pug">
div
  template(v-if='project && project.origin !== "local"')
    UpdateStatus(
      :project='project'
      label='Статус'
    ).q-mb-sm.full-width
    SetMasterButton(
      :project='project'
      dense
      flat
      :multiSelect='false'
      placeholder=''
    ).q-mb-sm.full-width

  UpdateProjectVideo(v-if="project" :project="project")
  SetDevelopmentRepositoryUrl(v-if="project" :project="project")

  //- Приём инвестиций в компонент напрямую временно скрыт
  //- OpenCloseToggle(v-if='project && project.parent_hash !== EMPTY_HASH' :project='project').full-width
</template>

<script setup lang="ts">
import type { IProject } from 'app/extensions/capital/entities/Project/model'
import { UpdateStatus } from '../../features/Project/UpdateProjectStatus'
import { SetMasterButton } from '../../features/Project/SetMaster'
import { UpdateProjectVideo } from '../../features/Project/UpdateProjectVideo'
import { SetDevelopmentRepositoryUrl } from '../../features/Project/SetDevelopmentRepository'

interface Props {
  project: IProject | null | undefined
}

defineProps<Props>()
</script>
